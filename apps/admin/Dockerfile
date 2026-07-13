FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/hhc-web-client/package.json packages/hhc-web-client/package.json
COPY packages/preferences/package.json packages/preferences/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY apps/admin apps/admin
COPY packages/hhc-web-client packages/hhc-web-client
COPY packages/preferences packages/preferences
COPY packages/ui packages/ui
RUN pnpm --filter @hhc/admin build

FROM nginx:1.29-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:10000/health || exit 1
