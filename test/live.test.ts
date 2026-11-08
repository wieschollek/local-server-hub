import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { listServers } from "../src/hub.js";
import { ReservationStore } from "../src/registry/store.js";
import { createHubDeps } from "../src/runtime.js";

describe("live scan", () => {
  test("finds an HTTP server started by this process", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lsh-live-"));
    const httpServer = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<title>local-server-hub</title>");
    });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      const result = await listServers(
        { probe: false },
        createHubDeps({ store: new ReservationStore(directory) }),
      );
      const missingTool = result.warnings.some((warning) => warning.includes("not installed"));
      if (missingTool) {
        return;
      }
      expect(result.servers.some((server) => server.port === port)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
