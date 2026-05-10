import {
  endCurrentSession,
  transitionToTab,
} from '@/src/lib/tracking';
import { IDLE_THRESHOLD_SECONDS, SNOOZE_MS } from '@/src/constants';
import { cooldownStore } from '@/src/lib/storage';
import { isRuntimeMessage } from '@/src/lib/messaging';
import {
  PROC_ALARM,
  checkProcrastination,
  ensureProcrastinationAlarm,
} from '@/src/lib/intervention';

export default defineBackground(() => {
  // Open side panel when toolbar icon clicked
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error('sidePanel.setPanelBehavior failed', err));
  }

  // Idle detection radius
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

  // On SW boot, finalize any session that survived a restart, and ensure alarm exists
  endCurrentSession().catch((e) => console.error('startup endSession', e));
  ensureProcrastinationAlarm();

  chrome.runtime.onInstalled.addListener(() => {
    endCurrentSession().catch(() => {});
    ensureProcrastinationAlarm();
  });

  chrome.runtime.onStartup.addListener(() => {
    endCurrentSession().catch(() => {});
    ensureProcrastinationAlarm();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROC_ALARM) return;
    checkProcrastination()
      .then((res) => {
        if (res.ok) {
          console.log(
            `[PlanFlow] intervention sent: ${res.taskTitle} on ${res.domain}`,
          );
        }
      })
      .catch((e) => console.error('procrastination check failed', e));
  });

  // ---- Behavior tracking listeners ----

  chrome.tabs.onActivated.addListener(async (info) => {
    try {
      const tab = await chrome.tabs.get(info.tabId);
      await transitionToTab(tab.url, info.tabId);
    } catch (e) {
      console.error('onActivated', e);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (change.status !== 'complete') return;
    if (!tab.active) return;
    try {
      await transitionToTab(tab.url, tabId);
    } catch (e) {
      console.error('onUpdated', e);
    }
  });

  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    try {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await endCurrentSession();
        return;
      }
      const tabs = await chrome.tabs.query({ active: true, windowId });
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        await transitionToTab(tab.url, tab.id);
      } else {
        await endCurrentSession();
      }
    } catch (e) {
      console.error('onFocusChanged', e);
    }
  });

  chrome.idle.onStateChanged.addListener(async (state) => {
    try {
      if (state === 'active') {
        // Resume tracking on whatever tab is active now
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (tab?.id !== undefined) {
          await transitionToTab(tab.url, tab.id);
        }
      } else {
        await endCurrentSession();
      }
    } catch (e) {
      console.error('onStateChanged', e);
    }
  });

  // ---- Runtime messages from content script / panels ----

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isRuntimeMessage(msg)) return false;
    if (msg.type === 'OPEN_DASHBOARD') {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'SNOOZE_DOMAIN') {
      const ms = (msg.minutes ?? 5) * 60_000 || SNOOZE_MS;
      cooldownStore
        .setSnoozeUntil(msg.domain, Date.now() + ms)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true; // async
    }
    return false;
  });

  console.log('PlanFlow background ready', { id: chrome.runtime.id });
});
