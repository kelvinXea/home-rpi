import type { SqliteDb } from "../db.ts";

/** Acceso a datos del módulo health: un ping real contra SQLite. */
export class HealthRepository {
  constructor(private readonly db: SqliteDb) {}

  /** Rechaza si la base no responde (cerrada, corrupta, bloqueada...). */
  async ping(): Promise<void> {
    await this.db.get("SELECT 1");
  }
}
