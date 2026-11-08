---
name: review
description: The weekly approval gate for marketing - prepare one review sheet of every checked item waiting (full text, link, asset, verification summary) for the owner to approve, reject or change; then apply their decisions by building posting packs, Gmail drafts and ad setup sheets. Use for "review the marketing", "what's waiting for approval", "approve all except 3", or after the owner has marked up a review sheet.
---

# Review

Nothing reaches the outside world except through here, and only on the owner's decision.

## Prepare mode

1. Gather every `queue/` item with status `checked` (and any `changes` items that were
   reworked and re-checked).
2. Write `review/<today>.md`, grouped by due date then channel. For each item:
   ```
   ### [N] <channel> · <kind> · due <date> · <campaign>
   decision: approve        <!-- approve | reject | change: <what> -->
   <the exact text>
   Link: …   Assets: … (credit)   To: … (pitches)
   Checked: <n> claims, <n> fixed, <n> cut  → verification file
   Why this item: one line from the brief
   ```
   Default each `decision:` to `approve` only if the item is routine (a post on an approved
   campaign). Pitches to people, anything costing money, and first posts on a new channel
   default to `decision: ?` so they need an explicit yes.
3. At the top: counts by channel, money this would commit, and the 1–3 items that most need
   the owner's eye.
4. Tell the owner where the sheet is. They can edit it, or just reply ("approve all but 4;
   change 7 to …").
5. Offer the **review board** too, the easier way for most owners: every queue item in the
   browser, in tabs by day (Overdue, Today, Tomorrow, each date ahead, All, Done; it opens on
   what needs doing first), a "Next up" bar with the time left, each item's video or image, the
   text with Copy buttons, the link, the fact check, and Approve / Change / Reject / Posted buttons that write the decision into the item
   (`status`, `decided`, `owner_note`, `out_url`). Start it in the background:
   `node ${CLAUDE_PLUGIN_ROOT}/tools/board.mjs marketing` (opens http://localhost:4747; `PORT=`
   to change, `NO_OPEN=1` to not open a browser). Reminders: **Add to calendar** downloads every
   post still to do as an .ics with an alarm 15 minutes before (re-download after changes);
   **Notify me** gives browser notifications at the same time while the tab is open. It serves only the queue's own asset files,
   on this machine only. An item that reuses another's text can point at its check with
   `checked_as: <other item id>`.
6. **On the phone**: if the workspace has `.board.env`, the board is also hosted on the owner's
   Cloudflare (see `board-cloud/README.md`: installable, push reminders 15 minutes before each
   post, Share to app). Run `node ${CLAUDE_PLUGIN_ROOT}/tools/board-sync.mjs marketing` after
   preparing, so the phone shows the new items. If the owner wants it and there's no
   `.board.env` yet, set it up with `board-cloud/setup.mjs` (it needs `npx wrangler login`).

## Apply mode

1. If `.board.env` exists, run `board-sync.mjs` first: decisions made on the phone come into
   the item files.
   Read the decisions: from the edited sheet, the owner's message, or the items themselves
   (the board writes `status: approved | rejected | changes` with `decided:` and `owner_note:`).
   Anything still `?` is left waiting, not assumed.
2. **approve** → status `approved`, then by kind:
   - posts, pins, videos, LinkedIn, Reddit, newsletter → add to `publish/<week-start>/` posting
     pack: one file per day, each entry with the platform, the exact text (in a fenced block so
     it copies cleanly), the asset path, the link, and the time to post. Status `ready`.
   - pitches → Gmail drafts (see `outreach`). Status `ready`.
   - ads → the setup sheet goes into the pack. Status `ready`.
   - pages → hand to the brand's own publishing pipeline as a draft; status `ready`.
3. **reject** → status `rejected`, with the reason in `notes` and a line in `log.md` if the
   reason is a pattern ("too salesy", "don't mention competitors") so producers learn it.
   Patterns the owner repeats become rules in `brand.md` Voice or Guardrails (say so).
4. **change** → apply the change, re-run `fact-gate` on it, status `checked`; it goes in the
   next sheet unless the owner approved it with the change.
5. When the owner says something went out, set `out` and record `out_url`.

If a scheduling tool is connected later (Buffer, Metricool, Later, a platform API), apply mode
schedules approved posts there instead of the posting pack. Still only approved items.
