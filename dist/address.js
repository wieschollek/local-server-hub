export function splitHostPort(token) {
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
export function loopbackHost(address) {
    if (address === "" || address === "*" || address === "0.0.0.0" || address === "::" || address === ":::") {
        return "127.0.0.1";
    }
    return address;
}
export function httpUrl(address, port) {
    const host = loopbackHost(address);
    const formatted = host.includes(":") ? `[${host}]` : host;
    return `http://${formatted}:${port}/`;
}
export function dedupeListeners(listeners) {
    const seen = new Set();
    const result = [];
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
export function portWarnings(port, platform) {
    if (platform === "darwin" && (port === 5000 || port === 7000)) {
        return ["macOS AirPlay Receiver often binds 5000 and 7000."];
    }
    return [];
}
//# sourceMappingURL=address.js.map