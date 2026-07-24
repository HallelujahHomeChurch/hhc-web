#!/usr/bin/env sh
set -eu

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=account_db_user="$ACCOUNT_DB_USER" \
  --set=account_db_password="$ACCOUNT_DB_PASSWORD" \
  --set=web_db_user="$WEB_DB_USER" \
  --set=web_db_password="$WEB_DB_PASSWORD" \
  --set=asset_db_user="$ASSET_DB_USER" \
  --set=asset_db_password="$ASSET_DB_PASSWORD" <<'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'account_db_user', :'account_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'account_db_user') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'web_db_user', :'web_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'web_db_user') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'asset_db_user', :'asset_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'asset_db_user') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', 'account_db', :'account_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'account_db') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'hhc_web', :'web_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hhc_web') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'asset', :'asset_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asset') \gexec

REVOKE ALL ON DATABASE account_db FROM PUBLIC;
REVOKE ALL ON DATABASE hhc_web FROM PUBLIC;
REVOKE ALL ON DATABASE asset FROM PUBLIC;
GRANT ALL PRIVILEGES ON DATABASE account_db TO :"account_db_user";
GRANT ALL PRIVILEGES ON DATABASE hhc_web TO :"web_db_user";
GRANT ALL PRIVILEGES ON DATABASE asset TO :"asset_db_user";
EOSQL
