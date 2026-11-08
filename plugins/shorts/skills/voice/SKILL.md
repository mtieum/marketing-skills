---
name: voice
description: Make the voice-over for a short with the studio's voice provider - Higgsfield (through its connector, owner's credits, cost shown first), ElevenLabs API, Kokoro (free, local) or the owner's own recordings - then finish the files (speed, format) and link them into shorts/<slug>.json. Also auditions voices. Use for "voice the short", "make the voice-over", "try some voices", "re-record line 3".
---

# Voice

Lines come from the fact-checked script: never change a line's words here. If a line sounds
wrong, change it in the script and re-run the fact gate on it.

1. `node tools/voice-lines.mjs <slug>` prints the numbered lines and writes `voice/lines.txt`.
2. Make each line as `<media>/<slug>/voice/raw/NN.mp3` (or `.wav`), by `studio.json` `voice.provider`:

   - **higgsfield**: needs the Higgsfield connector in this session (tools named like
     `…Higgsfield…generate_audio`). Not there → tell the owner to connect it (Claude Settings →
     Connectors, or `/mcp` in Claude Code) and stop. Find its text-to-speech model and the
     voice in `voice.voice` (use its model/preset discovery tools if needed). **Before
     generating, get the cost** (its quote/balance tools) and tell the owner the total for all
     lines; go ahead only on their yes. Generate each line, download each result to
     `raw/NN.mp3`.
   - **elevenlabs**: `node tools/voice-elevenlabs.mjs <slug>` (uses the owner's key; costs their
     plan's characters: about the number of characters in the lines).
   - **kokoro**: `<voice.python> tools/voice-kokoro.py <slug>`.
   - **recorded**: the owner records each line (quiet room, phone close, one take per line, a
     second of silence before and after) and drops the files as `raw/NN.*`. Trim silence with
     `ffmpeg -i in.m4a -af silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse raw/NN.mp3`.

3. `node tools/voice-finish.mjs <slug>`: applies `voice.speed`, writes `voice/NN.mp3`, sets each
   section's `voice`.
4. Check: durations look sane (`ffprobe` each; a 8-word line ≈ 2.5–4 s), no clipped starts.
   Listen-check is the owner's: tell them which files to play.

## Auditioning (first time, or a new voice)

Pick one representative line. Make it in 3–6 voices (Higgsfield: show the cost first), save as
`<media>/_audition/<voice>.mp3`, and ask the owner to choose. Record the choice in `studio.json`.
