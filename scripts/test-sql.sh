#!/usr/bin/env bash
# Runs every supabase/tests/test_*.sql file against the real migrations, each
# in its own disposable PostgreSQL 17 cluster, and fails if any file fails.
# Usage: npm run test:sql   (set PG_BIN to the PostgreSQL 17 bin directory)
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
readonly pg_port="${PG_PORT:-55440}"
temp_base="${TMPDIR:-/tmp}"
readonly temp_base="${temp_base%/}"

cd "$(dirname "$0")/.."

run_one() {
  local sql_file="$1"
  local test_root
  test_root=$(mktemp -d "$temp_base/jargon-sql-test.XXXXXX")
  local pg_data="$test_root/data"
  local socket_dir="$test_root/socket"
  mkdir "$socket_dir"

  "$pg_bin/initdb" -D "$pg_data" --auth=trust --encoding=UTF8 --no-locale >/dev/null
  "$pg_bin/pg_ctl" -D "$pg_data" -l "$test_root/postgres.log" \
    -o "-c listen_addresses='' -p $pg_port -k $socket_dir" -w start >/dev/null

  local status=0
  "$pg_bin/psql" -X --quiet --host="$socket_dir" --port="$pg_port" --dbname=postgres \
    --set=ON_ERROR_STOP=1 --file="$sql_file" || status=$?

  "$pg_bin/pg_ctl" -D "$pg_data" -m fast stop >/dev/null 2>&1 || true
  case "$test_root" in
    "$temp_base"/jargon-sql-test.*) rm -rf -- "$test_root" ;;
    *) echo "Refusing to remove unexpected test path: $test_root" >&2 ;;
  esac
  return "$status"
}

failed=0
count=0
for f in supabase/tests/test_*.sql; do
  count=$((count + 1))
  echo "== $f"
  if ! run_one "$f"; then
    echo "FAILED: $f" >&2
    failed=$((failed + 1))
  fi
done

echo "$((count - failed)) of $count SQL test files passed"
[[ "$failed" -eq 0 ]]
