<script lang="ts">
  import SafeInsertEditor from '../ui/SafeInsertEditor.svelte';
</script>

<main class="popup-page">
  <header>
    <h1>SafeInsert</h1>
    <p>入力して、挿入でページへ反映します。</p>
  </header>

  <SafeInsertEditor surface="popup" />
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
    background: #f7f9fa;
    color: #1b252c;
  }

  .popup-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    box-sizing: border-box;
    min-width: 0;
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

  .popup-page :global(.safeinsert-editor__actions) {
    margin-top: 2px;
  }

  .popup-page :global(.safeinsert-editor__hint),
  .popup-page :global(.safeinsert-editor__status) {
    line-height: 1.4;
  }
</style>
