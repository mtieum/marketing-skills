import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand } from '../brand';

/** One grade over every picture, so footage from different people sits together. */
export const grade = brand.grade ?? 'contrast(1.06) saturate(1.08) brightness(0.98)';

/** Each shot settles in: a slight push that ends as the next cut comes. */
function usePush(from: number, to: number): number {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [0, durationInFrames], [from, to], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
}

const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);

export function Clip({ src, from = 0 }: { src: string; from?: number }) {
  const { fps } = useVideoConfig();
  const scale = usePush(1.1, 1.0);
  if (!isVideo(src)) return <Photo src={src} />;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={Math.round(from * fps)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: grade }}
      />
    </AbsoluteFill>
  );
}

export function Photo({ src, move = 'in' }: { src: string; move?: 'in' | 'out' | 'left' | 'right' }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.sin), extrapolateRight: 'clamp' });
  const scale = move === 'in' ? 1.04 + 0.12 * t : move === 'out' ? 1.16 - 0.12 * t : 1.14;
  const x = move === 'left' ? 4 - 8 * t : move === 'right' ? -4 + 8 * t : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translateX(${x}%)`, filter: grade }} />
    </AbsoluteFill>
  );
}
