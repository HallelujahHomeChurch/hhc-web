# syntax=docker/dockerfile:1.7
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build

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
ARG NEXT_PUBLIC_WEEKLY_READER_ENABLED=false
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_RELEASE=$NEXT_PUBLIC_SENTRY_RELEASE
ENV NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=$NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED
ENV NEXT_PUBLIC_WEEKLY_READER_ENABLED=$NEXT_PUBLIC_WEEKLY_READER_ENABLED
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  set -eu; \
  export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)"; \
  pnpm build; \
  if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then \
    pnpm exec sentry-cli sourcemaps inject .next/static; \
  fi

# Private retry artifact; never deployed as the website image.
FROM scratch AS source_maps
ARG NEXT_PUBLIC_SENTRY_RELEASE=
LABEL org.opencontainers.image.revision=$NEXT_PUBLIC_SENTRY_RELEASE
COPY --from=build /app/.next/static/ /

FROM build AS stripped_build
RUN find .next -type f -name '*.map' -delete

# ponytail: temporary OpenSSL overlay; remove when the upstream runtime passes the image scan.
FROM debian:trixie-slim@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a AS runtime-patch
WORKDIR /tmp
RUN apt-get update && apt-get download libssl3t64=3.5.7-1~deb13u3 \
  && dpkg-deb --extract libssl3t64_*.deb /patched \
  && mkdir -p /patched/var/lib/dpkg/status.d \
  && dpkg-deb --field libssl3t64_*.deb > /patched/var/lib/dpkg/status.d/libssl3t64 \
  && dpkg-deb --control libssl3t64_*.deb /control \
  && cp /control/md5sums /patched/var/lib/dpkg/status.d/libssl3t64.md5sums

FROM gcr.io/distroless/nodejs22-debian13@sha256:6f5d43e96551e0240e604d3b2068fd0584d9f58b64ff868cbf14fa7abc3521b4 AS runtime

COPY --from=runtime-patch /patched/ /

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    HOSTNAME=0.0.0.0

COPY --from=stripped_build --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=stripped_build --chown=nonroot:nonroot /app/.next/static ./.next/static
COPY --from=stripped_build --chown=nonroot:nonroot /app/public ./public
COPY --from=stripped_build --chown=nonroot:nonroot /app/scripts/diagnose-dapr-port.mjs ./diagnose-dapr-port.mjs

EXPOSE 10000
USER nonroot:nonroot

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:10000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["server.js"]
