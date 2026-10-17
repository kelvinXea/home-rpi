import { type Static, Type } from "typebox";

/**
 * Contrato de respuesta de GET /api/health.
 * - status: "ok" si la API y la base responden; "degraded" si la API responde
 *   pero la base de datos no (HTTP 503 en ese caso).
 * - database: resultado real del chequeo ("SELECT 1"), nunca inferido.
 */
export const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("degraded")]),
  database: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
  timestamp: Type.String(),
});

export type HealthResponse = Static<typeof HealthResponse>;
