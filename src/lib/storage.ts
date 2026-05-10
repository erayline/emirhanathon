import type { CalendarEvent, BehaviorLog, ChatMessage, Insight } from '../types';

type StoreShape = {
  events: CalendarEvent[];
  chat: ChatMessage[];
  insights: Insight[];
  // Dynamic keys handled separately:
  //   `behavior:YYYY-MM-DD` -> BehaviorLog[]
  //   `lastInterventionAt:<domain>` -> number
  //   `snoozeUntil:<domain>` -> number
  //   `currentSession` -> { domain, startedAt }
};

type StaticKey = keyof StoreShape;

const DEFAULTS: { [K in StaticKey]: StoreShape[K] } = {
  events: [],
  chat: [],
  insights: [],
};

async function get<K extends StaticKey>(key: K): Promise<StoreShape[K]> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return (value ?? DEFAULTS[key]) as StoreShape[K];
}

async function set<K extends StaticKey>(key: K, value: StoreShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// ---- Events ----
export const eventsStore = {
  list: () => get('events'),
  save: (events: CalendarEvent[]) => set('events', events),
  add: async (ev: CalendarEvent) => {
    const list = await get('events');
    list.push(ev);
    await set('events', list);
    return ev;
  },
  update: async (id: string, patch: Partial<CalendarEvent>) => {
    const list = await get('events');
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, id: list[idx].id };
    await set('events', list);
    return list[idx];
  },
  remove: async (id: string) => {
    const list = await get('events');
    const next = list.filter((e) => e.id !== id);
    await set('events', next);
    return list.length !== next.length;
  },
};

// ---- Chat ----
export const chatStore = {
  list: () => get('chat'),
  save: (messages: ChatMessage[]) => set('chat', messages),
  append: async (msg: ChatMessage, limit = 50) => {
    const list = await get('chat');
    list.push(msg);
    const trimmed = list.length > limit ? list.slice(list.length - limit) : list;
    await set('chat', trimmed);
    return trimmed;
  },
  clear: () => set('chat', []),
};

// ---- Insights ----
export const insightsStore = {
  list: () => get('insights'),
  save: (insights: Insight[]) => set('insights', insights),
  upsert: async (insight: Insight, keep = 4) => {
    const list = await get('insights');
    const filtered = list.filter((i) => i.weekStart !== insight.weekStart);
    filtered.push(insight);
    filtered.sort((a, b) => b.generatedAt - a.generatedAt);
    const trimmed = filtered.slice(0, keep);
    await set('insights', trimmed);
    return trimmed;
  },
  forWeek: async (weekStart: string) => {
    const list = await get('insights');
    return list.find((i) => i.weekStart === weekStart) ?? null;
  },
};

// ---- Behavior (dynamic key per day) ----
function behaviorKey(date: string): string {
  return `behavior:${date}`;
}

export const behaviorStore = {
  forDate: async (date: string): Promise<BehaviorLog[]> => {
    const key = behaviorKey(date);
    const result = await chrome.storage.local.get(key);
    return (result[key] as BehaviorLog[] | undefined) ?? [];
  },
  saveForDate: async (date: string, logs: BehaviorLog[]) => {
    await chrome.storage.local.set({ [behaviorKey(date)]: logs });
  },
  /**
   * Aggregate by adding to the matching (date,domain,hourBucket) bucket.
   * Read should be cheap because we aggregate at write time.
   */
  addSession: async (entry: Omit<BehaviorLog, 'date'> & { date: string }) => {
    const logs = await behaviorStore.forDate(entry.date);
    const idx = logs.findIndex(
      (l) => l.domain === entry.domain && l.hourBucket === entry.hourBucket,
    );
    if (idx === -1) {
      logs.push({
        date: entry.date,
        domain: entry.domain,
        hourBucket: entry.hourBucket,
        durationMs: entry.durationMs,
      });
    } else {
      logs[idx].durationMs += entry.durationMs;
    }
    await behaviorStore.saveForDate(entry.date, logs);
  },
  forRange: async (datesISO: string[]): Promise<BehaviorLog[]> => {
    const keys = datesISO.map(behaviorKey);
    const result = await chrome.storage.local.get(keys);
    const all: BehaviorLog[] = [];
    for (const k of keys) {
      const list = result[k] as BehaviorLog[] | undefined;
      if (list) all.push(...list);
    }
    return all;
  },
};

// ---- Cooldown / snooze (dynamic key per domain) ----
export const cooldownStore = {
  getInterventionAt: async (domain: string): Promise<number | null> => {
    const key = `lastInterventionAt:${domain}`;
    const r = await chrome.storage.local.get(key);
    return (r[key] as number | undefined) ?? null;
  },
  setInterventionAt: async (domain: string, ts: number) => {
    await chrome.storage.local.set({ [`lastInterventionAt:${domain}`]: ts });
  },
  getSnoozeUntil: async (domain: string): Promise<number | null> => {
    const key = `snoozeUntil:${domain}`;
    const r = await chrome.storage.local.get(key);
    return (r[key] as number | undefined) ?? null;
  },
  setSnoozeUntil: async (domain: string, ts: number) => {
    await chrome.storage.local.set({ [`snoozeUntil:${domain}`]: ts });
  },
};

// ---- Active tracking session (survives SW restart) ----
export type CurrentSession = {
  domain: string;
  startedAt: number; // epoch ms
  tabId: number;
};

export const sessionStore = {
  get: async (): Promise<CurrentSession | null> => {
    const r = await chrome.storage.local.get('currentSession');
    return (r.currentSession as CurrentSession | undefined) ?? null;
  },
  set: async (session: CurrentSession | null) => {
    if (session === null) {
      await chrome.storage.local.remove('currentSession');
    } else {
      await chrome.storage.local.set({ currentSession: session });
    }
  },
};
