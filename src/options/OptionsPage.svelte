<script lang="ts">
  import { browser } from 'wxt/browser';

  import { SAFEINSERT_SETTINGS_UPDATED } from '../lib/messages';
  import {
    DEFAULT_SETTINGS,
    type SafeInsertSettings,
    readSettings,
    writeSettings
  } from '../lib/settings';

  const triggerPresets = ['Alt+Shift+Space', 'Alt+Space', 'Ctrl+Alt+Space', 'Ctrl+Shift+Space'];
  const insertPresets = ['Ctrl+Enter', 'Alt+Enter'];

  let settings: SafeInsertSettings = { ...DEFAULT_SETTINGS };
  let excludedSitesText = '';
  let inputTypeAllowlistText = settings.inputTypeAllowlist.join(',');
  let saved = false;

  const parseLines = (input: string): string[] =>
    input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const parseCsv = (input: string): string[] =>
    input
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

  const load = async (): Promise<void> => {
    settings = await readSettings();
    excludedSitesText = settings.excludedSites.join('\n');
    inputTypeAllowlistText = settings.inputTypeAllowlist.join(',');
  };

  const save = async (): Promise<void> => {
    const next: SafeInsertSettings = {
      ...settings,
      excludedSites: parseLines(excludedSitesText),
      inputTypeAllowlist: parseCsv(inputTypeAllowlistText)
    };

    await writeSettings(next);
    try {
      await browser.runtime.sendMessage({ type: SAFEINSERT_SETTINGS_UPDATED });
    } catch {
      // No content scripts are currently connected.
    }
    settings = next;

    saved = true;
    window.setTimeout(() => {
      saved = false;
    }, 1200);
  };

  void load();
</script>

<main>
  <h1>SafeInsert 設定</h1>

  <section>
    <label>
      起動ショートカット（ページ内キー監視）
      <input list="trigger-presets" bind:value={settings.triggerShortcut} />
      <datalist id="trigger-presets">
        {#each triggerPresets as preset}
          <option value={preset}></option>
        {/each}
      </datalist>
    </label>
    <p>ブラウザの拡張ショートカット（commands）は `chrome://extensions/shortcuts` で設定できます。</p>
  </section>

  <section>
    <label>
      挿入ショートカット
      <input list="insert-presets" bind:value={settings.insertShortcut} />
      <datalist id="insert-presets">
        {#each insertPresets as preset}
          <option value={preset}></option>
        {/each}
      </datalist>
    </label>
  </section>

  <section>
    <label>
      単一行inputの改行処理
      <select bind:value={settings.newlinePolicyForSingleLine}>
        <option value="space">空白に変換</option>
        <option value="remove">改行を削除</option>
        <option value="block">挿入を拒否</option>
      </select>
    </label>
  </section>

  <section>
    <label>
      除外サイト（1行1ホスト、例: example.com / *.example.com）
      <textarea rows="4" bind:value={excludedSitesText}></textarea>
    </label>
  </section>

  <section>
    <label>
      対象input type（カンマ区切り）
      <input bind:value={inputTypeAllowlistText} />
    </label>
  </section>

  <button type="button" on:click={save}>保存</button>
  {#if saved}
    <p>保存しました。</p>
  {/if}
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
    background: #f6f8f9;
    color: #172026;
  }

  main {
    max-width: 740px;
    margin: 28px auto;
    padding: 20px;
    background: #fff;
    border: 1px solid #d8e1e6;
    border-radius: 12px;
    display: grid;
    gap: 16px;
  }

  h1 {
    margin: 0;
    font-size: 20px;
  }

  section {
    display: grid;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 13px;
  }

  input,
  select,
  textarea,
  button {
    font: inherit;
  }

  input,
  select,
  textarea {
    border: 1px solid #bccad3;
    border-radius: 8px;
    padding: 8px 10px;
  }

  button {
    justify-self: start;
    border-radius: 8px;
    border: 1px solid #176d4d;
    background: #198754;
    color: #fff;
    padding: 8px 14px;
    cursor: pointer;
  }
</style>
