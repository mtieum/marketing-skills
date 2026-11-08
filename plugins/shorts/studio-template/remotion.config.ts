import { Config } from '@remotion/cli/config';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Pictures, clips, voice and the brand copies live in the media folder (not in git): staticFile('my-short/shots/x.mp4').
const studio = JSON.parse(readFileSync('studio.json', 'utf8'));
Config.setPublicDir(studio.media ?? 'media');
// The map scene needs WebGL; headless browsers often have none on the GPU, so SwiftShader draws it.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
// The picture's quality (--crf=16) is set in tools/build.sh: a config CRF would refuse the audio stems' wav codec.

// Use Playwright's headless Chrome if it is installed (tools/capture.mjs needs it anyway) rather than download another.
const cache = join(homedir(), '.cache/ms-playwright');
const shell = existsSync(cache) ? readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop() : undefined;
const binary = shell && ['chrome-headless-shell-linux64', 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']
  .map((d) => join(cache, shell, d, 'chrome-headless-shell'))
  .find((p) => existsSync(p));
if (binary) Config.setBrowserExecutable(binary);
