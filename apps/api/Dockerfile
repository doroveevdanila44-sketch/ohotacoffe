# Сборка из корня репозитория: docker build -f apps/api/Dockerfile -t kbs-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @kbs/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @kbs/api && npm prune --omit=dev --workspace @kbs/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/config ./config
COPY --from=build /repo/apps/api/media ./media
COPY --from=build /repo/apps/api/package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
