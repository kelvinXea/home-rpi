import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.ts";
import { SqliteDb } from "./db.ts";
import { runMigrations } from "./migrations.ts";
import { buildApp } from "./app.ts";

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Punto de entrada. Orden: validar entorno → preparar directorio de datos →
 * abrir SQLite → migraciones → Fastify → listen. El cierre ordenado (SIGINT/
 * SIGTERM) pasa por app.close(), que dispara onClose → db.close() una vez.
 */
async function main(): Promise<void> {
  // Lanza con mensaje claro si algún valor de entorno es inválido.
  const config = loadConfig();

  await fs.mkdir(path.dirname(config.databasePath), { recursive: true });

  let db: SqliteDb;
  try {
    db = await SqliteDb.open(config.databasePath);
  } catch (err) {
    console.error(`No se pudo abrir la base de datos en ${config.databasePath}:`, message(err));
    process.exit(1);
  }

  const app = buildApp({ db, logLevel: config.logLevel });

  let applied: number;
  try {
    applied = await runMigrations(db);
  } catch (err) {
    console.error("Error ejecutando migraciones:", message(err));
    // El proceso va a terminar igualmente: cerramos la base con el máximo esfuerzo.
    await db.close().catch(() => undefined);
    process.exit(1);
  }
  app.log.info(`Aplicadas ${applied} migracion(es)`);

  let dbClosed = false;
  const closeDbOnce = async (): Promise<void> => {
    if (dbClosed) return;
    dbClosed = true;
    await db.close();
  };

  // La base se cierra una única vez cuando Fastify termina su ciclo de vida.
  app.addHook("onClose", () => closeDbOnce());

  let shuttingDown = false;
  const shutdown = async (signal: "SIGINT" | "SIGTERM"): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Recibido ${signal}, cerrando la API`);
    try {
      await app.close(); // dispara onClose → db.close() una vez
    } catch (err) {
      console.error("Error durante el cierre:", message(err));
      process.exitCode = 1;
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(`API escuchando en ${address}`);
  } catch (err) {
    console.error(`No se pudo escuchar en ${config.host}:${config.port}:`, message(err));
    // El servidor nunca atendió peticiones: cerramos la base directamente y salimos.
    await closeDbOnce().catch(() => undefined);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(message(err));
  process.exit(1);
});
