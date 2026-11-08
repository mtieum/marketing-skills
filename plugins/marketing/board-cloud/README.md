# The review board, on your phone

The same board as `tools/board.mjs`, hosted on **your own Cloudflare account** so you can:

- **install it** on your phone's home screen like an app,
- get a **push notification 15 minutes before each post**, even with your computer off,
- **approve, ask for changes, reject** and mark **posted** from the phone,
- **post from the phone**: *Share to app* hands the video to Instagram, TikTok or YouTube with
  the caption already copied (paste it, post, then tap *Posted* on the board).

Nothing posts by itself: the apps only let approved partners do that, and the board is a gate,
not a robot. Posting automatically, once approved, is the job of an optional publishing gateway:
see *Posting automatically* below and `../publish/PROTOCOL.md`.

## What it costs and holds

Cloudflare's free tier is enough for a small brand: one Worker, a cron every 5 minutes, and one
R2 bucket holding only the files of what's queued (10 GB free; a week of shorts is 1-2 GB).
Files no queue item names are deleted at each sync. The board is behind a password; the drafts
and videos are in your account, nowhere else.

## Set up (once)

You need a Cloudflare account (free) and Node 20+.

```
cd board-cloud
npm install
npx wrangler login
node setup.mjs ../../../path/to/marketing      # your workspace: the folder with brand.md and queue/
```

Setup creates the bucket `review-board`, deploys the Worker `review-board`, makes the password,
a sync token and the push keys, and stores them as Worker secrets. It prints the address
(`https://review-board.<you>.workers.dev`) and the password **once**: put it in your password
manager. It writes `<workspace>/.board.env` (address and sync token) and git-ignores it.

Options: `--tz Europe/Paris` (the zone your queue's times are in; default: this computer's),
`--contact mailto:you@example.com` (who push services can contact; default: the board's address),
`--new-password` (a new password; signs every device out). Run it again any time to redeploy.

## Sync

```
node ../tools/board-sync.mjs <workspace>
```

It takes the decisions made on the phone into the item files (the same front matter the local
board writes), then uploads the queue and any new or changed files. Run it after the queue
changes, and before working on approved items; `--test-push` also sends a test notification.
The `marketing:review` skill runs it for you when `.board.env` exists.

**Automatically**, every 5 minutes, while the computer is on: a cron line (`crontab -e`)

```
*/5 * * * * cd /path/to/project && /path/to/node /path/to/plugin/tools/board-sync.mjs marketing >> /tmp/board-sync.log 2>&1
```

or, on Linux with systemd, a user timer (`~/.config/systemd/user/review-board-sync.{service,timer}`,
`OnUnitActiveSec=5min`, then `systemctl --user enable --now review-board-sync.timer`). Use
absolute paths: cron and systemd don't load your shell's PATH (nvm users especially).

## On the phone

1. Open the address, sign in.
2. **Install**: Android Chrome, menu → *Install app* (or *Add to home screen*). iPhone Safari,
   Share → *Add to Home Screen*, then open it from the home screen (iPhone only allows
   notifications for installed web apps, iOS 16.4+).
3. Tap **Notify me** and allow notifications.
4. When a reminder comes: open it, check the card, tap **Share to app** (it fetches the video;
   tap again to share; the caption is copied), pick the app, paste, post, then **Posted…**
   with the post's link.

## Posting automatically (a gateway)

Optional. A publishing gateway (any service speaking `../publish/PROTOCOL.md`) holds your
connected accounts and posts at the scheduled time. Turn it on per channel:

1. Get an API key and callback secret from the gateway, and connect your channels there.
2. Store them on the board: `npx wrangler secret put GATEWAY_KEY` and
   `npx wrangler secret put GATEWAY_CALLBACK_SECRET`.
3. Add `publish.json` to the workspace, naming the gateway's channel ids (its `GET /v0/channels`):
   ```json
   { "gateway": "https://gateway.example",
     "channels": {
       "instagram": { "id": "ch_…", "auto": true, "options": { "ai_generated": true } },
       "pinterest": { "id": "ch_…", "auto": true } } }
   ```
4. Sync. From then on, every 5 minutes the board:
   - sends each **approved** item for an `auto` channel to the gateway, with its time and a signed
     link to its file (valid until two days after the time);
   - re-sends it if you edit it, and cancels it if you pull it back (changes, rejected) before it goes;
   - reads back the result: posted → the item becomes Posted with the link (in the files at the
     next sync); failed → a push notification to post it by hand.

Cards say *Auto-posts in …* for what the gateway has. Channels without `auto` stay on
reminders and Share to app. Nothing is sent that you didn't approve.

## How it works

`src/worker.mjs` renders `../tools/board-page.mjs` (the same page as the local board) from
`queue.json` in R2, with decisions made since the last sync laid over it. Sign-in is a signed
cookie (90 days). The cron sends a Web Push (VAPID, no payload) to each subscribed device when a
post is 15 minutes away; the service worker (`public/sw.js`) asks the board what's due and shows
it. The sync API is behind the sync token.
