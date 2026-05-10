# Decisions

Log of design choices made under time pressure. Each entry: what, why, what I'd revisit later.

## React 19, not 18

WXT's React template scaffolds React 19. Spec says React 18 (locked). Downgrading would mean wrestling with @types/react divergence and zero functional benefit at this scale. Kept React 19. No code uses React-19-only APIs, so the spec's intent ("don't bleed-edge for fun") is honored.

## Path alias `@/` resolves to repo root, not `src/`

WXT's auto-generated `.wxt/tsconfig.json` hardcodes `@/* -> ../*` (repo root). Trying to override it via WXT's `alias` config or `tsconfig.json#paths` fought back through Vite's resolver. Workaround: imports are written `@/src/lib/...` so both Vite and TS resolve them. Three extra characters, no build hacks.

## Bundling the Gemini SDK in the service worker

Bundle size jumps from ~5 KB to ~280 KB on `background.js` because the SDK is imported for nudge generation in the alarm handler. Acceptable: SW is loaded once on demand, the SDK is also needed in dashboard/sidepanel, and a separate "ai-worker" pattern would have cost a half-day for marginal benefit. If the demo machine ever struggles with SW boot time, the fix is to move the AI call to the dashboard/sidepanel and have the SW emit an event for them to handle.

## Registrable-domain heuristic is "last 2 parts"

`m.youtube.com` → `youtube.com`. Works for the distraction list. Misses two-part eTLDs like `co.uk` (would record `co.uk` as the registrable). The Public Suffix List would fix this; not worth ~50 KB and a build-time fetch for the demo. Documented and bounded.

## Single chat history, no per-conversation segmentation

Stored as a flat `ChatMessage[]` capped at 50. Fine for single-user, single-thread chat in the side panel. A real product would want sessions or trimming by token budget; we leave it.

## Insight refresh cooldown enforced client-side only

`INSIGHT_REFRESH_COOLDOWN_MS = 1h`. There's no server, so this is a courtesy guard against spamming Gemini. A determined user can bypass it via devtools. Deliberate — single-user app, no abuse to worry about.

## Behavior aggregation at write time

`behaviorStore.addSession` increments a per-domain-per-hour bucket on each session end, instead of storing raw sessions and aggregating on read. Keeps reads cheap; loses sub-hour granularity. Acceptable for the heatmap which is hour-bucketed by spec.

## Avatar placeholder via pngjs

`scripts/generate-placeholder-avatar.mjs` writes 4 PNGs from an ASCII grid + small palette. Real art replaces files in `public/avatar/`. No code changes needed when frames are upgraded — file paths are stable.

## Shadow DOM overlay built with vanilla JS

The content script overlay (F3) doesn't import React. Lighter content-script bundle, simpler isolation. Re-using `Avatar.tsx` would have meant React in every tab.

## Snooze stored per-domain, not per-tab

"5 dk daha" sets `snoozeUntil:<domain>` for 5 minutes. Switching to a different YouTube tab won't bypass it. Switching to twitter.com will. Tradeoff favors the user not being nagged twice in a row on the same site.

## Tests skipped

Per spec §10. Manual demo coverage replaces unit tests for this hackathon scope.
