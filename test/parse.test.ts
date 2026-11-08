import { describe, expect, test } from "vitest";
import { parseDockerPs, parseLsof, parseNetstatWindows, parseSs } from "../src/scanner/parse.js";

const LSOF = `COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345 martin   23u  IPv4 0x1a2b3c4d      0t0  TCP 127.0.0.1:5173 (LISTEN)
node    12346 martin   24u  IPv6 0xabcd          0t0  TCP *:3000 (LISTEN)
python  22222 other     5u  IPv4 0x111           0t0  TCP [::1]:8000 (LISTEN)
node    12345 martin   23u  IPv4 0x1a2b3c4d      0t0  TCP 127.0.0.1:5173 (LISTEN)
`;

describe("parseLsof", () => {
  test("reads address, port, and pid", () => {
    expect(parseLsof(LSOF)).toEqual([
      { address: "127.0.0.1", port: 5173, pid: 12345 },
      { address: "*", port: 3000, pid: 12346 },
      { address: "::1", port: 8000, pid: 22222 },
    ]);
  });
});

describe("parseSs", () => {
  test("reads listen rows and an optional pid", () => {
    const text = `LISTEN 0      128    127.0.0.1:5173      0.0.0.0:*    users:(("node",pid=12345,fd=23))
LISTEN 0      128    [::1]:3000          [::]:*       users:(("node",pid=12346,fd=24))
LISTEN 0      128    *:8000              *:*
State Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
`;
    expect(parseSs(text)).toEqual([
      { address: "127.0.0.1", port: 5173, pid: 12345 },
      { address: "::1", port: 3000, pid: 12346 },
      { address: "*", port: 8000, pid: null },
    ]);
  });
});

describe("parseNetstatWindows", () => {
  test("keeps listening TCP rows only", () => {
    const text = `Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       12345
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12346
  TCP    [::1]:8000             [::]:0                 LISTENING       22222
  UDP    0.0.0.0:5353           *:*                                    100
`;
    expect(parseNetstatWindows(text)).toEqual([
      { address: "127.0.0.1", port: 5173, pid: 12345 },
      { address: "0.0.0.0", port: 3000, pid: 12346 },
      { address: "::1", port: 8000, pid: 22222 },
    ]);
  });
});

describe("parseDockerPs", () => {
  test("reads published host ports once", () => {
    const text = "abc\tweb\t0.0.0.0:8080->80/tcp, :::8080->80/tcp, 127.0.0.1:5173->5173/tcp\t/work/web\n";
    expect(parseDockerPs(text)).toEqual([
      {
        address: "0.0.0.0",
        port: 8080,
        pid: null,
        command: "docker web",
        cwd: "/work/web",
        stack: "docker",
      },
      {
        address: "127.0.0.1",
        port: 5173,
        pid: null,
        command: "docker web",
        cwd: "/work/web",
        stack: "docker",
      },
    ]);
  });
});
