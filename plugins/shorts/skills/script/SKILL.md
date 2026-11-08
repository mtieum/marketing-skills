---
name: script
description: Write a short's script as shorts/<slug>.json - hook, sections with voice-over lines, cards, chapters, shots and the closing screen - from a source page, product or story, then have every claim fact-checked. Use for "write a short about X", "script a video", "turn this page into a short", or when the marketing plan has a short-video item due.
---

# Script a short

## Shape (20–40 seconds)

- **Section 1, the hook** (≤ 2 s of speech): `hook` = a few words, very large; the line promises
  something specific. No logo intro, no "Hi, I'm…".
- **3–6 beats**: each one real, named thing with a `card` (`kicker` small, `title` what's on
  screen, `note` one checkable fact) and 1–2 shots. `chapter` groups beats ("Day one",
  "Step 1"); leave it out for no rail.
- **The close**, `"end": true`: one line saying what to do next, over a `screen` shot (the page
  on a phone) or a final clip.
- Lines: 5–12 words each, spoken English, one idea, no lists. Read them aloud at ~2.5 words/s.

## Steps

1. **Source.** Read the page, product or story in full. If it's the brand's own fact-checked
   content (an itinerary, a data story), the short must not claim anything the source doesn't.
   If the brand's marketing workspace exists (`marketing/brand.md`), follow its voice and guardrails.
2. **Write** `shorts/<slug>.json` (format: `src/types.ts`; an example is the plugin's
   `examples/example-short.json`). `slug` lowercase-with-dashes; `link` the exact page.
   Shots may point at files that don't exist yet: `shorts:footage` fills them; list what each
   shot should show in a `"_todo"` field on the shot if helpful (remove before building).
   Map shots take two `{name, lat, lng}` points (real coordinates from the source or a map tool).
3. **Fact gate.** Every `vo`, `card` and `note` is a claim. If the marketing plugin is installed,
   run `marketing:fact-gate` on the script; otherwise spawn a fresh-context agent with only the
   script and the instruction to check each claim against a primary source, and apply its fixes
   (fix WRONG, cut UNSUPPORTED). Record the date checked in a `"_checked"` field.
4. `node tools/index.mjs` and `bash tools/build.sh <slug> --draft` once footage stand-ins exist,
   to time it. Aim for the total the platform suits (Shorts and Reels: under 60 s; under 35 s holds best).
