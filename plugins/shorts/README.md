# shorts

Branded 9:16 short videos (TikTok, Instagram Reels, YouTube Shorts) made with
[Remotion](https://www.remotion.dev/): real, credited footage cut to a voice-over, cards that
name what's on screen, an optional map flying between points, the brand's page on a phone at
the end, captions burned in, audio mastered to the apps' loudness, and post notes with every
credit.

## Skills

| Skill | What it does |
|---|---|
| `setup` | Creates a studio folder, installs everything, walks through the third parties (Remotion licence, ffmpeg, Pixabay, Higgsfield / ElevenLabs / Kokoro / own voice, music) until `doctor` passes. Updates the engine later. |
| `brand` | The brand kit: import a designer's files, take it from the website, or generate a starter; checks it and renders a preview frame. Writes a designer brief. |
| `script` | A short as `shorts/<slug>.json` from a page or story, fact-checked. |
| `footage` | Commons photos, Pixabay clips, own footage, page captures, each credited. |
| `voice` | Voice-over with the chosen provider, costs shown first; auditions. |
| `build` | Draft, stills to check, final render, mastering, captions, post notes; hands to the marketing review. |

## The studio

`setup` copies `studio-template/` into the brand's project:

```
studio.json        media folder, contact, Remotion licence, voice provider
brand/             the brand kit (BRAND-KIT.md is the spec for designers)
shorts/<slug>.json one file per short
src/               the engine (Remotion); replaced on updates
tools/             doctor, brand check, footage finders, voice, build, captions, post notes
media/             footage, voice, renders (not in git)
```

## What each user brings

- Node 22, ffmpeg, Python 3 (setup helps install them).
- **A Remotion licence if their company has more than 3 people** (remotion.pro/license); free otherwise.
- Their own accounts and keys: Pixabay (free), and Higgsfield or ElevenLabs if they use them
  (paid, on their own account). Kokoro is free and local.
- Music they are licensed to use on every platform they post to (optional; none ships with this).

Works on its own, or with the `marketing` plugin: its short-video items are made here and come
back to its review.
