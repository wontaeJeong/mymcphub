FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js ./
COPY packages/mcp-protocol ./packages/mcp-protocol
COPY servers/stdio-sample ./servers/stdio-sample
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-hub/server-stdio-sample build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/servers/stdio-sample/package.json ./package.json
COPY --from=build /app/servers/stdio-sample/dist ./dist
COPY --from=build /app/packages/mcp-protocol/dist ./node_modules/@mcp-hub/mcp-protocol/dist
COPY --from=build /app/packages/mcp-protocol/package.json ./node_modules/@mcp-hub/mcp-protocol/package.json
CMD ["node", "dist/index.js"]
