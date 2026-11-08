import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
// Written by tools/brand.mjs from brand/brand.json after it passes the checks; the files it
// names (fonts, logo, music, map style) are copied to media/_brand/.
import kit from './generated/brand.json';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export type BrandKit = {
  name: string;
  colours: { background: string; deep: string; surface: string; text: string; muted: string; accent: string };
  fonts: { display: string; text: string };
  logo: { onDark: string; icon?: string };
  hook?: { lead?: string };
  endCard?: { line?: string; showAddress?: boolean };
  grade?: string;
  map?: { style: string; hideLayers?: string; filter?: string; attribution: string };
  music?: { file: string; credit: string; under?: number; between?: number };
};

export const brand = kit as BrandKit;
export const colour = brand.colours;

export const display = '"Brand Display", system-ui, sans-serif';
export const text = '"Brand Text", system-ui, sans-serif';

/** The brand's typefaces, loaded before the first frame is taken. */
export function useBrandFonts(): void {
  const [handle] = useState(() => delayRender('brand fonts'));
  useEffect(() => {
    const faces = [
      new FontFace('Brand Display', `url(${staticFile(brand.fonts.display)})`, { weight: '100 900' }),
      new FontFace('Brand Text', `url(${staticFile(brand.fonts.text)})`, { weight: '100 900' }),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => loaded.forEach((f) => document.fonts.add(f)))
      .finally(() => continueRender(handle));
  }, [handle]);
}

/** The safe area: TikTok, Reels and Shorts cover the bottom quarter with their caption and the right edge with buttons. */
export const safe = { top: 150, bottom: 480, left: 72, right: 150 };
