# Ampliar home-rpi

Dos procedimientos. Reglas generales (versiones exactas, tsconfig, seguridad) en
[AGENTS.md](../AGENTS.md). Activa Node antes (receta en AGENTS.md). No se incluyen apps ni
módulos de ejemplo en el repo: sustituye `<app>` / `<dominio>` por el nombre real.

## A. Añadir una app Angular

Ejemplo con `<app>` = `mi-app`, puerto de desarrollo 4202, puerto interno nginx 8082.

1. **Generar** con la CLI ya instalada en una app existente (desde `apps/`; la CLI exige Node 24):

   ```bash
   cd apps
   NG_CLI_ANALYTICS=false node menu-order-generator/node_modules/@angular/cli/bin/ng.js new <app> \
     --style=scss --routing --ssr=false --skip-git --skip-install --package-manager=pnpm
   ```

   (Añade `--dry-run` para ver qué crearía sin escribir nada; así se comprobaron estos flags.)

2. **`apps/<app>/package.json`**: `"name": "@home-rpi/<app>"`, `"private": true`,
   `"packageManager": "pnpm@12.14.0"`; quita `^`/`~` de todas las versiones (deben ser
   exactas) y copia el resto de versiones de una app existente (Angular 22.2.3,
   `typescript` 6.0.3: el compilador de Angular exige `>=6.0 <6.1`, no usar TS 7 aquí).
   Añade `bootstrap` 5.3.8 si la UI lo usa y, en `src/styles.scss`,
   `@import "bootstrap/scss/bootstrap";`.
3. **`apps/<app>/tsconfig.json`**: añade `"extends": "../../tsconfig.base.json"` y conserva su
   `target`/`module`/`rootDir`/`outDir`.
4. **Puerto de desarrollo**: en `angular.json`, `projects.<app>.architect.serve.options.port`
   (ver `apps/rpi-vpn-manager/angular.json`: 4201).
5. **Scripts raíz** (`package.json`): añade `dev:<x>` y `build:<x>` con
   `pnpm --filter @home-rpi/<app> run start|build`. `pnpm build` y `pnpm test` ya la recogen
   (`pnpm -r --if-present`).
6. `pnpm install` (actualiza el lockfile; commit del lockfile junto con la app).
7. **Docker/web** (`docker/web.Dockerfile`): `COPY apps/<app>/package.json apps/<app>/`,
   añade `--filter "@home-rpi/<app>..."` al `pnpm install`, `COPY apps/<app> apps/<app>`,
   `pnpm --filter @home-rpi/<app> build`, y
   `COPY --from=build /repo/apps/<app>/dist/<app>/browser /usr/share/nginx/html/<app>`.
   `docker/api.Dockerfile` también debe copiar el `package.json` de la nueva app
   (el lockfile necesita todos los miembros del workspace).
8. **nginx** (`docker/nginx.conf`): copia un bloque `server` con `listen 8082;`,
   `root /usr/share/nginx/html/<app>;` y el mismo `location /api/`.
9. **Compose**: en `web.ports` añade `"${WEB_<APP>_PORT:-8082}:8082"` y documenta la variable
   en `.env.example`.
10. **Prueba de integración** (`scripts/integration-test.sh`): añade el puerto
    (`IT_<APP>_PORT`, p. ej. 18082) a la exportación de variables, al chequeo de puerto libre
    y a `check_stack` (`/`, `app-root`, `<title>`, `/api/health`).
11. **Verificar**: `pnpm lint && pnpm build && pnpm test`; `pnpm dev:<x>` + `curl -I
    localhost:4202`; con Docker disponible: `docker compose config` y `pnpm test:integration`.

## B. Añadir un módulo de dominio a la API

Convención real (ver `health`): carpeta `apps/api/src/<dominio>/` con tres ficheros, uno por
capa. Imports relativos con extensión `.ts`.

1. **Repositorio** `<dominio>.repository.ts`: clase que recibe `SqliteDb` (`src/db.ts`) y es
   la única que escribe SQL (`db.run/get/all`, consultas parametrizadas).
2. **Servicio** `<dominio>.service.ts`: clase que recibe el repositorio; lógica de negocio y
   errores de dominio. No toca Fastify ni SQL.
3. **Rutas** `<dominio>.routes.ts`: `register<Dominio>Routes(app, service)` con prefijo
   `/api/...` y `schema` TypeBox en `params`/`querystring`/`body` **y** `response` (esa es la
   validación en runtime; `app.ts` ya fija `TypeBoxValidatorCompiler`). Sin lógica de negocio.
4. **Registro** en `apps/api/src/app.ts`, junto a `registerHealthRoutes(...)`:
   `register<Dominio>Routes(app, new <Dominio>Service(new <Dominio>Repository(db)))`.
5. **Migración**: añade un objeto al array `MIGRATIONS` de `apps/api/src/migrations.ts` con
   `version` consecutiva (2, 3, ...), `name` `"000N_<descripcion>"` y `statements` SQL.
   Se aplican una vez, en orden; no edites migraciones ya aplicadas.
6. **Contrato**: si el schema lo consumen también los frontends u otro paquete, defínelo en
   `packages/contracts/src/<dominio>/` (TypeBox, `Static<>` para el tipo; reexpórtalo en el
   `index.ts` del dominio y en `src/index.ts`) y ejecuta
   `pnpm --filter @home-rpi/contracts build` (la API lee `dist`). Si solo lo usa la API,
   déjalo en el módulo. `contracts` no puede importar Angular ni Fastify.
7. **Pruebas** `apps/api/src/test/<dominio>.test.ts` (`node:test`): crea una base temporal
   con `SqliteDb.open`, ejecuta `runMigrations(db)`, construye `buildApp({ db, logLevel:
   "silent" })` y usa `app.inject(...)`; cierra `app` y `db` en `finally` (modelo:
   `src/test/health.test.ts`).
8. **Verificar** (los tests corren sobre `dist`, compila antes):

   ```bash
   pnpm --filter @home-rpi/api build && pnpm --filter @home-rpi/api test
   pnpm lint && pnpm build && pnpm test
   ```

   Datos en Docker: volumen `api-data` en `/data`; nunca `docker compose down -v` sobre el
   proyecto real.
