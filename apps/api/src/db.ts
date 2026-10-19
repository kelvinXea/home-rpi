// sqlite3 es CJS y su binding nativo asigna `Database` dinámicamente: el
// cjs-module-lexer no lo detecta como named export bajo ESM (Node falla con
// `import { Database }`). Import default + destructure funciona en runtime;
// los tipos se toman del .d.ts por separado.
import sqlite3 from "sqlite3";
import type { Database as SqliteDatabase, RunResult } from "sqlite3";

const { Database } = sqlite3;

/**
 * Wrapper de promesas sobre sqlite3 (callbacks). Conexión única; node-sqlite3
 * serializa las sentencias por defecto.
 *
 * journal_mode=WAL: el fichero principal se acompaña de `*.sqlite-wal` y
 * `*.sqlite-shm`. En Docker (fase 5) hay que montar el DIRECTORIO de datos,
 * no solo el fichero, para que esos sidecar files persistan.
 */
export class SqliteDb {
  private readonly db: SqliteDatabase;
  private closed = false;

  private constructor(path: string) {
    this.db = new Database(path);
  }

  /** Abre la base de datos y aplica los PRAGMAs iniciales, en orden. */
  static async open(path: string): Promise<SqliteDb> {
    const instance = new SqliteDb(path);
    try {
      // foreign_keys ON + busy_timeout: comportamiento consistente y sin
      // SQLITE_BUSY prematuro ante escrituras concurrentes breves.
      await instance.rawRun("PRAGMA foreign_keys = 1");
      await instance.rawRun("PRAGMA journal_mode = WAL");
      await instance.rawRun("PRAGMA busy_timeout = 5000");
    } catch (err) {
      // Si un PRAGMA falla, la conexión ya existe: cerrarla para no dejar el
      // handle abierto (que impediría la salida limpia del proceso).
      await new Promise<void>((resolve) => {
        instance.db.close(() => resolve());
      });
      throw err;
    }
    return instance;
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error("database closed"));
      // node-sqlite3 entrega lastID/changes en `this` del callback, no como argumento.
      this.db.run(sql, ...params, function (this: RunResult, err: Error | null) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error("database closed"));
      this.db.get(sql, ...params, (err: Error | null, row?: T) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error("database closed"));
      this.db.all(sql, ...params, (err: Error | null, rows?: T[]) => {
        if (err) return reject(err);
        resolve(rows ?? []);
      });
    });
  }

  /** Cierre idempotente: la segunda llamada resuelve sin tocar SQLite. */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed) return resolve();
      this.db.close((err: Error | null) => {
        this.closed = true;
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private rawRun(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}
