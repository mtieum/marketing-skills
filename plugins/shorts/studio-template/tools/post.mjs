// Writes <media>/<slug>/upload/post.md (or post.new.md beside an existing one, never over it): the facts every post needs (file, length, link) and the
// full credits, gathered from the short itself so none is typed from memory. The captions per
// platform are written after, by a person or the marketing plugin's short-video playbook.
//   node tools/post.mjs <slug>
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, readShort, studio } from './lib.mjs';
import kit from '../src/generated/brand.json' with { type: 'json' };

const slug = process.argv[2];
const short = readShort(slug);
const up = join(MEDIA, slug, 'upload');
const video = readdirSync(up).find((f) => f.endsWith('.mp4'));
const seconds = video ? Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(up, video)]).toString())) : '?';

const shots = short.sections.flatMap((s) => s.shots);
const credits = [...new Set(shots.filter((s) => s.credit && !s.own).map((s) => s.credit))];
const lines = [
  ...credits.map((c) => `- ${c}`),
  ...(shots.some((s) => s.kind === 'map') && kit.map ? [`- Maps: ${kit.map.attribution}`] : []),
  ...(kit.music ? [`- Music: ${kit.music.credit}`] : []),
  ...(studio.voice?.credit ? [`- Voice: ${studio.voice.credit}`] : []),
];
const synthetic = studio.voice?.provider && studio.voice.provider !== 'recorded';

const md = `# ${short.title}

Video: ${video ?? '(not built yet)'} (1080x1920, ${seconds} s, -14 LUFS). Captions: captions.srt.
Link: ${short.link}

Each block below is the exact text to paste. The subtitles are burned into the video, so turn off
the apps' auto-captions (on YouTube, upload captions.srt under Subtitles: it helps search).

## Credits (paste at the end of every caption or description)

\`\`\`
${lines.join('\n').replace(/^- /gm, '') || '(no third-party material)'}
\`\`\`

## TikTok / Instagram Reels caption

\`\`\`
TODO: written from the short (hook, one line of value, where the link is), then the credits
\`\`\`

## YouTube Shorts

Title:

\`\`\`
TODO (under 100 characters, the words people search)
\`\`\`

Description:

\`\`\`
TODO: two lines about the short, the link, then the credits
\`\`\`

## Before posting
${synthetic ? `- The voice is synthetic (${studio.voice.provider}). TikTok asks for its "AI-generated" label on realistic AI content; turning it on is the safe choice. YouTube's "altered or synthetic" setting is for realistic people, places or events that didn't happen.\n` : ''}- Music: use only what the credits above allow on each platform; tracks from a platform's own library may not be cleared elsewhere.
- Watch it once on a phone with the sound off: every word should read without the voice.
`;
// Never overwrite notes someone has written: a rebuild's fresh notes go beside them.
const target = existsSync(join(up, 'post.md')) ? 'post.new.md' : 'post.md';
writeFileSync(join(up, target), md);
console.log(`post notes: ${join(up, target)}${target === 'post.new.md' ? ' (post.md already exists and was left as it is: compare the credits)' : ''}`);
