import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colour, display, safe, text } from './brand';
import type { Card as CardData } from './types';

/** A wash of the background colour at the top and bottom of every picture, clear in the middle, so the words always read. */
export function Scrim() {
  const bg = colour.background;
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${bg}d9 0%, ${bg}66 16%, transparent 32%, transparent 56%, ${bg}99 74%, ${bg}e6 100%)` }}
    />
  );
}

/** Rises in; `delay` in frames. */
function useRise(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.6, stiffness: 140 } });
}

/** What's on screen: a kicker (accent), a title (large), and a fact worth knowing. Top left, under the rail. */
export function StopCard({ card }: { card: CardData }) {
  const k = useRise(0);
  const t = useRise(3);
  const n = useRise(8);
  const lift = (p: number) => ({ opacity: p, transform: `translateY(${(1 - p) * 40}px)` });
  return (
    <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: 250 }}>
      {card.kicker && (
        <div style={{ ...lift(k), fontFamily: text, fontWeight: 800, fontSize: 38, letterSpacing: 4, textTransform: 'uppercase', color: colour.accent }}>
          {card.kicker}
        </div>
      )}
      <div style={{ ...lift(t), fontFamily: display, fontWeight: 800, fontSize: 104, lineHeight: 1.0, color: colour.text, marginTop: 10, textWrap: 'balance', textShadow: '0 4px 30px rgba(0,0,0,0.45)' }}>
        {card.title}
      </div>
      {card.note && (
        <div style={{ ...lift(n), display: 'inline-block', marginTop: 22, padding: '10px 22px', borderRadius: 999, background: `${colour.background}cc`, border: `2px solid ${colour.accent}`, fontFamily: text, fontWeight: 700, fontSize: 34, color: colour.text }}>
          {card.note}
        </div>
      )}
    </div>
  );
}

/** The voice-over as one quiet line above the apps' caption band: most people watch with the sound off. */
export function Subtitle({ line }: { line: string }) {
  const p = useRise(2);
  const bg = colour.background;
  return (
    <div style={{ position: 'absolute', left: safe.left, right: safe.right, bottom: safe.bottom + 20, textAlign: 'center', opacity: p }}>
      <span style={{ fontFamily: text, fontWeight: 700, fontSize: 46, lineHeight: 1.3, color: colour.text, textWrap: 'balance', textShadow: `0 2px 18px ${bg}, 0 0 3px ${bg}` }}>
        {line}
      </span>
    </div>
  );
}

/** The opening: a small lead line and the title, very large, landing in the first half second. */
export function Hook({ lead, title }: { lead?: string; title: string }) {
  const frame = useCurrentFrame();
  const small = useRise(0);
  const big = useRise(4);
  const bg = colour.background;
  const spread = interpolate(frame, [0, 60], [12, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center' }}>
      {lead && (
        <div style={{ opacity: small, transform: `translateY(${(1 - small) * 30}px)`, fontFamily: text, fontWeight: 800, fontSize: 56, letterSpacing: 6, textTransform: 'uppercase', color: colour.text, textShadow: `0 3px 24px ${bg}, 0 0 8px ${bg}, 0 0 2px ${bg}` }}>
          {lead}
        </div>
      )}
      <div
        style={{
          opacity: big,
          transform: `scale(${0.85 + 0.15 * big})`,
          fontFamily: display,
          fontWeight: 800,
          // As large as a short word; a longer one comes down to fit the frame, at about 0.6 of its size a letter.
          fontSize: Math.min(230, Math.floor(980 / (0.6 * [...title].length))),
          lineHeight: 1,
          letterSpacing: spread,
          color: colour.accent,
          textShadow: `0 8px 60px ${bg}, 0 0 14px ${bg}99`,
        }}
      >
        {title}
      </div>
    </div>
  );
}

/** The chapters as a thin rail at the top, filling as the short goes; it says where we are. */
export function Rail({ chapters, at, progress }: { chapters: string[]; at: number; progress: number }) {
  return (
    <div style={{ position: 'absolute', top: safe.top, left: safe.left, right: safe.right, display: 'flex', gap: 24 }}>
      {chapters.map((name, n) => {
        const fill = n < at ? 1 : n === at ? progress : 0;
        return (
          <div key={name} style={{ flex: 1 }}>
            <div style={{ fontFamily: text, fontWeight: 800, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: n === at ? colour.accent : colour.muted, marginBottom: 10 }}>
              {name}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: `${colour.text}33`, overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: colour.accent }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
