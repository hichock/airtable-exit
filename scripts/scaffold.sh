#!/usr/bin/env bash
# Copies the app template and the project kit into a target folder (default: current folder).
# Safe to re-run: existing files are kept, never overwritten. Usage: bash scaffold.sh [target]
# The one exception: the ignore rules for secrets and private data are always added to the target's .gitignore,
# even when it already had one, and a pre-commit hook that refuses staged env files is installed if the repo has none.
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
chmod +x "$TARGET/.claude/hooks/session-start.sh" "$TARGET/scripts/test-migrations-local.sh" "$TARGET/scripts/check-staged.sh" 2>/dev/null || true

# Ignore rules that must be there whatever the target's .gitignore said. ".env*" must come before "!.env.example".
GI="$TARGET/.gitignore"
touch "$GI"
missing=()
if ! grep -qxF '.env*' "$GI" || ! grep -qxF '!.env.example' "$GI"; then missing+=('.env*' '!.env.example'); fi
for l in node_modules/ .next/ .migrate/ '*.tsbuildinfo' next-env.d.ts .vercel/; do grep -qxF -- "$l" "$GI" || missing+=("$l"); done
if [ ${#missing[@]} -gt 0 ]; then
  [ -s "$GI" ] && [ -n "$(tail -c1 "$GI")" ] && echo >> "$GI"
  { echo "# airtable-exit: secrets and private data stay out of git"; printf '%s\n' "${missing[@]}"; } >> "$GI"
  echo "gitignore: added ${missing[*]}"
fi

# In a git repo: prove .env.local is ignored, and refuse staged env files on every commit.
if git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git -C "$TARGET" check-ignore -q .env.local; then
    echo "ERROR: .env.local is not ignored by git in $TARGET (a rule like !.env.local overrides it). Fix .gitignore before committing." >&2
    exit 1
  fi
  hooks="$(git -C "$TARGET" rev-parse --git-path hooks)"; case "$hooks" in /*) ;; *) hooks="$TARGET/$hooks" ;; esac
  prefix="$(git -C "$TARGET" rev-parse --show-prefix)"
  if [ -z "$(git -C "$TARGET" config core.hooksPath || true)" ] && [ ! -e "$hooks/pre-commit" ]; then
    mkdir -p "$hooks"
    printf '#!/bin/sh\n# Installed by airtable-exit scaffold.sh: refuses commits that stage env or private files.\nexec bash "$(git rev-parse --show-toplevel)/%sscripts/check-staged.sh"\n' "$prefix" > "$hooks/pre-commit"
    chmod +x "$hooks/pre-commit"
    echo "git: pre-commit hook refuses staged env files"
  fi
fi
echo "Done. Next: cd $TARGET && npm install && npm run demo"
