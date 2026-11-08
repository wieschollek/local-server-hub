export interface Listener {
  port: number;
  address: string;
  pid: number | null;
  user?: string | null;
  command?: string | null;
  cwd?: string | null;
  stack?: string | null;
}

export interface ProcessInfo {
  pid: number;
  user: string | null;
  command: string | null;
  cwd: string | null;
}

export interface ProbeResult {
  url: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  error: string | null;
}

export interface Reservation {
  port: number;
  project: string;
  worktree: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface ServerRecord {
  port: number;
  address: string;
  pid: number | null;
  user: string | null;
  command: string | null;
  cwd: string | null;
  stack: string;
  url: string | null;
  httpStatus: number | null;
  title: string | null;
  reservation: Reservation | null;
  warnings: string[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
  missing: boolean;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface ProcessInspector {
  currentUser(): string;
  inspect(pid: number): Promise<ProcessInfo>;
}

export interface HubDeps {
  platform: NodeJS.Platform;
  runner: CommandRunner;
  inspector: ProcessInspector;
  probe: (port: number, address: string) => Promise<ProbeResult>;
  store: {
    list(): Promise<Reservation[]>;
    reserve(input: {
      port: number;
      project: string;
      worktree?: string | null;
      note?: string | null;
      ttlMinutes?: number;
    }): Promise<Reservation>;
    release(port: number): Promise<boolean>;
  };
  now: () => Date;
  canBind: (port: number, host: string) => Promise<"ok" | "busy" | "unsupported">;
  isListening: (port: number, host: string) => Promise<boolean>;
  readProjectFiles: (cwd: string | null) => Record<string, string>;
}
