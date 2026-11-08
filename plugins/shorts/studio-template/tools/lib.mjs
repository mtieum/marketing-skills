// Shared by the studio's tools: where things are, the studio's settings, keys from .env.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const studio = JSON.parse(readFileSync(join(ROOT, 'studio.json'), 'utf8'));
export const MEDIA = resolve(ROOT, studio.media ?? 'media');
export const BRAND = join(ROOT, 'brand');
export const SHORTS = join(ROOT, 'shorts');

/** A key from the environment, or from the studio's .env. */
export function secret(name) {
  if (process.env[name]) return process.env[name];
  const env = join(ROOT, '.env');
  if (!existsSync(env)) return undefined;
  for (const line of readFileSync(env, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key?.trim() === name) return rest.join('=').trim().replace(/^"|"$/g, '') || undefined;
  }
  return undefined;
}

export const readShort = (slug) => JSON.parse(readFileSync(join(SHORTS, `${slug}.json`), 'utf8'));
