---
name: run
description: Do one week of a brand's marketing end to end - publish what was approved, report last week's numbers, keep the plan current, make and fact-check this week's items, and stop at the review. Use when asked to "run the marketing", "do this week's marketing", "/marketing:run", or on a weekly schedule.
---

# The weekly run

One turn of the loop. It always ends at a review: nothing goes out in the same run it was
written in.

## Steps

0. **Load.** Read `marketing/brand.md`, `plan.md`, the newest `metrics/` report, the last
   ~20 entries of `log.md`, and every `queue/` file's front matter. No workspace → run `setup`
   and stop there.

1. **Apply last review.** If the newest `review/<date>.md` has decisions not yet applied,
   run `review` in *apply* mode first (it turns approvals into posting packs and Gmail drafts).

2. **Report.** Run `report` for the week just gone. If there's no data yet, say so and go on.

3. **Plan.** Run `plan` if there is no plan, the plan's end date has passed, or the report
   recommends a change (stop a campaign, double down on one). Otherwise keep the plan.

4. **Make what's due.** From the plan's calendar, list items due in the next 7–10 days that
   aren't in `queue/` yet. For each, call the producer:
   - posts, pins, videos, newsletters → `content`
   - a data-led piece → `data-story`
   - pitches to people → `outreach`
   - ads → `paid-test`
   Keep the week realistic for one person to review in about 20 minutes: at most ~12 items.
   If more are due, take the highest-value ones (per the plan) and move the rest a week.

5. **Check.** Run `fact-gate` on every new or changed item. Items that fail are fixed or cut.

6. **Review sheet.** Run `review` in *prepare* mode. It writes `review/<today>.md`.

7. **Stop and report** in a few lines: what went out since last week, the headline numbers,
   what's waiting for review (count by channel) and where the review sheet is. Ask the
   owner to review.

## Scheduling

Run it weekly by hand, or schedule it (e.g. `/loop` or a cron'd `claude -p "/marketing:run"`
in the project). A scheduled run still stops at the review.
