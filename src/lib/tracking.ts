import { behaviorStore, sessionStore } from './storage';
import { SESSION_MAX_DURATION_MS } from '../constants';

const SKIP_PROTOCOLS = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'devtools://',
  'view-source:',
  'file://',
];

/**
 * Returns the registrable domain (eTLD+1, simple 2-part heuristic).
 * Misses .co.uk / .com.au style suffixes — acceptable for v1.
 */
export function getRegistrableDomain(url: string | undefined): string | null {
  if (!url) return null;
  if (SKIP_PROTOCOLS.some((p) => url.startsWith(p))) return null;
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!host) return null;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

export function todayDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hourBucket(now: Date = new Date()): number {
  return now.getHours();
}

/**
 * Finalize the active session and append it to today's behavior log.
 * Caps duration at SESSION_MAX_DURATION_MS so a sleeping laptop doesn't
 * record an 8-hour YouTube session.
 */
export async function endCurrentSession(now: number = Date.now()): Promise<void> {
  const session = await sessionStore.get();
  if (!session) return;
  const rawDuration = now - session.startedAt;
  const duration = Math.min(Math.max(0, rawDuration), SESSION_MAX_DURATION_MS);
  if (duration >= 1000) {
    const startDate = new Date(session.startedAt);
    await behaviorStore.addSession({
      date: todayDate(startDate),
      domain: session.domain,
      hourBucket: hourBucket(startDate),
      durationMs: duration,
    });
  }
  await sessionStore.set(null);
}

export async function startSession(
  domain: string,
  tabId: number,
  now: number = Date.now(),
): Promise<void> {
  await sessionStore.set({ domain, startedAt: now, tabId });
}

export async function getActiveSession() {
  return sessionStore.get();
}

/**
 * Returns ms the user has been on `domain` continuously, or 0 if not active.
 */
export async function activeDurationMs(
  domain: string,
  now: number = Date.now(),
): Promise<number> {
  const session = await sessionStore.get();
  if (!session || session.domain !== domain) return 0;
  return Math.max(0, now - session.startedAt);
}

/**
 * Convenience: end the current session, then start a new one if the URL
 * resolves to a trackable domain.
 */
export async function transitionToTab(
  url: string | undefined,
  tabId: number,
): Promise<string | null> {
  await endCurrentSession();
  const domain = getRegistrableDomain(url);
  if (domain) {
    await startSession(domain, tabId);
  }
  return domain;
}
