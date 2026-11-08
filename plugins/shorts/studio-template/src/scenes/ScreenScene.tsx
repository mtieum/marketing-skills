import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, colour, display, text } from '../brand';
import { Clip } from './Clip';

/** The phone's screen: captures are 1170 px wide (390 at 3x, tools/capture.mjs). */
const SCREEN_W = 540;
const SCREEN_H = Math.round((SCREEN_W * 844) / 390);

/**
 * A page or app on a phone, scrolling, over a blurred clip or photo, with the logo and the
 * brand's line above it: what the viewer gets if they tap through, shown as it is.
 * `scroll` is how far down the capture to travel, as a share of the screen's height (default 0.7).
 */
export function ScreenScene({ src, backdrop, link, scroll: depth = 0.7 }: { src: string; backdrop: string; link: string; scroll?: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 18, mass: 0.8 } });
  const scroll = interpolate(frame, [fps * 0.6, durationInFrames - fps * 0.6], [0, SCREEN_H * depth], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const address = link.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  const bg = colour.background;
  const line = brand.endCard?.line;
  const showAddress = brand.endCard?.showAddress ?? true;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(18px) brightness(0.55)', transform: 'scale(1.1)' }}>
        <Clip src={backdrop} />
      </div>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${bg}cc 0%, ${bg}33 40%, ${bg}dd 100%)` }} />
      {/* The words go above the phone: the bottom of the frame is under the apps' buttons and caption. */}
      <Img src={staticFile(brand.logo.onDark)} style={{ position: 'absolute', top: 160, left: (1080 - 520) / 2, width: 520, maxHeight: 110, objectFit: 'contain' }} />
      <div style={{ position: 'absolute', top: 290, width: '100%', textAlign: 'center', opacity: rise }}>
        {line && <span style={{ fontFamily: display, fontWeight: 800, fontSize: 60, color: colour.accent }}>{line}</span>}
        {showAddress && <span style={{ fontFamily: text, fontWeight: 600, fontSize: 40, color: colour.text, marginLeft: line ? 22 : 0 }}>{address}</span>}
      </div>
      <div
        style={{
          position: 'absolute',
          left: (1080 - SCREEN_W) / 2 - 16,
          top: 420 + (1 - rise) * 300,
          width: SCREEN_W + 32,
          height: SCREEN_H + 32,
          borderRadius: 64,
          background: '#05080f',
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
          opacity: rise,
        }}
      >
        <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: 50, overflow: 'hidden', position: 'relative' }}>
          <Img src={staticFile(src)} style={{ position: 'absolute', top: -scroll, left: 0, width: SCREEN_W }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
