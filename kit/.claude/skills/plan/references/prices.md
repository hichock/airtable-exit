# Prices for the savings line

Sources: support.airtable.com plans, airtable.com/pricing, supabase.com/pricing, vercel.com/pricing, all read
2026-11-08 (**sourced**). Re-check before sending a report older than a month.

| | Monthly billing | Annual billing | Limits that push people out |
|---|---|---|---|
| Airtable Team | $24/seat | $20/seat | 50k records/base, 20 GB/base, 100k API calls/workspace/month, 25k automation runs |
| Airtable Business | $54/seat | $45/seat | 125k records/base, 100 GB/base, 100k automation runs |
| Supabase Pro | from $25/project | — | 8 GB database, 100 GB files, 100k monthly active users; no pausing (Free pauses after 1 week idle) |
| Vercel Pro | $20/developer seat | — | viewers free, $20 usage credit; Hobby is non-commercial only |

Worked example (**derived**): 8 editors on Airtable Business, monthly = 8 × $54 = $432/month, vs $25 + $20 = $45/month
before usage and email. Team, 8 editors = $160–192/month. A vendor (WitsCode) reports the same $432 → ~$45 case.

Rules:
- Seats = people with owner, create or edit level (count each person once across base and workspace).
- Read, comment and interface-only users may still be billed on some plans: if unsure, say `needs input`.
- Never add costs the owner did not state (Zapier, Make, consultants).
