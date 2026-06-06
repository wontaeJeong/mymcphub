FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js ./
COPY packages/mcp-protocol ./packages/mcp-protocol
COPY apps/stdio-adapter ./apps/stdio-adapter
COPY servers/stdio-sample ./servers/stdio-sample
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-hub/mcp-protocol build
RUN pnpm --filter @mcp-hub/server-stdio-sample build
RUN pnpm --filter @mcp-hub/stdio-adapter build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5103
COPY --from=build /app/apps/stdio-adapter/package.json ./package.json
COPY --from=build /app/apps/stdio-adapter/dist ./dist
COPY --from=build /app/servers/stdio-sample/dist ./servers/stdio-sample/dist
COPY --from=build /app/packages/mcp-protocol/dist ./node_modules/@mcp-hub/mcp-protocol/dist
COPY --from=build /app/packages/mcp-protocol/package.json ./node_modules/@mcp-hub/mcp-protocol/package.json
EXPOSE 5103
CMD ["node", "dist/index.js"]
