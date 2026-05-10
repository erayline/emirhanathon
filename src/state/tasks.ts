import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import { eventsStore } from '../lib/storage';

type TasksState = {
  events: CalendarEvent[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  add: (e: CalendarEvent) => Promise<CalendarEvent>;
  addMany: (events: CalendarEvent[]) => Promise<void>;
  update: (id: string, patch: Partial<CalendarEvent>) => Promise<CalendarEvent | null>;
  remove: (id: string) => Promise<boolean>;
  /** Re-read from storage (use after background mutations or other panels). */
  refresh: () => Promise<void>;
};

export const useTasks = create<TasksState>((set, get) => ({
  events: [],
  loading: false,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loading: true });
    const list = await eventsStore.list();
    set({ events: list, loading: false, loaded: true });
  },
  refresh: async () => {
    const list = await eventsStore.list();
    set({ events: list, loaded: true });
  },
  add: async (e) => {
    await eventsStore.add(e);
    set({ events: [...get().events, e] });
    return e;
  },
  addMany: async (events) => {
    const current = await eventsStore.list();
    const next = [...current, ...events];
    await eventsStore.save(next);
    set({ events: next });
  },
  update: async (id, patch) => {
    const updated = await eventsStore.update(id, patch);
    if (updated) {
      set({ events: get().events.map((e) => (e.id === id ? updated : e)) });
    }
    return updated;
  },
  remove: async (id) => {
    const ok = await eventsStore.remove(id);
    if (ok) set({ events: get().events.filter((e) => e.id !== id) });
    return ok;
  },
}));

// Cross-context refresh: storage changes (from background or other panels)
// should bubble into the in-memory store.
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.events) {
      const next = (changes.events.newValue as CalendarEvent[] | undefined) ?? [];
      useTasks.setState({ events: next });
    }
  });
}
