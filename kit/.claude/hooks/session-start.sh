#!/usr/bin/env bash
# Prints the knowledge base map, the latest decisions and open setup steps at the start of every session,
# so every skill starts from what the project already knows. Output becomes session context.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f kb/README.md ] || exit 0
echo "## airtable-exit project. Read kb/RULES.md and follow it. Read kb/context.md before any task."
echo "Use the skills in .claude/skills (routing table in CLAUDE.md); don't do migration steps freehand."
echo
sed -n '1,60p' kb/README.md
if [ -f kb/decisions.md ] && grep -qE '^- ' kb/decisions.md; then
  echo; echo "## Latest decisions"
  grep -m 12 -E '^- ' kb/decisions.md
fi
if [ -f kb/setup-state.md ] && grep -q '\[ \]' kb/setup-state.md; then
  echo; echo "## Setup is not finished. Open steps:"; grep '\[ \]' kb/setup-state.md | head -5
  echo "Resume with /airtable-exit:setup (plugin) or follow kb/setup-state.md before other work."
fi
n=$(grep -rn "needs input" kb 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] && { echo; echo "Open 'needs input' items in kb/: $n (kb-tidy lists them)."; }
echo; echo "Stuck? The get-help skill sends the problem to the bundle's author (or email info@lowcoding.dev)."
exit 0
