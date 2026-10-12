# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter @homecloud/api...
RUN pnpm --filter @homecloud/api build
# Self-contained copy of the API with production dependencies only.
# --legacy: pnpm 10's default deploy requires injected workspace packages repo-wide.
RUN pnpm --filter @homecloud/api deploy --prod --legacy /app

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/server.js"]
