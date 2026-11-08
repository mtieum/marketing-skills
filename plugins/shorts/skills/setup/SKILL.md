---
name: setup
description: Guided setup of a shorts studio - creates the studio folder from the plugin's template, installs Remotion and headless Chrome, and walks the owner through every third-party piece (Node, ffmpeg, the Remotion licence question, Wikimedia contact, Pixabay key, a voice provider - Higgsfield, ElevenLabs, Kokoro or own recordings - and music) until the doctor check passes. Also updates an existing studio's engine. Use for "set up shorts", "install the video tools", "connect Higgsfield / ElevenLabs", "doctor", "update the shorts engine".
---

# Set up a shorts studio

The owner may never have used any of these tools. Do the work yourself where you can; where
only they can act (accounts, payment, keys, licences), give one clear step at a time and wait.

## 1. Where the studio lives

- Look for an existing studio (a folder with `studio.json` and `tools/doctor.mjs`), usually
  `shorts/` in the brand's project, or a sibling repo. Found → go to **Update or check**.
- New → ask where (default: `shorts/` in the current project; a separate folder if the project
  isn't a JS project or the owner wants the videos apart). Copy the plugin's `studio-template/`
  (two folders above this skill) there, including dotfiles. Add `media/` to the project's
  `.gitignore` if the studio is inside another repo (media gets large: hundreds of MB).
- Copy the plugin's `BRAND-KIT.md` to `brand/README.md` in the studio.

## 2. Install

In the studio: `npm install` (or pnpm), then `npx playwright install chromium`. Then
`node tools/doctor.mjs` and work down its `NO` lines with the owner:

| Item | What to do |
|---|---|
| Node 22+ | Install via nvm (`nvm install 22`) or nodejs.org. Re-run the doctor in a shell that uses it. |
| ffmpeg / ffprobe | Linux: package manager. macOS: `brew install ffmpeg`. Windows: `winget install ffmpeg`. |
| Remotion licence | Ask (AskUserQuestion): an individual or company of **up to 3 people** may use Remotion free; **larger companies need a Remotion company licence** (remotion.pro/license) before using it commercially. Record the answer in `studio.json` `remotionLicence` (e.g. `"free: individual"`, `"company licence, bought 2026-11"`). Don't proceed for a larger company without one. |
| Contact | `studio.json` `contact`: the brand's site or a contact email. Wikimedia Commons requires a contact in every client's requests. |
| Pixabay (optional) | Free account at pixabay.com, then the key on pixabay.com/api/docs/ → `PIXABAY_API=` in `.env`. |
| Voice | See below. |
| Music (optional) | See below. |
| Brand kit | Hand over to the `shorts:brand` skill. |

**Keys:** ask the owner to put keys into `.env` themselves (copy `.env.example`), or to run
`! echo 'KEY=…' >> <studio>/.env` so the key doesn't sit in the conversation. Never commit `.env`.

## 3. Voice

Ask which (AskUserQuestion), with what each costs:

- **Higgsfield** (`provider: "higgsfield"`): voices made through the Higgsfield connector in
  Claude, on the owner's own Higgsfield account and credits. Setup: in Claude, Settings →
  Connectors → add Higgsfield and sign in (in Claude Code, `/mcp` to check it's connected).
  Then audition 3–6 voices on one line with the `shorts:voice` skill, showing the credit cost
  before each generation, and record the chosen voice in `studio.json` `voice.voice`.
- **ElevenLabs** (`provider: "elevenlabs"`): the owner's ElevenLabs account; API key
  (elevenlabs.io → Settings → API keys) as `ELEVENLABS_API_KEY` in `.env`, a voice ID from
  their Voice Library in `voice.voice`. Paid by characters on their plan.
- **Kokoro** (`provider: "kokoro"`): free, runs on this computer, decent quality. Install into a
  venv (`python3 -m venv ~/kokoro && ~/kokoro/bin/pip install kokoro soundfile`), put that
  Python's full path in `voice.python`, a voice such as `bf_emma` (British) or `af_heart`
  (American) in `voice.voice`. The first run downloads the model (~300 MB).
- **Own recordings** (`provider: "recorded"`): the owner records each line; no credit needed.

Set `voice.speed` (1.0; 1.05–1.1 suits fast short-form) and `voice.credit` (e.g.
`"generated (ElevenLabs)"`; it goes in every post).

## 4. Music

Optional. Only a track licensed for **every platform** the shorts go to. Platform libraries
(YouTube Audio Library, TikTok Commercial Music Library) are usually cleared only on their own
platform; free music sites can still trigger Content ID claims, so prefer a track from a
licence that covers all platforms, or none. File in `brand/music/`, credit in `brand.json`.

## 5. Done when

`node tools/doctor.mjs` ends in `Ready.` Tell the owner what's set up and the next step
(`shorts:brand`, then `shorts:script`).

## Update or check

- **Check:** run the doctor and fix what it reports.
- **Update the engine** (after the plugin updates): replace the studio's `src/` (except
  `src/generated/`), `tools/`, `remotion.config.ts`, `tsconfig.json` and `package.json`'s
  dependencies with the template's; never touch `brand/`, `shorts/`, `studio.json`, `.env` or
  the media. Show the diff summary, `npm install`, run the doctor, and render one existing
  short's still (`npx remotion still src/index.ts <slug> /tmp/check.png --frame=60`) to confirm.
