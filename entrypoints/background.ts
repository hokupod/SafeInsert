import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import {
  SAFEINSERT_GET_ACTIVE_TAB,
  SAFEINSERT_GET_LAST_TARGET,
  SAFEINSERT_GET_TARGET_STATE,
  SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED,
  SAFEINSERT_INSERT_TEXT,
  SAFEINSERT_INSERT_TEXT_TO_TRACKED,
  SAFEINSERT_OPEN_SIDE_PANEL_REQUEST,
  SAFEINSERT_REQUEST_TRACK_TARGET,
  SAFEINSERT_SIDE_PANEL_ACTIVATED,
  SAFEINSERT_TARGET_CLEARED,
  SAFEINSERT_TRACK_TARGET,
  type SafeInsertRuntimeMessage
} from '../src/lib/messages';
import { LAST_TARGET_STORAGE_KEY, isPersistedLastTarget, type PersistedLastTarget } from '../src/lib/last-target';

const ACTION_COMMAND = '_execute_action';
const lastTargetByTab = new Map<
  number,
  { frameId: number; inputType: string; isTextarea: boolean; updatedAt: number; windowId?: number }
>();
const lastPanelNotifyAtByTab = new Map<number, number>();

interface ActiveTabCandidate {
  id?: number;
  windowId?: number;
}

interface RuntimeSender {
  tab?: {
    id?: number;
    windowId?: number;
  };
  frameId?: number;
}

let persistedLastTarget: PersistedLastTarget | null = null;
let cacheReadyPromise: Promise<void> | null = null;

function log(message: string, payload?: unknown): void {
  const time = new Date().toISOString();
  if (payload === undefined) {
    console.info(`[SafeInsert:bg ${time}] ${message}`);
    return;
  }

  console.info(`[SafeInsert:bg ${time}] ${message}`, payload);
}

async function pickActiveTab(): Promise<ActiveTabCandidate | null> {
  try {
    const currentWindowTabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (currentWindowTabs[0]?.id) {
      log('pickActiveTab: currentWindow hit', { tabId: currentWindowTabs[0].id, windowId: currentWindowTabs[0].windowId });
      return currentWindowTabs[0];
    }
  } catch (error) {
    log('pickActiveTab: currentWindow query failed', String(error));
  }

  try {
    const lastFocusedTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (lastFocusedTabs[0]?.id) {
      log('pickActiveTab: lastFocusedWindow hit', { tabId: lastFocusedTabs[0].id, windowId: lastFocusedTabs[0].windowId });
      return lastFocusedTabs[0];
    }
  } catch (error) {
    log('pickActiveTab: lastFocusedWindow query failed', String(error));
  }

  try {
    const anyActiveTabs = await browser.tabs.query({ active: true });
    if (anyActiveTabs[0]?.id) {
      log('pickActiveTab: any active hit', { tabId: anyActiveTabs[0].id, windowId: anyActiveTabs[0].windowId });
      return anyActiveTabs[0];
    }
  } catch (error) {
    log('pickActiveTab: any-active query failed', String(error));
  }

  let newest: { tabId: number; updatedAt: number } | null = null;
  for (const [tabId, target] of lastTargetByTab.entries()) {
    if (!newest || target.updatedAt > newest.updatedAt) {
      newest = { tabId, updatedAt: target.updatedAt };
    }
  }

  if (newest) {
    log('pickActiveTab: fallback to last tracked target tab', newest);
    return { id: newest.tabId };
  }

  if (persistedLastTarget?.tabId) {
    log('pickActiveTab: fallback to persisted last target', persistedLastTarget);
    return { id: persistedLastTarget.tabId };
  }

  log('pickActiveTab: no tab resolved');
  return null;
}

function selectNewestTrackedTarget(): PersistedLastTarget | null {
  let newest: PersistedLastTarget | null = null;

  for (const [tabId, target] of lastTargetByTab.entries()) {
    if (!newest || target.updatedAt > newest.updatedAt) {
      newest = {
        tabId,
        frameId: target.frameId,
        inputType: target.inputType,
        isTextarea: target.isTextarea,
        windowId: target.windowId,
        updatedAt: target.updatedAt
      };
    }
  }

  if (newest) {
    return newest;
  }

  return persistedLastTarget;
}

