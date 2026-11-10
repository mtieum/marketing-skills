# Publishing gateway protocol, v0

How a review board hands an **approved** post to a publishing gateway: a service that holds
the brand's connected social accounts and posts at the scheduled time. The plugin never posts
by itself; a gateway is optional, and anyone can run one (a hosted service, or your own with
your own platform apps). This file is the contract between the two.

Status: **draft v0**. Breaking changes bump the path (`/v1/`).

## Why a gateway

Posting through Instagram, TikTok, YouTube and Pinterest needs a developer app each platform
has approved (Meta App Review, TikTok's audit, Google's verification and YouTube audit,
Pinterest's standard access). One gateway with approved apps lets every user of the plugin
connect their accounts once, instead of each going through four reviews.

## Roles

- **Board**: the brand's review board (`board-cloud/`). It owns the queue, the files and the
  owner's decisions. It sends a post only after the owner approved it.
- **Gateway**: holds each brand's channel connections (OAuth tokens), schedules, posts, reports
  back. Connecting a channel happens in the gateway's own pages, not in this protocol.

## Basics

- HTTPS, JSON (`content-type: application/json`), UTF-8.
- Every call carries `Authorization: Bearer <api key>`. One key per brand (workspace); the
  gateway issues it. Keys are secrets: kept as Worker secrets, never in a repo.
- Times are RFC 3339 with an offset (`2026-11-12T18:00:00+00:00`).
- The board names each post with its own id (`client_id`: the queue item's id, `[A-Za-z0-9._-]{1,120}`).
  Creating is idempotent on it: sending the same post again replaces it while it's still scheduled.

## Discovery

`GET /v0` → what the gateway does.

```json
{ "protocol": "v0", "name": "Example gateway",
  "platforms": ["instagram", "pinterest", "youtube", "tiktok"],
  "connect_url": "https://gateway.example/connect" }
```

`GET /v0/channels` → the brand's connected channels.

```json
{ "channels": [
  { "id": "ch_3kd9", "platform": "instagram", "handle": "@example", "status": "ok",
    "can": { "video": true, "image": true, "max_seconds": 900, "link": false } },
  { "id": "ch_8xq1", "platform": "pinterest", "handle": "example", "status": "reconnect",
    "can": { "video": true, "image": true, "link": true, "boards": ["Christmas Markets in Europe"] } }
] }
```

`status`: `ok`, or `reconnect` (the platform revoked or expired the token: the owner must
reconnect in the gateway before posts to it can go).

## Posts

### Schedule (or replace) a post

`PUT /v0/posts/{client_id}`

```json
{
  "channel": "ch_3kd9",
  "publish_at": "2026-11-12T18:00:00+00:00",
  "media": [
    { "url": "https://board.example/media/a/9f2c…mp4?exp=1763060400&sig=…",
      "type": "video/mp4", "bytes": 116728229,
      "cover_url": "https://board.example/media/a/41be…jpg?exp=1763060400&sig=…" }
  ],
  "text": {
    "caption": "A weekend in Cologne…",
    "title": "Cologne Christmas Markets: a 2-Day Cologne Itinerary",
    "description": "…",
    "link": "https://example.com/cologne/?utm_source=pinterest",
    "alt": "Cologne Cathedral above the lit stalls…",
    "board": "Christmas Markets in Europe"
  },
  "options": { "privacy": "public", "ai_generated": true, "cover_ms": 1000 },
  "approval": { "by": "owner", "at": "2026-11-08T16:40:00Z" },
  "callback": "https://board.example/api/gateway/callback"
}
```

- `publish_at`: omit or `null` to post as soon as possible.
- `media`: one file for now (a video, or an image). The `url` must be fetchable by the gateway
  (and by the platform, for Instagram, which downloads it itself) **until 24 hours after
  `publish_at`**: a signed link with an expiry, not a public bucket. `bytes` lets the gateway
  refuse files a platform would reject before trying.
- `text`: the board sends every field it has; the gateway uses what the platform takes:
  - Instagram: `caption`
  - TikTok: `caption` (as the title)
  - YouTube: `title` and `description`
  - Pinterest: `title`, `description`, `link`, `alt` and `board`
  The text is posted exactly as sent: a gateway never rewrites it.
- `options.privacy`: `public` (default), `private`, `followers`. A gateway whose platform app
  isn't approved for public posts says so with `privacy_not_allowed` rather than posting
  privately in silence.
- `options.ai_generated`: sets the platform's AI-content label where there is one.
- The cover of a video: `media[].cover_url` (an image, signed like the file) and/or
  `options.cover_ms` (the frame to use, in milliseconds from the start). A gateway uses what each
  platform takes: an image where it can (YouTube thumbnail, Instagram cover), else the frame time
  (TikTok, Pinterest). Sending both keeps every platform on the same picture.
- `approval` is **required**: who approved it and when. A gateway refuses posts without it
  (`not_approved`). It is the owner's consent each platform's terms ask for.
- `callback`: optional; see Status.

Answers `201` (new) or `200` (replaced) with the post (below). `409 already_started` if it's
already publishing or published.

### Read, cancel

- `GET /v0/posts/{client_id}` → the post.
- `DELETE /v0/posts/{client_id}` → cancels it if it hasn't started (`200`), else `409 already_started`.

### The post

```json
{ "client_id": "2026-11-12-instagram-cologne", "channel": "ch_3kd9",
  "status": "published", "publish_at": "2026-11-12T18:00:00+00:00",
  "published_at": "2026-11-12T18:00:41Z",
  "platform_id": "18039…", "url": "https://www.instagram.com/reel/…/",
  "attempts": 1, "error": null }
```

`status`: `scheduled` → `publishing` → `published`, or `failed` (with `error`), or `canceled`.

## Status back to the board

Two ways, and the board must handle the first:

1. **Polling**: the board reads `GET /v0/posts/{client_id}` for its sent, unfinished posts
   (every few minutes is plenty).
2. **Callback** (optional): on each status change the gateway `POST`s the post to `callback`,
   with `X-Gateway-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">` keyed
   with the brand's **callback secret** (issued with the API key). The board checks the
   signature and refuses anything older than 5 minutes.

When a post is `published`, the board marks the queue item `out` with `out_url` = `url`, as
if the owner had tapped Posted.

## Errors

Error bodies: `{ "error": { "code": "…", "message": "…", "retryable": false } }`.

| code | HTTP | meaning |
|---|---|---|
| `unauthorized` | 401 | bad or revoked API key |
| `not_approved` | 422 | no `approval` |
| `unknown_channel` | 422 | the channel isn't this brand's |
| `reconnect` | 409 | the channel needs reconnecting in the gateway |
| `media_unreachable` | 422 / in `error` | the gateway or platform couldn't fetch `media.url` |
| `media_rejected` | in `error` | the platform refused the file (length, size, format) |
| `privacy_not_allowed` | 422 | the gateway's app can't post with that privacy yet |
| `already_started` | 409 | too late to change or cancel |
| `rate_limited` | 429 / in `error` | slow down (`Retry-After`), or the platform's daily cap |
| `platform_error` | in `error` | the platform failed; `retryable` says whether the gateway will try again |

A gateway retries `retryable` failures by itself (with backoff, up to a limit) before
reporting `failed`.

## What a gateway promises

- Posts only what the board sent, only after `publish_at`, only once (idempotent on
  `client_id`).
- Keeps tokens encrypted; deletes its copies of media once a post is final; keeps post
  records (no media) long enough to answer status, then deletes them.
- Never posts, likes, follows or messages anything else on a connected account.

## On the board's side

The board sends a post when **all** of these hold:
- the item is `approved` (or `ready`),
- the channel is mapped to a gateway channel in the workspace config,
- and the owner turned publishing on for that channel.

Everything else stays on reminders and Share to app. A post that fails comes back to the board
as a reminder, so a person can post it by hand.
