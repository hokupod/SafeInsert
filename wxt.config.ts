import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'SafeInsert',
    description: 'IME確定による誤送信を避ける安全入力サイドパネル',
    version: '0.1.0',
    icons: {
      16: 'icon.png',
      32: 'icon.png',
      48: 'icon.png',
      128: 'icon.png'
    },
    permissions: ['storage', 'tabs'],
    action: {
      default_title: 'SafeInsert',
      default_icon: {
        16: 'icon.png',
        32: 'icon.png'
      }
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
