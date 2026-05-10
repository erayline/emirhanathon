# PlanFlow

A pixel-art planning buddy that lives in your browser, watches you procrastinate, and gently calls you out.

**Hackathon problem:** Problem 3 — Sürekli Ertelenen Görevler (recurring procrastination).

PlanFlow tracks your browser activity locally, lets you manage a weekly calendar with natural language (powered by Gemini 2.5 Flash), and when you scheduled "write the report" but you've been on YouTube for three minutes — a tiny pixel buddy drops in from the top of the page and reminds you, with a single button to get back to work.

## What's in here

- **Side panel** with a chunky pink-pixel avatar and a chat box. Ask "what did I do today?" and it answers using your real, locally tracked behavior.
- **Dashboard** with a hand-rolled weekly calendar grid, AI-driven natural language input ("paste my class schedule" or "tonight 8 to 10 pm write report"), a 7×24 distraction heatmap, and a weekly AI insight card.
- **Procrastination intervention**: a `chrome.alarms`-driven check ticks every minute. If you have an active task and you've been on a known distraction domain for 3+ minutes, it generates a short AI nudge, then drops a Shadow-DOM pop on the page (click-through everywhere except the avatar/buttons).

Everything lives client-side in `chrome.storage.local`. No accounts, no server, no telemetry.

## Stack

- [WXT](https://wxt.dev/) (Vite + auto-manifest, MV3, Chromium only)
- React 19 + TypeScript (strict)
- Tailwind CSS 3
- Zustand
- `@google/genai` SDK → `gemini-2.5-flash`

## Install + run

```bash
npm install
cp .env.example .env
# add your Gemini API key:
#   WXT_GEMINI_API_KEY=...
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode**.
3. **Load unpacked** → select `.output/chrome-mv3/`.
4. Pin the toolbar icon. Clicking it opens the side panel.

### Dev (hot reload)

```bash
npm run dev
```

WXT prints an unpacked dir to load (`.output/chrome-mv3-dev/`) and reloads on save.

### Regenerate placeholder avatar frames

```bash
node scripts/generate-placeholder-avatar.mjs
```

Drops 4 PNGs into `public/avatar/`. Replace these files with real art whenever you have it — no code change needed.

## Demo scenarios

Film in this order:

1. **Cold install** — `chrome://extensions` → load unpacked → click toolbar icon → side panel opens with the idle pink avatar.
2. **Bulk paste** — open the dashboard, paste a 14-line university timetable into the AI input → grid fills with 14 colored blocks in ~3 seconds.
3. **Single command** — type "tonight 8 to 10 pm write the report" → pink task block appears for tonight 20:00–22:00.
4. **Behavior tracked** — quick montage of browsing (YouTube, GitHub, Twitter). Open dashboard → heatmap fills with today's activity.
5. **Intervention** — with the report task active, open YouTube and wait. Avatar drops from top, says a generated line, two buttons: **ok, başlıyorum** and **5 dk daha**. Click the first → dashboard opens.
6. **Chat** — side panel → "what did I do today?" → AI replies referencing real domains/durations.
7. **Insight** — scroll the dashboard → AI insight card with a 2-3 sentence weekly observation.

For seeding demo data without browsing for an hour, click "load a demo week" on the empty dashboard — it preloads 14 events and 3 days of browsing logs.

To force-trigger an intervention from devtools (skip the 3-minute wait):

```js
chrome.tabs.query({active: true, currentWindow: true}, t =>
  chrome.tabs.sendMessage(t[0].id, {
    type: 'INTERVENE',
    taskTitle: 'Write the report',
    cueText: 'My lord — the report awaits.',
    taskEndMinutes: 22 * 60,
  })
);
```

## Project layout

```
planflow/
├── wxt.config.ts             # WXT manifest + Vite config
├── tailwind.config.ts
├── entrypoints/
│   ├── background.ts         # SW: tracking, alarms, intervention dispatch, message routing
│   ├── content.ts            # Shadow-DOM overlay (click-through)
│   ├── sidepanel/            # avatar + chat
│   └── dashboard/            # calendar + AI input + heatmap + insight
├── src/
│   ├── lib/
│   │   ├── ai.ts             # Gemini client, tool schemas, prompts
│   │   ├── storage.ts        # typed chrome.storage.local wrapper (single source of truth)
│   │   ├── tracking.ts       # active tab + domain + session math
│   │   ├── intervention.ts   # cooldown, distraction list, alarm handler
│   │   ├── calendar.ts       # day index, time math, recurrence helpers
│   │   ├── insights.ts       # weekly aggregation + heatmap data
│   │   ├── messaging.ts      # typed runtime/tabs message helpers
│   │   └── seed.ts           # demo data
│   ├── components/           # Avatar, ChatBox, CalendarGrid, EventBlock, EventModal, Heatmap, InsightCard, Toast, …
│   ├── state/                # Zustand stores: tasks, chat, behavior
│   ├── constants.ts
│   └── types.ts
└── public/
    └── avatar/               # 4 placeholder PNGs (idle-1, idle-2, talk-1, talk-2)
```

## Permissions

Declared in `wxt.config.ts`:

- `storage` — local data only.
- `tabs` — read active tab URL for tracking and dispatching the overlay.
- `alarms` — minute-tick procrastination check.
- `idle` — pause tracking when the user steps away.
- `sidePanel` — open the side panel from the toolbar action.
- `host_permissions: <all_urls>` — needed for the content-script overlay to inject on any page.

No remote requests except to `generativelanguage.googleapis.com` (Gemini).

## License

For the hackathon — see `DECISIONS.md` for design notes.
