import Fastify, { type FastifyInstance } from "fastify";
import { registerAjvFormats, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import { HealthResponse } from "@home-rpi/contracts";
import type { SqliteDb } from "./db.ts";

export interface BuildAppOptions {
  db: SqliteDb;
  /** Nivel de log pino (los tests usan "silent"). */
  logLevel?: string;
}

interface FastifyValidationError extends Error {
  validation: unknown;
  statusCode?: number | string;
  code?: string;
}

/**
 * Detecta errores de validación de Fastify (FST_ERR_VALIDATION): los únicos
 * que se devuelven al cliente con detalle. Todo el resto se enmascara como 500.
 */
function isValidationFailure(err: unknown): err is FastifyValidationError {
  if (!(err instanceof Error) || !("validation" in err)) return false;
  const candidate = err as { validation?: unknown; statusCode?: number | string };
  return candidate.validation !== undefined && Number(candidate.statusCode ?? 0) === 400;
}

/**
 * Construye la instancia de Fastify sin escuchar puertos: el ciclo de vida
 * (listen/close) lo gestiona server.ts. La base de datos se inyecta ya abierta;
 * este módulo nunca la cierra.
 */
export function buildApp({ db, logLevel = "info" }: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: logLevel } });

  // Validación en runtime con TypeBox (contratos de @home-rpi/contracts).
  registerAjvFormats();
  app.setValidatorCompiler(TypeBoxValidatorCompiler);

  // Errores sin filtrar internos al cliente: validaciones pasan como 400,
  // el resto se loguea en servidor y responde con un 500 genérico.
  app.setErrorHandler((err, request, reply) => {
    if (isValidationFailure(err)) {
      reply.status(400).send({
        statusCode: 400,
        code: err.code ?? "FST_ERR_VALIDATION",
        message: err.message,
        details: err.validation,
      });
      return;
    }
    request.log.error(
      err instanceof Error ? { err } : String(err),
      "Error no controlado en la API",
    );
    reply.status(500).send({ statusCode: 500, error: "Internal Server Error" });
  });

  app.get(
    "/api/health",
    { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
    async (request, reply) => {
      try {
        // Chequeo real de la base: si no responde, el endpoint degrada.
        await db.get("SELECT 1");
        return { status: "ok", database: "ok", timestamp: new Date().toISOString() };
      } catch (err) {
        request.log.warn(
          `Health check: base de datos no accesible (${
            err instanceof Error ? err.message : String(err)
          })`,
        );
        return reply.code(503).send({
          status: "degraded",
          database: "error",
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  return app;
}
