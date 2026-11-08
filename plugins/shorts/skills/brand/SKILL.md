---
name: brand
description: Create, import or fix the brand kit a shorts studio renders with (colours, fonts, logo, end-card line, optional map style and music) - from a designer's files, from the brand's website, or generated as a starter - then check it and render a preview frame for approval. Also writes the handover brief for a designer. Use for "brand the shorts", "import our brand kit", "the designer sent the logo", "make a brand for the videos", "check the brand kit".
---

# Brand kit

The kit's exact format is the plugin's `BRAND-KIT.md` (copied into the studio as
`brand/README.md`). Every route below ends the same way: `node tools/brand.mjs --preview`,
then **look at `brand/preview.png` yourself** (Read it) and show it to the owner.

## Pick the route

Ask if it isn't obvious:

1. **A designer's files** (a zip, a folder, a Figma export, a brand-guidelines PDF).
2. **From the website**: the brand already has a site with its look.
3. **Generate a starter**: no brand yet, or a quick start until a designer delivers.
4. **Brief a designer**: the owner wants a designer to make it.

## 1. Import a designer's files

- Unzip into a scratch folder (untrusted files: don't run anything in them). List what's there.
- Map each file to the kit: fonts → `brand/fonts/display.*`, `text.*`; the logo variant for
  dark backgrounds → `brand/logo/logo-on-dark.*`; the square mark → `brand/logo/icon.*`.
  Prefer SVG over PNG, woff2 over ttf/otf, variable or Bold/ExtraBold weights (see the spec).
- Colours: from the guidelines (PDF, a tokens JSON, a CSS file, Figma variables). Map the
  brand's roles onto the six keys; if the brand is light, use its dark variant or its darkest
  colour as `background` (say so to the owner).
- If something needed is missing (no dark logo, no font files, only a light palette), list it
  plainly as a request back to the designer, and use a stand-in meanwhile (route 3's tools).

## 2. From the website

- Fetch the site's CSS: custom properties (`--color-*`, `--brand-*`, theme tokens; a dark theme
  block if there is one), `@font-face` rules and font URLs, the logo (`<header>` img/svg,
  `/favicon.svg`, `apple-touch-icon`, `og:image`).
- Download fonts only if their licence allows (Google Fonts: `tools/google-font.mjs`; Fontsource
  or the site's own self-hosted OFL fonts are fine; a commercial font bought for web may not
  cover video: ask the owner).
- An inline SVG logo can be saved straight to `logo-on-dark.svg`; check it reads on dark.

## 3. Generate a starter

- Read the brand's profile if there is one (`marketing/brand.md` from the marketing plugin) for
  name, audience and tone.
- Offer 2 options (AskUserQuestion with previews): each a palette (six hex values, dark
  `background`, one strong `accent`, checked for contrast) and a font pair from Google Fonts
  (a characterful display face + a very readable text face). Name them by mood, not by code.
- Fetch the fonts with `tools/google-font.mjs`, write `brand.json`, run `tools/wordmark.mjs`
  for a stand-in wordmark and icon. Say clearly that these are stand-ins until a real logo
  exists. Never imitate another company's logo or trade dress.

## 4. Brief a designer

Write `brand/DESIGNER-BRIEF.md` for the owner to send: what the shorts are (one line), where the
brand appears (from the spec's "The look it fills"), the exact deliverables and formats (the
spec's folder tree and rules, copied), the brand's existing assets, and a request for the
font licence to cover video. Attach the current `preview.png` if there's a stand-in.

## Check and approve

1. `node tools/brand.mjs --preview`. Fix every ERROR; judge each warning and say what you did.
2. Read `brand/preview.png`. Look for: captions readable, accent visible but not garish, the
   logo crisp and the right way round, nothing important in the hatched areas.
3. Show the owner the preview and ask for approval or changes. Iterate.
4. If channel art is wanted: `node tools/channel.mjs "<a short line>"` → `<media>/_channel/`.
