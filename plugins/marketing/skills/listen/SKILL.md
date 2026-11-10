---
name: listen
description: Forum listening. Find people on public forums (Reddit first) asking for what the brand's pages answer, draft a genuinely useful reply from the brand's own facts, and put it on the review board for the owner to post by hand, within hard limits. Use for "listen", "find threads to answer", "draft forum replies", setting up listening for a brand, or when a timer left candidates waiting for an agent.
---

# Listen

Help first, link second. A reply has to be worth reading if nobody clicks. The owner posts every
reply from their own account; nothing here logs in, posts, votes or messages anyone.

Tools (Node 22, in this plugin's `tools/`): `listen.mjs poll|draft|offer|check|track|report|run <workspace>`, with
the guardrails in `listen-lib.mjs` (tested: `node --test tools/listen-lib.test.mjs`).

## Set up (once per brand)

1. Copy `templates/workspace/listen.json` to the workspace. Fill `about`, `domain`, `disclosure`
   (it must say the project is the owner's own) and the feeds. For Reddit, use **one combined feed**
   (`r/a+b+c/new/.rss`): unauthenticated RSS allows about one request a minute.
2. **Sources**: one entry per subreddit with `links_allowed`. Read each one's rules (sidebar, wiki)
   and set `true` only where self-made links are plainly allowed; unsure means `false`.
   A reply without a link still helps and builds the account's history.
3. **Pages**: the brand supplies `listen/pages.json`, `[{ name, aliases?, match?, country?, url, kind }]`
   with `kind` `itinerary` (the best answer) or `city`, rebuilt as its site changes (a script of
   the brand's, on a timer). Leave out names that are everyday words, or give them `match` words.
4. **Model** (`listen.json` `model.provider`):
   - `agent` (default): the tools gather; an agent (Claude Code, Cowork, a scheduled task) runs this
     skill to score and draft. Frontier quality, no API key.
   - `local`: LM Studio or Ollama (`url` like `http://host:1234/v1`, `name` the loaded model).
   - `openai` / `anthropic`: by API, key in the environment or the workspace's git-ignored `.listen.env`.
5. Git-ignore `listen/candidates/`, `listen/seen.json`, `listen/state.json`, `.listen.env`.
   Keep `listen/demand.csv`: it is the list of places people ask about that the brand can't answer yet.
6. A timer can run `listen.mjs run <workspace>` every 30 minutes (poll, draft, offer, check, track),
   rebuild the page index daily and run `listen.mjs report` on Mondays. With `agent`, the timer
   gathers and tracks; drafting and checking wait for the agent.

## Each pass (as the agent)

1. `node tools/listen.mjs poll <workspace>` (skip if a timer just did).
2. For each `listen/candidates/*.json` with `status: "new"`:
   - Read the post, then the thread's comments: `<thread url>.rss` for Reddit (wait a minute
     between Reddit requests). Note whether a good answer is already near the top, and whether
     the brand's domain already appears.
   - Score it (0–10): how much a short plan for this place would help *this* person. Low for
     hotel-only, visa-only, vague or long multi-country posts. **0** for minors, emergencies, lost
     documents, grief or anything sensitive.
   - Check the place. If it isn't the page the prefilter matched, look it up in `pages.json`; if
     the brand has nothing for it, add a row to `listen/demand.csv` and skip it. A `city`-only
     match is also demand (no itinerary yet).
   - Facts come from the brand, never from memory: the matched page (fetch it), and the brand's
     own data tools if this session has them (an MCP server for its places, say). Only facts you
     can see there go in the reply.
   - Write the reply (rules below) and save into the candidate file: `fit`, `summary` (what they
     asked, two short lines), `city`, `country`, `nights`, `interests`, `reply`, `link_in_thread`,
     `drafted_by: "agent"`, and `status: "drafted"`, or `status: "skipped"` with a `reason`.
3. Queue items with `kind: reply` and `status: changes` carry the owner's note: redraft the reply
   in the card's text block (keep the disclosure line as it is) and set `status: draft`, so the
   fact gate sees it again.
4. `node tools/listen.mjs offer <workspace>`: the guardrails decide which drafts go on the board
   and which carry the disclosed link. Cards start as `draft`.
5. **Fact gate.** Run the `fact-gate` skill on the new reply cards (`kind: reply`, `status: draft`):
   a fresh-context verifier checks every claim against the linked page and, where it can, the
   place's own site; the table goes to `campaigns/listening/verification/<card id>.md`; WRONG is
   fixed, UNSUPPORTED is cut (never touch the disclosure line); then `status: checked`. Only
   checked cards are ready to post. Then sync the board.
6. Tell the owner how many cards are waiting, and the top rows of `demand.csv` if any are new.

## The reply

1. Open with the direct answer to what they asked. No greeting, no "Great question".
2. 3–5 concrete tips that fit their interests, dates and constraints: named places, a rough plan
   per day, one practical tip (a pass, a booking warning).
3. 80–150 words, plain sentences, casual forum tone. No headers, no emoji, no marketing words
   ("ultimate", "hidden gem", "must-see").
4. No link and no brand name in the reply: `offer` adds the disclosure line when it's allowed.
5. Never claim personal experience ("when I was there"). The owner may add their own when posting.
6. Vary the opening: read the last 20 reply cards and don't start like any of them.

## On the board

A reply card shows the thread, the reply and **Copy reply & open thread**. The owner pastes,
adjusts and posts it, then taps **Posted…** with the comment's link. **Change…** sends a note
back for a redraft, **Reject** skips it, **Mute source** quiets that subreddit for 30 days (so
does a reject noting a removal or a mod warning). Unposted cards expire after two days.

## After posting

`listen.mjs track` follows each posted reply (from its **Posted…** link) without an account:
right away it resolves the comment's address and, if the owner changed the draft before posting,
keeps both versions in `listen/examples.jsonl`; the last 10 go into every drafting prompt (an
agent drafting should read them too, and write the way the owner posts). At 24 hours and 7 days
it records the replies the comment got; a comment that is gone (removed or deleted) is marked
`removed: yes` and mutes that source. Upvotes need the platform's API and aren't read.

`listen.mjs report` writes the week to `metrics/listening-<date>.md`: found, drafted, offered,
posted (with links), edited, replies, removals, why posts were skipped, and the places asked
about with no page yet. The `report` skill can fold it in. Visits from replies come from the
site's analytics, filtered on `utm_medium=reply`.

## Guardrails (enforced in `listen-lib.mjs`, `limits` in listen.json can tighten or loosen)

- At most 8 cards a day; one reply per thread; nothing for a muted source.
- Links only where `links_allowed`, never in a thread that already has the brand's link, at most
  1 per source a day and 3 a week, 5 a day overall, and at most 10% of all replies (`max_link_share`).
- No extra accounts, no votes, no DMs, no replies to minors or people in trouble, no knocking competitors.
