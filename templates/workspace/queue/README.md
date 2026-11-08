# Queue

One file per item: a post, a pin, a pitch email, an ad, a page, a newsletter.

File name: `<due date>-<channel>-<short-slug>.md`, e.g. `2026-11-12-pinterest-lisbon-two-nights.md`.

```markdown
---
id: 2026-11-12-pinterest-lisbon-two-nights
campaign: two-night-itineraries        # folder name in campaigns/
channel: pinterest                     # matches a channel playbook
kind: post | pin | video | pitch | newsletter | page | ad | reply
status: draft                          # see below
due: 2026-11-12                        # day to go out
link: https://…?utm_source=pinterest&utm_medium=social&utm_campaign=two-night-itineraries
assets: [path/to/image.jpg]            # files the item needs, each with its licence/credit
to: ""                                 # for pitches: the person, from outreach.csv
checked: ""                            # date the fact gate passed it
notes: ""                              # reviewer's notes
---

The exact text that will go out, nothing else.
```

## Status

`draft` → `checked` (fact gate passed) → `approved` / `rejected` / `changes` (review) →
`ready` (in a posting pack or a Gmail draft) → `out` (posted or sent; add `out_url`) →
`measured` (report has read its numbers).

Only `review` sets `approved`, and only from the person's decision.
