// CI の実行履歴コレクタ。GitHub Actions の run 一覧から失敗率と flaky を割り出す。
// GITHUB_TOKEN が無い環境 (ローカル実行) では黙ってスキップする。
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { gh, ghPaginate, repoSlug } from '../lib.mjs';

export const id = 'ci';
export const enabled = true;
export const description = 'GitHub Actions の失敗率・flaky test・未実行ワークフロー';

const RUNS_TO_SCAN = 100;
const MIN_FAILURES = 3;
const FAILURE_RATE_THRESHOLD = 0.2;
// 追加したばかりのワークフローはまだトリガされていないのが当たり前なので、
// この日数を超えて一度も走っていないものだけを「噛み合っていない」と見なす。
const NEVER_RUN_GRACE_DAYS = 14;

export default async function collect({ repoRoot }) {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('[ci] GITHUB_TOKEN が無いためスキップします');
    return [];
  }

  const slug = repoSlug();
  const repo = await gh(`/repos/${slug}`);
  const branch = repo.default_branch;

  const runs = (
    await ghPaginate(`/repos/${slug}/actions/runs?branch=${encodeURIComponent(branch)}&event=push`, {
      max: RUNS_TO_SCAN,
    })
  ).filter((r) => r.status === 'completed');

  const signals = [];
  const byWorkflow = new Map();
  for (const run of runs) {
    if (!byWorkflow.has(run.name)) byWorkflow.set(run.name, []);
    byWorkflow.get(run.name).push(run);
  }

  for (const [name, workflowRuns] of byWorkflow) {
    const failures = workflowRuns.filter((r) => r.conclusion === 'failure');
    const rate = failures.length / workflowRuns.length;

    if (failures.length >= MIN_FAILURES && rate >= FAILURE_RATE_THRESHOLD) {
      signals.push({
        rule_id: 'ci-failure-rate',
        target: `.github/workflows (${name})`,
        symbol: name,
        severity_hint: rate >= 0.5 ? 'P0' : 'P1',
        summary: `ワークフロー "${name}" が ${branch} の直近 ${workflowRuns.length} 回のうち ${failures.length} 回失敗している (${Math.round(
          rate * 100,
        )}%)`,
        evidence: {
          workflow: name,
          branch,
          runs: workflowRuns.length,
          failures: failures.length,
          failure_rate: Number(rate.toFixed(2)),
          recent_failures: failures.slice(0, 5).map((r) => ({
            run: r.run_number,
            sha: r.head_sha.slice(0, 8),
            url: r.html_url,
            at: r.updated_at,
          })),
        },
      });
    }

    // 同一 SHA で成功と失敗が混在 = 非決定的 (flaky)
    const bySha = new Map();
    for (const r of workflowRuns) {
      if (!bySha.has(r.head_sha)) bySha.set(r.head_sha, new Set());
      bySha.get(r.head_sha).add(r.conclusion);
    }
    const flaky = [...bySha.entries()].filter(
      ([, outcomes]) => outcomes.has('failure') && outcomes.has('success'),
    );
    if (flaky.length > 0) {
      signals.push({
        rule_id: 'ci-flaky',
        target: `.github/workflows (${name})`,
        symbol: name,
        severity_hint: 'P1',
        summary: `ワークフロー "${name}" が同一コミットで成功と失敗の両方を記録している (${flaky.length} コミット) — 非決定的なテストの兆候`,
        evidence: {
          workflow: name,
          flaky_commits: flaky.map(([sha]) => sha.slice(0, 8)).slice(0, 8),
        },
      });
    }
  }

  // 一度も実行されていないワークフロー定義
  const defined = await workflowNames(repoRoot);
  const ranNames = new Set(runs.map((r) => r.path?.replace(/^\.github\/workflows\//, '')));
  const allRuns = await ghPaginate(`/repos/${slug}/actions/runs`, { max: RUNS_TO_SCAN });
  for (const r of allRuns) {
    if (r.path) ranNames.add(r.path.replace(/^\.github\/workflows\//, ''));
  }
  for (const file of defined) {
    if (ranNames.has(file)) continue;
    const ageDays = fileAgeDays(repoRoot, path.posix.join('.github/workflows', file));
    if (ageDays !== null && ageDays < NEVER_RUN_GRACE_DAYS) continue;
    signals.push({
      rule_id: 'ci-never-run',
      target: `.github/workflows/${file}`,
      severity_hint: 'P2',
      summary: `ワークフロー .github/workflows/${file} が直近 ${allRuns.length} 回の run に一度も現れない (トリガ条件が噛み合っていない可能性)`,
      evidence: {
        workflow_file: file,
        runs_scanned: allRuns.length,
        file_age_days: ageDays,
      },
    });
  }

  return signals;
}

/** ワークフローファイルが追加されてから何日経ったか。判定できなければ null。 */
function fileAgeDays(repoRoot, relPath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', relPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (!out) return null;
    return (Date.now() / 1000 - Number(out)) / 86_400;
  } catch {
    return null;
  }
}

async function workflowNames(repoRoot) {
  try {
    return (await readdir(path.join(repoRoot, '.github', 'workflows'))).filter((f) =>
      /\.ya?ml$/.test(f),
    );
  } catch {
    return [];
  }
}
