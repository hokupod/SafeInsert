<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';

  import {
    SAFEINSERT_GET_LAST_TARGET,
    SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED,
    SAFEINSERT_INSERT_TEXT_TO_TRACKED,
    SAFEINSERT_SIDE_PANEL_ACTIVATED,
    SAFEINSERT_TARGET_CLEARED,
    type SafeInsertInsertResponse,
    type SafeInsertRuntimeMessage,
    type SafeInsertTargetStateResponse
  } from '../lib/messages';
  import { normalizeForSingleLine } from '../lib/insert';
  import { isShortcutMatch, normalizeShortcut } from '../lib/shortcut';
  import { DEFAULT_SETTINGS, readSettings, type SafeInsertSettings } from '../lib/settings';

  let settings: SafeInsertSettings = { ...DEFAULT_SETTINGS };
  let text = '';
  let statusMessage = '';
  let errorMessage = '';
  let targetLabel = '未接続';
  let isComposing = false;
  let textareaEl: HTMLTextAreaElement | null = null;
  let readRequestSeq = 0;
  let refreshTimer: number | null = null;

  const focusTextarea = (): void => {
    textareaEl?.focus();
    const pos = text.length;
    textareaEl?.setSelectionRange(pos, pos);
  };

  const applyTrackedLabel = (inputType?: string, isTextarea?: boolean): boolean => {
    if (inputType === 'contenteditable') {
      targetLabel = 'contenteditable';
      return true;
    }

    if (typeof isTextarea === 'boolean') {
      targetLabel = isTextarea ? 'textarea' : `input[type=${inputType ?? 'text'}]`;
      return true;
    }

    if (typeof inputType === 'string') {
      targetLabel = `input[type=${inputType}]`;
      return true;
    }

    return false;
  };

  const syncTrackedMeta = async (): Promise<boolean> => {
    try {
      const route = await browser.runtime.sendMessage({
        type: SAFEINSERT_GET_LAST_TARGET
      });
      if (!route || typeof route !== 'object') {
        return false;
      }

      const payload = route as { tabId?: number | null; inputType?: string; isTextarea?: boolean };
      if (typeof payload.tabId !== 'number') {
        return false;
      }

      const updated = applyTrackedLabel(payload.inputType, payload.isTextarea);
      if (updated) {
        errorMessage = '';
        return true;
      }

      targetLabel = '対象候補あり';
      errorMessage = '';
      return true;
    } catch {
      return false;
    }
  };

  const readTargetState = async (options?: { silent?: boolean }): Promise<void> => {
    const requestSeq = ++readRequestSeq;
    const silent = options?.silent ?? false;
    if (!silent) {
      statusMessage = '';
      errorMessage = '';
    }

    let response: SafeInsertTargetStateResponse | undefined;
    try {
      response = (await browser.runtime.sendMessage({
        type: SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED
      })) as SafeInsertTargetStateResponse | undefined;
    } catch {
      if (requestSeq !== readRequestSeq) {
        return;
      }
      if (silent) {
        return;
      }
      errorMessage = 'このページではSafeInsertを使用できません。';
      targetLabel = '未接続';
      return;
    }

    if (requestSeq !== readRequestSeq) {
      return;
    }

    if (!response) {
      const hasTracked = await syncTrackedMeta();
      if (silent || hasTracked) {
        if (hasTracked && !statusMessage) {
          statusMessage = '入力欄を追跡中です。必要なら再読込してください。';
        }
        return;
      }
      errorMessage = '挿入先が見つかりません。ページ側で編集対象を一度クリックしてください。';
      targetLabel = '対象なし';
      return;
    }

    if (!response.ok) {
      const hasTracked = await syncTrackedMeta();
      if (silent || hasTracked) {
        if (hasTracked && !statusMessage) {
          statusMessage = '入力欄を追跡中です。必要なら再読込してください。';
        }
        return;
      }
      errorMessage = response.message;
      targetLabel = '対象なし';
      return;
    }

    text = response.value;
    if (response.inputType === 'contenteditable') {
      targetLabel = 'contenteditable';
    } else {
      targetLabel = response.isTextarea ? 'textarea' : `input[type=${response.inputType}]`;
    }
    errorMessage = '';
    statusMessage = '入力欄を読み込みました。';
    focusTextarea();
  };

  const insertToPage = async (): Promise<void> => {
    statusMessage = '';
    errorMessage = '';

    let response: SafeInsertInsertResponse | undefined;
    try {
      response = (await browser.runtime.sendMessage({
        type: SAFEINSERT_INSERT_TEXT_TO_TRACKED,
        text
      })) as SafeInsertInsertResponse | undefined;
    } catch {
      errorMessage = '挿入に失敗しました。ページを再読み込みして再試行してください。';
      return;
    }

    if (!response) {
      const verify = (await browser.runtime.sendMessage({
        type: SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED
      })) as SafeInsertTargetStateResponse | undefined;
      const expected =
        verify?.ok && verify.isTextarea ? text : normalizeForSingleLine(text, settings.newlinePolicyForSingleLine);
      if (verify?.ok && expected !== null && verify.value === expected) {
        errorMessage = '';
        statusMessage = '元入力欄へ挿入しました。';
        void syncTrackedMeta();
        return;
      }
      const hasTracked = await syncTrackedMeta();
      if (hasTracked) {
        errorMessage = '';
        statusMessage = '元入力欄へ反映を試行しました。必要なら再読込で確認してください。';
        return;
      }
      errorMessage = '挿入に失敗しました。ページを再読み込みして再試行してください。';
      return;
    }

    if (!response.ok) {
      const verify = (await browser.runtime.sendMessage({
        type: SAFEINSERT_GET_TARGET_STATE_FROM_TRACKED
      })) as SafeInsertTargetStateResponse | undefined;
      const expected =
        verify?.ok && verify.isTextarea ? text : normalizeForSingleLine(text, settings.newlinePolicyForSingleLine);
      if (verify?.ok && expected !== null && verify.value === expected) {
        errorMessage = '';
        statusMessage = '元入力欄へ挿入しました。';
        void syncTrackedMeta();
        return;
      }
      const hasTracked = await syncTrackedMeta();
      if (hasTracked) {
        errorMessage = '';
        statusMessage = '元入力欄へ反映を試行しました。必要なら再読込で確認してください。';
        return;
      }
      errorMessage = response.message;
      return;
    }

    errorMessage = '';
    statusMessage = '元入力欄へ挿入しました。';
    void syncTrackedMeta();
  };

  const handleKeydown = async (event: KeyboardEvent): Promise<void> => {
    if (isComposing) {
      return;
    }

    const insertShortcut = normalizeShortcut(settings.insertShortcut) || DEFAULT_SETTINGS.insertShortcut;
    if (isShortcutMatch(event, insertShortcut)) {
      event.preventDefault();
      await insertToPage();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      text = '';
      statusMessage = '入力をクリアしました。';
    }
  };

  const handleRuntimeMessage = (message: SafeInsertRuntimeMessage): void => {
    if (message?.type === SAFEINSERT_TARGET_CLEARED) {
      targetLabel = '対象なし';
      statusMessage = '';
      errorMessage = '挿入先が見つかりません。ページ側で編集対象を一度クリックしてください。';
      return;
    }

    if (message?.type !== SAFEINSERT_SIDE_PANEL_ACTIVATED) {
      return;
    }

    if (refreshTimer !== null) {
      return;
    }

    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      void syncTrackedMeta();
      void readTargetState({ silent: true });
    }, 120);
  };

  onMount(() => {
    void (async () => {
      settings = await readSettings();
      await readTargetState();
      focusTextarea();
    })();

    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  });
