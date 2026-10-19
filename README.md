# home-rpi

Monorepo pnpm para gestionar un Raspberry Pi desde la red local.

| Proyecto                    | Qué es                                            | Puerto dev |
| --------------------------- | ------------------------------------------------- | ---------- |
| `apps/menu-order-generator` | Frontend Angular: consulta menús y prepara pedidos | 4200       |
| `apps/rpi-vpn-manager`      | Frontend Angular (scaffold, sin lógica)           | 4201       |
| `apps/api`                  | API Fastify + SQLite (`/api/health`, `/api/menus`) | 3000       |
| `packages/contracts`        | Contratos compartidos (TypeBox)                   | —          |

Más detalle técnico y convenciones en [AGENTS.md](AGENTS.md) y [docs/extending.md](docs/extending.md).

## Desarrollo local

### Requisitos

- Node **24.22.0** (`.nvmrc`) y pnpm **12.14.0** (fijado en `packageManager`).
- Con nvm, en cada shell nuevo:

  ```bash
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use --silent   # lee .nvmrc
  ```

### Instalar y compilar

```bash
pnpm install
pnpm build      # compila contracts → api → frontends (contracts debe ir antes: los frontends usan sus tipos)
```

### Arrancar API + frontend

La API y el frontend se levantan en dos terminales.

**Terminal 1 — API** (escucha en `127.0.0.1:3000`, base de datos en `apps/api/data/api.sqlite`):

```bash
pnpm --filter @home-rpi/api start     # usa dist/ (requiere pnpm build)
# o, con recarga automática:
pnpm --filter @home-rpi/api dev
```

Variables opcionales: `PORT`, `HOST`, `DATABASE_PATH`, `LOG_LEVEL` (`fatal|error|warn|info|debug|trace`).
Comprobación: `curl http://127.0.0.1:3000/api/health` → `{"status":"ok","database":"ok","timestamp":"…"}`.
Documentación OpenAPI: <http://127.0.0.1:3000/api/docs>.

**Terminal 2 — frontend de pedidos** (<http://localhost:4200>):

```bash
pnpm dev:menu
```

`ng serve` reenvía `/api` a `127.0.0.1:3000` mediante `apps/menu-order-generator/proxy.conf.json`,
así que la API debe estar levantada antes de abrir la página. (El frontend de VPN: `pnpm dev:vpn`, puerto 4201.)

### Crear datos de prueba

La base arranca vacía, así que la pantalla mostrará "No hay menús disponibles". Crea menús con la API
(`price` es un entero ≥ 0):

```bash
curl -X POST http://127.0.0.1:3000/api/menus \
  -H 'Content-Type: application/json' \
  -d '{"commerce":"Pepezolano","products":[{"product":"Producto 1","price":5000},{"product":"Producto 2","price":3000}]}'
```

Otros endpoints: `GET /api/menus`, `GET|PUT|DELETE /api/menus/:id`. Para empezar de cero en local,
para la API y borra `apps/api/data/api.sqlite*` (incluye los ficheros `-wal`/`-shm`).

### Qué probar en la pantalla

1. El selector muestra el nombre del comercio; al elegir uno aparecen sus productos y precios.
2. `+` / `−` cambian la cantidad (nunca por debajo de 0); el resumen y el total se actualizan.
3. Cambiar de comercio reinicia las cantidades.
4. `Compartir pedido` está deshabilitado con el pedido vacío. En escritorio copia el texto al
   portapapeles; en un móvil abre la hoja de compartir (requiere HTTPS o `localhost`).
5. Para ver el error de carga, para la API y pulsa `Reintentar`.

### Tests y lint

```bash
pnpm test    # vitest en los frontends + node:test en la API (necesita pnpm build previo para la API)
pnpm lint
```

## Producción con Docker

Topología: `api` (Node, sin puertos publicados) + `web` (nginx sin privilegios) que sirve los frontends
y hace proxy de `/api/` a la API. Los datos se guardan en el volumen con nombre `home-rpi_api-data`
(montado como directorio `/data`).

> Los ficheros Docker están escritos y revisados estáticamente, pero **aún no se han ejecutado en esta
> base de código**. Verifica la primera puesta en marcha en tu Raspberry Pi (imágenes con soporte arm64).

### Requisitos

- Docker Engine con el plugin Compose v2 en el Raspberry Pi (o en la máquina donde construyas).

### Puesta en marcha

```bash
git clone <url-del-repo> home-rpi && cd home-rpi
cp .env.example .env        # ajusta puertos / LOG_LEVEL si hace falta (sin secretos)
pnpm docker:up              # = docker compose up -d --build --wait
```

Sin pnpm en el servidor, equivale a `docker compose up -d --build --wait`.

| Servicio                | URL por defecto                |
| ----------------------- | ------------------------------ |
| Pedidos (menu-order)    | `http://<ip-de-la-pi>:8080`    |
| VPN manager (scaffold)  | `http://<ip-de-la-pi>:8081`    |
| Salud de la API (proxy) | `http://<ip-de-la-pi>:8080/api/health` |

Puertos y nivel de log se cambian en `.env` (`WEB_MENU_PORT`, `WEB_VPN_PORT`, `LOG_LEVEL`).

Crear el primer menú en producción (a través del proxy):

```bash
curl -X POST http://<ip-de-la-pi>:8080/api/menus \
  -H 'Content-Type: application/json' \
  -d '{"commerce":"Pepezolano","products":[{"product":"Producto 1","price":5000}]}'
```

> La API no tiene autenticación: expón estos puertos solo en la red local, nunca a Internet.

### Operación

```bash
docker compose ps                 # estado y healthchecks
docker compose logs -f api web    # logs
pnpm docker:down                  # para y elimina contenedores; CONSERVA los datos
```

Actualizar tras un `git pull`: `pnpm docker:up` (reconstruye y reinicia; el volumen de datos persiste).

**Cuidado con los datos:** `docker compose down -v` borra el volumen `api-data` y, con él, la base de
datos. No lo uses sobre el proyecto real, ni `docker system prune`.

Copia de seguridad de la base (con la API parada para un fichero consistente, ya que SQLite usa WAL):

```bash
docker compose stop api
docker run --rm -v home-rpi_api-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/home-rpi-data-$(date +%F).tgz -C /data .
docker compose start api
```

### Prueba de integración

```bash
pnpm test:integration
```

Levanta un proyecto aislado (`home-rpi-it`, puertos 18080/18081 o `IT_MENU_PORT`/`IT_VPN_PORT`) y solo
hace `down -v` sobre ese proyecto, nunca sobre el real.
