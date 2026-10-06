# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc pnpm install --frozen-lockfile

COPY . .
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ARG NEXT_PUBLIC_SENTRY_RELEASE=
ARG NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=false
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_RELEASE=$NEXT_PUBLIC_SENTRY_RELEASE
ENV NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=$NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  set -eu; \
  export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)"; \
  pnpm build; \
  if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then \
    pnpm exec sentry-cli sourcemaps inject .next/static; \
    pnpm exec sentry-cli sourcemaps upload --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" \
      --release "$NEXT_PUBLIC_SENTRY_RELEASE" .next/static; \
    find .next -type f -name '*.map' -delete; \
  fi

# ponytail: temporary OpenSSL overlay; remove when the upstream runtime passes the image scan.
FROM debian:trixie-slim@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a AS runtime-patch
WORKDIR /tmp
RUN apt-get update && apt-get download libssl3t64=3.5.7-1~deb13u3 \
  && dpkg-deb --extract libssl3t64_*.deb /patched \
  && mkdir -p /patched/var/lib/dpkg/status.d \
  && dpkg-deb --field libssl3t64_*.deb > /patched/var/lib/dpkg/status.d/libssl3t64 \
  && dpkg-deb --control libssl3t64_*.deb /control \
  && cp /control/md5sums /patched/var/lib/dpkg/status.d/libssl3t64.md5sums

FROM gcr.io/distroless/nodejs22-debian13@sha256:4e4fb0ce55fd73901600796ef079a9490369d2515d7da31633a91608c82ca13b AS runtime

COPY --from=runtime-patch /patched/ /

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=build --chown=nonroot:nonroot /app/.next/static ./.next/static
COPY --from=build --chown=nonroot:nonroot /app/public ./public

EXPOSE 10000
USER nonroot:nonroot

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:10000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["server.js"]