</script>

<main>
  <header>
    <h1>SafeInsert</h1>
    <p>Side Panelで入力し、挿入でページへ反映します。</p>
  </header>

  <section class="meta">
    <span>対象: {targetLabel}</span>
    <button type="button" on:click={() => readTargetState()}>再読込</button>
  </section>

  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}

  <textarea
    bind:this={textareaEl}
    bind:value={text}
    rows="10"
    on:keydown={handleKeydown}
    on:compositionstart={() => (isComposing = true)}
    on:compositionend={() => (isComposing = false)}
  ></textarea>

  <div class="actions">
    <button type="button" class="primary" on:click={insertToPage}>挿入</button>
    <button
      type="button"
      on:click={() => {
        text = '';
        statusMessage = '';
        errorMessage = '';
      }}
    >
      クリア
    </button>
  </div>

  <p class="hint">挿入: {settings.insertShortcut} / クリア: Esc</p>

  {#if statusMessage}
    <p class="status">{statusMessage}</p>
  {/if}

</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
    background: #f7f9fa;
    color: #1b252c;
  }

  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    box-sizing: border-box;
  }

  h1 {
    margin: 0;
    font-size: 18px;
  }

  header p {
    margin: 4px 0 0;
    font-size: 12px;
    opacity: 0.82;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  textarea {
    width: 100%;
    flex: 1;
    resize: vertical;
    border: 1px solid #bccad3;
    border-radius: 10px;
    padding: 10px;
    font: inherit;
    line-height: 1.5;
    min-height: 180px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    border: 1px solid #8fa3b1;
    border-radius: 8px;
    background: #fff;
    color: #1b252c;
    padding: 7px 12px;
    font: inherit;
    cursor: pointer;
  }

  button.primary {
    border-color: #0f6c4a;
    background: #198754;
    color: #fff;
  }

  .hint,
  .status,
  .error {
    margin: 0;
    font-size: 12px;
  }

  .status {
    color: #0f6c4a;
  }

  .error {
    color: #c62828;
  }
</style>
