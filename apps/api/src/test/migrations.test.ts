import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SqliteDb } from "../db.ts";
import { runMigrations } from "../migrations.ts";

async function withTempDb(fn: (db: SqliteDb, dbPath: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-mig-"));
  const dbPath = path.join(dir, "migrations.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    await fn(db, dbPath);
    await db.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("las migraciones se aplican una sola vez (idempotentes)", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-mig-"));
  const dbPath = path.join(dir, "migrations.sqlite");
  try {
    const first = await SqliteDb.open(dbPath);
    let applied = await runMigrations(first);
    assert.equal(applied, 2);

    // Segunda ejecución sobre la misma conexión: nada que aplicar.
    applied = await runMigrations(first);
    assert.equal(applied, 0);

    const version = await first.get<{ user_version: number }>("PRAGMA user_version");
    assert.equal(version?.user_version, 2);
    await first.close();

    // Tercera ejecución tras reabrir el mismo fichero: persiste el estado.
    const second = await SqliteDb.open(dbPath);
    try {
      applied = await runMigrations(second);
      assert.equal(applied, 0);
    } finally {
      await second.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("schema_migrations registra la versión y el nombre aplicados", async () => {
  await withTempDb(async (db) => {
    await runMigrations(db);
    const rows = await db.all<{ version: number; name: string }>(
      "SELECT version, name FROM schema_migrations ORDER BY version",
    );
    assert.deepEqual(rows, [
      { version: 1, name: "0001_initial" },
      { version: 2, name: "0002_menus" },
    ]);
  });
});
