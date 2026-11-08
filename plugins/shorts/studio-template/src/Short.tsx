import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { brand, colour, useBrandFonts } from './brand';
import { Hook, Rail, Scrim, StopCard, Subtitle } from './Overlays';
import { Clip, Photo } from './scenes/Clip';
import { MapScene } from './scenes/MapScene';
import { ScreenScene } from './scenes/ScreenScene';
import type { Timed } from './timing';
import type { Shot, ShortSpec } from './types';

/**
 * The audio is rendered as two stems, mixed and mastered after (tools/master.sh), so the music
 * can be swapped without touching the voice: `stem` renders only that one; without it, both play (studio).
 */
export type Stem = 'voice' | 'music';

export type ShortProps = { short: ShortSpec; timed: Timed; stem?: Stem };

function ShotView({ shot, link }: { shot: Shot; link: string }) {
  switch (shot.kind) {
    case 'clip':
      return <Clip src={shot.src} from={shot.from} />;
    case 'photo':
      return <Photo src={shot.src} move={shot.move} />;
    case 'map':
      return <MapScene from={shot.from} to={shot.to} />;
    case 'screen':
      return <ScreenScene src={shot.src} backdrop={shot.backdrop} link={link} scroll={shot.scroll} />;
  }
}

/** Where we are, for the rail: the chapters in order, which one is playing, and how far through it. */
function useChapters({ short, timed }: ShortProps): { chapters: string[]; at: number; progress: number } | null {
  const frame = useCurrentFrame();
  const chapters = [...new Set(short.sections.flatMap((s) => (s.chapter ? [s.chapter] : [])))];
  const i = timed.findIndex((t) => frame >= t.start && frame < t.start + t.frames);
  const chapter = short.sections[i]?.chapter;
  if (!chapter) return null;
  const span = short.sections.flatMap((s, j) => (s.chapter === chapter ? [timed[j]!] : []));
  const start = span[0]!.start;
  const end = span[span.length - 1]!.start + span[span.length - 1]!.frames;
  return { chapters, at: chapters.indexOf(chapter), progress: (frame - start) / (end - start) };
}

/** The music's level at a frame: down under the voice, up in the gaps between lines, faded out under the end. */
const RAMP = 6;
function musicLevel(frame: number, { short, timed }: ShortProps): number {
  const under = brand.music?.under ?? 0.12;
  const between = brand.music?.between ?? 0.26;
  const total = timed.length ? timed[timed.length - 1]!.start + timed[timed.length - 1]!.frames : 0;
  const end = timed[short.sections.findIndex((s) => s.end)]?.start ?? total - 45;
  // How far into the nearest line we are: 1 while speaking, easing to 0 over RAMP frames either side.
  let speaking = 0;
  for (const t of timed) {
    const a = t.start, b = t.start + t.spoken;
    const v = interpolate(frame, [a - RAMP, a, b, b + RAMP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    speaking = Math.max(speaking, v);
  }
  const fade = interpolate(frame, [end, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (between + (under - between) * speaking) * fade;
}

export function Short(props: ShortProps) {
  useBrandFonts();
  const { short, timed, stem } = props;
  const rail = useChapters(props);
  return (
    <AbsoluteFill style={{ background: colour.background }}>
      {short.sections.map((section, i) => {
        const t = timed[i];
        if (!t) return null;
        // The section's shots share its time, cut evenly.
        const each = Math.floor(t.frames / section.shots.length);
        const hook = typeof section.hook === 'string' ? { title: section.hook } : section.hook;
        return (
          <Sequence key={i} from={t.start} durationInFrames={t.frames} name={section.card?.title ?? hook?.title ?? (section.end ? 'End' : `Section ${i + 1}`)}>
            {section.shots.map((shot, j) => (
              <Sequence key={j} from={j * each} durationInFrames={j === section.shots.length - 1 ? t.frames - j * each : each}>
                <ShotView shot={shot} link={short.link} />
              </Sequence>
            ))}
            {!section.end && <Scrim />}
            {hook && <Hook lead={hook.lead ?? brand.hook?.lead} title={hook.title} />}
            {section.card && <StopCard card={section.card} />}
            {!section.end && <Subtitle line={section.vo} />}
            {section.voice && stem !== 'music' && <Audio src={staticFile(section.voice)} />}
          </Sequence>
        );
      })}
      {rail && <Rail chapters={rail.chapters} at={rail.at} progress={rail.progress} />}
      {brand.music && stem !== 'voice' && <Audio src={staticFile(brand.music.file)} volume={(f) => musicLevel(f, props)} />}
    </AbsoluteFill>
  );
}
