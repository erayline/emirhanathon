import { create } from 'zustand';
import { aggregateWeek, type WeeklyAggregate } from '../lib/insights';

type BehaviorState = {
  weekly: WeeklyAggregate | null;
  loading: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useBehavior = create<BehaviorState>((set, get) => ({
  weekly: null,
  loading: false,
  load: async () => {
    if (get().weekly) return;
    set({ loading: true });
    const w = await aggregateWeek();
    set({ weekly: w, loading: false });
  },
  refresh: async () => {
    set({ loading: true });
    const w = await aggregateWeek();
    set({ weekly: w, loading: false });
  },
}));
