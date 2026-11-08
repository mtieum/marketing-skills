# marketing-skills

A Claude Code plugin that runs a small brand's marketing for someone who isn't a marketer.
It plans, writes, checks and queues the work; a person approves it once a week; then it
hands over what is ready to post or send and measures what happened.

Nothing in the plugin is about one brand. Everything a brand-specific run needs lives in
that brand's **workspace**, a `marketing/` folder in the brand's own project.

## The loop

```
          ┌──────────── report (what happened last week) ◄────────────┐
          ▼                                                           │
  plan (6-week plan, campaigns, calendar)                             │
          ▼                                                           │
  campaign → content / data-story / outreach / paid-test (drafts)     │
          ▼                                                           │
  fact-gate (independent check of every claim)                        │
          ▼                                                           │
  review (one page, you approve / reject / edit)                      │
          ▼                                                           │
  publish: posting pack, Gmail drafts, ad setup sheet ────────────────┘
```

`/marketing:run` does one turn of the loop and stops at the review.

## Skills

| Skill | What it does |
|---|---|
| `setup` | Builds the workspace and the brand profile (`brand.md`) by reading the site and asking you. |
| `run` | The weekly turn: report, plan, produce what's due, check it, put it up for review, publish what you approved. |
| `plan` | A 6-week plan: goals, 2–3 campaigns, channel cadence, a dated calendar. |
| `campaign` | One campaign: brief, angle, audience, the list of items to make. |
| `content` | Posts for a channel from a source page or story. Channel playbooks in `skills/content/channels/`. |
| `data-story` | Finds a story in the brand's own data and turns it into a page and a press pitch. |
| `outreach` | Finds the right people (press, bloggers, partners), writes personal pitches, tracks replies. |
| `paid-test` | A small capped ad test: hypothesis, audience, copy variants, budget, stop rules, setup sheet. |
| `fact-gate` | A separate agent checks every factual claim against a source. Nothing ships unchecked. |
| `review` | Gathers everything waiting into one review file and applies your decisions. Or review in the browser: `node tools/board.mjs marketing` shows the queue in tabs by day (opening on what is due next), with each video, Copy buttons, Approve / Change / Reject / Posted written back into the queue, and reminders (calendar file and browser notifications) 15 minutes before each post. |
| `report` | Pulls the numbers, compares them with the plan, says what to do more and less of. |

## Install

```
/plugin marketplace add mtieum/marketing-skills
/plugin install marketing@marketing-skills
```

In the Claude app (and Cowork): Customize → Plugins → Add marketplace → `mtieum/marketing-skills`.

Then, in the brand's project: `/marketing:setup`, and each week `/marketing:run`.

## The workspace

```
marketing/
  brand.md          who, for whom, voice, offers, channels, guardrails, budget, data sources
  plan.md           current 6-week plan and calendar
  log.md            what was tried and what it did: the plugin's memory between runs
  campaigns/<slug>/brief.md
  queue/<id>.md     one file per item (post, pitch, ad, page), with a status
  outreach.csv      people contacted, when, reply, outcome
  review/<date>.md  the weekly review sheets
  metrics/<date>.md the weekly reports
  publish/<date>/   posting packs ready to copy
```

A starting copy is in `templates/workspace/`. `examples/fictional-studio/` shows a filled-in profile for a made-up brand.

## Rules it keeps

- **Draft and queue.** Nothing is posted, sent or spent without a person approving it in a review.
- **True or cut.** Every factual claim passes the fact gate; a claim that can't be checked is removed.
- **No fakery.** No fake accounts, reviews, testimonials or engagement; no posing as a customer;
  disclosed ads and affiliate links (UK: ASA/CAP code); email only where the law allows (UK: PECR).
- **Platform rules first.** Each channel playbook says what that platform and its communities allow.
- **Money is capped.** Paid tests carry a per-test and a monthly cap from `brand.md` and stop rules.

## Licence

MIT.
