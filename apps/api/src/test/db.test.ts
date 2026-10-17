import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SqliteDb } from "../db.ts";

async function withTempDb(fn: (db: SqliteDb, dbPath: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-db-"));
  const dbPath = path.join(dir, "test.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    await fn(db, dbPath);
    await db.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("journal_mode=WAL y foreign_keys activados al abrir", async () => {
  await withTempDb(async (db) => {
    const mode = await db.get<{ journal_mode: string }>("PRAGMA journal_mode");
    assert.equal(mode?.journal_mode, "wal");
    const fk = await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
    assert.equal(fk?.foreign_keys, 1);
  });
});

test("consultas tras close() rechazan con 'database closed'", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-db-"));
  const dbPath = path.join(dir, "closed.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    assert.deepEqual(await db.get("SELECT 1 AS one"), { one: 1 });
    await db.close();
    await db.close(); // idempotente: no debe lanzar ni tocar SQLite de nuevo
    await assert.rejects(db.get("SELECT 1"), /database closed/);
    await assert.rejects(db.run("PRAGMA foreign_keys = 0"), /database closed/);
    await assert.rejects(db.all("SELECT 1"), /database closed/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("la base persiste en el fichero indicado (WAL checkpoint al cerrar)", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-db-"));
  const dbPath = path.join(dir, "persist.sqlite");
  try {
    const first = await SqliteDb.open(dbPath);
    await first.run("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    await first.run("INSERT INTO t (id) VALUES (42)");
    await first.close();

    // Reabrir el mismo fichero: los datos deben estar ahí.
    const second = await SqliteDb.open(dbPath);
    try {
      assert.deepEqual(await second.get<{ id: number }>("SELECT id FROM t"), { id: 42 });
    } finally {
      await second.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
