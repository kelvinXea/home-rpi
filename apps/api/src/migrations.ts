import type { SqliteDb } from "./db.ts";

interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/**
 * Mecanismo mínimo de migraciones: tabla `schema_migrations`, aplicadas en
 * orden y una sola vez (idempotente). 
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "0001_initial",
    // Marcador no-domain: hace observable la migración (PRAGMA user_version)
    // sin crear tablas de negocio.
    statements: ["PRAGMA user_version = 1;"],
  },
  {
    version: 2,
    name: "0002_menus",
    // `products` guarda el arreglo de productos como JSON (TEXT): suficiente
    // para el CRUD inicial; se normalizará en tabla propia si hace falta consultar por producto.
    statements: [
      `CREATE TABLE IF NOT EXISTS menus (
         id TEXT PRIMARY KEY,
         commerce TEXT NOT NULL,
         products TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
      "PRAGMA user_version = 2;",
    ],
  },
];

export async function runMigrations(db: SqliteDb): Promise<number> {
  await db.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL UNIQUE,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  const applied = new Set(
    (await db.all<{ version: number }>("SELECT version FROM schema_migrations")).map((r) => r.version),
  );

  let count = 0;
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    for (const statement of migration.statements) {
      await db.run(statement);
    }
    await db.run("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", [
      migration.version,
      migration.name,
    ]);
    count += 1;
  }
  return count;
}
