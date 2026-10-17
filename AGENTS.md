# AGENTS.md — home-rpi

Instrucciones para agentes de IA que trabajen en este monorepo. Léelo completo antes de
cambiar nada. Si una regla choca con una instrucción explícita del usuario, sigue la
instrucción y señala el conflicto.

## Objetivo / arquitectura (planificada)

Monorepo pnpm para gestionar un Raspberry Pi desde la red local:

- `apps/` → frontend Angular (fases 2–3).
- API Fastify + SQLite (fases 3–4).
- `docker/` → despliegue Docker (fase 5).

Estado fase 3: dos apps Angular de scaffold sin lógica de negocio — `menu-order-generator`
(puerto 4200) y `rpi-vpn-manager` (puerto 4201); más la API Fastify + SQLite en `apps/api`
(única ruta `GET /api/health`) y el paquete compartido `packages/contracts`. Sigue sin haber
VPN real ni lógica de negocio: no inventar apps, scripts, lógica ni estructura que no exista.

## Entorno verificado (a fecha 2026-10-17)

| Elemento | Versión | Verificación |
| --- | --- | --- |
| Node | v24.22.0 | `node -v` con nvm activo; `.nvmrc`/`.node-version` = 24.22.0 |
| pnpm | 12.14.0 | `pnpm -v`; latest estable en el momento (`npm view pnpm version`) |
| typescript | 7.0.2 | devDep exacta raíz; specifier y resolución exactos en lockfile v9.0 |
| eslint | 10.13.0 | idem |
| @eslint/js | 10.0.1 | idem; peer `eslint: ^10.0.0` compatible con 10.13.0 (`npm view`) |

- Node v24.22.0 se instaló en la fase 1 con `nvm install 24.22.0`; **no es el default del
  sistema**: activarlo por shell (receta abajo). pnpm 12.14.0 está instalado global bajo el
  prefix de ese Node y fijado vía `packageManager` en package.json.

## Estructura y responsabilidades (estado fase 3)

```
home-rpi/
├── apps/menu-order-generator/    # @home-rpi: Angular 22.2.3 + Bootstrap 5.3.8/Sass; ng serve en 4200
├── apps/rpi-vpn-manager/         # idem (scaffold espejo); ng serve en 4201 (angular.json)
├── apps/api/                     # @home-rpi/api: Fastify 5.12.7 + sqlite3 5.1.1; src→dist con tsc
├── packages/.gitkeep             # librerías TS compartidas (sin uso aún)
├── packages/contracts/           # @home-rpi/contracts: contrato HealthResponse (TypeBox); ESM+types en dist
├── docker/.gitkeep               # Dockerfiles/compose futuros (fuera de alcance fase 5)
├── package.json                  # @home-rpi/root: scripts, engines.node=24.22.0,
│                                 #   packageManager=pnpm@12.14.0, devDeps exactas
├── pnpm-workspace.yaml           # packages: apps/* + packages/*; allowBuilds (postinstall
│                                 #   aprobados); minimumReleaseAgeExclude: eslint@10.13.0 + typebox@1.4.1
├── tsconfig.base.json     # opciones estrictas compartidas, sin target/module
├── eslint.config.mjs      # flat config: @eslint/js recommended; linta .js/.mjs/.cjs
├── pnpm-lock.yaml         # v9.0, generado con pnpm 12.14.0 sobre Node v24.22.0
├── .nvmrc / .node-version # 24.22.0
└── .editorconfig / .gitignore
```

- `opencode.json` es configuración de sesión preexistente del entorno; no tocarla ni
  documentarla como parte del proyecto.

## API y contratos (fase 3)

Capas reales en `apps/api/src/`: `server.ts` (arranque: config → SQLite → migraciones → listen;
cierre ordenado con onClose + SIGINT/SIGTERM, conexión cerrada una sola vez) → `app.ts`
(rutas bajo `/api`, validación runtime de peticiones y respuestas vía TypeBox, error handler
propio que no filtra errores de validación 400) → `db.ts` (wrapper promise sobre sqlite3;
PRAGMAs `foreign_keys=1`, `journal_mode=WAL`, `busy_timeout=5000`) + `migrations.ts`.
Aún sin capa de servicios ni tablas de dominio: la migración 0001 solo fija
`PRAGMA user_version = 1` (mecanismo idempotente con tabla `schema_migrations`).

- Contratos en `packages/contracts`: un único `HealthResponse` ({status, database, timestamp}).
  Biblioteca de schemas elegida: **TypeBox** — es el type provider oficial de Fastify
  (`@fastify/type-provider-typebox`), así los schemas se validan sin convertir a JSON Schema;
  con Zod haría falta un adaptador/conversión extra. El paquete no importa ni Angular ni
  Fastify, y la API lo consume como dependencia `workspace:*`.
- SQLite en WAL: genera ficheros laterales `<db>-wal`/`<db>-shm`; al cerrar se hace checkpoint.
  En Docker (fase 5) hay que montar el **directorio** de datos, no un único fichero.
- Quirk sqlite3 5.1.1 bajo ESM: es CJS y `Database` se asigna dinámicamente en el binding, así
  cjs-module-lexer no expone named exports; importar por defecto y desestructurar (ver `db.ts`).

## Convenciones

1. Los paquetes del workspace se llaman `@home-rpi/<nombre>` y son `"private": true`.
2. TypeScript estricto: cada app hereda `tsconfig.base.json` (strict, noImplicitOverride,
   noFallthroughCasesInSwitch, forceConsistentCasingInFileNames) y define su propio
   `target`, `module`, `outDir`. No aflojar opciones en la base ni meter ahí opciones
   específicas de Angular/Fastify.
