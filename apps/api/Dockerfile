# Built from the repo root, because the service imports @fantasy-cricket/shared
# and npm workspaces resolve it through the root node_modules.
#
# Two stages: the build image carries the toolchain, the run image does not.
FROM node:22-slim AS build
WORKDIR /app

# Manifests first, so a dependency layer is only rebuilt when they change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @fantasy-cricket/api --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.json ./
RUN npm run build --workspace @fantasy-cricket/api

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @fantasy-cricket/api --include-workspace-root \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./apps/api/dist
# Types only, but the workspace link must resolve for Node to start.
COPY packages/shared ./packages/shared

# Cloud Run sets PORT and overrides this; it documents the default.
EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/index.js"]
