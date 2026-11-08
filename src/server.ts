import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findFreePort, getPortInfo, listServers, suggestPort } from "./hub.js";
import { createHubDeps } from "./runtime.js";
import { ReservationStore } from "./registry/store.js";
import type { HubDeps } from "./types.js";

const portSchema = z.number().int().min(1).max(65535);
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function createServer(overrides: Partial<HubDeps> = {}): McpServer {
  const deps = createHubDeps(overrides);
  const server = new McpServer({ name: "local-server-hub", version: "0.1.0" });

  server.registerTool(
    "list_servers",
    {
      description: "List TCP listeners owned by the current user, with process, project directory, stack, URL, and HTTP status.",
      inputSchema: {
        probe: z.boolean().optional().describe("Send an HTTP request to each listener. Default true."),
        includeOthers: z.boolean().optional().describe("Include listeners owned by other users. Default false."),
      },
      annotations: readOnly,
    },
    async (args) => respond(() => listServers(args, deps)),
  );

  server.registerTool(
    "get_port_info",
    {
      description: "Return listeners, reservation, HTTP probe, and platform warnings for one port.",
      inputSchema: {
        port: portSchema,
        probe: z.boolean().optional().describe("Send an HTTP request. Default true."),
      },
      annotations: readOnly,
    },
    async (args) => respond(() => getPortInfo(args.port, args, deps)),
  );

  server.registerTool(
    "find_free_port",
    {
      description: "Return a port that is not listening, not reserved, and can be bound on IPv4 and IPv6.",
      inputSchema: {
        preferred: portSchema.optional().describe("First port to try."),
        framework: z.string().min(1).max(64).optional().describe("Framework whose default port is tried first."),
        from: portSchema.optional(),
        to: portSchema.optional(),
      },
      annotations: readOnly,
    },
    async (args) => respond(() => findFreePort(args, deps)),
  );

  server.registerTool(
    "reserve_port",
    {
      description: "Lease a port for a project or worktree so parallel agents do not collide. Default lease is 8 hours.",
      inputSchema: {
        port: portSchema,
        project: z.string().min(1).max(256),
        worktree: z.string().max(512).optional(),
        note: z.string().max(512).optional(),
        ttlMinutes: z.number().int().min(1).max(10080).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => respond(() => deps.store.reserve(args)),
  );

  server.registerTool(
    "release_port",
    {
      description: "Release a port reservation. This does not stop a process.",
      inputSchema: { port: portSchema },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => respond(async () => ({ released: await deps.store.release(args.port) })),
  );

  server.registerTool(
    "list_reservations",
    {
      description: "List port reservations that have not expired.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => respond(() => deps.store.list().then((reservations) => ({ reservations }))),
  );

  server.registerTool(
    "suggest_port",
    {
      description: "Return the framework default port when it is free, otherwise the next free port.",
      inputSchema: {
        framework: z.string().min(1).max(64),
      },
      annotations: readOnly,
    },
    async (args) => respond(() => suggestPort(args.framework, deps)),
  );

  return server;
}

export function storeFromDir(directory: string): ReservationStore {
  return new ReservationStore(directory);
}

async function respond(fn: () => Promise<unknown>) {
  try {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
    };
  }
}
