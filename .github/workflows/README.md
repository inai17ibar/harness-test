# Claude Dev Harness — GitHub Actions

このディレクトリには Claude Dev Harness と連携する 4 つのワークフローがあります。

## ワークフロー

| ファイル | 役割 |
|---|---|
| `ci.yml` | PR時にテスト・lint実行 |
| `label-harness-prs.yml` | `agent/*` `ccx/*` ブランチのPRに `harness-bot` ラベル付与 |
| `auto-merge.yml` | `harness-bot` ラベル付きPRをCI通過で自動マージ |
| `cleanup-branches.yml` | 毎日 3時(JST) にマージ済みブランチを削除 |

## セットアップ

### 1. ファイルを配置

```bash
cp -r .github/workflows your-repo/.github/
git add .github/workflows
git commit -m "ci: add Claude Dev Harness workflows"
git push
```

### 2. ラベルを作成

```bash
gh label create harness-bot \
  --description "PR created by Claude Dev Harness" \
  --color 8B5CF6
```

### 3. リポジトリ設定

GitHub の Settings → Actions → General で:
- "Workflow permissions" を **Read and write permissions** に
- "Allow GitHub Actions to create and approve pull requests" にチェック

Settings → Branches で main/master のブランチ保護:
- "Require status checks to pass before merging" にチェック
- Status check に `test` (CIジョブ名) を追加
- "Allow auto-merge" にチェック

### 4. 動作確認

```bash
# Harness経由でPR作成
spawn-agents --merge 1

# GitHub上で確認
# 1. PR作成
# 2. harness-bot ラベル自動付与
# 3. CIが走る
# 4. 通過したら自動マージ
# 5. ブランチ自動削除
```

## 完全自動化フロー

```
ユーザ: spawn-agents --merge 10 11 12
   ↓
Claude エージェントが並行実装 + コミット
   ↓
spawn-agents が PR作成
   ↓
GitHub Actions: harness-bot ラベル付与
   ↓
GitHub Actions: CI実行 (テスト・lint)
   ↓
GitHub Actions: 自動マージ (CI通過後)
   ↓
GitHub Actions: ブランチ削除
   ↓
ユーザ: 何もしなくていい (Slack通知だけ届く)
```

## トラブル

| 症状 | 原因 | 対処 |
|---|---|---|
| auto-mergeが動かない | ブランチ保護未設定 | Settings → Branches で必須チェック設定 |
| CI失敗 | テストが書かれていない | `package.json` に `test` スクリプト追加 |
| ラベルが付かない | ラベル未作成 | `gh label create harness-bot` |
| Actions に権限がない | デフォルト権限が読み取りのみ | Settings → Actions → "Read and write" |
