import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { findFreePort, listServers, suggestPort } from "../src/hub.js";
import { ReservationStore } from "../src/registry/store.js";
import type { CommandResult, CommandRunner, HubDeps } from "../src/types.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function command(stdout: string, missing = false): CommandResult {
  return { stdout, stderr: "", code: missing ? 127 : 0, missing };
}

async function deps(options: {
  lsof?: string;
  missingLsof?: boolean;
  user?: string;
  users?: Record<number, string>;
  files?: Record<string, string>;
  bind?: (port: number) => "ok" | "busy" | "unsupported";
  listening?: number[];
  platform?: NodeJS.Platform;
}): Promise<{ deps: HubDeps; store: ReservationStore }> {
  const directory = await mkdtemp(path.join(tmpdir(), "lsh-"));
  directories.push(directory);
  const store = new ReservationStore(directory);
  const runner: CommandRunner = async (commandName) => {
    if (commandName === "lsof") {
      return command(options.lsof ?? "", options.missingLsof);
    }
    if (commandName === "docker") {
      return command("");
    }
    return command("");
  };
  const hubDeps: HubDeps = {
    platform: options.platform ?? "darwin",
    runner,
    inspector: {
      currentUser: () => options.user ?? "martin",
      inspect: async (pid) => ({
        pid,
        user: options.users?.[pid] ?? "martin",
        command: pid === 9 ? "python -m http.server" : "node /app/node_modules/vite/bin/vite.js",
        cwd: "/work/app",
      }),
    },
    probe: async (port, address) => ({
      url: `http://127.0.0.1:${port}/`,
      ok: true,
      status: 200,
      title: address ? "App" : null,
      error: null,
    }),
    store,
    now: () => new Date("2026-11-08T10:00:00.000Z"),
    canBind: async (port) => options.bind?.(port) ?? "ok",
    isListening: async (port) => options.listening?.includes(port) ?? false,
    readProjectFiles: () => options.files ?? { "package.json": '{ "devDependencies": { "vite": "^5.0.0" } }' },
  };
  return { deps: hubDeps, store };
}

describe("listServers", () => {
  test("keeps the current user's server and warns about AirPlay", async () => {
    const { deps: hubDeps } = await deps({
      lsof: "node 20 martin 1u IPv4 0x1 0t0 TCP *:5000 (LISTEN)\nnode 21 other 1u IPv4 0x1 0t0 TCP 127.0.0.1:3000 (LISTEN)\n",
      users: { 20: "martin", 21: "other" },
    });
    const result = await listServers({ probe: true }, hubDeps);
    expect(result.servers.map((server) => server.port)).toEqual([5000]);
    expect(result.servers[0]?.stack).toBe("vite");
    expect(result.servers[0]?.user).toBe("martin");
    expect(result.servers[0]?.httpStatus).toBe(200);
    expect(result.servers[0]?.warnings).toContain("macOS AirPlay Receiver often binds 5000 and 7000.");
  });

  test("probes framework defaults when the scanner is missing", async () => {
    const { deps: hubDeps } = await deps({ missingLsof: true, listening: [5173] });
    const result = await listServers({ probe: false }, hubDeps);
    expect(result.warnings[0]).toContain("lsof is not installed");
    expect(result.servers.map((server) => server.port)).toEqual([5173]);
  });
});

describe("ports", () => {
  test("skips a listening port and a reservation", async () => {
    const { deps: hubDeps, store } = await deps({
      lsof: "node 20 martin 1u IPv4 0x1 0t0 TCP 127.0.0.1:3000 (LISTEN)\n",
    });
    await store.reserve({ port: 3001, project: "taken", ttlMinutes: 10 });
    const free = await findFreePort({ preferred: 3000, from: 3000, to: 3010 }, hubDeps);
    expect(free.port).toBe(3002);
  });

  test("suggests the framework default, then the next free port", async () => {
    const open = await deps({});
    await expect(suggestPort("vite", open.deps)).resolves.toMatchObject({ port: 5173, usedDefault: true });
    const busy = await deps({ lsof: "node 20 martin 1u IPv4 0x1 0t0 TCP 127.0.0.1:5173 (LISTEN)\n" });
    await expect(suggestPort("vite", busy.deps)).resolves.toMatchObject({ port: 5174, usedDefault: false });
    await expect(suggestPort("not-a-stack", open.deps)).rejects.toThrow(/Unknown framework/);
  });
});
