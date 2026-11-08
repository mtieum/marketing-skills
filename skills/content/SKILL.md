---
name: content
description: Write channel-ready marketing items (short-video scripts, Pinterest pins, Reddit posts, LinkedIn posts, newsletters, X/Threads/Bluesky posts) from a source page, story or campaign brief, following each channel's playbook and the brand voice, into the marketing queue. Use when the plan or a campaign has posts due, or when asked to "write posts", "make pins", "draft the newsletter", "turn this page into social".
---

# Content

Every item starts from a **source**: a page on the site, a data story, a campaign's hero
asset. Items written from nothing read like it.

## Steps

1. **Load.** `brand.md` (voice, guardrails, domain producers), the campaign brief, the
   channel playbook `channels/<channel>.md` for each channel (none → use `channels/general.md`
   and say so), and `log.md` for what has worked on that channel.

2. **Use the domain producer first.** If `brand.md` lists a skill or tool that already
   makes this kind of content (a city-guide bundle, a video renderer), run it, then adapt its
   output to the playbook. Don't re-research what it already verified.

3. **Read the source** in full (fetch the live page if it's published). Pull out 3–6
   specific, true details: names, numbers, places, steps. Each item uses at least one; no item
   is only adjectives.

4. **Write each item** to the playbook: its format, length, hook, link rule, hashtags, image
   size. Each channel gets its own version; never paste one text across channels.
   - Brand voice from `brand.md`; banned words are banned everywhere.
   - Disclosure: an ad or an affiliate link is labelled as the guardrails say.
   - Link: the campaign's UTM link for that channel, or none where the playbook says links hurt.
   - Assets: every image or clip has a source and a licence that allows commercial use; record
     the credit. No AI-generated pictures of real places, people or products presented as real.

5. **Queue.** One file per item in `queue/` (format in `queue/README.md`), status `draft`.
   Also write `sources` lines at the end of the file (below a `<!-- sources -->` marker) listing
   where each fact came from; the review hides them, the fact gate uses them.

6. Hand the new item ids to `fact-gate` (the `run` skill does this; when called alone, run it
   yourself before saying the items are ready).

## Quality bar
Read each item as the busy stranger on that platform. Would they stop, learn something, and
know what to do next? If the item would work for any brand with the nouns swapped, rewrite it.
