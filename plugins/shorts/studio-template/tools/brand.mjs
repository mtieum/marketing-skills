// Checks the brand kit in brand/ and hands it to the renderer:
//   node tools/brand.mjs            # check, then copy the files to <media>/_brand and write src/generated/brand.json
//   node tools/brand.mjs --preview  # the same, then render brand/preview.png (one frame showing the whole kit)
//
// The kit's format is in BRAND-KIT.md (brand/README.md in a studio). Errors stop here, before
// anything renders; warnings are printed and left to a person to judge.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { BRAND, MEDIA, ROOT } from './lib.mjs';

const errors = [];
const warnings = [];
const kitFile = join(BRAND, 'brand.json');
if (!existsSync(kitFile)) {
  console.error(`no brand kit: ${kitFile} is missing. Run the shorts:brand skill, or copy the template.`);
  process.exit(1);
}
const kit = JSON.parse(readFileSync(kitFile, 'utf8'));
const at = (p) => join(BRAND, p);
const head = (file, n) => {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(n);
  readSync(fd, buf, 0, n, 0);
  closeSync(fd);
  return buf;
};

// --- Name -----------------------------------------------------------------
if (!kit.name || kit.name === 'Your brand') errors.push('name: set the brand\'s name');

// --- Colours --------------------------------------------------------------
const NEED = ['background', 'deep', 'surface', 'text', 'muted', 'accent'];
const hex = /^#[0-9a-fA-F]{6}$/;
for (const k of NEED) {
  if (!hex.test(kit.colours?.[k] ?? '')) errors.push(`colours.${k}: needs a 6-digit hex like #1a2b3c (got ${kit.colours?.[k] ?? 'nothing'})`);
}
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
if (NEED.every((k) => hex.test(kit.colours?.[k] ?? ''))) {
  const c = kit.colours;
  const check = (a, b, min, what, hard) => {
    const r = contrast(c[a], c[b]);
    if (r < min) (hard ? errors : warnings).push(`colours: ${a} on ${b} is ${r.toFixed(1)}:1, ${what} needs ${min}:1 or more`);
  };
  check('text', 'background', 4.5, 'captions over pictures', true);
  check('accent', 'background', 3, 'large titles in the accent', true);
  check('muted', 'background', 3, 'the rail\'s labels', false);
  check('text', 'surface', 4.5, 'text on the surface colour', false);
  if (lum(c.background) > 0.4) warnings.push('colours.background is light: the shorts are designed dark (captions sit on a wash of the background over footage); a light background reads badly over most video');
}

// --- Fonts ----------------------------------------------------------------
const FONT_SIGS = { woff2: 'wOF2', woff: 'wOFF', otf: 'OTTO' };
for (const k of ['display', 'text']) {
  const p = kit.fonts?.[k];
  if (!p) { errors.push(`fonts.${k}: name a font file in brand/fonts/`); continue; }
  const f = at(p);
  if (!existsSync(f)) { errors.push(`fonts.${k}: ${p} not found in brand/`); continue; }
  const ext = extname(f).slice(1).toLowerCase();
  if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext)) { errors.push(`fonts.${k}: ${p} must be .woff2, .woff, .ttf or .otf`); continue; }
  const sig = head(f, 4);
  const ok = ext === 'ttf' ? sig.readUInt32BE(0) === 0x00010000 || sig.toString('latin1') === 'true' : sig.toString('latin1') === FONT_SIGS[ext];
  if (!ok) errors.push(`fonts.${k}: ${p} isn't a real .${ext} file (renamed from something else?)`);
}

