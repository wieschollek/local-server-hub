import net from "node:net";

export function canBind(port: number, host: string): Promise<"ok" | "busy" | "unsupported"> {
  return new Promise((resolve) => {
    const server = net.createServer();
    const finish = (result: "ok" | "busy" | "unsupported") => {
      server.removeAllListeners();
      if (server.listening) {
        server.close(() => resolve(result));
        return;
      }
      resolve(result);
    };
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL") {
        finish("unsupported");
        return;
      }
      finish("busy");
    });
    server.listen({ port, host, exclusive: true }, () => finish("ok"));
  });
}

export function isPortOpen(port: number, host = "127.0.0.1", timeoutMs = 200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function portIsFree(
  port: number,
  canBindPort: (port: number, host: string) => Promise<"ok" | "busy" | "unsupported">,
): Promise<boolean> {
  const ipv4 = await canBindPort(port, "127.0.0.1");
  if (ipv4 !== "ok") {
    return false;
  }
  const ipv6 = await canBindPort(port, "::1");
  return ipv6 === "ok" || ipv6 === "unsupported";
}
