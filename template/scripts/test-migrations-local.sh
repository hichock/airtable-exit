#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (no credentials), then runs the RLS checks.
# Needs Postgres binaries (initdb, pg_ctl, psql). Usage: bash scripts/test-migrations-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb)")"
PORT="${PORT:-$((54000 + RANDOM % 1000))}"
DIR="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUN_AS=(runuser -u postgres --); fi
cleanup() { "${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
"${RUN_AS[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres >/dev/null
"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/stub-supabase.sql
for f in supabase/migrations/*.sql; do echo "apply $f"; "${PSQL[@]}" -f "$f"; done
for f in supabase/tests/rls*.sql; do echo "check $f"; "${PSQL[@]}" -f "$f"; done
