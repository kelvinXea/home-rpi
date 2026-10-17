# AGENTS.md — home-rpi

Instrucciones para agentes de IA que trabajen en este monorepo. Léelo completo antes de
cambiar nada. Si una regla choca con una instrucción explícita del usuario, sigue la
instrucción y señala el conflicto.

## Objetivo / arquitectura (planificada)

Monorepo pnpm para gestionar un Raspberry Pi desde la red local:

- `apps/` → frontend Angular (fases 2–3).
- API Fastify + SQLite (fases 3–4).
- `docker/` → despliegue Docker (fase 5).

Estado fase 2: dos apps Angular de scaffold sin lógica de negocio — `menu-order-generator`
(puerto 4200) y `rpi-vpn-manager` (puerto 4201). No hay API, VPN real ni backend todavía:
no inventar apps, scripts, lógica ni estructura que no exista.

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

## Estructura y responsabilidades (estado fase 2)

```
home-rpi/
├── apps/menu-order-generator/    # @home-rpi: Angular 22.2.3 + Bootstrap 5.3.8/Sass; ng serve en 4200
├── apps/rpi-vpn-manager/         # idem (scaffold espejo); ng serve en 4201 (angular.json)
├── packages/.gitkeep             # librerías TS compartidas (sin uso aún)
├── docker/.gitkeep               # Dockerfiles/compose futuros (fuera de alcance fase 5)
├── package.json                  # @home-rpi/root: scripts, engines.node=24.22.0,
│                                 #   packageManager=pnpm@12.14.0, devDeps exactas
├── pnpm-workspace.yaml           # packages: apps/* + packages/*; allowBuilds (postinstall
│                                 #   aprobados); minimumReleaseAgeExclude: eslint@10.13.0
├── tsconfig.base.json     # opciones estrictas compartidas, sin target/module
├── eslint.config.mjs      # flat config: @eslint/js recommended; linta .js/.mjs/.cjs
├── pnpm-lock.yaml         # v9.0, generado con pnpm 12.14.0 sobre Node v24.22.0
├── .nvmrc / .node-version # 24.22.0
└── .editorconfig / .gitignore
```

- `opencode.json` es configuración de sesión preexistente del entorno; no tocarla ni
  documentarla como parte del proyecto.

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
   `esbuild`, `lmdb`, `msgpackr-extract`) quedan en el mapa `allowBuilds:` de
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
| `pnpm install` | idempotente; "Scope: all 3 workspace projects"; lockfile pasa supply-chain policies |
| `pnpm ls -r --depth -1` | lista los 3 proyectos (root + las dos apps) |
| `pnpm lint` | `eslint .` linta el JS de la raíz sin errores |
| `pnpm build` | compila las dos apps (`dist/<app>/` en cada una); warning no fatal Sass @import |
| `pnpm test` | vitest en las dos apps: 2 archivos / 4 tests passed (incl. h1 exacto) |
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
