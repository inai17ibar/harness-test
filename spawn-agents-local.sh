#!/bin/bash
# spawn-agents-local.sh — gh不要のローカルテスト版
# 使い方: ./spawn-agents-local.sh 1 2 3
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREES_BASE="${HOME}/worktrees-test"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="$REPO_ROOT/.agent-logs"
mkdir -p "$LOG_DIR" "$WORKTREES_BASE"

ISSUES=("$@")
declare -a PIDS=()

echo "🚀 ${#ISSUES[@]}件のIssueを並行処理"
echo ""

for issue in "${ISSUES[@]}"; do
  # ローカルのIssueモックファイルを読む (gh の代わり)
  issue_file="$REPO_ROOT/.github/issues/${issue}.json"
  if [ ! -f "$issue_file" ]; then
    echo "❌ Issue #${issue} が見つかりません: $issue_file"
    continue
  fi

  title=$(cat "$issue_file" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
  body=$(cat  "$issue_file" | python3 -c "import sys,json; print(json.load(sys.stdin)['body'])")

  branch="agent/issue-${issue}-${TIMESTAMP}"
  worktree_path="${WORKTREES_BASE}/issue-${issue}"

  # 既存worktreeを削除
  [ -d "$worktree_path" ] && git worktree remove --force "$worktree_path" 2>/dev/null || true
  git worktree add "$worktree_path" -b "$branch" 2>/dev/null

  log_file="$LOG_DIR/issue-${issue}-${TIMESTAMP}.log"

  prompt="GitHub Issue #${issue}: ${title}

${body}

## 指示
1. テストファイルを読んで、実装すべき関数の仕様を理解してください
2. 実装ファイルを作成し、テストをすべて pass させてください
3. 既存テスト (src/math.test.js) を壊さないこと
4. 完了したら git commit -am 'fix: resolve issue #${issue}' を実行してください
5. 最後に COMPLETED:#${issue} と出力してください"

  echo "▶️  Issue #${issue}: ${title}"
  echo "   Branch: $branch"
  echo "   Log: $log_file"

  (
    cd "$worktree_path"
    echo "$prompt" | claude --headless --print 2>&1 | tee "$log_file"
  ) &
  PIDS+=($!)
done

echo ""
echo "⏳ 全エージェント完了待機中..."

for i in "${!PIDS[@]}"; do
  issue="${ISSUES[$i]}"
  if wait "${PIDS[$i]}"; then
    echo "✅ Issue #${issue} 完了"
  else
    echo "❌ Issue #${issue} 失敗 — ログ: $LOG_DIR/issue-${issue}-${TIMESTAMP}.log"
  fi
done

echo ""
echo "📊 結果確認:"
for issue in "${ISSUES[@]}"; do
  worktree="${WORKTREES_BASE}/issue-${issue}"
  if [ -d "$worktree" ]; then
    echo ""
    echo "── Issue #${issue} ──"
    git -C "$worktree" log --oneline -3
    echo "  テスト実行中..."
    (cd "$worktree" && node --test src/*.test.js 2>&1 | grep -E "^# (pass|fail)") || true
  fi
done
