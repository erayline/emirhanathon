import {
  COOLDOWN_MS,
  DISTRACTION_DOMAINS,
  MIN_PROCRASTINATION_MS,
} from '../constants';
import { cooldownStore, eventsStore } from './storage';
import { activeDurationMs, getRegistrableDomain } from './tracking';
import { getCurrentTask, minutesToHHMM } from './calendar';
import { generateNudge, AIError } from './ai';
import { sendIntervention } from './messaging';

const DISTRACTION_SET = new Set<string>(DISTRACTION_DOMAINS);

export const PROC_ALARM = 'procrastinationCheck';

export function ensureProcrastinationAlarm(): void {
  chrome.alarms.get(PROC_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(PROC_ALARM, { periodInMinutes: 1 });
    }
  });
}

export type CheckResult =
  | { ok: false; reason: string }
  | { ok: true; domain: string; taskTitle: string };

export async function checkProcrastination(
  now: number = Date.now(),
): Promise<CheckResult> {
  const events = await eventsStore.list();
  const task = getCurrentTask(events, new Date(now));
  if (!task) return { ok: false, reason: 'no active task' };

  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab || tab.id === undefined || !tab.url) {
    return { ok: false, reason: 'no active tab' };
  }
  const domain = getRegistrableDomain(tab.url);
  if (!domain) return { ok: false, reason: 'untrackable URL' };
  if (!DISTRACTION_SET.has(domain)) {
    return { ok: false, reason: `${domain} not a distraction` };
  }

  const snoozeUntil = await cooldownStore.getSnoozeUntil(domain);
  if (snoozeUntil && snoozeUntil > now) {
    return { ok: false, reason: 'snoozed' };
  }

  const lastAt = await cooldownStore.getInterventionAt(domain);
  if (lastAt && now - lastAt < COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }

  const ms = await activeDurationMs(domain, now);
  if (ms < MIN_PROCRASTINATION_MS) {
    return { ok: false, reason: `only ${Math.round(ms / 1000)}s on site` };
  }

  let cueText: string;
  try {
    cueText = await generateNudge({
      taskTitle: task.title,
      taskEndHHMM: minutesToHHMM(task.endMinutes),
      domain,
      minutesOnSite: ms / 60_000,
    });
  } catch (e) {
    if (e instanceof AIError) console.warn('nudge AI failed', e.message);
    else console.error('nudge generation crashed', e);
    cueText = `Hey — "${task.title}" is on your plan, this isn't.`;
  }

  try {
    await sendIntervention(tab.id, {
      taskTitle: task.title,
      cueText,
      taskEndMinutes: task.endMinutes,
    });
    await cooldownStore.setInterventionAt(domain, now);
    return { ok: true, domain, taskTitle: task.title };
  } catch (e) {
    console.error('intervention dispatch failed', e);
    return { ok: false, reason: 'dispatch failed' };
  }
}
