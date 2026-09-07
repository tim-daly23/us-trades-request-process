# Design canvas — source of truth for the UI

Extracted from the published artifact "US Trades Portal Mockups"
(https://claude.ai/code/artifact/15f22d7f-75ac-4d7e-a871-f635846f422b).

Ten artboards across two pages. `canvas.json` holds the layout and the
annotations written on the canvas.

**Page 1 — Customer portal**
| Artboard | Built? |
|---|---|
| 1 · Branded login | yes |
| 2 · Customer dashboard | no |
| 3 · My requests | yes (no filter bar / pagination yet) |
| 4 · New manpower request | partly — layout not yet aligned |
| 5 · Request detail | partly — layout not yet aligned |
| 6 · Candidate review | no |

**Page 2 — Internal console** (separate, denser chrome: dark left rail)
| Artboard | Built? |
|---|---|
| 7 · Ops dashboard | no |
| 8 · Requisition queue | no |
| 9 · Fill board | no |
| 10 · Worker search | no |

## The rules that carry the look

- **Nothing is rounded.** Every panel, pill, input and bar is square.
- **Figures are monospace** (IBM Plex Mono) — request numbers, counts, dates,
  rates. Body copy is IBM Plex Sans.
- Navy `#26374C` chrome, orange `#D96A0B` for primary action and the active
  tab underline. Tokens live in `app/globals.css`.
- Tables are dense: 34px headers, 54px rows, hairline `#EFEFEC` separators.
