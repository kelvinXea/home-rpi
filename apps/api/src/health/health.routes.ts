import type { FastifyInstance } from "fastify";
import { HealthResponse } from "@home-rpi/contracts";
import type { HealthService } from "./health.service.ts";

/** Capa HTTP: schema, código de estado y delegación en el servicio. */
export function registerHealthRoutes(app: FastifyInstance, service: HealthService): void {
  app.get(
    "/api/health",
    { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
    async (request, reply) => {
      const result = await service.check(request.log);
      return reply.code(result.status === "ok" ? 200 : 503).send(result);
    },
  );
}
