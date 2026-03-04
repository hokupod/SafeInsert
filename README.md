# SafeInsert

IME確定時の誤送信リスクを下げるための、Chrome/Edge 向けブラウザ拡張です。  
入力は Side Panel 側で行い、明示操作（`挿入` ボタン or `Ctrl+Enter`）でページへ反映します。

## 現在の実装方針

- UI は **Side Panel 方式**（ページ内モーダルは不採用）
- フォーカスターゲットは Content Script が追跡し、Background 経由で中継
- 既定ショートカットは `Alt+Shift+Space`（環境依存あり）
- モーダル入力の prefill は「元入力欄の全文」
- 挿入時は「元入力欄の全文置換」
- `input[type=password]` は対象外

## 主な機能

- `textarea` / `input`（allowlist 対象 type）への挿入
- `contenteditable` へのベストエフォート挿入
- IME composition 中は Enter 系ショートカットを挿入トリガーにしない
- 単一行 input の改行ポリシー（空白変換 / 削除 / 拒否）
- 除外サイト設定（`example.com`, `*.example.com`）

## 必要環境

- Node.js（推奨: 20 以上）
- pnpm（`packageManager: pnpm@10.27.0`）
- Chromium 系ブラウザ（Chrome / Edge）

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev
```

- `pnpm dev` 実行後、`chrome://extensions` で「デベロッパーモード」を有効化
- 「パッケージ化されていない拡張機能を読み込む」で `/.output/chrome-mv3` を指定
- 反映が不安定な場合は、拡張機能の再読み込み + 対象ページの再読み込みを実施

## 使い方

1. 対象ページで挿入先（`textarea` / `input` / `contenteditable`）をクリック
2. Side Panel を開く（拡張アイコン or 拡張ショートカット）
3. Side Panel の入力欄で編集
4. `挿入` ボタンまたは `Ctrl+Enter` で反映
5. 反映先が変わった場合は `再読込` で追跡状態を同期

## ショートカット

- 既定（manifest command）: `Alt+Shift+Space`
- 変更場所:
  - ブラウザ側 command: `chrome://extensions/shortcuts`
  - ページ内トリガー / 挿入ショートカット: Options ページ
- 注意:
  - `Alt+Shift+Space` は環境や IME/OS 設定により競合する場合あり

## 設定項目（Options）

- 起動ショートカット（ページ内キー監視）
- 挿入ショートカット
- 単一行 input の改行処理
- 除外サイト
- 対象 input type allowlist

保存先:

- `safeInsert.settings.v1`
- `safeInsert.lastTarget.v1`

## スクリプト

```bash
pnpm dev        # 開発モード
pnpm build      # 本番ビルド
pnpm zip        # 配布用ZIP作成
pnpm typecheck  # 型チェック
pnpm test       # テスト実行
```

## 配布（ZIP作成）

```bash
pnpm zip
```

- 出力例: `/.output/safeinsert-<version>-chrome.zip`

## 制約 / 既知事項

- `chrome://*` など拡張コンテンツスクリプト非対応ページでは利用不可
- クロスオリジン iframe は制約あり（同一オリジン前提で安定）
- ページリロード直後は追跡キャッシュが消えるため、対象要素を再クリックして再追跡が必要
- サイト固有実装により挿入後の表示同期が遅れる場合あり

## セキュリティ / プライバシー

- 外部送信なし（ネットワークアクセス用途の実装なし）
- 入力本文をログに出さない方針
- 利用権限は最小化（`storage`, `tabs`）

## ライセンス

MIT License。詳細は `LICENSE` を参照してください。
