import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { staticFile } from 'remotion';
import { FPS } from './brand';
import type { ShortSpec } from './types';

/** Held after each line before the cut. tools/captions.mjs uses the same numbers. */
export const TAIL = 0.3;
/** Until the voice is made, a line takes about this long per word. */
const PER_WORD = 0.36;
/** The close stays up a little after its line. */
export const END_HOLD = 0.8;

/** Per section: where it starts, how long it lasts, and how much of that is the voice speaking (all in frames). */
export type Timed = { start: number; frames: number; spoken: number }[];

/** Each section's start and length in frames: the line's real length once made, an estimate until then. */
export async function timeline(short: ShortSpec): Promise<Timed> {
  let at = 0;
  const out: Timed = [];
  for (const section of short.sections) {
    const spoken = section.voice
      ? await getAudioDurationInSeconds(staticFile(section.voice))
      : section.vo.split(/\s+/).length * PER_WORD;
    const frames = Math.ceil((spoken + TAIL + (section.end ? END_HOLD : 0)) * FPS);
    out.push({ start: at, frames, spoken: Math.round(spoken * FPS) });
    at += frames;
  }
  return out;
}
