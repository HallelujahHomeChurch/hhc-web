#!/usr/bin/env bash
set -euo pipefail
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
# A failed public channel is unverified, not evidence that the ACA app is unhealthy.
if ! curl --silent --show-error --max-time 45 --output "$scratch/body" \
  --write-out '%{http_code}' https://www.alive.org.tw/zh-Hant/maintenance >"$scratch/status"; then
  echo 'Public website verification unavailable' >&2
  exit 20
fi
if [[ "$(cat "$scratch/status")" != 200 ]] || ! grep -q '<html' "$scratch/body" || ! grep -q '</html>' "$scratch/body"; then
  echo 'Public website acceptance failed; application health is not established by this response' >&2
  exit 20
fi
if ! curl --fail --silent --show-error --max-time 20 \
  https://admin.alive.org.tw/assets/weekly/v1/manifest.json --output "$scratch/weekly.json" ||
  ! jq -e '.version == "v1" and (.assets | type == "array" and length > 0)' "$scratch/weekly.json" >/dev/null; then
  echo 'Gateway weekly asset route could not be verified' >&2
  exit 20
fi
for host in www.alive.org.tw account.alive.org.tw admin.alive.org.tw; do
  if ! status="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' \
    --header 'Content-Type: application/reports+json' --data-binary '[]' "https://$host/csp-report")" || [[ "$status" != 204 ]]; then
    echo "Gateway CSP route could not be verified for $host" >&2
    exit 20
  fi
done
