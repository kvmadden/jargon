#!/usr/bin/env bash
set -euo pipefail

pg_bin="${PG_BIN:-}"
if [[ -z "$pg_bin" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@17/bin/pg_ctl ]]; then
    pg_bin=/opt/homebrew/opt/postgresql@17/bin
  elif command -v pg_ctl >/dev/null 2>&1; then
    pg_bin=$(dirname "$(command -v pg_ctl)")
  else
    echo 'PostgreSQL 17 is required (set PG_BIN to its bin directory).' >&2
    exit 1
  fi
fi

readonly pg_bin
readonly pg_port="${PG_PORT:-55439}"
temp_base="${TMPDIR:-/tmp}"
readonly temp_base="${temp_base%/}"
test_root=$(mktemp -d "$temp_base/jargon-ai-spend-acl.XXXXXX")
readonly test_root
readonly pg_data="$test_root/data"
readonly socket_dir="$test_root/socket"
mkdir "$socket_dir"

cleanup() {
  "$pg_bin/pg_ctl" -D "$pg_data" -m fast stop >/dev/null 2>&1 || true
  case "$test_root" in
    "$temp_base"/jargon-ai-spend-acl.*)
      rm -rf -- "$test_root"
      ;;
    *)
      echo "Refusing to remove unexpected test path: $test_root" >&2
      ;;
  esac
}
trap cleanup EXIT

"$pg_bin/initdb" \
  -D "$pg_data" \
  --auth=trust \
  --encoding=UTF8 \
  --no-locale >/dev/null

"$pg_bin/pg_ctl" \
  -D "$pg_data" \
  -l "$test_root/postgres.log" \
  -o "-c listen_addresses='' -p $pg_port -k $socket_dir" \
  -w start >/dev/null

"$pg_bin/psql" \
  -X \
  --host="$socket_dir" \
  --port="$pg_port" \
  --dbname=postgres \
  --file=supabase/tests/test_ai_spend_acl.sql
