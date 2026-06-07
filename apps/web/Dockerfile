FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --filter @mcp-hub/web... --frozen-lockfile --network-concurrency=1 --child-concurrency=1
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
RUN pnpm --filter @mcp-hub/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@mcp-hub/web", "start"]
