#!/bin/sh
set -eu

grep -q 'AS build' Dockerfile
grep -q 'pnpm install --frozen-lockfile' Dockerfile
grep -q 'listen 10000' nginx.conf
grep -q 'location = /health' nginx.conf
grep -q 'try_files \$uri \$uri.html \$uri/index.html =404' nginx.conf
