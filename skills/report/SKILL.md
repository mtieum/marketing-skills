---
name: report
description: Weekly marketing report for a brand - pull the numbers from the sources listed in brand.md (Search Console, site analytics, platform stats, outreach replies, ad spend), compare with the plan's goals, attribute results to items that went out, and recommend what to do more of, less of, or stop. Use for "how's the marketing doing", "weekly report", "what worked", or as step 2 of the weekly run.
---

# Report

Short, honest, and ending in decisions.

## Steps

1. **Collect** for the last 7 days and the 4 before, from each source in `brand.md` Data sources:
   - Search Console: clicks, impressions, CTR, position; top gaining/losing pages and queries;
     new referring domains (Links report). Via API if credentials are configured, else the
     owner's CSV exports in `metrics/raw/` — ask for them by name if missing.
   - Site analytics: visits, top referrers (look for each channel and each pitched outlet).
   - Conversions: from wherever `brand.md` says each win is counted.
   - Platforms: the owner pastes or exports post stats (views, saves, clicks); ask once,
     listing exactly which posts.
   - Outreach: replies, links won (check each claimed link exists), from `outreach.csv`.
   - Paid: spend and results per variant.
   Missing data is reported as missing, never estimated.

2. **Attribute.** For each item with status `out`, record what it did in its front matter and
   set `measured`. Link wins back to campaigns.

3. **Write** `metrics/<today>.md`:
   - Headline: 3 lines, progress against each plan goal (number vs target, on/off track).
   - What worked / what didn't, by campaign and channel, with the numbers.
   - Decisions recommended: keep / change / stop per campaign, using the brief's 3-week rules.
     Anything with too little data says so rather than calling it.
   - Next week's single most valuable action.

4. **Log** the decisions in `log.md` once the owner agrees (or the `run` skill applies them to
   the plan).

## Honesty rules
- Small numbers are noise: under ~100 impressions or ~10 clicks, say "too early".
- Search changes lag weeks; don't credit last week's post for this week's ranking.
- Correlation is labelled as such.
