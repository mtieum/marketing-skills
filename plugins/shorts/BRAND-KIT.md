# Brand kit for shorts: the handover spec

What a designer (or anyone) delivers so the shorts look like the brand. Send a folder or a
zip laid out like this; the `shorts:brand` skill imports it, checks every file and renders a
preview frame to approve.

```
brand/
  brand.json            colours, file names and a few words (below)
  fonts/
    display.woff2       titles and the opening
    text.woff2          captions, cards, labels
  logo/
    logo-on-dark.svg    the wordmark or lockup, for a dark background
    icon.svg            optional: the square mark, for channel avatars
  music/
    bed.mp3             optional: one licensed music track
  map/
    style.json          optional: a MapLibre map style, if the brand has its own map look
```

## The look it fills

Shorts are 1080×1920, dark, with real footage full-bleed. The brand shows in: a wash of the
background colour at the top and bottom of every shot (so words read), cards with a title in the
display font, a kicker and pins in the accent colour, captions in the text font, a progress rail,
the opening title, and a closing scene with the logo, a line and the website on a phone.

`preview.png` (rendered by `npm run preview`) shows all of these at once, with the areas the apps
cover (bottom quarter, right edge) hatched in red.

## Colours

Six colours, as 6-digit hex (`#1a2b3c`): no names, no RGB, no transparency.

| Key | Used for | Rule |
|---|---|---|
| `background` | the wash over footage, the end scene, behind maps | dark; captions in `text` must reach 4.5:1 on it |
| `deep` | the darkest tone (reserved for depth, e.g. under cards) | darker than `background` |
| `surface` | a lifted panel, the preview's ground | between `background` and `text` |
| `text` | captions, titles | 4.5:1 on `background` (checked, it's an error below that) |
| `muted` | inactive labels on the rail, small print | 3:1 on `background` advised |
| `accent` | kicker, opening title, pins, route, progress | 3:1 on `background` (checked) |

If the brand is light (a white site), give its **dark** variant here: white washes over video
make captions unreadable. A brand with no dark variant: use the brand's darkest colour as
`background` and its main colour as `accent`, and check the preview.

## Fonts

- Two files: `display` and `text` (they may be the same file).
- Formats: `.woff2` (best), `.woff`, `.ttf` or `.otf`. Real font files, not renamed.
- A **variable font** covering weights 600–800 is best: titles are set at 800, captions at 700.
  With static fonts, send the **Bold or ExtraBold** weight for `display` and **Bold** for `text`.
- Latin is enough unless the shorts will be in another script; then say which.
- The licence must allow use in video (most do; desktop-only licences don't). Google Fonts (OFL)
  are fine; `node tools/google-font.mjs "Family" brand/fonts/text.woff2` fetches one.

## Logo

- `logo-on-dark`: **SVG** preferred, with text **outlined** (converted to paths), a `viewBox`,
  no links to outside files, no background box. A PNG works: transparent, at least 1600 px wide.
  It's shown about 520 px wide on a dark background.
- `icon` (optional): square SVG, or a PNG of at least 800×800, transparent. Used for channel
  avatars, where apps crop to a circle: keep the mark inside the middle 70%.

## brand.json

```json
{
  "name": "Brand name",
  "colours": { "background": "#101828", "deep": "#0b1220", "surface": "#1d2939",
               "text": "#f9fafb", "muted": "#98a2b3", "accent": "#f79009" },
  "fonts": { "display": "fonts/display.woff2", "text": "fonts/text.woff2" },
  "logo": { "onDark": "logo/logo-on-dark.svg", "icon": "logo/icon.svg" },
  "hook": { "lead": "" },
  "endCard": { "line": "Try it free", "showAddress": true },
  "grade": "contrast(1.06) saturate(1.08) brightness(0.98)",
  "map": { "style": "https://tiles.openfreemap.org/styles/positron",
           "attribution": "© OpenFreeMap © OpenMapTiles © OpenStreetMap",
           "filter": "", "hideLayers": "" },
  "music": { "file": "music/bed.mp3", "credit": "Track by Artist, licence, source",
             "under": 0.12, "between": 0.26 }
}
```

| Field | What it does |
|---|---|
| `hook.lead` | Small line above every opening title, if the brand has a fixed one (e.g. "Weekend in"). Each short can override it. |
| `endCard.line` | Short call to action shown in the accent above the phone at the end. |
| `endCard.showAddress` | Shows the website's domain next to it. |
| `grade` | A CSS filter over all footage so clips from different people match. Leave out for the default. |
| `map` | Only if shorts use map shots. `style` is a MapLibre style URL or `map/style.json`; `attribution` is required (the map data's credit); `filter` (CSS) and `hideLayers` (a regex of layer ids to drop) are optional. |
| `music` | Optional bed under the voice, ducked while speaking (`under`) and up between lines (`between`). `credit` is required and goes in every post. Only tracks licensed for every platform you post to: platform libraries (YouTube Audio Library, TikTok's) are often cleared only there, and free sites' tracks can still draw Content ID claims. |

## What the check refuses

Missing files, colours that aren't 6-digit hex, captions or accent below contrast, fonts that
aren't real font files, logos that aren't SVG/PNG, a map without attribution, music without a
credit. It warns (but lets through) small PNGs, SVG text that isn't outlined, non-square icons
and light backgrounds.