3. Versiones exactas siempre: sin `^`/`~` en devDependencies, packageManager o engines.
   Tras tocar dependencias: `pnpm install` para actualizar el lockfile raíz.
4. Validación en runtime ≠ tipos estáticos: los tipos TS no protegen datos de entrada; la
   API validará toda entrada externa (HTTP, ficheros) en runtime.
5. Capas de la API: rutas → servicios → acceso a datos (SQLite). Las rutas no contienen
   lógica de negocio.
6. pnpm 12 bloquea scripts postinstall por defecto; los paquetes aprobados (`@parcel/watcher`,
   `esbuild`, `lmdb`, `msgpackr-extract`, `sqlite3`) quedan en el mapa `allowBuilds:` de
   pnpm-workspace.yaml, gestionado con `pnpm approve-builds <pkg> -y` (no editar a mano).

## Comandos verificados (ejecutados el 2026-10-17 con exit code 0)

Cada shell nuevo necesita activar Node antes de nada:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
nvm use --silent   # activa v24.22.0 (del .nvmrc); pnpm 12.14.0 queda en el PATH
```

Quirk: no encadenar `node -v`/`pnpm ...` en la misma línea que `. nvm.sh`; puede resolver
a otro Node (se observó v20.20.2).

| Comando | Resultado verificado |
| --- | --- |
| `pnpm install` | idempotente; "Scope: all 5 workspace projects"; "Already up to date" |
| `pnpm ls -r --depth -1` | lista los 5 proyectos (root + las dos apps Angular + api + contracts) |
| `pnpm lint` | `eslint .` linta el JS de la raíz sin errores |
| `pnpm build` | compila los 4 proyectos con script (`tsc` en contracts y api; `ng build` en los frontends); warning no fatal Sass @import |
| `pnpm test` | vitest en las dos apps: 2 archivos / 4 tests passed (incl. h1 exacto); node:test en `apps/api`: 13 tests passed (`node --test dist/test/*.js`) |
| Arranque manual de la API compilada + `curl /api/health` | 200 `{"status":"ok","database":"ok"}` en 127.0.0.1:3000; SIGTERM → log "Recibido SIGTERM, cerrando la API" y exit 0; DB persistida con checkpoint WAL al cerrar; segundo proceso en el mismo puerto → error claro EADDRINUSE + exit 1 (fallo controlado verificado en vivo) |
| `pnpm build:menu` / `build:vpn` | build por app vía `--filter @home-rpi/<nombre>`; exit 0 |
| `pnpm dev:menu` / `dev:vpn` | `ng serve` en 4200 / 4201; verificado con curl y parada limpia del grupo |

Solo se documenta aquí lo que se ejecutó con exit code 0. No añadir comandos a esta tabla
sin haberlos ejecutado primero.

## Reglas para añadir apps / módulos (fases 2–5)

- Nueva app → `apps/<nombre>/package.json` con `"name": "@home-rpi/<nombre>"`; el
  workspace la recoge solo (`apps/*`). Librería compartida → `packages/<nombre>/`.
- Cada proyecto TS: tsconfig propio que extiende `../../tsconfig.base.json` y fija su
  `target`/`module`/`outDir`.
- Dependencias siempre con pnpm y versión exacta; actualizar lockfile raíz.

## Límites de seguridad

- Prohibido `rm -rf` fuera de `node_modules/`, `dist/`, `.angular/`; preferir borrados
  puntuales de ficheros concretos.
- Sin secretos en el repo (`.env*` está en .gitignore); no escribir credenciales ni tokens.
- No tocar el host del sistema (servicios, `/boot`, paquetes del SO): solo esta carpeta.
- **No hacer commits** (el repo SÍ es git: un commit inicial en `main`; la política de
  commits queda pendiente, ver Pendientes).

## Validación y documentación de cambios

Tras cualquier cambio que toque package.json, lockfile o configs: ejecutar `pnpm install`
y los scripts afectados; registrar el exit code real. No declarar "verificado" nada sin
haberlo ejecutado en esta sesión.

## Política de no suposición

Tres estados posibles para cada afirmación: **ejecutado** (exit code 0 aquí),
**incompatibilidad/limitación confirmada** (evidencia del registro, p. ej. `npm view`), o
**no verificable** (sin red/herramienta). Nunca presentar lo no verificado como hecho;
anotar la diferencia en *Pendientes*.

## Trabajo con contexto limitado (~40k tokens)

- Salidas acotadas: nunca leer el lockfile ni node_modules enteros; usar `grep -n`/`sed
  -n 'A,Bp'` con rangos y `| head`.
- Preferir consultas de registro (`npm view <pkg> version|peerDependencies`, `pnpm ls`)
  antes que descargar o leer fuentes.
- Cambios pequeños, uno a la vez; verificar cada cambio antes del siguiente.

## Pendientes (no resueltos en fase 1)

1. **typescript-eslint incompatible con TS 7.0.2 — confirmado**: el latest estable
   (@typescript-eslint/parser 8.71.2) declara peer `typescript >=4.8.4 <6.1.0`
   (evidencia: `npm view @typescript-eslint/parser peerDependencies`) y no hay releases
   estables >8.x (solo canary alpha). Hasta que exista una compatible, `.ts/.tsx` quedan
   fuera del linting (eslint.config.mjs solo aplica @eslint/js recommended a .js/.mjs/.cjs).
2. **Node v24.22.0 instalado vía nvm en la fase 1**: no es el default del sistema; los
   shells nuevos necesitan `nvm use` (receta de "Comandos verificados").
3. **Política de commits pendiente**: el repo SÍ es git ahora (un commit inicial en
   `main`, árbol limpio salvo los cambios no commiteados de la sesión actual). Definir la
   política de commits queda pendiente de instrucción explícita.
