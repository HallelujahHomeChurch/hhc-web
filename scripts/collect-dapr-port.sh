#!/usr/bin/env bash
set -euo pipefail

revision="$(az containerapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" --query properties.latestRevisionName -o tsv --only-show-errors)"
image="$(az containerapp revision show -g "$RESOURCE_GROUP" -n "$APP_NAME" --revision "$revision" --query properties.template.containers[0].image -o tsv --only-show-errors)"
if [[ "$image" != "$IMAGE_REF" ]]; then
  echo 'No matching candidate revision; port evidence unavailable.'
  exit 0
fi

replicas="$(az containerapp replica list -g "$RESOURCE_GROUP" -n "$APP_NAME" --revision "$revision" \
  --query '[].{name:name,containers:properties.containers[].{name:name,ready:ready}}' -o json --only-show-errors)"
targets="$(jq -r 'sort_by(any((.containers // [])[]; .name == "daprd" and .ready == true)) | .[].name' <<< "$replicas")"
if [[ -z "$targets" ]]; then
  echo 'Candidate has no replicas; port evidence unavailable.'
  exit 0
fi

while IFS= read -r replica; do
  printf 'Dapr port snapshot: revision=%s replica=%s\n' "$revision" "$replica"
  timeout 15s script -q -e -c \
    "az containerapp exec -g \"$RESOURCE_GROUP\" -n \"$APP_NAME\" --revision \"$revision\" --replica \"$replica\" --container \"$APP_NAME\" --command \"/nodejs/bin/node /app/diagnose-dapr-port.mjs\"" \
    /dev/null </dev/null || echo 'Replica console unavailable; socket owner remains unknown.'
done <<< "$targets"
