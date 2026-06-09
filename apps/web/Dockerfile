FROM node:22-alpine AS build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${http_proxy} \
    https_proxy=${https_proxy} \
    no_proxy=${no_proxy} \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY deploy/certs/ /usr/local/share/ca-certificates/
RUN if find /usr/local/share/ca-certificates -type f -name '*.crt' -size +0c | grep -q .; then update-ca-certificates; fi
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
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
RUN apk add --no-cache ca-certificates
COPY deploy/certs/ /usr/local/share/ca-certificates/
RUN if find /usr/local/share/ca-certificates -type f -name '*.crt' -size +0c | grep -q .; then update-ca-certificates; fi
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
RUN adduser -D -u 10001 appuser
COPY --from=build /app ./
USER appuser
EXPOSE 3000
CMD ["pnpm", "--filter", "@mcp-hub/web", "start"]