async function ensureTargetCacheLoaded(): Promise<void> {
  if (cacheReadyPromise) {
    return cacheReadyPromise;
  }

  cacheReadyPromise = (async () => {
    try {
      const raw = await browser.storage.local.get(LAST_TARGET_STORAGE_KEY);
      const candidate = raw[LAST_TARGET_STORAGE_KEY];
      if (isPersistedLastTarget(candidate)) {
        persistedLastTarget = candidate;
        lastTargetByTab.set(candidate.tabId, {
          frameId: candidate.frameId,
          inputType: candidate.inputType,
          isTextarea: candidate.isTextarea,
          windowId: candidate.windowId,
          updatedAt: candidate.updatedAt
        });
        log('target cache loaded from storage', candidate);
      }
    } catch (error) {
      log('target cache load failed', String(error));
    }
  })();

  return cacheReadyPromise;
}

async function persistLastTarget(payload: PersistedLastTarget): Promise<void> {
  persistedLastTarget = payload;
  try {
    await browser.storage.local.set({
      [LAST_TARGET_STORAGE_KEY]: payload
    });
  } catch (error) {
    log('persist last target failed', String(error));
  }
}

function clearTrackedTargetForTab(tabId: number): void {
  lastTargetByTab.delete(tabId);
  lastPanelNotifyAtByTab.delete(tabId);
  if (persistedLastTarget?.tabId === tabId) {
    persistedLastTarget = null;
    void browser.storage.local.remove(LAST_TARGET_STORAGE_KEY).catch(() => {
      // Best effort cleanup.
    });
  }

  void browser.runtime
    .sendMessage({
      type: SAFEINSERT_TARGET_CLEARED,
      tabId
    })
    .catch(() => {
      // Side panel may be closed.
    });
}

