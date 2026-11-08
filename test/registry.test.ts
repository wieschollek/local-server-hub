import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PortReservedError, ReservationStore } from "../src/registry/store.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function store(): Promise<ReservationStore> {
  const directory = await mkdtemp(path.join(tmpdir(), "lsh-"));
  directories.push(directory);
  return new ReservationStore(directory);
}

describe("ReservationStore", () => {
  test("reserves, refreshes the same project, and releases", async () => {
    const reservations = await store();
    const now = new Date("2026-11-08T10:00:00.000Z");
    const created = await reservations.reserve({
      port: 5173,
      project: "app",
      worktree: "feature",
      now,
      ttlMinutes: 30,
    });
    expect(created.expiresAt).toBe("2026-11-08T10:30:00.000Z");
    const refreshed = await reservations.reserve({
      port: 5173,
      project: "app",
      worktree: "feature",
      now: new Date("2026-11-08T10:10:00.000Z"),
      ttlMinutes: 30,
    });
    expect(refreshed.createdAt).toBe(created.createdAt);
    expect(refreshed.worktree).toBe("feature");
    expect(await reservations.release(5173)).toBe(true);
    expect(await reservations.list()).toEqual([]);
    expect(await reservations.release(5173)).toBe(false);
  });

  test("rejects a port reserved by another project and drops expired leases", async () => {
    const reservations = await store();
    const now = new Date("2026-11-08T10:00:00.000Z");
    await reservations.reserve({ port: 3000, project: "one", now, ttlMinutes: 5 });
    await expect(reservations.reserve({ port: 3000, project: "two", now })).rejects.toBeInstanceOf(PortReservedError);
    await expect(reservations.reserve({
      port: 3000,
      project: "one",
      worktree: "other",
      now,
    })).rejects.toBeInstanceOf(PortReservedError);
    const later = new Date("2026-11-08T10:06:00.000Z");
    expect(await reservations.list(later)).toEqual([]);
    const replacement = await reservations.reserve({ port: 3000, project: "two", now: later, ttlMinutes: 5 });
    expect(replacement.project).toBe("two");
  });
});
