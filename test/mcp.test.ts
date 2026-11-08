import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ReservationStore } from "../src/registry/store.js";
import { createServer } from "../src/server.js";
import type { CommandResult } from "../src/types.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function text(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const block = result.content.find((item) => item.type === "text");
  return JSON.parse(block?.text ?? "{}");
}

describe("MCP server", () => {
  test("lists tools and reserves a discovered port", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lsh-mcp-"));
    directories.push(directory);
    const empty: CommandResult = { stdout: "", stderr: "", code: 0, missing: false };
    const server = createServer({
      platform: "darwin",
      store: new ReservationStore(directory),
      runner: async (command) => {
        if (command === "lsof") {
          return {
            stdout: "node 20 martin 1u IPv4 0x1 0t0 TCP 127.0.0.1:5173 (LISTEN)\n",
            stderr: "",
            code: 0,
            missing: false,
          };
        }
        return empty;
      },
      inspector: {
        currentUser: () => "martin",
        inspect: async (pid) => ({ pid, user: "martin", command: "vite", cwd: "/work/app" }),
      },
      probe: async () => ({ url: "http://127.0.0.1:5173/", ok: true, status: 200, title: "Vite", error: null }),
      readProjectFiles: () => ({}),
      canBind: async () => "ok",
      isListening: async () => false,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "find_free_port",
      "get_port_info",
      "list_reservations",
      "list_servers",
      "release_port",
      "reserve_port",
      "suggest_port",
    ]);
    const listed = await client.callTool({ name: "list_servers", arguments: { probe: true } });
    expect(text(listed)).toMatchObject({ servers: [{ port: 5173, stack: "vite", title: "Vite" }] });
    const reserved = await client.callTool({
      name: "reserve_port",
      arguments: { port: 4242, project: "app", ttlMinutes: 15 },
    });
    expect(text(reserved)).toMatchObject({ port: 4242, project: "app" });
    const released = await client.callTool({ name: "release_port", arguments: { port: 4242 } });
    expect(text(released)).toEqual({ released: true });
    await client.close();
    await server.close();
  });
});
