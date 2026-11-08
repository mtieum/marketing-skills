---
name: outreach
description: Find the right journalists, bloggers, newsletter writers, community owners and partners for a story or product, write short personal pitches and follow-ups, put them in Gmail as drafts for approval, and track replies in outreach.csv. Use for press pitches, link-building outreach, partnership emails, "pitch this", "who should we send this to", or chasing replies.
---

# Outreach

Few, well-chosen, personal emails beat many generic ones. A pitch is a favour asked of a
stranger: make it easy to say yes and never annoying to say nothing.

## Steps

1. **Read** `brand.md`, the campaign brief or data story, `outreach.csv` (never contact a
   `do_not_contact` row; never re-pitch someone within 60 days unless they replied), and `log.md`.

2. **Find people (10–25 per story).** For each: name, outlet, role, a recent piece of theirs
   on this topic (URL, and why it's relevant), and a work address or contact route published
   for this purpose (their outlet's site, their own site, a press page). Record where you found
   it (`source_of_contact`) and the `lawful_basis`:
   - journalists/bloggers at a published work address, about their beat: legitimate interest (UK GDPR); B2B, so PECR consent isn't required for corporate addresses, but say who you are and honour opt-outs at once.
   - personal addresses (gmail etc.) of sole traders/bloggers: count as individuals under PECR; contact only via their published contact form or with their invitation, not cold email.
   Never guess or scrape email patterns. Never buy lists.

3. **Write each pitch** (queue item, `kind: pitch`, `to:` the person):
   - Subject: the finding, plainly (≤ 60 chars). No "Quick question", no fake "Re:".
   - 80–150 words: why them (their piece), the finding, 1–2 numbers, the angle for *their*
     readers, the link, offer (data file, chart, quote, local cut). Who you are, in one line.
   - Plain text, no tracking pixels, no attachments on first contact.
   - One polite follow-up after 5–7 working days, written now as a second item, sent only if no reply.

4. **Partners and communities** (newsletters, associations, tool directories, open-data
   showcases): same, with what's in it for their readers or members.

5. **After approval** (`review` apply mode): create Gmail drafts with the Gmail tools, one per
   approved pitch, and mark the item `ready`. The owner sends them. If the Gmail tools aren't
   connected, put the pitches in the posting pack instead and say so.

6. **Track.** Update `outreach.csv` (first_contact, follow_up, reply, outcome). Replies are
   answered by the owner; draft a reply on request. A "no" or "stop" sets `do_not_contact`.

## Don't
- No mass mail-merge, no sequences beyond one follow-up, no paying for links or offering to.
- Never claim coverage or relationships that don't exist.
