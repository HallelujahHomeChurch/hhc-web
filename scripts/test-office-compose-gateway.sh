#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file="$root/compose/.env.compose.local"

if [ ! -f "$env_file" ]; then
  printf '%s\n' "Missing $env_file; run scripts/office-compose-init.sh first." >&2
  exit 1
fi

cd "$root"
docker compose --env-file "$env_file" config --quiet
docker compose --env-file "$env_file" up --build -d postgres redis notification-api account-migrate account-api asset-api hhc-web-api api-gateway web account admin
docker compose --env-file "$env_file" exec -T api-gateway nginx -t

assert_host() {
  host=$1
  expected=$2
  actual=$(docker compose --env-file "$env_file" exec -T api-gateway sh -c "wget -qSO- --header='Host: $host' http://127.0.0.1:10000/health 2>&1 | awk '/HTTP\\// { print \\$2; exit }'")
  [ "$actual" = "$expected" ] || {
    printf '%s\n' "Expected $host /health to return $expected, got $actual" >&2
    exit 1
  }
}

assert_host www-test.alive.org.tw 200
assert_host account-test.alive.org.tw 200
assert_host admin-test.alive.org.tw 200
printf '%s\n' "Gateway office host routing passed."
