import { Map as MapLibre, setWorkerUrl, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, Easing, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, colour, display, text } from '../brand';
import type { Stop } from '../types';

/** The map is drawn at a phone's size and scaled up, so its streets and labels read as they do on a phone. */
const SCALE = 2.5;
const map = brand.map ?? { style: 'https://tiles.openfreemap.org/styles/positron', attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap' };

// maplibre's worker, copied beside the brand by tools/brand.mjs.
setWorkerUrl(staticFile('_brand/maplibre/maplibre-gl-worker.mjs'));

/** A point part of the way along a straight line: the route is drawn as the camera travels. */
const along = (a: Stop, b: Stop, t: number): [number, number] => [a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t];

/**
 * The map flying from one point to the next, the route drawn in the accent colour as it goes,
 * each point a pin with its name. Every frame waits for the tiles, so nothing renders half-drawn.
 * Its look is brand.map: a style URL, or a style file in the kit (copied to _brand/).
 */
export function MapScene({ from, to }: { from: Stop; to: Stop }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const box = useRef<HTMLDivElement>(null);
  const [m, setMap] = useState<MapLibreMap | null>(null);
  const [ready] = useState(() => delayRender('map style'));

  useEffect(() => {
    let gone = false;
    fetch(/^https?:/.test(map.style) ? map.style : staticFile(map.style))
      .then((r) => r.json())
      .then((style) => {
        if (gone || !box.current) return;
        const hide = map.hideLayers ? new RegExp(map.hideLayers) : null;
        const mapped = new MapLibre({
          container: box.current,
          style: hide ? { ...style, layers: style.layers.filter((l: { id: string }) => !hide.test(l.id)) } : style,
          center: [from.lng, from.lat],
          zoom: 15.5,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
          canvasContextAttributes: { preserveDrawingBuffer: true },
          pixelRatio: SCALE,
        });
        mapped.on('error', (e) => console.error('map:', e.error?.message ?? e));
        mapped.on('load', () => {
          setMap(mapped);
          continueRender(ready);
        });
      });
    return () => {
      gone = true;
    };
  }, []);

  // The camera: from the first point to the second, pulling back a little in the middle so both are in view.
  const t = interpolate(frame, [0, durationInFrames * 0.85], [0, 1], { easing: Easing.inOut(Easing.cubic), extrapolateRight: 'clamp' });
  const centre = along(from, to, t);
  const near = 15.4;
  const fit = m?.cameraForBounds([[Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)], [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)]], { padding: 90 })?.zoom ?? near;
  const zoom = near - (near - Math.min(near - 0.7, fit)) * Math.sin(Math.PI * t);
  const drawn = interpolate(frame, [durationInFrames * 0.1, durationInFrames * 0.8], [0, 1], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // The camera moves while rendering, before the pins are placed with project(): placed after, they lag a frame.
  m?.jumpTo({ center: centre, zoom, pitch: 35, bearing: -12 + 10 * t });

  useEffect(() => {
    if (!m) return;
    const handle = delayRender(`map frame ${frame}`);
    let done = false;
    const finish = () => {
      if (done) return;
      if (m.areTilesLoaded() && m.isStyleLoaded()) {
        done = true;
        continueRender(handle);
      } else m.once('render', finish);
    };
    m.once('render', finish);
    m.triggerRepaint();
    const fallback = setTimeout(() => {
      done = true;
      continueRender(handle);
    }, 8000);
    return () => clearTimeout(fallback);
  }, [m, frame]);

  const bg = colour.background;
  const pin = (stop: Stop, shown: number) => {
    if (!m) return null;
    const p = m.project([stop.lng, stop.lat]).mult(SCALE);
    return (
      <div style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${shown})`, opacity: shown }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: colour.accent, border: `8px solid ${bg}`, boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', left: 60, top: -6, whiteSpace: 'nowrap', fontFamily: display, fontWeight: 700, fontSize: 44, color: colour.text, textShadow: `0 2px 14px ${bg}, 0 0 4px ${bg}` }}>
          {stop.name}
        </div>
      </div>
    );
  };
  // The route is drawn over the map, not in it, so a filter on the map leaves the accent alone.
  const route = () => {
    if (!m) return null;
    const a = m.project([from.lng, from.lat]).mult(SCALE);
    const b = m.project(along(from, to, drawn)).mult(SCALE);
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={bg} strokeWidth={24} strokeLinecap="round" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour.accent} strokeWidth={12} strokeLinecap="round" />
      </svg>
    );
  };
  const appear = (at: number) => interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bg }}>
      <div ref={box} style={{ position: 'absolute', left: 0, top: 0, width: 1080 / SCALE, height: 1920 / SCALE, transform: `scale(${SCALE})`, transformOrigin: '0 0', filter: map.filter ?? 'none' }} />
      {route()}
      {pin(from, appear(0))}
      {pin(to, appear(durationInFrames * 0.75))}
      <div style={{ position: 'absolute', right: 160, bottom: 440, fontFamily: text, fontSize: 20, color: colour.muted, opacity: 0.8 }}>{map.attribution}</div>
    </AbsoluteFill>
  );
}
