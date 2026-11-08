# Checks before cutover

Source: Airtable exit research §6, 2026-11-08 (checks are **assumed** best practice, consistent with WitsCode,
Scroll and Softr guides). Record each as pass / fail / n.a. with the number in kb/cutover.md.

- [ ] **Row-count parity** per table: Airtable count vs `select count(*)` (`npm run migrate:parity`).
- [ ] **Sample diff:** 50 random records per table, field by field, after normalising (dates to UTC, empty → NULL,
      arrays sorted). `npm run migrate:parity -- --sample 50`.
- [ ] **Link parity:** for every link field, the count of links per side matches.
- [ ] **Computed parity:** each rebuilt formula and rollup equals Airtable's stored value for all rows (compare
      with the final snapshot in `.migrate/snapshot/`). List mismatches; don't hide them.
- [ ] **Attachments:** count and total bytes match; three files open from the app.
- [ ] **Automations dry run:** each rebuilt job ran against staging or demo data; output matches Airtable's run
      history for the same inputs.
- [ ] **People:** every Airtable editor who should stay has an account and the right role; nobody else has
      access (RLS tests per role pass: `npm run test:migrations`).
- [ ] **Forms and links:** each public form URL works; old embeds are updated or listed for the owner.
- [ ] **Integrations:** each tool in kb/context.md → Tools is switched or marked "retired" by the owner.
- [ ] **Backups:** latest snapshot in `.migrate/snapshot/` kept; Supabase backups on (Pro has daily backups;
      check the plan).
- [ ] **Rollback plan** written with a deadline.
