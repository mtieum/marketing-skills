---
name: fact-gate
description: Independently verify every factual claim in queued marketing items (posts, pitches, pages, ads) with a separate fresh-context agent, then fix or cut whatever fails, so nothing unverified ships. Use after any marketing item is written or changed, before review; when asked "check the facts", "verify these posts".
---

# Fact gate

The writer doesn't check its own work. A separate agent with a fresh context does.

## Steps

1. **Collect** the items to check: given ids, or every `queue/` file with status `draft`
   (or edited since its `checked` date).

2. **Spawn one verifier agent** (Agent tool, general-purpose) per batch of up to ~10 items.
   Give it only the item files, `brand.md`'s Guardrails section, and these instructions:
   - Extract every checkable claim: numbers, prices, dates, times, names, addresses, opening
     days, distances, rankings, "only/first/oldest/cheapest/best", quotes, licences/credits,
     links (do they resolve and say what the item says they say).
   - Check each against a source it opens itself, official or primary first. The item's
     `sources` lines are leads, not proof. Numbers from the brand's own data: re-derive from
     the data file or tool, don't trust the page.
   - Verdict per claim: SUPPORTED (with URL), WRONG (with the correct text), UNSUPPORTED
     (with replacement text or "cut"), SOFT (opinion; fine if it reads as opinion).
   - Also flag: anything breaching the guardrails, undisclosed ads/affiliate links, claims
     needing evidence under the ad rules, image credits missing.
   - Write the table to `campaigns/<campaign>/verification/<item-id>.md`.

3. **Apply** every WRONG fix and cut every UNSUPPORTED claim (rewrite the sentence so it
   still reads well). A claim that couldn't be checked doesn't ship; cutting it is a success.

4. If fixes added new claims, re-run the verifier on just those lines.

5. Set `status: checked` and `checked: <date>` on each item with no WRONG or UNSUPPORTED rows
   left. Report items checked, claims fixed, claims cut, and anything still blocked.
