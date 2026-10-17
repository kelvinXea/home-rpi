import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { loadConfig, type Env } from "../config.ts";

test("valores por defecto con entorno vacío", () => {
  const config = loadConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.logLevel, "info");
  // Por defecto la base va a data/ (ignorado en .gitignore), resuelta desde el cwd.
  assert.equal(config.databasePath, path.resolve("data/api.sqlite"));
});

test("DATABASE_PATH se respeta y se resuelve a ruta absoluta", () => {
  const env: Env = { DATABASE_PATH: "custom/mi-base.sqlite" };
  const config = loadConfig(env);
  assert.ok(path.isAbsolute(config.databasePath));
  assert.equal(config.databasePath, path.resolve("custom/mi-base.sqlite"));
});

test("DATABASE_PATH vacío se rechaza", () => {
  for (const value of ["", "   "]) {
    assert.throws(() => loadConfig({ DATABASE_PATH: value }), /DATABASE_PATH inválido/);
  }
});

test("PORT inválido lanza error con mensaje claro", () => {
  for (const value of ["abc", "0", "70000"]) {
    assert.throws(() => loadConfig({ PORT: value }), /PORT inválido/);
  }
  // Un valor válido se respeta.
  assert.equal(loadConfig({ PORT: "8080" }).port, 8080);
});

test("LOG_LEVEL inválido lanza error; los niveles válidos se aceptan", () => {
  assert.throws(() => loadConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL inválido/);
  for (const level of ["fatal", "error", "warn", "info", "debug", "trace"]) {
    assert.equal(loadConfig({ LOG_LEVEL: level }).logLevel, level);
  }
});

test("HOST vacío se rechaza; un host válido se respeta", () => {
  assert.throws(() => loadConfig({ HOST: "   " }), /HOST inválido/);
  assert.equal(loadConfig({ HOST: "0.0.0.0" }).host, "0.0.0.0");
});
