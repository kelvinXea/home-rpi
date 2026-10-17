import path from "node:path";

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Entorno legible por `loadConfig` (permite inyectar valores en tests). */
export type Env = Record<string, string | undefined>;

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  logLevel: LogLevel;
}

const DEFAULT_PORT = "3000";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_LOG_LEVEL: LogLevel = "info";

function validatePort(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`PORT inválido: "${raw}" — debe ser un entero entre 1 y 65535`);
  }
  const port = Number.parseInt(raw, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`PORT inválido: ${port} — debe estar entre 1 y 65535`);
  }
  return port;
}

function validateHost(raw: string): string {
  const host = raw.trim();
  if (host.length === 0) {
    throw new Error("HOST inválido: no puede estar vacío");
  }
  return host;
}

function validateLogLevel(raw: string): LogLevel {
  const level = raw.toLowerCase() as LogLevel;
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(
      `LOG_LEVEL inválido: "${raw}" — valores permitidos: ${LOG_LEVELS.join(", ")}`,
    );
  }
  return level;
}

/**
 * Lee y valida la configuración desde variables de entorno.
 * Lanza un Error con mensaje claro para cada valor inválido (no hay silenciosos).
 * No tiene efectos secundarios sobre el sistema: solo resuelve rutas.
 */
export function loadConfig(env: Env = process.env): AppConfig {
  const portRaw = env.PORT ?? DEFAULT_PORT;
  const hostRaw = env.HOST ?? DEFAULT_HOST;
  const logLevelRaw = env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;

  // DATABASE_PATH: si se proporciona no puede estar vacío; por defecto va a
  // data/ (ignorado en .gitignore), resuelto desde el directorio de trabajo.
  const databasePathRaw = env.DATABASE_PATH;
  if (databasePathRaw !== undefined && databasePathRaw.trim().length === 0) {
    throw new Error("DATABASE_PATH inválido: no puede estar vacío");
  }
  const databasePath = path.resolve(databasePathRaw ?? "data/api.sqlite");

  return {
    port: validatePort(portRaw),
    host: validateHost(hostRaw),
    logLevel: validateLogLevel(logLevelRaw),
    databasePath,
  };
}
