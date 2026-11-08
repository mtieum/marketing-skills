---
name: paid-test
description: Design a small, capped paid ad test (Meta, Pinterest, Google, TikTok, LinkedIn) - one question, audience, 2-4 ad variants, budget inside the brand's caps, stop rules - and a setup sheet the owner follows in the ad manager; then read the results. Use when the plan calls for a paid test or when asked about ads, boosting, "spend £x to see if…".
---

# Paid test

A test answers one question with money capped in advance. It is not "running ads".

## Steps

1. **Read** `brand.md` Paid (monthly cap, per-test cap, platforms, never-bid terms), `log.md`
   (past tests), the campaign brief, and the newest report. If no caps are set, stop and ask.

2. **The question.** One sentence: "Does <audience> click <angle> on <platform> for less than
   £<x> per <win>?" Prefer an angle that already did well organically.

3. **Check the rules before writing.**
   - Platform ad policies for this category (travel, finance, health, dating etc. have extras).
   - Affiliate programmes: many forbid bidding on their brand names or sending paid traffic to
     their links directly (e.g. Booking.com-style terms); send ads to the brand's own page.
   - UK: ads must be obviously ads; claims (prices, "cheapest", "best") need evidence (ASA/CAP).
   - Special ad categories (housing, jobs, credit) restrict targeting; note if relevant.

4. **Design** (`queue/<date>-<platform>-<slug>-ad.md`, `kind: ad`):
   - Objective (traffic / conversions; conversions only if the win is tracked on the page).
   - Audience: location, age, interests or keywords; size estimate if known; exclusions.
   - Budget: daily amount × days ≤ per-test cap, and this month's total ≤ monthly cap
     (sum other tests from the queue).
   - 2–4 variants differing in one thing (hook or image), each with headline, body, image
     spec + credit, CTA, landing URL with `utm_medium=cpc`.
   - **Stop rules**: stop a variant at £<x> spend with no click-through above <y>%; stop
     the test at the cap or the end date; stop at once on any policy warning.
   - **Decision rule**: what result means scale / change / drop.
   - Setup sheet: step-by-step settings for the ad manager, including the spend limit
     (account spending limit or campaign lifetime budget set to the cap).

5. **Fact-gate** the ad copy, then it goes to review. The owner launches it; Claude never
   enters payment details or launches ads.

6. **Results.** In `report`, read spend, impressions, clicks, CPC, wins, cost per win per
   variant (owner exports the numbers, or pastes them). Write the decision into `log.md`.
