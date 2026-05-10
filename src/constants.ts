export const DISTRACTION_DOMAINS = [
  'youtube.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'reddit.com',
  'tiktok.com',
  'facebook.com',
  'netflix.com',
] as const;

export const COOLDOWN_MS = 20 * 60 * 1000; // 20 min between interventions on same domain
export const MIN_PROCRASTINATION_MS = 3 * 60 * 1000; // 3 min on a distraction site
export const SNOOZE_MS = 5 * 60 * 1000; // 5 min snooze after "5 dk daha"
export const IDLE_THRESHOLD_SECONDS = 60;
export const SESSION_MAX_DURATION_MS = 30 * 60 * 1000; // cap dangling sessions

export const DAY_LABELS: Record<number, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
};

export const DAY_NAMES_FULL: Record<number, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};

export const CALENDAR_START_HOUR = 6;
export const CALENDAR_END_HOUR = 24;

export const APP_LANGUAGE = 'English';

export const CHAT_HISTORY_LIMIT = 50;
export const INSIGHT_REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
