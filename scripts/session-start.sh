#!/usr/bin/env bash
# Plugin SessionStart hook. Its output becomes session context.
# Once setup has copied the kit, the project's own .claude/hooks/session-start.sh prints the
# knowledge base map instead, so this script stays silent there.
dir="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$dir/.claude/hooks/session-start.sh" ] && exit 0
echo "airtable-exit plugin is installed. Plugin files: ${CLAUDE_PLUGIN_ROOT:-unknown} (template/ and kit/ live there)."
echo "This folder has no airtable-exit project yet. When the owner wants to move off Airtable, leave Airtable,"
echo "or build their own CRM from an Airtable base, run /airtable-exit:setup (it is resumable)."
exit 0
