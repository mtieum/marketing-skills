import { AbsoluteFill, Img, staticFile } from 'remotion';
import { brand, colour, display, safe, text, useBrandFonts } from './brand';
import { Hook, Rail, StopCard, Subtitle } from './Overlays';

/**
 * One frame that shows the whole kit as the shorts will use it: the overlays in place, the
 * swatches with their names, both typefaces, the logo, and the apps' covered areas hatched.
 * Rendered (at frame 45, once everything has risen in) by tools/brand.mjs --preview to brand/preview.png, for whoever made the kit to check.
 */
export function BrandPreview() {
  useBrandFonts();
  const swatches = Object.entries(colour);
  return (
    <AbsoluteFill style={{ background: colour.surface }}>
      <Rail chapters={['Chapter one', 'Chapter two']} at={0} progress={0.6} />
      <StopCard card={{ kicker: 'Kicker', title: 'A card title', note: 'A note' }} />
      <Hook lead={brand.hook?.lead ?? 'Lead line'} title={brand.name} />
      <div style={{ position: 'absolute', left: safe.left, top: 880, display: 'flex', gap: 14 }}>
        {swatches.map(([name, hex]) => (
          <div key={name} style={{ width: 124 }}>
            <div style={{ height: 80, borderRadius: 14, background: hex, border: `2px solid ${colour.muted}` }} />
            <div style={{ fontFamily: text, fontSize: 22, color: colour.text, marginTop: 6 }}>{name}</div>
            <div style={{ fontFamily: text, fontSize: 20, color: colour.muted }}>{hex}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: safe.left, top: 1050, color: colour.text }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64 }}>Display Aa 0123</div>
        <div style={{ fontFamily: text, fontWeight: 600, fontSize: 40 }}>Text Aa Bb Cc 0123 — £€$ áéîõü</div>
      </div>
      <Img src={staticFile(brand.logo.onDark)} style={{ position: 'absolute', left: safe.left, top: 1190, height: 60, background: colour.background, padding: 14, borderRadius: 10 }} />
      <Subtitle line="The voice-over line, as captions show it." />
      {/* Where the apps' own buttons and caption sit: keep everything important out of the hatching. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: safe.bottom - 80, background: 'repeating-linear-gradient(45deg, #ff000033 0 12px, transparent 12px 24px)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: safe.right - 40, background: 'repeating-linear-gradient(45deg, #ff000033 0 12px, transparent 12px 24px)' }} />
    </AbsoluteFill>
  );
}
