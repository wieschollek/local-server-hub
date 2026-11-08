import { httpUrl, portWarnings } from "./address.js";
import { defaultProbePorts, frameworkDefault, KNOWN_FRAMEWORKS } from "./defaults.js";
import { detectStack } from "./detect/stack.js";
import { portIsFree } from "./ports/bind.js";
import { parseDockerPs, parseLsof, parseNetstatWindows, parseSs } from "./scanner/parse.js";
import type { HubDeps, Listener, Reservation, ServerRecord } from "./types.js";

export interface ListServersResult {
  servers: ServerRecord[];
  warnings: string[];
}

export interface PortInfoResult {
  port: number;
  listening: boolean;
  servers: ServerRecord[];
  reservation: Reservation | null;
  warnings: string[];
}

export interface FreePortResult {
  port: number;
  framework: string | null;
  defaultPort: number | null;
  warnings: string[];
}

const SEARCH_SPAN = 200;

export async function listServers(
  options: { probe?: boolean; includeOthers?: boolean },
  deps: HubDeps,
): Promise<ListServersResult> {
  const warnings: string[] = [];
  const scanned = await scanOwnListeners(deps, warnings, options.includeOthers === true);
  const reservations = await deps.store.list();
  const byPort = indexReservations(reservations);
  const probe = options.probe !== false;
  const servers = await mapPool(scanned, 8, (listener) => toRecord(listener, byPort, deps, probe));
  servers.sort((a, b) => a.port - b.port || a.address.localeCompare(b.address));
  return { servers, warnings };
}

export async function getPortInfo(
  port: number,
  options: { probe?: boolean },
  deps: HubDeps,
): Promise<PortInfoResult> {
  const warnings: string[] = [];
  const listeners = (await scanOwnListeners(deps, warnings, true)).filter((listener) => listener.port === port);
  const reservations = await deps.store.list();
  const servers = await mapPool(listeners, 4, (listener) =>
    toRecord(listener, indexReservations(reservations), deps, options.probe !== false),
  );
  return {
    port,
    listening: servers.length > 0,
    servers,
    reservation: reservations.find((item) => item.port === port) ?? null,
    warnings: [...new Set([...warnings, ...portWarnings(port, deps.platform)])],
  };
}

export async function findFreePort(
  input: { preferred?: number; framework?: string; from?: number; to?: number },
  deps: HubDeps,
): Promise<FreePortResult> {
  const framework = normalizeFramework(input.framework);
  const defaultPort = framework ? requiredDefault(framework) : null;
  const start = input.preferred ?? defaultPort ?? input.from ?? 3000;
  const from = input.from ?? start;
  const to = input.to ?? Math.min(65535, from + SEARCH_SPAN - 1);
  if (from > to || from < 1 || to > 65535 || to - from > 499) {
    throw new Error("Port search range is invalid. The range can cover at most 500 ports.");
  }
  const busy = await busyPorts(deps);
  const warnings = portWarnings(start, deps.platform);
  const first = Math.max(from, Math.min(start, to));
  const candidates = [first, ...range(from, to).filter((port) => port !== first)];
  for (const port of candidates) {
    if (busy.has(port)) {
      continue;
    }
    if (await portIsFree(port, deps.canBind)) {
      return {
        port,
        framework,
        defaultPort,
        warnings: [...new Set([...warnings, ...portWarnings(port, deps.platform)])],
      };
    }
  }
  throw new Error(`No free port between ${from} and ${to}.`);
}

export async function suggestPort(frameworkInput: string, deps: HubDeps): Promise<FreePortResult & { usedDefault: boolean }> {
  const framework = requiredFramework(frameworkInput);
  const defaultPort = requiredDefault(framework);
  const busy = await busyPorts(deps);
  const warnings = portWarnings(defaultPort, deps.platform);
  if (!busy.has(defaultPort) && (await portIsFree(defaultPort, deps.canBind))) {
    return { port: defaultPort, framework, defaultPort, usedDefault: true, warnings };
  }
  const next = await findFreePort({ framework, from: defaultPort + 1, to: Math.min(65535, defaultPort + SEARCH_SPAN) }, deps);
  return { ...next, framework, defaultPort, usedDefault: false, warnings: [...new Set([...warnings, ...next.warnings])] };
}

async function scanOwnListeners(deps: HubDeps, warnings: string[], includeOthers: boolean): Promise<Listener[]> {
  const scanned = await scanListeners(deps);
  warnings.push(...scanned.warnings);
  let listeners = scanned.listeners;
  if (scanned.usedFallback) {
    listeners = await probeDefaultPorts(deps);
  }
  const docker = await deps.runner("docker", [
    "ps",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Ports}}\t{{.Label \"com.docker.compose.project.working_dir\"}}",
  ]);
  if (docker.missing) {
    warnings.push("docker is not installed; container port mappings were skipped.");
  } else if (docker.code !== 0) {
    warnings.push(`docker ps failed: ${firstLine(docker.stderr || docker.stdout)}`);
  } else {
    const mapped = parseDockerPs(docker.stdout);
    const taken = new Set(listeners.map((listener) => listener.port));
    listeners.push(...mapped.filter((listener) => !taken.has(listener.port)));
  }
  const currentUser = deps.inspector.currentUser().toLowerCase();
  const enriched = await mapPool(listeners, 6, async (listener) => enrich(listener, deps, currentUser, includeOthers));
  return enriched.filter((listener): listener is Listener => listener !== null);
}

