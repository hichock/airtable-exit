#!/usr/bin/env bash
# Copies the app template and the project kit into a target folder (default: current folder).
# Safe to re-run: existing files are kept, never overwritten. Usage: bash scaffold.sh [target]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-.}"
mkdir -p "$TARGET"
copy() {
  (cd "$1" && find . -type f ! -path './node_modules/*' ! -path './.next/*' ! -path './.migrate/*' ! -name '*.tsbuildinfo' ! -name 'next-env.d.ts' -print0) |
  while IFS= read -r -d '' f; do
    dest="$TARGET/${f#./}"
    if [ -e "$dest" ]; then echo "keep  ${f#./}"; else mkdir -p "$(dirname "$dest")"; cp "$1/$f" "$dest"; echo "add   ${f#./}"; fi
  done
}
for part in template kit; do
  added=$(copy "$ROOT/$part" | { grep -c '^add' || true; })
  echo "$part: $added files added"
done
chmod +x "$TARGET/.claude/hooks/session-start.sh" "$TARGET/scripts/test-migrations-local.sh" 2>/dev/null || true
echo "Done. Next: cd $TARGET && npm install && npm run demo"