// --- Logo -----------------------------------------------------------------
const pngSize = (f) => {
  const b = head(f, 24);
  return b.toString('latin1', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
};
const svgInfo = (f) => {
  const s = readFileSync(f, 'utf8');
  const vb = s.match(/viewBox="([\d.\s-]+)"/);
  const [, , w, h] = vb ? vb[1].trim().split(/\s+/).map(Number) : [];
  return { s, w, h };
};
const logo = (key, need, square) => {
  const p = kit.logo?.[key];
  if (!p) { if (need) errors.push(`logo.${key}: name a logo file in brand/logo/`); return; }
  const f = at(p);
  if (!existsSync(f)) { errors.push(`logo.${key}: ${p} not found in brand/`); return; }
  const ext = extname(f).toLowerCase();
  if (ext === '.svg') {
    const { s, w, h } = svgInfo(f);
    if (!w) warnings.push(`logo.${key}: the SVG has no viewBox, so it may not scale`);
    if (/<text[\s>]/.test(s)) warnings.push(`logo.${key}: the SVG has live <text>; outline it (convert text to paths) or it renders in a fallback font`);
    if (/(xlink:)?href="(?!#|data:)/.test(s)) warnings.push(`logo.${key}: the SVG links to outside files; embed or remove them`);
    if (square && w && Math.abs(w - h) > 0.5) warnings.push(`logo.${key}: an icon should be square (viewBox is ${w}×${h})`);
  } else if (ext === '.png') {
    const size = pngSize(f);
    if (!size) errors.push(`logo.${key}: ${p} isn't a real PNG`);
    else {
      if (size.w < 1000 && !square) warnings.push(`logo.${key}: ${size.w}px wide is soft at video size; 1600px or an SVG is better`);
      if (square && size.w !== size.h) warnings.push(`logo.${key}: an icon should be square (${size.w}×${size.h})`);
      if (square && size.w < 800) warnings.push(`logo.${key}: ${size.w}px is small for channel avatars (800px or more)`);
    }
  } else errors.push(`logo.${key}: ${p} must be .svg or .png`);
};
logo('onDark', true, false);
logo('icon', false, true);

// --- Map ------------------------------------------------------------------
if (kit.map?.style && !/^https?:/.test(kit.map.style)) {
  const f = at(kit.map.style);
  if (!existsSync(f)) errors.push(`map.style: ${kit.map.style} not found in brand/`);
  else {
    try {
      const s = JSON.parse(readFileSync(f, 'utf8'));
      if (!Array.isArray(s.layers) || !s.sources) errors.push('map.style: not a MapLibre style (no layers or sources)');
    } catch {
      errors.push('map.style: not valid JSON');
    }
  }
}
if (kit.map && !kit.map.attribution) errors.push('map.attribution: the map\'s data credit is required (e.g. "© OpenStreetMap")');
if (kit.map?.hideLayers) {
  try { new RegExp(kit.map.hideLayers); } catch { errors.push('map.hideLayers: not a valid regular expression'); }
}

// --- Music ----------------------------------------------------------------
if (kit.music?.file) {
  if (!existsSync(at(kit.music.file))) warnings.push(`music.file: ${kit.music.file} not found; the shorts will have no music bed`);
  else if (!kit.music.credit) errors.push('music.credit: say where the track is from and under what licence (it goes in every post\'s credits)');
}

// --- Report ---------------------------------------------------------------
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`ERROR    ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s): fix brand/brand.json or the files it names, then run this again.`);
  process.exit(1);
}

// --- Hand over ------------------------------------------------------------
const out = join(MEDIA, '_brand');
mkdirSync(join(out, 'maplibre'), { recursive: true });
const put = (p, name) => {
  const dest = `${name}${extname(p).toLowerCase()}`;
  copyFileSync(at(p), join(out, dest));
  return `_brand/${dest}`;
};
const gen = {
  name: kit.name,
  colours: Object.fromEntries(NEED.map((k) => [k, kit.colours[k]])),
  fonts: { display: put(kit.fonts.display, 'display'), text: put(kit.fonts.text, 'text') },
  logo: { onDark: put(kit.logo.onDark, 'logo-on-dark'), ...(kit.logo.icon ? { icon: put(kit.logo.icon, 'icon') } : {}) },
  ...(kit.hook?.lead ? { hook: { lead: kit.hook.lead } } : {}),
  endCard: { line: kit.endCard?.line || undefined, showAddress: kit.endCard?.showAddress ?? true },
  ...(kit.grade ? { grade: kit.grade } : {}),
  ...(kit.map
    ? { map: { ...kit.map, style: /^https?:/.test(kit.map.style) ? kit.map.style : put(kit.map.style, 'map-style') } }
    : {}),
  ...(kit.music?.file && existsSync(at(kit.music.file))
    ? { music: { file: put(kit.music.file, 'music'), credit: kit.music.credit, under: kit.music.under, between: kit.music.between } }
    : {}),
};
// maplibre runs its work in a module worker that imports the shared chunk: both are served from the media folder.
const maplibre = join(ROOT, 'node_modules/maplibre-gl/dist');
if (existsSync(maplibre)) for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(join(maplibre, f), join(out, 'maplibre', f));
else warnings.push('maplibre-gl is not installed yet (npm install): map shots will fail');
mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
writeFileSync(join(ROOT, 'src/generated/brand.json'), JSON.stringify(gen, null, 2) + '\n');
console.log(`brand kit ok: "${kit.name}", ${warnings.length} warning(s); files in ${out}`);

if (process.argv.includes('--preview')) {
  execFileSync('node', [join(ROOT, 'tools/index.mjs')], { stdio: 'inherit' });
  execFileSync('npx', ['remotion', 'still', 'src/index.ts', 'brand-preview', join(BRAND, 'preview.png'), '--frame=45', '--log=error'], { cwd: ROOT, stdio: 'inherit' });
  console.log(`preview: ${join(BRAND, 'preview.png')}`);
}
