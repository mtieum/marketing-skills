# marketing-skills

Claude plugins for running a small brand's marketing without being a marketer. Brand-free:
everything about a brand lives in that brand's own project.

| Plugin | What it does |
|---|---|
| [`marketing`](plugins/marketing/) | Plans, writes, fact-checks and queues marketing; a person approves weekly; reports on what worked. |
| [`shorts`](plugins/shorts/) | Makes branded 9:16 short videos with Remotion, from a guided setup and a designer-ready brand kit. |

## Install

Claude Code:

```
/plugin marketplace add mtieum/marketing-skills
/plugin install marketing@marketing-skills
/plugin install shorts@marketing-skills
```

Claude app or Cowork: Customize → Plugins → Add marketplace → `mtieum/marketing-skills`, then install either plugin.

Then, in the brand's project: `/marketing:setup` and `/shorts:setup`.

## Licence

MIT. The `shorts` plugin uses Remotion, which has its own licence: free for individuals and
companies of up to 3 people, a paid company licence above that.
