import { execFile } from "node:child_process";
import { readFileSync, readlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import type { CommandResult, CommandRunner, ProcessInfo, ProcessInspector } from "../types.js";

export function execFileRunner(command: string, args: string[], timeoutMs = 8_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 8_000_000, windowsHide: true },
      (error, stdout, stderr) => {
        const errno = error as NodeJS.ErrnoException | null;
        const missing = errno?.code === "ENOENT";
        const exitCode = typeof errno?.code === "number" ? errno.code : error ? 1 : 0;
        resolve({
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
          code: missing ? 127 : exitCode,
          missing,
        });
      },
    );
  });
}

export function defaultStoreDir(): string {
  return process.env.LOCAL_SERVER_HUB_DIR || path.join(homedir(), ".local-server-hub");
}

export function createProcessInspector(runner: CommandRunner, platform: NodeJS.Platform): ProcessInspector {
  return {
    currentUser(): string {
      return process.env.USER || process.env.USERNAME || "";
    },
    async inspect(pid: number): Promise<ProcessInfo> {
      if (!Number.isInteger(pid) || pid <= 0) {
        return { pid, user: null, command: null, cwd: null };
      }
      if (platform === "linux") {
        return inspectLinux(pid, runner);
      }
      if (platform === "win32") {
        return inspectWindows(pid, runner);
      }
      return inspectDarwin(pid, runner);
    },
  };
}

async function inspectLinux(pid: number, runner: CommandRunner): Promise<ProcessInfo> {
  const command = readProc(pid, "cmdline")?.replace(/\0/g, " ").trim() || null;
  let cwd: string | null = null;
  try {
    cwd = readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    cwd = null;
  }
  const ps = await runner("ps", ["-p", String(pid), "-o", "user="]);
  return { pid, user: ps.stdout.trim() || null, command, cwd };
}

async function inspectDarwin(pid: number, runner: CommandRunner): Promise<ProcessInfo> {
  const ps = await runner("ps", ["-p", String(pid), "-o", "user=,command="]);
  const line = ps.stdout.trim();
  const splitAt = line.indexOf(" ");
  const user = splitAt === -1 ? line || null : line.slice(0, splitAt);
  const command = splitAt === -1 ? null : line.slice(splitAt + 1).trim() || null;
  const lsof = await runner("lsof", ["-a", "-nP", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const cwdLine = lsof.stdout.split(/\r?\n/).find((entry) => entry.startsWith("n") && entry !== "n");
  return { pid, user, command, cwd: cwdLine ? cwdLine.slice(1) : null };
}

async function inspectWindows(pid: number, runner: CommandRunner): Promise<ProcessInfo> {
  const script = `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -First 1 CommandLine).CommandLine`;
  const result = await runner("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  const command = result.stdout.trim() || null;
  return { pid, user: process.env.USERNAME ?? null, command, cwd: null };
}

function readProc(pid: number, name: string): string | null {
  try {
    return readFileSync(`/proc/${pid}/${name}`, "utf8");
  } catch {
    return null;
  }
}

export function readProjectFiles(cwd: string | null): Record<string, string> {
  if (!cwd) {
    return {};
  }
  const names = [
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "manage.py",
    "Gemfile",
    "composer.json",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "Cargo.toml",
    "artisan",
  ];
  const files: Record<string, string> = {};
  for (const name of names) {
    try {
      const buffer = readFileSync(path.join(cwd, name));
      files[name] = buffer.subarray(0, 65_536).toString("utf8");
    } catch {
      continue;
    }
  }
  try {
    const csproj = readdirSync(cwd).find((entry) => entry.endsWith(".csproj"));
    if (csproj) {
      files[csproj] = "csproj";
    }
  } catch {
    return files;
  }
  return files;
}