async function enrich(
  listener: Listener,
  deps: HubDeps,
  currentUser: string,
  includeOthers: boolean,
): Promise<Listener | null> {
  if (listener.stack === "docker" || listener.pid === null) {
    return listener;
  }
  const info = await deps.inspector.inspect(listener.pid);
  if (!includeOthers && currentUser && info.user && info.user.toLowerCase() !== currentUser) {
    return null;
  }
  const command = info.command ?? listener.command ?? null;
  const cwd = info.cwd ?? listener.cwd ?? null;
  const stack = listener.stack ?? detectStack(command, deps.readProjectFiles(cwd));
  return { ...listener, user: info.user, command, cwd, stack };
}

async function toRecord(
  listener: Listener,
  reservations: Map<number, Reservation>,
  deps: HubDeps,
  probe: boolean,
): Promise<ServerRecord> {
  const stack = listener.stack ?? "unknown";
  const warnings = portWarnings(listener.port, deps.platform);
  let httpStatus: number | null = null;
  let title: string | null = null;
  const url = httpUrl(listener.address, listener.port);
  if (probe) {
    const result = await deps.probe(listener.port, listener.address);
    httpStatus = result.status;
    title = result.title;
  }
  return {
    port: listener.port,
    address: listener.address,
    pid: listener.pid,
    user: listener.user ?? null,
    command: listener.command ?? null,
    cwd: listener.cwd ?? null,
    stack,
    url,
    httpStatus,
    title,
    reservation: reservations.get(listener.port) ?? null,
    warnings,
  };
}

async function scanListeners(deps: HubDeps): Promise<{ listeners: Listener[]; warnings: string[]; usedFallback: boolean }> {
  if (deps.platform === "darwin") {
    const result = await deps.runner("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"]);
    if (result.missing) {
      return { listeners: [], warnings: ["lsof is not installed; falling back to probing framework default ports."], usedFallback: true };
    }
    return { listeners: parseLsof(result.stdout), warnings: [], usedFallback: false };
  }
  if (deps.platform === "linux") {
    const result = await deps.runner("ss", ["-H", "-ltnp"]);
    if (result.missing) {
      return { listeners: [], warnings: ["ss is not installed; falling back to probing framework default ports."], usedFallback: true };
    }
    return { listeners: parseSs(result.stdout), warnings: [], usedFallback: false };
  }
  if (deps.platform === "win32") {
    const result = await deps.runner("netstat", ["-ano"]);
    if (result.missing) {
      return { listeners: [], warnings: ["netstat is not installed; falling back to probing framework default ports."], usedFallback: true };
    }
    return { listeners: parseNetstatWindows(result.stdout), warnings: [], usedFallback: false };
  }
  return {
    listeners: [],
    warnings: [`Unsupported platform ${deps.platform}; falling back to probing framework default ports.`],
    usedFallback: true,
  };
}

async function probeDefaultPorts(deps: HubDeps): Promise<Listener[]> {
  const ports = defaultProbePorts();
  const open = await mapPool(ports, 8, async (port) => {
    const listening = await deps.isListening(port, "127.0.0.1");
    if (!listening) {
      return null;
    }
    const listener: Listener = { port, address: "127.0.0.1", pid: null };
    return listener;
  });
  return open.filter((listener): listener is Listener => listener !== null);
}

async function busyPorts(deps: HubDeps): Promise<Set<number>> {
  const warnings: string[] = [];
  const listeners = await scanOwnListeners(deps, warnings, true);
  const reserved = await deps.store.list();
  return new Set([...listeners.map((listener) => listener.port), ...reserved.map((item) => item.port)]);
}

function normalizeFramework(framework: string | undefined): string | null {
  if (!framework) {
    return null;
  }
  return requiredFramework(framework);
}

function requiredFramework(framework: string): string {
  const name = framework.trim().toLowerCase();
  if (!KNOWN_FRAMEWORKS.includes(name)) {
    throw new Error(`Unknown framework "${framework}". Known frameworks: ${KNOWN_FRAMEWORKS.join(", ")}.`);
  }
  return name;
}

function requiredDefault(framework: string): number {
  const port = frameworkDefault(framework);
  if (port === null) {
    throw new Error(`No default port for ${framework}.`);
  }
  return port;
}

function indexReservations(reservations: Reservation[]): Map<number, Reservation> {
  return new Map(reservations.map((reservation) => [reservation.port, reservation]));
}

function range(from: number, to: number): number[] {
  const ports: number[] = [];
  for (let port = from; port <= to; port += 1) {
    ports.push(port);
  }
  return ports;
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] || "unknown error";
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
