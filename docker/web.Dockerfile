# nginx que sirve los dos frontends Angular y hace proxy de /api/ hacia la API.
ARG NODE_IMAGE=node:24.22.0-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28-alpine

# ---- build: compila contracts y ambos frontends ----
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
ARG PNPM_VERSION=12.14.0
RUN npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/menu-order-generator/package.json apps/menu-order-generator/
COPY apps/rpi-vpn-manager/package.json apps/rpi-vpn-manager/
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN test "$(pnpm -v)" = "$(node -p "require('./package.json').packageManager.split('@')[1]")" \
 && pnpm install --frozen-lockfile \
      --filter "@home-rpi/menu-order-generator..." --filter "@home-rpi/rpi-vpn-manager..."

# contracts se compila antes: menu-order-generator importa sus tipos desde dist/ (import type).
COPY packages/contracts packages/contracts
COPY apps/menu-order-generator apps/menu-order-generator
COPY apps/rpi-vpn-manager apps/rpi-vpn-manager
RUN pnpm --filter @home-rpi/contracts build \
 && pnpm --filter @home-rpi/menu-order-generator build \
 && pnpm --filter @home-rpi/rpi-vpn-manager build

# ---- runtime: nginx sin privilegios (usuario nginx, puertos 8080/8081) ----
FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/menu-order-generator/dist/menu-order-generator/browser /usr/share/nginx/html/menu
COPY --from=build /repo/apps/rpi-vpn-manager/dist/rpi-vpn-manager/browser /usr/share/nginx/html/vpn
EXPOSE 8080 8081
