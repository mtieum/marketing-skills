---
name: footage
description: Find, check and credit the pictures for a short - Wikimedia Commons photos, Pixabay clips, the owner's own footage, screen captures of a page - save them under the studio's media folder and fill each shot's src and credit in shorts/<slug>.json. Use for "find footage", "get clips for the short", "capture the page", "use my own videos".
---

# Footage

**Real and credited, never generated.** No AI-generated images or video of real places, people,
products or events, ever: a made-up picture of a real thing misleads viewers and can break
platform rules. Generated abstract backgrounds or brand graphics are fine if the owner wants them.

Files go in `<media>/<slug>/shots/` (media = `studio.json` `media`). A shot's `src` is
`<slug>/shots/<file>`.

## Sources, in order of preference

1. **The owner's own** photos and video: best for authenticity. Mark the shot `"own": true`.
   Phone video: keep it as is (the engine crops upright); if it's HDR/HEVC and won't play,
   `ffmpeg -i in.mov -vf "zscale=t=linear,tonemap=hable,zscale=t=bt709,format=yuv420p" -c:v libx264 -crf 18 out.mp4`.
   Never use photos with recognisable people without their consent.
2. **Wikimedia Commons** photos: `python3 tools/commons.py search "<what, where>"`, then
   `get "File:…" <media>/<slug>/shots/<name>.jpg`. It refuses NC/ND licences and prints the
   credit from the file's own metadata: paste it as the shot's `credit`. Prefer ≥ 2000 px tall
   or wide panoramas (they pan well).
3. **Pixabay** clips: `python3 tools/pixabay.py search "<what>" --thumbs /tmp/look`, **look at
   every still** (Read the images): tags are loose (a clip tagged with a city is often elsewhere)
   and Pixabay hosts AI-generated footage. Then `get <id> <media>/<slug>/shots/<name>.mp4` and
   paste its credit. Prefer clips marked `ok` (sharp once upright).
4. **Screen captures** for `screen` shots: `node tools/capture.mjs <url> <media>/<slug>/shots/page.png`
   (add `--light` for a light page). Credit the backdrop clip, not the page.

## Check

- Look at each chosen file (a still from each clip: `ffmpeg -ss 1 -i clip.mp4 -frames:v 1 /tmp/s.jpg`).
  It must show what the card says, in the right place and season if the line implies one.
- `node tools/check.mjs <slug> --draft` lists any missing file or credit.
- Record anything doubtful in the shot's `_todo` and tell the owner.
