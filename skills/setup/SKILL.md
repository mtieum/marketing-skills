---
name: setup
description: Set up a brand's marketing workspace (marketing/ folder with brand.md profile, plan, queue, outreach tracker, log) by reading the brand's site and code and asking the owner only what can't be found. Use the first time marketing is run for a brand, or when asked to "set up marketing", "onboard a brand", "update the brand profile".
---

# Set up a brand

The workspace is the only place brand facts live. Every other skill reads `marketing/brand.md`
first, so a vague profile makes every later draft vague. Spend the effort here.

## Steps

1. **Find or create the workspace.** In the current project, look for `marketing/brand.md`.
   - Exists → this is an update: read it and `log.md`, and change only what's asked or stale.
   - Missing → copy the plugin's `templates/workspace/` (two folders above this skill) to
     `marketing/` in the project root.

2. **Read before asking.** Gather what's already written down:
   - The live site: home, about, pricing, product pages, privacy/terms (for what's tracked
     and what's promised). Fetch them; don't guess from the name.
   - The project: README, CLAUDE.md, any brand or positioning notes, the content collections,
     existing marketing or content skills (these become **Domain producers**), analytics
     wiring (for **Data sources**).
   - Claude's memory for this project, if any (positioning, colours, decisions).

3. **Draft `brand.md`** from what you found. Mark each field you inferred with `(inferred)`
   and each you couldn't fill with `TODO`.

4. **Ask the owner only the gaps**, in one round (AskUserQuestion, ≤4 questions), most
   valuable first. Usually: what counts as a win and how it's measured; paid caps; which
   channel accounts exist; anything never to say or show. Offer a recommended default for each.

5. **Channels.** For each channel the owner uses, check a playbook exists in
   `skills/content/channels/`. If not, say so; `content` will fall back to the general rules.

6. **Write it and show it.** Save `brand.md`, add a dated line to `log.md`
   ("Workspace set up"), and give the owner a short summary: the one-liner, audiences,
   the win, channels, caps, and every remaining `TODO`.

## Rules

- Real facts only. No invented customers, numbers, awards or testimonials, in the profile or anywhere.
- The profile is short enough to read in two minutes. Detail goes in the brand's own docs; link to them.
- Never commit secrets (API tokens) into the workspace; note where they live instead.
