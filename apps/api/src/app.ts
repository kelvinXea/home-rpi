import Fastify, { type FastifyInstance } from "fastify";
import { registerAjvFormats, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import type { SqliteDb } from "./db.ts";
import { HealthRepository } from "./health/health.repository.ts";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { MenusRepository } from "./menus/menus.repository.ts";
import { registerMenusRoutes } from "./menus/menus.routes.ts";
import { MenusService } from "./menus/menus.service.ts";
import { registerHealthRoutes } from "./health/health.routes.ts";
import { HealthService } from "./health/health.service.ts";

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
      // Sin err.message ni err.validation: exponen rutas de schema internas.
      request.log.info({ validation: err.validation }, "Petición rechazada por validación");
      reply.status(400).send({
        statusCode: 400,
        code: "FST_ERR_VALIDATION",
        error: "Bad Request",
        message: "Petición inválida",
      });
      return;
    }
    request.log.error(
      err instanceof Error ? { err } : String(err),
      "Error no controlado en la API",
    );
    reply.status(500).send({ statusCode: 500, error: "Internal Server Error" });
  });

  // OpenAPI a partir de los schemas de las rutas. Bajo /api para que el proxy
  // nginx (location /api/) también lo exponga. Se registra antes que las rutas.
  app.register(swagger, {
    openapi: {
      info: { title: "home-rpi API", version: "0.0.0" },
      tags: [{ name: "menus", description: "CRUD de menús de menu-order-generator" }],
    },
  });
  app.register(swaggerUi, { routePrefix: "/api/docs" });

  // after(): las rutas se declaran cuando swagger ya está cargado y puede capturarlas.
  app.after(() => {
    registerHealthRoutes(app, new HealthService(new HealthRepository(db)));
    registerMenusRoutes(app, new MenusService(new MenusRepository(db)));
  });

  return app;
}
