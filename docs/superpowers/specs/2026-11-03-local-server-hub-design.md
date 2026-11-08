# local-server-hub design

Date: 2026-11-03
Status: approved for implementation on 2026-11-08 by the YOLO continuation of the design session.

## Goal

One TypeScript MCP server discovers local dev servers and leases free ports. The public repository is `wieschollek/local-server-hub`, MIT license. It runs over stdio and is started with `npx github:wieschollek/local-server-hub`.

## Decisions

- Discover and allocate. One implementation recognizes many stacks.
- Scanner: `lsof` on macOS, `ss` on Linux, `netstat -ano` on Windows.
- Missing scanner: probe the framework default ports and return a warning.
- Process details: command, working directory, and user. The default list contains only the current user's processes.
- Stack detection uses the command line first, then project files in the working directory.
- Docker published ports come from `docker ps` when Docker is installed.
- HTTP probe uses HEAD, then GET when the server rejects HEAD. The result stores status, title, and URL.
- Reservations live in `~/.local-server-hub/reservations.json` (`LOCAL_SERVER_HUB_DIR` overrides it). Writes are locked and atomic. The default lease is 8 hours and the maximum is 7 days.
- A free port must not be listening, must not be reserved, and must bind on IPv4. IPv6 must bind or be unsupported.
- macOS ports 5000 and 7000 produce an AirPlay warning.
- No tool stops a process.

## Tools

`list_servers`, `get_port_info`, `find_free_port`, `reserve_port`, `release_port`, `list_reservations`, `suggest_port`.

## Tests

Parser fixtures for `lsof`, `ss`, `netstat`, and `docker ps`. Stack detection. Reservation conflicts and expiry. Free-port selection. An in-memory MCP client. A live scan that finds an HTTP server started by the test process.
