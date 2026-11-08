---
name: data-story
description: Find a newsworthy, true story in a brand's own data, build it into a publishable page brief with a chart and method, and prepare a press/blogger pitch - the main way small sites earn backlinks. Use when asked for "digital PR", "a data story", "something journalists would link to", "earn backlinks", or when the plan calls for one.
---

# Data story

Journalists and bloggers link to original numbers they can't get elsewhere. The brand's
own data is the asset; the story is what a reader would repeat to a friend.

## Steps

1. **Inventory the data.** From `brand.md` Proof and assets, plus the project (databases,
   datasets, APIs, MCP tools), list what the brand can count that others can't. Note each
   source's licence and freshness.

2. **Find 5 candidate stories.** For each: the headline a journalist would write, the
   number(s) behind it, who cares (which outlet's readers), why now (season, news, event),
   and how hard it is to produce. Good shapes:
   - ranking ("the 10 cities where…") with a clear, fair method
   - surprising comparison ("cheaper to fly to X than take the train to Y")
   - seasonal guide built on numbers ("best month for…")
   - local angle per region/city (each local paper gets its own line)
   Show the 5 to the owner with a recommendation; produce one at a time.

3. **Pull and check the numbers.** Write the query or script into
   `campaigns/<slug>/data/` so it can be re-run. Sanity-check outliers by hand; drop rows you
   can't explain. Note every exclusion in the method.

4. **Page brief** (`campaigns/<slug>/page.md`): headline, standfirst, the key finding in one
   sentence, 3–5 findings with numbers, a table or chart spec (data file + chart type),
   **method** (sources, dates, what was counted, what was excluded, licences and credits),
   a quote line from the owner, and an embeddable chart or table with a credit link. The
   brand's own pipeline publishes the page (as a draft) after review.

5. **Pitch.** Hand to `outreach` with: the one-line finding, 2 supporting numbers, the
   local/sector angles, the page URL, and the owner's contact. Pitches go out only after the
   page is live.

6. Run `fact-gate` on the page brief (numbers re-derived from the data file, not just read).

## Don't
- Don't torture data into a headline; if the honest finding is dull, pick another story.
- Don't rank people's businesses negatively by name ("worst restaurant in…").
- Don't publish data you aren't licensed to republish; credit every source as its licence asks.
