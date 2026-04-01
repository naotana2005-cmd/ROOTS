# Notion同期スキル

ROOTSプロジェクトの直近24時間のgit変更をNotionに同期する。
各ファイルのNotionページを最新内容に更新し、変更ログDBにエントリを追記する。

## 実行手順

### Step 1: 同期スクリプト実行

以下のコマンドを実行する:

```bash
cd scripts/notion-sync && node sync-to-notion.js
```

### Step 2: 結果確認

スクリプトの出力を確認し、以下をユーザーに報告する:
- 処理したコミット数
- 更新したNotionページ数
- エラーがあればその内容

### Step 3: 未コミットの変更があれば報告

```bash
git status --porcelain
```

未コミットの変更がある場合、「以下のファイルはまだコミットされていないため同期されていません」と報告する。

## エラー対応

- `NOTION_API_TOKEN が設定されていません` → `.env` ファイルにトークンを設定するよう案内
- `config.json のIDがテンプレートのまま` → Notion側のページIDを設定するよう案内
- API エラー → エラーメッセージを表示し、Notion側の接続設定を確認するよう案内

## 前提条件

- `.env` に `NOTION_API_TOKEN` が設定済み
- `scripts/notion-sync/config.json` にNotionページIDが設定済み
- `npm install` が `scripts/notion-sync/` で実行済み
