# local-server-hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stdio MCP server that lists local dev listeners and leases free ports, then publish `wieschollek/local-server-hub`.

**Architecture:** Pure parsers turn `lsof`, `ss`, `netstat`, and `docker ps` text into listeners. A hub enriches them with process info, stack detection, HTTP probes, and the reservation file. `McpServer` exposes that hub over stdio.

**Tech Stack:** Node.js 20, TypeScript, `@modelcontextprotocol/sdk` 1.32.2, Zod 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-local-server-hub-design.md`

## Global Constraints

- Public repo `wieschollek/local-server-hub`, MIT license.
- One TypeScript implementation. It detects Node, Python, Ruby, PHP, Go, Java, .NET, Rust, and Docker.
- Default list is the current user's listeners.
- No tool kills a process.
- Reservation file mode is private to the user. Default TTL is 8 hours. Maximum TTL is 7 days.
- macOS warning text: `macOS AirPlay Receiver often binds 5000 and 7000.`
- Node.js `>=20`.

---

### Task 1: Parsers and stack detection

**Files:**
- Create: `src/scanner/parse.ts`
- Create: `src/detect/stack.ts`
- Test: `test/parse.test.ts`
- Test: `test/stack.test.ts`

**Interfaces:**
- Produces: `parseLsof(text)`, `parseSs(text)`, `parseNetstatWindows(text)`, `parseDockerPs(text)` return `{ address, port, pid }[]`.
- Produces: `detectStack(command, files)` returns a framework id or `unknown`.

- [x] Write parser fixtures and stack cases.
- [x] Run `npx vitest run test/parse.test.ts test/stack.test.ts` and confirm the failure is missing modules.
- [x] Implement the parsers and `detectStack`.
- [x] Re-run the same tests and confirm they pass.

### Task 2: Reservations and free ports

**Files:**
- Create: `src/registry/store.ts`
- Create: `src/ports/bind.ts`
- Create: `src/hub.ts`
- Test: `test/registry.test.ts`
- Test: `test/hub.test.ts`

**Interfaces:**
- Produces: `ReservationStore.reserve({ port, project, worktree?, note?, ttlMinutes? })`.
- Produces: `findFreePort({ preferred?, framework?, from?, to? }, deps)`.
- Produces: `suggestPort(framework, deps)` with `usedDefault`.
- Consumes: parser and `detectStack` results.

- [x] Write reservation, conflict, expiry, and free-port tests.
- [x] Run `npx vitest run test/registry.test.ts test/hub.test.ts` and confirm failure.
- [x] Implement the store, bind check, and hub.
- [x] Re-run those tests and confirm they pass.

### Task 3: MCP server and live scan

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`
- Create: `src/runtime.ts`
- Test: `test/mcp.test.ts`
- Test: `test/live.test.ts`

**Interfaces:**
- Consumes: `listServers`, `getPortInfo`, `findFreePort`, `suggestPort`, `ReservationStore`.
- Produces: tools `list_servers`, `get_port_info`, `find_free_port`, `reserve_port`, `release_port`, `list_reservations`, `suggest_port`.

- [x] Write the in-memory client test and the live HTTP scan.
- [x] Run `npx vitest run test/mcp.test.ts test/live.test.ts`.
- [x] Implement `createServer` and the stdio entrypoint.
- [x] Re-run `npm test` and confirm every test passes.

### Task 4: Publish

**Files:**
- Create: `README.md`, `LICENSE`, `.github/workflows/ci.yml`
- Modify: `package.json`

- [x] Build `dist/` and confirm `git diff --exit-code -- dist` is clean after the build.
- [x] Create the public GitHub repository and push `main`.
