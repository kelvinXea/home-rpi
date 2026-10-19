import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { Compile } from "typebox/compile";
import { ErrorResponse, Menu } from "@home-rpi/contracts";
import { buildApp } from "../app.ts";
import { SqliteDb } from "../db.ts";
import { runMigrations } from "../migrations.ts";

const validMenu = { commerce: "Café Sol", products: [{ product: "Espresso", price: 1500 }] };
const isMenu = Compile(Menu);
const isError = Compile(ErrorResponse);

async function withApp(fn: (app: FastifyInstance, dbPath: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-menus-"));
  const dbPath = path.join(dir, "menus.sqlite");
  try {
    const db = await SqliteDb.open(dbPath);
    await runMigrations(db);
    const app = buildApp({ db, logLevel: "silent" });
    try {
      await fn(app, dbPath);
    } finally {
      await app.close();
      await db.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("GET /api/menus lista vacío y luego los menús creados", async () => {
  await withApp(async (app) => {
    const empty = await app.inject({ method: "GET", url: "/api/menus" });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json(), []);

    await app.inject({ method: "POST", url: "/api/menus", payload: validMenu });
    await app.inject({ method: "POST", url: "/api/menus", payload: { commerce: "Otro", products: [] } });
    const res = await app.inject({ method: "GET", url: "/api/menus" });
    assert.equal(res.statusCode, 200);
    const list = res.json();
    assert.equal(list.length, 2);
    assert.ok(list.every((m: unknown) => isMenu.Check(m)));
    assert.deepEqual(list.map((m: { commerce: string }) => m.commerce), ["Café Sol", "Otro"]);
  });
});

test("POST /api/menus crea con id generado, recorta espacios y GET por id lo devuelve", async () => {
  await withApp(async (app) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/menus",
      payload: { commerce: "  Café Sol  ", products: [{ product: " Té ", price: 0 }] },
    });
    assert.equal(res.statusCode, 201);
    const created = res.json();
    assert.ok(isMenu.Check(created));
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(
      { commerce: created.commerce, products: created.products },
      { commerce: "Café Sol", products: [{ product: "Té", price: 0 }] },
    );

    const got = await app.inject({ method: "GET", url: `/api/menus/${created.id}` });
    assert.equal(got.statusCode, 200);
    assert.deepEqual(got.json(), created);
  });
});

test("POST /api/menus rechaza un id enviado por el cliente (propiedad adicional)", async () => {
  await withApp(async (app) => {
    const res = await app.inject({ method: "POST", url: "/api/menus", payload: { id: "x", ...validMenu } });
    assert.equal(res.statusCode, 400);
  });
});

test("PUT /api/menus/:id reemplaza commerce y products sin cambiar el id", async () => {
  await withApp(async (app) => {
    const created = (await app.inject({ method: "POST", url: "/api/menus", payload: validMenu })).json();
    const next = { commerce: "Nuevo", products: [{ product: "Jugo", price: 2500 }] };
    const res = await app.inject({ method: "PUT", url: `/api/menus/${created.id}`, payload: next });
    assert.equal(res.statusCode, 200);
    assert.ok(isMenu.Check(res.json()));
    assert.deepEqual(res.json(), { id: created.id, ...next });
    const got = await app.inject({ method: "GET", url: `/api/menus/${created.id}` });
    assert.deepEqual(got.json(), { id: created.id, ...next });

    const withId = await app.inject({
      method: "PUT",
      url: `/api/menus/${created.id}`,
      payload: { id: "otro", ...next },
    });
    assert.equal(withId.statusCode, 400);
  });
});

test("DELETE /api/menus/:id elimina y devuelve el menú; después es 404", async () => {
  await withApp(async (app) => {
    const created = (await app.inject({ method: "POST", url: "/api/menus", payload: validMenu })).json();
    const res = await app.inject({ method: "DELETE", url: `/api/menus/${created.id}` });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), created);
    const after = await app.inject({ method: "GET", url: `/api/menus/${created.id}` });
    assert.equal(after.statusCode, 404);
    const again = await app.inject({ method: "DELETE", url: `/api/menus/${created.id}` });
    assert.equal(again.statusCode, 404);
  });
});

test("GET/PUT/DELETE de un id inexistente devuelven 404 con cuerpo de error", async () => {
  await withApp(async (app) => {
    for (const [method, payload] of [
      ["GET", undefined],
      ["PUT", validMenu],
      ["DELETE", undefined],
    ] as const) {
      const res = await app.inject({ method, url: "/api/menus/no-existe", payload });
      assert.equal(res.statusCode, 404, method);
      assert.ok(isError.Check(res.json()), method);
    }
  });
});

