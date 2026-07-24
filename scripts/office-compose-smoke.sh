#!/usr/bin/env sh
set -eu

hosts='www-test.alive.org.tw account-test.alive.org.tw admin-test.alive.org.tw'

wait_for() {
  host=$1
  attempt=1
  while [ "$attempt" -le 30 ]; do
    if curl --fail --silent --show-error --max-time 5 "https://$host/health" >/dev/null; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  printf '%s\n' "HTTPS health check unavailable for $host" >&2
  return 1
}

for host in $hosts; do
  wait_for "$host"
done

status=$(curl --silent --output /dev/null --write-out '%{http_code}' https://www-test.alive.org.tw/priv/)
[ "$status" = 404 ] || { printf '%s\n' "Public host exposed /priv/ with status $status" >&2; exit 1; }
status=$(curl --silent --output /dev/null --write-out '%{http_code}' https://admin-test.alive.org.tw/api/)
[ "$status" = 404 ] || { printf '%s\n' "Admin host exposed /api/ with status $status" >&2; exit 1; }

printf '%s\n' "Office HTTPS smoke test passed."
