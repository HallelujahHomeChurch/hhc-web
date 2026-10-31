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