test("datos inválidos devuelven 400 (precios negativos, tipos incorrectos, vacíos)", async () => {
  await withApp(async (app) => {
    const p = (price: unknown) => ({ commerce: "A", products: [{ product: "B", price }] });
    const invalid: unknown[] = [
      p(-1),
      p("1000"),
      p(null),
      p(1.5),
      p(true),
      { commerce: "   ", products: [] },
      { commerce: 5, products: [] },
      { commerce: "A" },
      { commerce: "A", products: "x" },
      { commerce: "A", products: [{ product: "  ", price: 1 }] },
      { commerce: "A", products: [{ product: "B", price: 1, extra: 1 }] },
      { commerce: "A", products: [], extra: 1 },
      [],
    ];
    for (const payload of invalid) {
      const res = await app.inject({
        method: "POST",
        url: "/api/menus",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify(payload),
      });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
      assert.ok(isError.Check(res.json()));
      assert.equal(res.json().message, "Petición inválida");
    }
    const raw = await app.inject({
      method: "POST",
      url: "/api/menus",
      headers: { "content-type": "application/json" },
      payload: '{"commerce":"A","products":[{"product":"B","price":1e400}]}',
    });
    assert.equal(raw.statusCode, 400);
    const none = await app.inject({ method: "GET", url: "/api/menus" });
    assert.deepEqual(none.json(), [], "ninguna petición inválida debe persistir");

    const created = (await app.inject({ method: "POST", url: "/api/menus", payload: validMenu })).json();
    const put = await app.inject({ method: "PUT", url: `/api/menus/${created.id}`, payload: p(-5) });
    assert.equal(put.statusCode, 400);
    const unchanged = await app.inject({ method: "GET", url: `/api/menus/${created.id}` });
    assert.deepEqual(unchanged.json(), created);
  });
});

test("los menús persisten tras cerrar y reabrir la base de datos", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-menus-persist-"));
  const dbPath = path.join(dir, "persist.sqlite");
  try {
    let db = await SqliteDb.open(dbPath);
    await runMigrations(db);
    let app = buildApp({ db, logLevel: "silent" });
    const created = (await app.inject({ method: "POST", url: "/api/menus", payload: validMenu })).json();
    await app.close();
    await db.close();

    db = await SqliteDb.open(dbPath);
    await runMigrations(db);
    app = buildApp({ db, logLevel: "silent" });
    try {
      const res = await app.inject({ method: "GET", url: `/api/menus/${created.id}` });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), created);
    } finally {
      await app.close();
      await db.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("un fallo de SQLite devuelve 500 genérico, sin detalles", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-menus-500-"));
  try {
    const db = await SqliteDb.open(path.join(dir, "err.sqlite")); // sin migrar: no existe la tabla
    const app = buildApp({ db, logLevel: "silent" });
    try {
      for (const [method, url, payload] of [
        ["GET", "/api/menus", undefined],
        ["GET", "/api/menus/x", undefined],
        ["POST", "/api/menus", validMenu],
      ] as const) {
        const res = await app.inject({ method, url, payload });
        assert.equal(res.statusCode, 500, `${method} ${url}`);
        assert.deepEqual(res.json(), { statusCode: 500, error: "Internal Server Error" });
        assert.ok(!res.body.toLowerCase().includes("sqlite"));
      }
    } finally {
      await app.close();
      await db.close();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("OpenAPI y Swagger UI están disponibles y documentan el CRUD", async () => {
  await withApp(async (app) => {
    const spec = await app.inject({ method: "GET", url: "/api/docs/json" });
    assert.equal(spec.statusCode, 200);
    const doc = spec.json();
    assert.match(doc.openapi, /^3\./);
    assert.deepEqual(Object.keys(doc.paths["/api/menus"]).sort(), ["get", "post"]);
    assert.deepEqual(Object.keys(doc.paths["/api/menus/{id}"]).sort(), ["delete", "get", "put"]);
    assert.ok(doc.paths["/api/menus"].post.requestBody);
    assert.deepEqual(Object.keys(doc.paths["/api/menus"].post.responses).sort(), ["201", "400", "500"]);
    assert.ok(doc.paths["/api/menus/{id}"].get.responses["404"]);
    assert.ok(doc.paths["/api/menus/{id}"].put.responses["404"]);
    assert.ok(doc.paths["/api/menus/{id}"].delete.responses["404"]);
    assert.equal(doc.paths["/api/menus/{id}"].get.parameters[0].name, "id");
    const product = JSON.stringify(doc);
    assert.ok(product.includes('"minimum":0'), "el precio documenta minimum 0");

    const ui = await app.inject({ method: "GET", url: "/api/docs/" });
    assert.equal(ui.statusCode, 200);
    assert.match(ui.headers["content-type"] as string, /text\/html/);
  });
});
