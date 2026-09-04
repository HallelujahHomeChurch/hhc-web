#!/bin/sh
set -eu

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
grep -q 'docker build --secret id=npmrc' "$workflow"
scanner='ghcr.io/aquasecurity/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969'
test "$(grep -Fc "$scanner" "$ci_workflow")" -eq 2
test "$(grep -Fc "$scanner" "$workflow")" -eq 6
grep -Fq 'fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1' "$ci_workflow"
grep -Fq 'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 hhc-web:verify' "$ci_workflow"
grep -Fq 'fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1' "$workflow"
grep -Fq 'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 hhc-web:verify' "$workflow"
grep -Fq 'docker pull "$IMAGE_REF"' "$workflow"
grep -Fq 'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE_REF"' "$workflow"
scan_line="$(grep -nF 'name: Scan immutable image' "$workflow" | cut -d: -f1)"
what_if_line="$(grep -nF 'name: Preview infrastructure change' "$workflow" | cut -d: -f1)"
test "$scan_line" -lt "$what_if_line"
grep -q '^  set -eu;' Dockerfile
grep -Fq 'FROM gcr.io/distroless/nodejs22-debian13@sha256:4e4fb0ce55fd73901600796ef079a9490369d2515d7da31633a91608c82ca13b AS runtime' Dockerfile
grep -Fq 'CMD ["/nodejs/bin/node", "-e", "fetch(' Dockerfile
grep -q 'az deployment group what-if' "$workflow"
grep -q 'for path in health zh-Hant/maintenance' "$workflow"
grep -q 'for attempt in {1..12}' "$workflow"
grep -q 'sleep 5' "$workflow"
grep -q 'v1.0/invoke/hhc-web/method/${path}' "$workflow"
grep -q 'PREVIOUS_READY_REVISION' "$workflow"
grep -q 'PREVIOUS_IMAGE_REF=' "$workflow"
grep -q -- '--image "$PREVIOUS_IMAGE_REF"' "$workflow"

grep -q "name: 'hhc-web'" "$infra"
grep -q "appId: 'hhc-web'" "$infra"
grep -q "path: '/health'" "$infra"
grep -q "cpu: json('0.5')" "$infra"
grep -q "memory: '1Gi'" "$infra"
grep -A4 "type: 'Liveness'" "$infra" | grep -q 'initialDelaySeconds: 20'
grep -A4 "type: 'Readiness'" "$infra" | grep -q 'initialDelaySeconds: 20'
grep -q "minReplicas: 1" "$infra"

if grep -q 'external:' "$infra"; then
  echo 'hhc-web must remain internal and be reached through Dapr' >&2
  exit 1
fi
