#!/usr/bin/env bash
# Prueba de integración con Docker Compose en un proyecto AISLADO (home-rpi-it):
# otros puertos, otro volumen. No toca el entorno ni los datos del proyecto real.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="home-rpi-it"
export WEB_MENU_PORT="${IT_MENU_PORT:-18080}"
export WEB_VPN_PORT="${IT_VPN_PORT:-18081}"
export LOG_LEVEL="warn"
DC=(docker compose -p "$PROJECT" -f docker-compose.yml)

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

for port in "$WEB_MENU_PORT" "$WEB_VPN_PORT"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    fail "el puerto $port ya está en uso; define IT_MENU_PORT/IT_VPN_PORT con otros libres"
  fi
done

# Solo se borran recursos del proyecto de prueba (down -v NUNCA sobre el proyecto real).
cleanup() {
  "${DC[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

http() { curl -fsS --max-time 10 "$@"; }

check_stack() {
  local menu="http://127.0.0.1:$WEB_MENU_PORT" vpn="http://127.0.0.1:$WEB_VPN_PORT" body
  for base in "$menu" "$vpn"; do
    body="$(http "$base/api/health")" || fail "/api/health no responde por $base"
    [[ "$body" == *'"status":"ok"'* && "$body" == *'"database":"ok"'* ]] || fail "health inesperado en $base: $body"
  done
  ok "/api/health responde por el proxy en ambos puertos"

  [[ "$(http -o /dev/null -w '%{http_code}' "$menu/")" == 200 ]] || fail "menu: HTTP != 200"
  body="$(http "$menu/")"
  [[ "$body" == *'<app-root'* && "$body" == *'<title>MenuOrderGenerator</title>'* ]] || fail "menu: index.html inesperado"
  [[ "$(http -o /dev/null -w '%{http_code}' "$vpn/")" == 200 ]] || fail "vpn: HTTP != 200"
  body="$(http "$vpn/")"
  [[ "$body" == *'<app-root'* && "$body" == *'<title>RpiVpnManager</title>'* ]] || fail "vpn: index.html inesperado"
  ok "ambos frontends devuelven 200 con app-root y su <title>"
}

# Ejecuta JS dentro del contenedor api sobre la base real del volumen.
api_db() {
  "${DC[@]}" exec -T api node -e "
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/data/home-rpi.sqlite', (e) => { if (e) throw e; });
db.serialize(() => { $1 });
db.close();
"
}

echo "== Build y arranque (--build --wait) =="
"${DC[@]}" up -d --build --wait
check_stack

if "${DC[@]}" port api 3000 2>/dev/null | grep -q .; then
  fail "api publica un puerto en el host"
fi
ok "api no publica puertos"

echo "== Persistencia =="
api_db "
db.run('CREATE TABLE IF NOT EXISTS it_marker (v TEXT)');
db.run(\"INSERT INTO it_marker VALUES ('persistente')\");
"
before="$(api_db "db.all('SELECT version, name, applied_at FROM schema_migrations ORDER BY version', (e, r) => { if (e) throw e; console.log(JSON.stringify(r)); });")"
[[ "$before" == *'0001_initial'* ]] || fail "schema_migrations sin 0001_initial: $before"

"${DC[@]}" down
"${DC[@]}" up -d --wait
check_stack

after="$(api_db "db.all('SELECT version, name, applied_at FROM schema_migrations ORDER BY version', (e, r) => { if (e) throw e; console.log(JSON.stringify(r)); });")"
[[ "$before" == "$after" ]] || fail "schema_migrations cambió tras down+up: antes=$before después=$after"
marker="$(api_db "db.get('SELECT v FROM it_marker', (e, r) => { if (e) throw e; console.log(r && r.v); });")"
[[ "$marker" == persistente ]] || fail "el marcador no sobrevivió a down+up"
ok "la base SQLite y schema_migrations sobreviven a down + up (volumen con nombre)"

echo "INTEGRATION TEST OK"
