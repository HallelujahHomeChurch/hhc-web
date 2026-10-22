#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Candidate port evidence unavailable; socket owner remains unknown."' ERR

if [[ ! "$IMAGE_REF" =~ @sha256:[0-9a-f]{64}$ ]]; then
  echo 'Unpinned candidate image; socket owner remains unknown.'
  exit 0
fi
revision="$(az containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" --query properties.latestRevisionName -o tsv --only-show-errors 2>/dev/null)"
[[ "$revision" =~ ^[a-zA-Z0-9_-]+$ ]]
if [[ "$revision" == "${PREVIOUS_READY_REVISION:-}" ]]; then
  echo 'No matching candidate revision; socket owner remains unknown.'
  exit 0
fi
image="$(az containerapp revision show -g "$RESOURCE_GROUP" -n "$APP_NAME" --revision "$revision" --query properties.template.containers[0].image -o tsv --only-show-errors 2>/dev/null)"
if [[ "$image" != "$IMAGE_REF" ]]; then
  echo 'No matching candidate revision; socket owner remains unknown.'
  exit 0
fi

replicas="$(az containerapp replica list -g "$RESOURCE_GROUP" -n "$APP_NAME" --revision "$revision" \
  --query '[].{name:name,containers:properties.containers[].{name:name,ready:ready}}' -o json --only-show-errors 2>/dev/null)"
targets="$(jq -r 'sort_by(any((.containers // [])[]; .name == "daprd" and .ready == true)) | .[].name' <<< "$replicas" 2>/dev/null)"
if [[ -z "$targets" ]]; then
  echo 'Candidate has no replicas; socket owner remains unknown.'
  exit 0
fi

while IFS= read -r replica; do
  [[ "$replica" =~ ^[a-zA-Z0-9_-]+$ ]]
  if output="$(timeout --kill-after=2s 12s script -q -e -c \
    "az containerapp exec -g \"$RESOURCE_GROUP\" -n \"$APP_NAME\" --revision \"$revision\" --replica \"$replica\" --container \"$APP_NAME\" --command \"/nodejs/bin/node /app/diagnose-dapr-port.mjs\"" \
    /dev/null </dev/null 2>&1)"; then
    # Emit only the helper schema, never console banners, commands or errors.
    if ! printf '%s\n' "$output" | node scripts/diagnose-dapr-port.mjs --sanitize-console; then
      echo 'Candidate diagnostic response unavailable; socket owner remains unknown.'
    fi
  else
    echo 'Replica console unavailable; socket owner remains unknown.'
  fi
done <<< "$targets"
