FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js ./
COPY servers/internal-docs ./servers/internal-docs
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-hub/server-internal-docs build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5101
COPY --from=build /app/servers/internal-docs/package.json ./package.json
COPY --from=build /app/servers/internal-docs/dist ./dist
EXPOSE 5101
CMD ["node", "dist/index.js"]
