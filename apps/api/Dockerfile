# Two stages: the build image carries the toolchain, the run image does not.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Cloud Run sets PORT and overrides this; it documents the default.
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