async function requestRetrackOnTab(tabId: number): Promise<boolean> {
  try {
    await browser.tabs.sendMessage(tabId, { type: SAFEINSERT_REQUEST_TRACK_TARGET });
  } catch {
    return false;
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
  return lastTargetByTab.has(tabId);
}

async function sendToTrackedFrame<T>(message: { type: string; text?: string }): Promise<T | undefined> {
  await ensureTargetCacheLoaded();
  let newest = selectNewestTrackedTarget();
  if (!newest) {
    const activeTab = await pickActiveTab();
    if (activeTab?.id) {
      if (await requestRetrackOnTab(activeTab.id)) {
        newest = selectNewestTrackedTarget();
      }
    }
  }

  if (!newest) {
    log('relay aborted: no tracked target', { type: message.type });
    return;
  }

  log('relay start', { type: message.type, tabId: newest.tabId, frameId: newest.frameId });
  try {
    const response = (await browser.tabs.sendMessage(newest.tabId, message, {
      frameId: newest.frameId
    })) as T;
    log('relay success (frame)', { type: message.type, tabId: newest.tabId, frameId: newest.frameId });
    return response;
  } catch (error) {
    const errorText = String(error);
    log('relay frame failed', {
      type: message.type,
      tabId: newest.tabId,
      frameId: newest.frameId,
      error: errorText
    });

    if (errorText.includes('Receiving end does not exist')) {
      clearTrackedTargetForTab(newest.tabId);
      const reTracked = await requestRetrackOnTab(newest.tabId);
      if (reTracked) {
        const refreshed = selectNewestTrackedTarget();
        if (refreshed && refreshed.tabId === newest.tabId) {
          try {
            const response = (await browser.tabs.sendMessage(refreshed.tabId, message, {
              frameId: refreshed.frameId
            })) as T;
            log('relay success (retracked frame)', {
              type: message.type,
              tabId: refreshed.tabId,
              frameId: refreshed.frameId
            });
            return response;
          } catch (retryError) {
            log('relay retracked frame failed', {
              type: message.type,
              tabId: refreshed.tabId,
              frameId: refreshed.frameId,
              error: String(retryError)
            });
          }
        }
      }
    }

    return;
  }
}

async function handleRuntimeMessage(
  message: SafeInsertRuntimeMessage,
  sender: RuntimeSender
): Promise<unknown> {
  log('runtime message', { type: message?.type, senderTabId: sender.tab?.id, senderFrameId: sender.frameId });

  if (message?.type === SAFEINSERT_TRACK_TARGET) {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;
    if (typeof tabId !== 'number' || typeof frameId !== 'number') {
      log('track target ignored: missing tab/frame');
      return;
    }

    const next = {
      frameId,
      inputType: message.inputType,
      isTextarea: message.isTextarea,
      windowId: sender.tab?.windowId,
      updatedAt: Date.now()
    };

    const previous = lastTargetByTab.get(tabId);
    lastTargetByTab.set(tabId, next);
    void persistLastTarget({
      tabId,
      frameId,
      inputType: next.inputType,
      isTextarea: next.isTextarea,
      windowId: next.windowId,
      updatedAt: next.updatedAt
    });

    const hasTargetChanged =
      !previous ||
      previous.frameId !== frameId ||
      previous.inputType !== message.inputType ||
      previous.isTextarea !== message.isTextarea;
    const lastNotifyAt = lastPanelNotifyAtByTab.get(tabId) ?? 0;
    const shouldNotifyPanel = hasTargetChanged || Date.now() - lastNotifyAt > 800;
    if (shouldNotifyPanel) {
      lastPanelNotifyAtByTab.set(tabId, Date.now());
      void browser.runtime.sendMessage({ type: SAFEINSERT_SIDE_PANEL_ACTIVATED }).catch(() => {
        // Side panel may be closed.
      });
    }
    log('track target updated', { tabId, frameId, inputType: message.inputType, isTextarea: message.isTextarea });
    return;
  }

  if (message?.type === SAFEINSERT_GET_ACTIVE_TAB) {
    await ensureTargetCacheLoaded();
    const activeTab = await pickActiveTab();
    const tabId = activeTab?.id ?? null;
    log('get active tab response', { tabId });
    return { tabId };
  }

  if (message?.type === SAFEINSERT_GET_LAST_TARGET) {
    await ensureTargetCacheLoaded();
    const newest = selectNewestTrackedTarget();
    if (!newest) {
      log('get last target response: empty');
      return { tabId: null, frameId: null };
    }

    log('get last target response', {
      tabId: newest.tabId,
      frameId: newest.frameId,
      knownTabs: Array.from(lastTargetByTab.keys())
    });
    return {
      tabId: newest.tabId,
      frameId: newest.frameId,
      inputType: newest.inputType,
      isTextarea: newest.isTextarea,
      windowId: newest.windowId
    };
  }

  if (message?.type === SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED) {
    const response = await sendToTrackedFrame<{
      ok: boolean;
      message?: string;
      value?: string;
      inputType?: string;
      isTextarea?: boolean;
    }>({
      type: SAFEINSERT_GET_TARGET_STATE
    });

    if (!response) {
      return {
        ok: false,
        message: '挿入先が見つかりません。ページ側で編集対象を一度クリックしてください。'
      };
    }

    return response;
  }

  if (message?.type === SAFEINSERT_INSERT_TEXT_TO_TRACKED) {
    const response = await sendToTrackedFrame<{
      ok: boolean;
      message?: string;
    }>({
      type: SAFEINSERT_INSERT_TEXT,
      text: message.text
    });

    if (!response) {
      return {
        ok: false,
        message: '挿入に失敗しました。ページを再読み込みして再試行してください。'
      };
    }

    return response;
  }

  if (message?.type !== SAFEINSERT_OPEN_SIDE_PANEL_REQUEST) {
    return;
  }

  log('open side panel request received; sidePanel.open is disabled due user-gesture restriction');
  void browser.runtime.sendMessage({ type: SAFEINSERT_SIDE_PANEL_ACTIVATED }).catch(() => {
    // Side panel may not be open yet.
  });
}

export default defineBackground(() => {
  log('service worker boot');
  void ensureTargetCacheLoaded();

  const chromeApi = (globalThis as any).chrome as {
    sidePanel?: {
      setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
    };
  };

  void chromeApi.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });

  browser.commands.onCommand.addListener((command) => {
    log('command received', { command });
    if (command !== ACTION_COMMAND) {
      return;
    }

    void browser.runtime.sendMessage({ type: SAFEINSERT_SIDE_PANEL_ACTIVATED }).catch(() => {
      // Side panel may not be open yet.
    });
  });

  const chromeRuntime = (globalThis as any).chrome?.runtime as
    | {
        onMessage?: {
          addListener: (
            callback: (
              message: SafeInsertRuntimeMessage,
              sender: RuntimeSender,
              sendResponse: (response?: unknown) => void
            ) => boolean
          ) => void;
        };
      }
    | undefined;

  if (chromeRuntime?.onMessage?.addListener) {
    chromeRuntime.onMessage.addListener((message, sender, sendResponse) => {
      void handleRuntimeMessage(message, sender)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error) => {
          log('runtime handler failed', String(error));
          sendResponse();
        });
      return true;
    });
  } else {
    browser.runtime.onMessage.addListener((message, sender) => handleRuntimeMessage(message, sender));
  }

  browser.tabs.onRemoved.addListener((tabId) => {
    clearTrackedTargetForTab(tabId);
    log('tab removed; target cache cleared', { tabId });
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      clearTrackedTargetForTab(tabId);
      log('tab loading; stale target cache cleared', { tabId });
    }
  });
});
