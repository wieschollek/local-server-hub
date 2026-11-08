import { dedupeListeners, splitHostPort } from "../address.js";
export function parseLsof(text) {
    const listeners = [];
    for (const line of text.split(/\r?\n/)) {
        const addressMatch = line.match(/\bTCP\s+(\S+)\s+\(LISTEN\)/);
        if (!addressMatch) {
            continue;
        }
        const hostPort = splitHostPort(addressMatch[1]);
        if (!hostPort) {
            continue;
        }
        const pidMatch = line.match(/^\S+\s+(\d+)\s+/);
        listeners.push({
            address: hostPort.address,
            port: hostPort.port,
            pid: pidMatch ? Number(pidMatch[1]) : null,
        });
    }
    return dedupeListeners(listeners);
}
export function parseSs(text) {
    const listeners = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("LISTEN")) {
            continue;
        }
        const parts = trimmed.split(/\s+/);
        if (parts.length < 5) {
            continue;
        }
        const hostPort = splitHostPort(parts[3]);
        if (!hostPort) {
            continue;
        }
        const pidMatch = line.match(/pid=(\d+)/);
        listeners.push({
            address: hostPort.address,
            port: hostPort.port,
            pid: pidMatch ? Number(pidMatch[1]) : null,
        });
    }
    return dedupeListeners(listeners);
}
export function parseNetstatWindows(text) {
    const listeners = [];
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
        if (!match) {
            continue;
        }
        const hostPort = splitHostPort(match[1]);
        if (!hostPort) {
            continue;
        }
        listeners.push({
            address: hostPort.address,
            port: hostPort.port,
            pid: Number(match[2]),
        });
    }
    return dedupeListeners(listeners);
}
export function parseDockerPs(text) {
    const listeners = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const [id, name, ports, cwd] = line.split("\t");
        if (!ports) {
            continue;
        }
        const seen = new Set();
        for (const match of ports.matchAll(/(?:^|,\s*)(\S+):(\d+)->/g)) {
            const port = Number(match[2]);
            if (!Number.isInteger(port) || seen.has(port)) {
                continue;
            }
            const hostPort = splitHostPort(`${match[1]}:${port}`);
            if (!hostPort) {
                continue;
            }
            seen.add(port);
            listeners.push({
                address: hostPort.address,
                port,
                pid: null,
                command: `docker ${name || id || "container"}`,
                cwd: cwd?.trim() ? cwd.trim() : null,
                stack: "docker",
            });
        }
    }
    return listeners;
}
//# sourceMappingURL=parse.js.map