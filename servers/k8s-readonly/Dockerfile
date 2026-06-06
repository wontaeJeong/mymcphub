FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.js ./
COPY servers/k8s-readonly ./servers/k8s-readonly
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mcp-hub/server-k8s-readonly build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5102
COPY --from=build /app/servers/k8s-readonly/package.json ./package.json
COPY --from=build /app/servers/k8s-readonly/dist ./dist
EXPOSE 5102
CMD ["node", "dist/index.js"]
