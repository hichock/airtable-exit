# Create a read-only Airtable token

**What it is for:** Claude reads your base with it: tables, fields, records and files, for the plan and later for
the copy. The token can only read. It cannot change or delete anything in Airtable.
**Time:** about 2 minutes. **You need:** to be an owner or creator of the base.

1. Open https://airtable.com/create/tokens and sign in.
2. Click **Create token**.
3. Name it `airtable-exit (read-only)`.
4. Click **+ Add a scope** and add these five, one by one:
   - `schema.bases:read` (tables and fields)
   - `data.records:read` (records)
   - `data.recordComments:read` (comments)
   - `workspacesAndBases:read` (who has access)
   - `user.email:read` (your own user id and email)
   Do not add anything that ends in `:write`. If you came from a link that pre-selects scopes, remove every
   `:write` scope.
5. Under access, click **+ Add a base** and pick only the base(s) you want to move.
6. Click **Create token**. Airtable shows the token **once**. Copy it.
7. Put it where Claude asked:
   - **On your computer:** open the file `.env.local` in the project folder (Claude opens it or tells you the
     path), find the line `AIRTABLE_PAT=` and paste the token right after the `=`. Save.
   - **In a cloud session (claude.ai/code):** do not paste it into the chat. Add it in the environment's settings,
     see [claude-cloud-session.md](claude-cloud-session.md) → "Add a key".
8. Tell Claude "done". It checks the token without showing it.

**Later:** after the move you can delete the token on the same page (click it → **Delete token**).
**Source:** Airtable support "Creating personal access tokens" and the scopes reference, read 2026-11-09.
