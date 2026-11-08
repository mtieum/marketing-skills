// Checks everything the studio needs, and says how to fix what's missing:
//   node tools/doctor.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BRAND, ROOT, secret, studio } from './lib.mjs';

const rows = [];
const ok = (what, detail = '') => rows.push(['ok ', what, detail]);
const no = (what, fix) => rows.push(['NO ', what, fix]);
const opt = (what, fix) => rows.push(['-- ', what, fix]);
const has = (cmd, args = ['-version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;

// Tools on the computer
const [major] = process.versions.node.split('.').map(Number);
major >= 22 ? ok('Node', process.versions.node) : no('Node 22 or newer', `you have ${process.versions.node}: install Node 22 (e.g. nvm install 22)`);
has('ffmpeg') ? ok('ffmpeg') : no('ffmpeg', 'install ffmpeg (Linux: your package manager; macOS: brew install ffmpeg; Windows: winget install ffmpeg)');
has('ffprobe') ? ok('ffprobe') : no('ffprobe', 'comes with ffmpeg');
has('python3', ['--version']) ? ok('python3') : no('python3', 'install Python 3 (for the footage finders)');

// The studio's own packages
existsSync(join(ROOT, 'node_modules/remotion')) ? ok('Remotion and packages installed') : no('packages', 'run: npm install');
const pw = join(homedir(), '.cache/ms-playwright');
existsSync(pw) && readdirSync(pw).some((d) => d.startsWith('chromium')) ? ok('Headless Chrome (Playwright)') : no('Headless Chrome', 'run: npx playwright install chromium');

// Licence and identity
const lic = studio.remotionLicence;
lic ? ok('Remotion licence', lic) : no('Remotion licence', 'Remotion is free for individuals and companies of up to 3 people; larger companies need a company licence (remotion.pro). Record which applies in studio.json "remotionLicence"');
studio.contact ? ok('Contact for Wikimedia', studio.contact) : no('Contact', 'set studio.json "contact" (a URL or email): Wikimedia Commons requires it');

// Brand kit
if (!existsSync(join(BRAND, 'brand.json'))) no('Brand kit', 'run the shorts:brand skill');
else {
  const r = spawnSync('node', [join(ROOT, 'tools/brand.mjs')], { encoding: 'utf8' });
  r.status === 0 ? ok('Brand kit', r.stdout.trim().split('\n').pop()) : no('Brand kit', `node tools/brand.mjs reports:\n${r.stdout.trim()}`);
}

// Footage
secret('PIXABAY_API') ? ok('Pixabay key') : opt('Pixabay key (optional, for video clips)', 'free key at pixabay.com/api/docs/ -> PIXABAY_API in .env');

// Voice
const v = studio.voice ?? {};
switch (v.provider) {
  case 'higgsfield':
    ok('Voice: Higgsfield', 'made through the Higgsfield connector in Claude (your account and credits); the shorts:voice skill checks it is connected');
    break;
  case 'elevenlabs':
    secret('ELEVENLABS_API_KEY') && v.voice ? ok('Voice: ElevenLabs', v.voice) : no('Voice: ElevenLabs', 'ELEVENLABS_API_KEY in .env and studio.json voice.voice (a voice ID)');
    break;
  case 'kokoro': {
    const py = v.python || 'python3';
    has(py, ['-c', 'import kokoro, soundfile']) ? ok('Voice: Kokoro', `${py}, ${v.voice || 'bf_emma'}`) : no('Voice: Kokoro', `${py} can't import kokoro: python3 -m venv ~/kokoro && ~/kokoro/bin/pip install kokoro soundfile, then studio.json voice.python = ~/kokoro/bin/python (full path)`);
    break;
  }
  case 'recorded':
    ok('Voice: your own recordings', 'save line NN as <media>/<slug>/voice/raw/NN.mp3');
    break;
  default:
    no('Voice', 'choose studio.json voice.provider: higgsfield, elevenlabs, kokoro (free, local) or recorded');
}
v.provider && v.provider !== 'recorded' && !v.credit && no('Voice credit', 'studio.json voice.credit, e.g. "generated (ElevenLabs)": it goes in every post');

// Music
const kit = existsSync(join(BRAND, 'brand.json')) ? JSON.parse(readFileSync(join(BRAND, 'brand.json'), 'utf8')) : {};
kit.music?.file && existsSync(join(BRAND, kit.music.file)) ? ok('Music bed', kit.music.credit) : opt('Music bed (optional)', 'a track you are licensed to use on every platform you post to -> brand/music/, credit in brand.json');

const w = Math.max(...rows.map((r) => r[1].length));
for (const [mark, what, detail] of rows) console.log(`${mark} ${what.padEnd(w)}  ${detail}`);
const missing = rows.filter((r) => r[0] === 'NO ').length;
console.log(missing ? `\n${missing} thing(s) to fix.` : '\nReady.');
process.exit(missing ? 1 : 0);
