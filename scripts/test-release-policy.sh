#!/bin/sh
set -eu

workflow=.github/workflows/release.yml
infra=infra/main.bicep

grep -q 'workflow_dispatch:' "$workflow"
grep -q 'deploy-hhc-web-production' "$workflow"
grep -q 'environment: production' "$workflow"
grep -q 'id-token: write' "$workflow"
grep -q 'packages: read' "$workflow"
grep -q 'IMAGE_TAG=main-${GITHUB_SHA::7}' "$workflow"
grep -q 'docker build --secret id=npmrc' "$workflow"
grep -q 'az deployment group what-if' "$workflow"
grep -q 'for path in health zh-Hant/maintenance' "$workflow"
grep -q 'v1.0/invoke/hhc-web/method/${path}' "$workflow"
grep -q 'PREVIOUS_READY_REVISION' "$workflow"

grep -q "name: 'hhc-web'" "$infra"
grep -q "appId: 'hhc-web'" "$infra"
grep -q "path: '/health'" "$infra"
grep -q "minReplicas: 1" "$infra"

if grep -q 'external:' "$infra"; then
  echo 'hhc-web must remain internal and be reached through Dapr' >&2
  exit 1
fi
