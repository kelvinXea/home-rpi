import type { FastifyBaseLogger } from "fastify";
import type { HealthResponse } from "@home-rpi/contracts";
import type { HealthRepository } from "./health.repository.ts";

/** Evalúa el estado de la API; si la base no responde, degrada en vez de lanzar. */
export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async check(log: FastifyBaseLogger): Promise<HealthResponse> {
    try {
      await this.repository.ping();
      return { status: "ok", database: "ok", timestamp: new Date().toISOString() };
    } catch (err) {
      log.warn(
        `Health check: base de datos no accesible (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
      return { status: "degraded", database: "error", timestamp: new Date().toISOString() };
    }
  }
}
