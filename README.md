# local-server-hub

MCP server for local development ports. It lists listening dev servers and leases free ports so parallel agents and worktrees do not collide.

The server does not stop processes.

## Tools

| Tool | Purpose |
|---|---|
| `list_servers` | TCP listeners for the current user: port, pid, command, project directory, stack, URL, HTTP status |
| `get_port_info` | One port, including its reservation |
| `find_free_port` | A port that is not listening, not reserved, and can be bound |
| `suggest_port` | Framework default, or the next free port |
| `reserve_port` | Lease a port for a project or worktree (default 8 hours, maximum 7 days) |
| `release_port` | Drop a lease |
| `list_reservations` | Active leases |

Leases are stored in `~/.local-server-hub/reservations.json`. Override the directory with `LOCAL_SERVER_HUB_DIR`.

Recognized stacks: Vite, Next, Nuxt, Astro, Angular, webpack, Remix, Django, Flask, FastAPI, Rails, PHP, Go, Spring, .NET, Rust, Node, and Docker port mappings.

On macOS, ports 5000 and 7000 carry a warning because AirPlay Receiver often binds them.

If `lsof` (macOS), `ss` (Linux), or `netstat` (Windows) is missing, the server probes the framework default ports instead. A missing `docker` binary skips container mappings and returns a warning.

## Install

Requires Node.js 20 or newer.

Claude Code:

```bash
claude mcp add local-server-hub -- npx -y github:wieschollek/local-server-hub
```

Cursor `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "local-server-hub": {
      "command": "npx",
      "args": ["-y", "github:wieschollek/local-server-hub"]
    }
  }
}
```

The published `dist/` is what `npx` runs. From a checkout:

```bash
npm ci
npm test
npm run build
node dist/index.js
```

## Development

```bash
npm test
npm run build
```

GitHub Actions runs the tests on Ubuntu, macOS, and Windows.
