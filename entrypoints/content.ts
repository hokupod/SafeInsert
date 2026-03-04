import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import { insertFromModal } from '../src/lib/insert';
import {
  SAFEINSERT_GET_TARGET_STATE,
  SAFEINSERT_INSERT_TEXT,
  SAFEINSERT_REQUEST_TRACK_TARGET,
  SAFEINSERT_SETTINGS_UPDATED,
  SAFEINSERT_SIDE_PANEL_ACTIVATED,
  SAFEINSERT_TRACK_TARGET,
  type SafeInsertInsertResponse,
  type SafeInsertRuntimeMessage,
  type SafeInsertTargetStateResponse
} from '../src/lib/messages';
import { isShortcutMatchLoose, normalizeShortcut } from '../src/lib/shortcut';
import { DEFAULT_SETTINGS, isExcludedHost, readSettings, type SafeInsertSettings } from '../src/lib/settings';
import {
  createTargetSnapshot,
  isTargetUsable,
  resolveSupportedTarget,
  type SupportedTargetElement,
  type TargetSnapshot
} from '../src/lib/target';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  main() {
    void bootstrap();
  }
});

let settings: SafeInsertSettings = { ...DEFAULT_SETTINGS };
let currentTargetElement: SupportedTargetElement | null = null;
let lastTrackedSnapshot: TargetSnapshot | null = null;

async function bootstrap(): Promise<void> {
  settings = await readSettings();

  window.addEventListener('keydown', handleKeydownCapture, true);
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('selectionchange', handleSelectionChange, true);
  document.addEventListener('keydown', handleKeydownCapture, true);

  browser.runtime.onMessage.addListener((message: SafeInsertRuntimeMessage) => handleRuntimeMessage(message));
}

function handleFocusIn(event: FocusEvent): void {
  if (isExcludedHost(window.location.hostname, settings.excludedSites)) {
    currentTargetElement = null;
    return;
  }

  const resolved = resolveSupportedTarget(event.target, settings);
  if (!resolved) {
    return;
  }

  currentTargetElement = resolved;
  const snapshot = createTargetSnapshot(resolved);
  lastTrackedSnapshot = snapshot;
  trackTargetSnapshot(snapshot);
}

function handleSelectionChange(): void {
  const resolved = resolveSupportedTarget(document.activeElement, settings);
  if (!resolved) {
    return;
  }

  currentTargetElement = resolved;
  const snapshot = createTargetSnapshot(resolved);
  lastTrackedSnapshot = snapshot;
  trackTargetSnapshot(snapshot);
}

function handleKeydownCapture(event: KeyboardEvent): void {
  if ((event as KeyboardEvent & { __safeInsertHandled?: boolean }).__safeInsertHandled) {
    return;
  }

  if (isExcludedHost(window.location.hostname, settings.excludedSites)) {
    return;
  }

  const triggerShortcut = normalizeShortcut(settings.triggerShortcut);
  if (!triggerShortcut || !isShortcutMatchLoose(event, triggerShortcut)) {
    return;
  }

  (event as KeyboardEvent & { __safeInsertHandled?: boolean }).__safeInsertHandled = true;

  const target = resolveBestTarget();
  if (target) {
    const snapshot = createTargetSnapshot(target);
    lastTrackedSnapshot = snapshot;
    currentTargetElement = target;
    trackTargetSnapshot(snapshot);
  }

  event.preventDefault();
  event.stopPropagation();

  void browser.runtime
    .sendMessage({ type: SAFEINSERT_SIDE_PANEL_ACTIVATED })
    .catch(() => {
      // Background may be unavailable on restricted pages.
    });
}

function handleRuntimeMessage(
  message: SafeInsertRuntimeMessage
): SafeInsertTargetStateResponse | SafeInsertInsertResponse | undefined {
  if (message?.type === SAFEINSERT_SETTINGS_UPDATED) {
    void readSettings().then((next) => {
      settings = next;
    });
    return;
  }

  if (isExcludedHost(window.location.hostname, settings.excludedSites)) {
    if (message?.type === SAFEINSERT_GET_TARGET_STATE) {
      return;
    }

    if (message?.type === SAFEINSERT_INSERT_TEXT) {
      return;
    }

    return;
  }

  if (message?.type === SAFEINSERT_GET_TARGET_STATE) {
    const snapshot = resolveBestSnapshot();
    if (!snapshot) {
      return {
        ok: false,
        message: '対象の入力欄が見つかりません。'
      };
    }

    return {
      ok: true,
      value: snapshot.valueAtOpen,
      isTextarea: snapshot.isTextarea,
      inputType: snapshot.inputType
    };
  }

  if (message?.type === SAFEINSERT_REQUEST_TRACK_TARGET) {
    const snapshot = resolveBestSnapshot();
    if (!snapshot) {
      return { ok: false, message: '対象なし' };
    }

    trackTargetSnapshot(snapshot);
    return { ok: true, inputType: snapshot.inputType, isTextarea: snapshot.isTextarea };
  }

  if (message?.type === SAFEINSERT_INSERT_TEXT) {
    const snapshot = resolveBestSnapshot();
    if (!snapshot) {
      return {
        ok: false,
        message: '挿入先が見つかりません。ページ側で再度フォーカスしてから再試行してください。'
      };
    }

    const result = insertFromModal(snapshot, message.text, settings);
    if (!result.ok) {
      return {
        ok: false,
        message: result.message ?? '挿入に失敗しました。'
      };
    }

    if (isTargetUsable(snapshot)) {
      snapshot.elementRef.focus();
      currentTargetElement = snapshot.elementRef;
      const nextSnapshot = createTargetSnapshot(snapshot.elementRef);
      lastTrackedSnapshot = nextSnapshot;
      trackTargetSnapshot(nextSnapshot);
    }

    return { ok: true };
  }

  return;
}

function resolveBestTarget(): SupportedTargetElement | null {
  const activeResolved = resolveSupportedTarget(document.activeElement, settings);
  if (activeResolved) {
    return activeResolved;
  }

  if (currentTargetElement && resolveSupportedTarget(currentTargetElement, settings)) {
    return currentTargetElement;
  }

  return null;
}

function resolveBestSnapshot(): TargetSnapshot | null {
  if (lastTrackedSnapshot && isTargetUsable(lastTrackedSnapshot)) {
    return lastTrackedSnapshot;
  }

  const target = resolveBestTarget();
  if (!target) {
    return null;
  }

  const snapshot = createTargetSnapshot(target);
  lastTrackedSnapshot = snapshot;
  return isTargetUsable(snapshot) ? snapshot : null;
}

function trackTargetSnapshot(snapshot: TargetSnapshot): Promise<void> {
  return browser.runtime
    .sendMessage({
      type: SAFEINSERT_TRACK_TARGET,
      inputType: snapshot.inputType,
      isTextarea: snapshot.isTextarea
    })
    .then(() => {
      // Sent.
    })
    .catch(() => {
      // Background may be unavailable on restricted pages.
    });
}
