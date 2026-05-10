import type { RuntimeMessage, InterventionMessage } from '../types';

export function sendIntervention(
  tabId: number,
  payload: Omit<InterventionMessage, 'type'>,
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, {
    type: 'INTERVENE',
    ...payload,
  } satisfies InterventionMessage);
}

export function sendRuntime(message: RuntimeMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object') return false;
  const t = (value as { type?: unknown }).type;
  return t === 'INTERVENE' || t === 'OPEN_DASHBOARD' || t === 'SNOOZE_DOMAIN';
}
