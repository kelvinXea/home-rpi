# API Fastify + SQLite. Contexto de build: raíz del repo (ver docker-compose.yml).
ARG NODE_IMAGE=node:24.22.0-bookworm-slim

# ---- build: instala, compila contracts + api y extrae solo producción ----
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
# Debe coincidir con "packageManager" del package.json raíz (se comprueba abajo).
ARG PNPM_VERSION=12.14.0
RUN npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
# Los demás miembros del workspace deben existir para resolver el lockfile.
COPY apps/menu-order-generator/package.json apps/menu-order-generator/
COPY apps/rpi-vpn-manager/package.json apps/rpi-vpn-manager/
RUN test "$(pnpm -v)" = "$(node -p "require('./package.json').packageManager.split('@')[1]")" \
 && pnpm install --frozen-lockfile --filter "@home-rpi/api..."

COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @home-rpi/contracts build \
 && pnpm --filter @home-rpi/api build \
 && pnpm --filter @home-rpi/api --prod deploy /out \
 && rm -rf /out/src /out/dist/test /out/tsconfig.json /out/pnpm-lock.yaml /out/pnpm-workspace.yaml

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/home-rpi.sqlite
# /data existe y es del usuario no root: un volumen nuevo hereda este propietario.
RUN mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "dist/server.js"]
