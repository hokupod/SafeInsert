import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'SafeInsert',
    description: 'IME確定による誤送信を避ける安全入力サイドパネル',
    version: '0.1.0',
    permissions: ['storage', 'tabs'],
    action: {
      default_title: 'SafeInsert'
    },
    side_panel: {
      default_path: 'sidepanel.html'
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Alt+Shift+Space'
        },
        description: 'SafeInsert Side Panelを開く'
      }
    }
  }
});
