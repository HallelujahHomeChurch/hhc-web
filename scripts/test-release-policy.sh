#!/bin/sh
set -eu
api_scale="$(awk '/^resource app / { in_api = 1; next } in_api && /^resource / { exit } in_api { print }' infra/main.bicep)"
for expected in 'minReplicas: 1' 'maxReplicas: 8' "name: 'cpu-scaler'" "type: 'cpu'" "type: 'Utilization'" "value: '50'" "name: 'http-scaler'" 'http: {' "concurrentRequests: '20'"; do
  printf '%s\n' "$api_scale" | grep -Fq "$expected"
done

workflow=.github/workflows/release.yml
ci_workflow=.github/workflows/ci.yml
infra=infra/main.bicep

grep -q 'workflow_dispatch:' "$workflow"
grep -q '^  push:' "$workflow"
grep -q 'branches: \[main\]' "$workflow"
grep -Fq "github.event_name == 'push' && 'deploy-hhc-web-production' || inputs.confirmation" "$workflow"
grep -q 'deploy-hhc-web-production' "$workflow"
grep -q 'environment: production' "$workflow"
grep -q 'id-token: write' "$workflow"
grep -q 'packages: read' "$workflow"
grep -q 'IMAGE_TAG=main-${GITHUB_SHA::7}' "$workflow"
grep -Fq 'image_args=(--secret id=npmrc' "$workflow"
grep -Fq 'docker build "${image_args[@]}" --target runtime' "$workflow"
scanner='ghcr.io/aquasecurity/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969'
test "$(grep -Fc "$scanner" "$ci_workflow")" -eq 2
test "$(grep -Fc "$scanner" "$workflow")" -eq 5
grep -Fq 'fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1' "$ci_workflow"
grep -Fq 'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 hhc-web:verify' "$ci_workflow"
grep -Fq 'fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1' "$workflow"
node --test scripts/release-image.node-test.mjs
node --test scripts/check-static-budgets.node-test.mjs
for file in "$ci_workflow" "$workflow"; do
  grep -Fq '/check-static-budgets.mjs --require-build' "$file"
  grep -Fq -- '-v "$PWD/src:/app/src:ro"' "$file"
  if grep -Eq '^ +corepack pnpm (build|perf:static)$|run: corepack pnpm (build|perf:static)$' "$file"; then
    echo 'Static budgets must inspect the built image without another host compilation' >&2
    exit 1
  fi
done
budget_line="$(grep -nF 'name: Check static budgets on the immutable production image' "$workflow" | cut -d: -f1)"
export_line="$(grep -nF 'name: Export verified immutable image' "$workflow" | cut -d: -f1)"
test "$budget_line" -lt "$export_line"
grep -Fq 'needs: [verify, prepare_image]' "$workflow"
grep -Fq "cancel-in-progress: \${{ github.event_name == 'pull_request' }}" "$ci_workflow"
grep -Fq 'docker pull "$IMAGE_REF"' "$workflow"
grep -Fq 'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE_REF"' "$workflow"
scan_line="$(grep -nF 'name: Scan immutable image' "$workflow" | cut -d: -f1)"
what_if_line="$(grep -nF 'name: Preview infrastructure change' "$workflow" | cut -d: -f1)"
test "$scan_line" -lt "$what_if_line"
grep -q '^  set -eu;' Dockerfile
grep -Fq 'FROM gcr.io/distroless/nodejs22-debian13@sha256:6f5d43e96551e0240e604d3b2068fd0584d9f58b64ff868cbf14fa7abc3521b4 AS runtime' Dockerfile
grep -Fq 'CMD ["/nodejs/bin/node", "-e", "fetch(' Dockerfile
grep -q 'az deployment group what-if' "$workflow"
grep -q 'for path in health zh-Hant/maintenance' "$workflow"
grep -q 'for attempt in {1..12}' "$workflow"
grep -q 'sleep 5' "$workflow"
grep -q 'v1.0/invoke/hhc-web/method/${path}' "$workflow"
grep -q 'PREVIOUS_READY_REVISION' "$workflow"
grep -q 'PREVIOUS_IMAGE_REF=' "$workflow"
grep -q -- '--image "$PREVIOUS_IMAGE_REF"' "$workflow"
grep -Fq "MEMBER_VIDEO_NAV_ENABLED: \${{ vars.MEMBER_VIDEO_NAV_ENABLED || 'false' }}" "$workflow"
grep -Fq -- '--build-arg NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED="$MEMBER_VIDEO_NAV_ENABLED"' "$workflow"
grep -Fq 'ARG NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=false' Dockerfile
grep -Fq 'ENV NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED=$NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED' Dockerfile

grep -q "name: 'hhc-web'" "$infra"
grep -q "appId: 'hhc-web'" "$infra"
grep -q "path: '/health'" "$infra"
grep -q "cpu: json('0.5')" "$infra"
grep -q "memory: '1Gi'" "$infra"
grep -A4 "type: 'Liveness'" "$infra" | grep -q 'initialDelaySeconds: 20'
grep -A4 "type: 'Readiness'" "$infra" | grep -q 'initialDelaySeconds: 20'
grep -A2 "type: 'Startup'" "$infra" | grep -Fq "httpGet: { path: '/health', port: 10000 }"
grep -A2 "type: 'Liveness'" "$infra" | grep -Fq "httpGet: { path: '/health', port: 10000 }"
grep -A2 "type: 'Readiness'" "$infra" | grep -Fq "httpGet: { path: '/v1.0/healthz', port: 3501 }"
grep -q "minReplicas: 1" "$infra"

if grep -q 'external:' "$infra"; then
  echo 'hhc-web must remain internal and be reached through Dapr' >&2
  exit 1
fi
