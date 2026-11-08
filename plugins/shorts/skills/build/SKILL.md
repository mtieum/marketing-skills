---
name: build
description: Render a short - a quick draft to check timing, stills to look at, then the final picture, voice and music stems, mastering to -14 LUFS, captions.srt and post notes with every credit - and hand the result to the marketing review if the brand uses the marketing plugin. Use for "render the short", "build the video", "make a draft", "change the music and remix".
---

# Build

Run everything from the studio folder.

1. **Check:** `node tools/check.mjs <slug>` (or `--draft`). Fix what it lists (footage, credits, voice).
2. **Draft** (no voice needed): `bash tools/build.sh <slug> --draft` → `<media>/<slug>/video/draft.mp4`.
3. **Look before the long render.** Render stills at a few frames and Read them:
   `npx remotion still src/index.ts <slug> /tmp/<slug>-<f>.png --frame=<f>` for the hook (~30),
   the middle of each section, and the close. Check: words inside the safe area, captions
   readable over the picture, cards not covering the subject, the right footage on each card,
   maps drawn (not blank), the logo crisp. Fix in the script or footage, not by hand-editing the engine.
4. **Final:** `bash tools/build.sh <slug>` (minutes: maps render slowly, in software). It writes
   `<media>/<slug>/upload/`: the video, `captions.srt`, `post.md`.
   New music only: `bash tools/build.sh <slug> --bed`.
5. **Post notes.** Fill the TODO captions in `post.md`: per platform, from the short (hook, one
   line of value, where the link is), ending with the credits block. If the marketing plugin's
   short-video playbook is available, follow it.
6. **Hand over.** If the brand has a marketing workspace (`marketing/queue/`), add a queue item
   (`channel: short-video`, `kind: video`, status `draft`, `assets:` the upload folder) so it goes
   through the fact gate and the weekly review like everything else. Otherwise tell the owner
   where the upload folder is. Never post it yourself.
