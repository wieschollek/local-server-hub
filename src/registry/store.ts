import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reservation } from "../types.js";

const FILE_NAME = "reservations.json";
const DEFAULT_TTL_MINUTES = 8 * 60;
const MAX_TTL_MINUTES = 7 * 24 * 60;

interface StoreFile {
  version: 1;
  reservations: Reservation[];
}

export class PortReservedError extends Error {
  readonly reservation: Reservation;

  constructor(reservation: Reservation) {
    super(`Port ${reservation.port} is reserved by ${reservation.project} until ${reservation.expiresAt}.`);
    this.name = "PortReservedError";
    this.reservation = reservation;
  }
}

export class ReservationStore {
  constructor(private readonly directory: string) {}

  async list(now = new Date()): Promise<Reservation[]> {
    return this.withLock(async () => {
      const file = await this.read(now);
      await this.write(file);
      return file.reservations;
    });
  }

  async reserve(input: {
    port: number;
    project: string;
    worktree?: string | null;
    note?: string | null;
    ttlMinutes?: number;
    now?: Date;
  }): Promise<Reservation> {
    const now = input.now ?? new Date();
    const ttl = clampTtl(input.ttlMinutes);
    return this.withLock(async () => {
      const file = await this.read(now);
      const project = input.project.trim();
      if (!project) {
        throw new Error("project is required.");
      }
      const worktree = blankToNull(input.worktree);
      const existing = file.reservations.find((item) => item.port === input.port);
      if (existing && (existing.project !== project || existing.worktree !== worktree)) {
        throw new PortReservedError(existing);
      }
      const reservation: Reservation = {
        port: input.port,
        project,
        worktree,
        note: blankToNull(input.note),
        createdAt: existing?.createdAt ?? now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 60_000).toISOString(),
      };
      file.reservations = [
        ...file.reservations.filter((item) => item.port !== input.port),
        reservation,
      ].sort((a, b) => a.port - b.port);
      await this.write(file);
      return reservation;
    });
  }

  async release(port: number, now = new Date()): Promise<boolean> {
    return this.withLock(async () => {
      const file = await this.read(now);
      const next = file.reservations.filter((item) => item.port !== port);
      const released = next.length !== file.reservations.length;
      file.reservations = next;
      await this.write(file);
      return released;
    });
  }

  private async read(now: Date): Promise<StoreFile> {
    let parsed: StoreFile;
    try {
      const raw = await readFile(path.join(this.directory, FILE_NAME), "utf8");
      parsed = JSON.parse(raw) as StoreFile;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { version: 1, reservations: [] };
      }
      throw new Error("reservations.json is invalid.");
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.reservations)) {
      throw new Error("reservations.json is invalid.");
    }
    const nowMs = now.getTime();
    parsed.reservations = parsed.reservations.filter((item) => Date.parse(item.expiresAt) > nowMs);
    return parsed;
  }

  private async write(file: StoreFile): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = path.join(this.directory, FILE_NAME);
    const temporary = path.join(this.directory, `${FILE_NAME}.${process.pid}.tmp`);
    await writeFile(temporary, JSON.stringify(file, null, 2), { mode: 0o600 });
    await rename(temporary, target);
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lockPath = path.join(this.directory, "reservations.lock");
    const started = Date.now();
    for (;;) {
      try {
        const handle = await open(lockPath, "wx", 0o600);
        try {
          return await fn();
        } finally {
          await handle.close();
          await unlink(lockPath).catch(() => undefined);
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          throw error;
        }
        if (Date.now() - started > 5_000) {
          await unlink(lockPath).catch(() => undefined);
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
}

function clampTtl(ttlMinutes: number | undefined): number {
  if (ttlMinutes === undefined) {
    return DEFAULT_TTL_MINUTES;
  }
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > MAX_TTL_MINUTES) {
    throw new Error(`ttlMinutes must be an integer from 1 to ${MAX_TTL_MINUTES}.`);
  }
  return ttlMinutes;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
