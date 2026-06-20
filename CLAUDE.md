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
