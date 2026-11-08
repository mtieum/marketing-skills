#!/usr/bin/env node
// Puts the review board on your own Cloudflare account, once:
//   cd board-cloud && npm install && npx wrangler login
//   node setup.mjs <workspace> [--contact mailto:you@example.com] [--tz Europe/London] [--new-password]
//
// It creates the R2 bucket, makes a password, a sync token and the push keys, deploys the
// Worker, stores the secrets on Cloudflare, and writes <workspace>/.board.env (the board's
// address and sync token, for tools/board-sync.mjs; kept out of git). Run it again to redeploy:
// the secrets stay as they are unless --new-password (a new password signs every device out).
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const WITH_VALUE = new Set(['--contact', '--tz', '--url']);
const ws = resolve(args.find((a, i) => !a.startsWith('--') && !WITH_VALUE.has(args[i - 1])) ?? 'marketing');
if (!existsSync(join(ws, 'queue'))) { console.error(`no queue/ in ${ws}: pass the workspace folder`); process.exit(1); }
const tz = flag('--tz') ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
const envFile = join(ws, '.board.env');
const wrangler = (a, opts = {}) => execFileSync('npx', ['wrangler', ...a], { cwd: HERE, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...opts });

// Who's signed in: wrangler says, or we stop here.
try { wrangler(['whoami']); } catch { console.error('Sign in to Cloudflare first: npx wrangler login'); process.exit(1); }

// The bucket (an error just means it's there already).
try { wrangler(['r2', 'bucket', 'create', 'review-board']); console.log('bucket review-board created'); }
catch { console.log('bucket review-board: already there'); }

// Deploy, and read the address from wrangler's output.
const out = wrangler(['deploy', '--var', `BOARD_TZ:${tz}`]);
const url = out.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0] ?? flag('--url');
if (!url) { console.log(out); console.error('Deployed, but no workers.dev address in the output: pass --url https://your.domain'); process.exit(1); }

// Secrets: only the first time (or a new password when asked).
const saved = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) : {};
const secrets = {};
let password;
if (!saved.BOARD_SYNC_TOKEN) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
  Object.assign(secrets, {
    SYNC_TOKEN: randomBytes(32).toString('base64url'),
    VAPID_PRIVATE_JWK: JSON.stringify(privateKey.export({ format: 'jwk' })),
    VAPID_PUBLIC: raw.toString('base64url'),
    // Who push services can contact about this sender: the board's own address unless given.
    VAPID_SUBJECT: flag('--contact') ?? url,
  });
}
if (!saved.BOARD_SYNC_TOKEN || args.includes('--new-password')) {
  password = randomBytes(12).toString('base64url');
  secrets.BOARD_PASSWORD = password;
}
if (Object.keys(secrets).length) {
  const dir = mkdtempSync(join(tmpdir(), 'board-'));
  const f = join(dir, 'secrets.json');
  writeFileSync(f, JSON.stringify(secrets), { mode: 0o600 });
  try { wrangler(['secret', 'bulk', f]); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const token = secrets.SYNC_TOKEN ?? saved.BOARD_SYNC_TOKEN;
writeFileSync(envFile, `BOARD_URL=${url}\nBOARD_SYNC_TOKEN=${token}\n`, { mode: 0o600 });
const gi = join(ws, '.gitignore');
if (!existsSync(gi) || !readFileSync(gi, 'utf8').split('\n').includes('.board.env')) appendFileSync(gi, '.board.env\n');

console.log(`\nReview board: ${url}  (times read as ${tz})`);
if (password) console.log(`Password: ${password}\n  Shown once. Keep it in your password manager; node setup.mjs ${ws} --new-password makes a new one.`);
console.log(`Sync token and address saved in ${envFile} (git-ignored).\nNext: node ../tools/board-sync.mjs ${ws}`);
