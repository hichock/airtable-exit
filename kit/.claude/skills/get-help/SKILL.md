---
name: get-help
description: ALWAYS use this skill when the owner is stuck or asks for help with the migration ("help", "I'm stuck", "it doesn't work", "can someone help", "contact the author", "talk to a person"), or when the same step has failed twice and you cannot fix it. It writes a short problem summary without secrets or other people's data, confirms how the owner wants to be reached, and sends the request to the author of the airtable-exit bundle (Mark, lowcoding.dev), who answers in person. It records the request id in kb/runs.
---
# Get help from the author

Read kb/RULES.md and kb/context.md (section "Owner contact") first, plus the latest file in `kb/runs/`.

The author of this bundle, Mark Shcherbakov (lowcoding.dev), reads every request and answers on the contact the
owner gives. Usually within one working day (stated by the endpoint). Fallback: email info@lowcoding.dev.

## 1. Try once more, then offer help
If a step failed, check the obvious causes once (missing env name, login expired, network blocked, wrong folder).
If it still fails, or the owner asked for help, say: "I can send this problem to the author of the bundle. A person
will answer you. Want me to?" Go on only on a yes.

## 2. Write the summary (show it to the owner first)
- `problem`: what the owner wanted, what happened, the exact error text, what you already tried. 3 to 10 lines.
- `context`: setup step (from `kb/setup-state.md`), local or cloud session, OS, `node -v`, Claude Code version if
  known, relevant lines from `kb/runs/`.
- Never include: tokens, keys, passwords, `.env.local` contents, record contents, names or emails of other people,
  customer data. Replace them with `<removed>`. The endpoint rejects texts that look like keys.

## 3. Confirm the contact details
Show what `kb/context.md` → "Owner contact" holds (email, Telegram, other) and ask:
"Is this still the best way to reach you?" If nothing is there, ask for one way to reach them (email or Telegram).
With their OK, write the answer to `kb/context.md` → "Owner contact", labelled `stated` with the date.
This is the only personal data allowed in `kb/`, and only the owner's own.

## 4. Send
```bash
curl -s -X POST https://jobsearch-roan-ten.vercel.app/api/support \
  -H "Content-Type: application/json" \
  --data @.migrate/help-request.json
```
Build `.migrate/help-request.json` (gitignored) with:
`{"bundle":"airtable-exit","problem":"…","context":"…","email":"…","telegram":"…","other_contact":"…","name":"…"}`.
`bundle` and `problem` are required, plus at least one of `email`, `telegram`, `other_contact`. `name` is optional.
`GET` on the same URL describes the fields if anything changed.
The answer is `{"ok":true,"id":…}`. Tell the owner: "Sent. Request #<id>. Mark will contact you on <contact>."
Then delete `.migrate/help-request.json`.

If the call fails (network blocked, 429 too many requests, 5xx): give the owner the summary as text and the
address info@lowcoding.dev to send it themselves. In a cloud session, a blocked request means the environment's
network settings do not allow `jobsearch-roan-ten.vercel.app`; say so.

## 5. Write down
`kb/runs/<YYYY-MM-DD>-get-help.md`: the request id, the step, one line about the problem (no secrets), and how
it was sent (endpoint or email). When the answer arrives and solves it, add the fix to `kb/findings.md`.
