# Prices and free limits for the cost line

Sources: support.airtable.com plans and airtable.com/pricing (read 2026-11-08); supabase.com/pricing and
supabase.com/docs/guides/storage/uploads/file-limits, vercel.com/docs/plans/hobby and
vercel.com/docs/cron-jobs/usage-and-pricing (read 2026-11-09). All **sourced**. Re-check before sending a report
older than a month.

## Airtable today
| | Monthly billing | Annual billing | Limits that push people out |
|---|---|---|---|
| Airtable Team | $24/seat | $20/seat | 50k records/base, 20 GB/base, 100k API calls/workspace/month, 25k automation runs |
| Airtable Business | $54/seat | $45/seat | 125k records/base, 100 GB/base, 100k automation runs |

## After: free by default
| Service | Plan | Price | Limits that matter for this app |
|---|---|---|---|
| Supabase | Free | $0 | 500 MB database per project; 1 GB file storage; **50 MB per file**; 50,000 monthly active users; 5 GB egress; 2 active projects; pauses after 1 week with no activity (restore from the dashboard) |
| Vercel | Hobby | $0 | Crons once per day at most, timing within the hour (this app's crons are daily); functions up to 300 s; 100 GB transfer; 100 deployments per day |
| GitHub | Free | $0 | Private repos included |

Vercel's fair-use guidelines describe Hobby as for personal, non-commercial use. Say this in one line in the report
and let the owner decide. If they want the commercial plan: Vercel Pro, $20 per developer seat per month, viewers free.

## When a limit is hit
| Limit | First option (free) | Upgrade option |
|---|---|---|
| A file over 50 MB | Keep it where the company already stores big files (Google Drive, Dropbox, SharePoint) and put the link in a URL field. The copy skips files over the limit and lists them in `.migrate/copy-report.json`. | Supabase Pro, from $25/month per project: per-file limit up to 500 GB, 100 GB files included |
| All files over 1 GB | Same: move the biggest or oldest files to existing storage and link them | Supabase Pro |
| Database over 500 MB | Drop dead tables and fields first (usage.md) | Supabase Pro: 8 GB database included |
| Idle pausing | A CRM used every working day should not go idle (assumed); if it pauses, restore it in the dashboard | Supabase Pro: no pausing |
| Crons more often than daily, precise times | Daily jobs only | Vercel Pro |

## Worked example (**derived**)
8 editors on Airtable Business, monthly billing = 8 × $54 = $432/month, vs $0/month on the free tiers before email
sending. If they choose both paid plans: $25 + $20 = $45/month. A vendor (WitsCode) reports the same $432 → ~$45 case.

## Rules
- Seats = people with owner, create or edit level (count each person once across base and workspace).
- Read, comment and interface-only users may still be billed on some plans: if unsure, say `needs input`.
- Never add costs the owner did not state (Zapier, Make, consultants).
- Free tiers are the default. A paid plan appears only as an option next to the limit that would need it.
