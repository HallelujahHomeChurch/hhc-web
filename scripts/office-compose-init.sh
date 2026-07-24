#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file="$root/compose/.env.compose.local"
account_api="$root/../account/account-api"

if [ -e "$env_file" ]; then
  printf '%s\n' "Refusing to overwrite $env_file" >&2
  exit 1
fi

cp "$root/compose/.env.example" "$env_file"
key_dir=$(mktemp -d)
trap 'rm -rf "$key_dir"' EXIT
keys=$("$account_api/scripts/generate-keys.sh" --output-dir "$key_dir")

set_value() {
  key=$1
  value=$2
  escaped=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')
  sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$env_file"
  rm -f "$env_file.bak"
}

set_value ADMIN_INIT_PASSWORD "$(openssl rand -base64 24)"
set_value REFRESH_TOKEN_SECRET "$(openssl rand -hex 32)"
set_value MFA_ENCRYPTION_KEY "$(openssl rand -hex 16)"
set_value ASSET_LOCAL_SIGNING_KEY "$(openssl rand -hex 32)"
set_value POSTGRES_PASSWORD "$(openssl rand -hex 24)"
set_value ACCOUNT_DB_PASSWORD "$(openssl rand -hex 24)"
set_value WEB_DB_PASSWORD "$(openssl rand -hex 24)"
set_value ASSET_DB_PASSWORD "$(openssl rand -hex 24)"
set_value NOTIFICATION_INTERNAL_TOKEN "$(openssl rand -hex 32)"

for key in JWT_PRIVATE_KEY JWT_PUBLIC_KEY JWT_KEY_ID CSRF_SECRET; do
  value=$(printf '%s\n' "$keys" | sed -n "s/^${key}=//p")
  set_value "$key" "$value"
done

printf '%s\n' "Created $env_file"
printf '%s\n' "Set Azure DNS credentials and ACME_EMAIL before starting Compose."
