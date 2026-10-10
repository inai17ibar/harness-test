# harness-test-repo

テスト駆動開発の練習用リポジトリです。

## プロジェクト構成
- `src/*.js` — 実装ファイル
- `src/*.test.js` — テストファイル (Node.js built-in test runner)

## テスト実行
```bash
node --test src/subtract.test.js   # subtract のみ
node --test src/divide.test.js     # divide のみ  
node --test src/clamp.test.js      # clamp のみ
node --test src/**/*.test.js       # 全テスト
```

## 実装ルール
- ES Modules (`export`/`import`) を使うこと
- ファイル名は `src/<関数名>.js`
- テストが通ることがゴール。既存テスト (`src/math.test.js`) を壊さないこと

## 自律的な課題発見パイプライン
リポジトリを毎日走査し、課題を優先度・種別ラベル付きの issue として自動起票する。
詳細は `docs/autonomous-issue-discovery.md`。

```bash
node scripts/discovery/collect.mjs   # [1] 事実収集 (LLM なし・API キー不要)
node scripts/discovery/judge.mjs     # [2] 分類と文章化 (Claude API を 1 回)
node scripts/discovery/publish.mjs   # [3] 重複排除と起票 (既定は DRY_RUN)
```

- 新規の指摘が 0 件なら LLM を呼ばない。変更のない日は API 課金が発生しない
- 起票は 1 回あたり最大 5 件。重複は指紋 (fingerprint) で抑止される
- `DRY_RUN=true` が既定。本番化は `.github/workflows/discover-issues.yml` で切り替える
- `harness-ready` ラベルは**人間だけが付ける**。自動実装 harness との接続点であり、
  ここを自動化すると未レビューのコード変更が master に入る
- コレクタを追加するときは、日付や件数を `target` / `symbol` に入れないこと
  (毎回別の指紋になり、同じ指摘が毎晩起票される)
