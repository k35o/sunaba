---
"sunaba": minor
---

M1 walking skeleton: an agent can list stories, render them at addressable URLs, and read errors.

- `sunaba/react`: CSF3-subset types (`Meta`/`StoryObj`/decorators/play) and `definePreview`
- protocol: canonical story ids (`<file>:<Export>`) and the `/render` address grammar — `addressToUrl`/`parseAddress` are the single source of truth
- static indexer (oxc-parser): literal-field extraction with diagnostics instead of silent skips
- dev server: user Vite config + sunaba plugin, stage runtime (args merge, decorator nesting, env axes, error/console reporting over WebSocket)
- MCP at `/mcp`: `list_stories` and `stage` (select, args/env overrides, on-demand play)
- `examples/react-basic` as the first test bed
