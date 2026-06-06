FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js ./
COPY servers/echo ./servers/echo
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-hub/server-echo build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5100
COPY --from=build /app/servers/echo/package.json ./package.json
COPY --from=build /app/servers/echo/dist ./dist
EXPOSE 5100
CMD ["node", "dist/index.js"]
