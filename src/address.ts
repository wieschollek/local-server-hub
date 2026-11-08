export function splitHostPort(token: string): { address: string; port: number } | null {
  const match = token.match(/^(.*):(\d+)$/);
  if (!match) {
    return null;
  }
  let address = match[1];
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.slice(1, -1);
  }
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return { address, port };
}

export function loopbackHost(address: string): string {
  if (address === "" || address === "*" || address === "0.0.0.0" || address === "::" || address === ":::") {
    return "127.0.0.1";
  }
  return address;
}

export function httpUrl(address: string, port: number): string {
  const host = loopbackHost(address);
  const formatted = host.includes(":") ? `[${host}]` : host;
  return `http://${formatted}:${port}/`;
}

export function dedupeListeners<T extends { address: string; port: number; pid: number | null }>(listeners: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const listener of listeners) {
    const key = `${listener.address}|${listener.port}|${listener.pid ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(listener);
  }
  return result;
}

export function portWarnings(port: number, platform: NodeJS.Platform): string[] {
  if (platform === "darwin" && (port === 5000 || port === 7000)) {
    return ["macOS AirPlay Receiver often binds 5000 and 7000."];
  }
  return [];
}
