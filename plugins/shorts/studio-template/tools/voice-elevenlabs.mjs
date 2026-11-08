// Voices a short's lines with the ElevenLabs API (your own key, ELEVENLABS_API_KEY, and studio.json
// voice.voice = a voice ID from your ElevenLabs library). Writes <media>/<slug>/voice/raw/NN.mp3 for
// lines that don't have one yet (--force: all), then run tools/voice-finish.mjs.
//   node tools/voice-elevenlabs.mjs <slug> [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, readShort, secret, studio } from './lib.mjs';

const slug = process.argv[2];
const key = secret('ELEVENLABS_API_KEY');
const voice = studio.voice?.voice;
if (!key || !voice) { console.error('needs ELEVENLABS_API_KEY in .env and studio.json voice.voice (a voice ID)'); process.exit(1); }
const dir = join(MEDIA, slug, 'voice', 'raw');
mkdirSync(dir, { recursive: true });
const short = readShort(slug);
for (const [i, s] of short.sections.entries()) {
  const out = join(dir, `${String(i).padStart(2, '0')}.mp3`);
  if (existsSync(out) && !process.argv.includes('--force')) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: s.vo, model_id: studio.voice?.model || 'eleven_multilingual_v2' }),
  });
  if (!r.ok) { console.error(`line ${i}: ${r.status} ${await r.text()}`); process.exit(1); }
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`line ${i}: ${out}`);
}
