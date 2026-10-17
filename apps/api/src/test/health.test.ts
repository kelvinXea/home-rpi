import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildApp } from "../app.ts";
import { SqliteDb } from "../db.ts";

function assertIsoTimestamp(value: unknown): void {
  assert.equal(typeof value, "string", "timestamp debe ser una cadena ISO");
  assert.ok(!Number.isNaN(Date.parse(String(value))), `timestamp no parseable: ${String(value)}`);
}

test("GET /api/health responde ok cuando la base de datos es accesible", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-health-"));
  const dbPath = path.join(dir, "health.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    const app = buildApp({ db, logLevel: "silent" });
    try {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.status, "ok");
      assert.equal(body.database, "ok");
      assertIsoTimestamp(body.timestamp);
    } finally {
      await app.close();
    }
    await db.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("GET /api/health degrada a 503 si la base de datos no es accesible", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-health-"));
  const dbPath = path.join(dir, "degraded.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    const app = buildApp({ db, logLevel: "silent" });
    try {
      // Sanity: con la base abierta el endpoint responde ok.
      const healthy = await app.inject({ method: "GET", url: "/api/health" });
      assert.equal(healthy.statusCode, 200);

      await db.close();

      const res = await app.inject({ method: "GET", url: "/api/health" });
      assert.equal(res.statusCode, 503);
      const body = res.json();
      assert.equal(body.status, "degraded");
      assert.equal(body.database, "error");
      assertIsoTimestamp(body.timestamp);
    } finally {
      await app.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
