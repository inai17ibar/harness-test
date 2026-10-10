#!/usr/bin/env node
// ============================================================================
// [3/3] Publish — 重複排除と issue 起票。LLM を使わない決定的な段。
// ============================================================================
// DRY_RUN=true (既定) のときは 1 件も起票せず、起票予定をレポートに出すだけ。
// 数日 DRY_RUN で中身を確認してから DRY_RUN=false にすること。
import path from 'node:path';
import {
  DISCOVERED_LABEL,
  FINGERPRINT_MARKER,
  PRIORITIES,
  PRIORITY_LABELS,
  TYPE_LABELS,
  appendSummary,
  extractFingerprint,
  gh,
  ghPaginate,
  readJson,
  repoRoot,
  repoSlug,
  setOutput,
  truncate,
  writeJson,
} from './lib.mjs';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MAX_ISSUES = Number(process.env.DISCOVERY_MAX_ISSUES ?? 5);
const MIN_CONFIDENCE = Number(process.env.DISCOVERY_MIN_CONFIDENCE ?? 0.6);

async function main() {
  const root = repoRoot();
  const findingsFile = process.env.DISCOVERY_FINDINGS ?? path.join(root, '.discovery', 'findings.json');
  const reportFile = process.env.DISCOVERY_REPORT ?? path.join(root, '.discovery', 'report.json');

  const input = await readJson(findingsFile);
  const findings = input.findings ?? [];

  const rejected = [];
  let candidates = findings.filter((f) => {
    if (f.confidence < MIN_CONFIDENCE) {
      rejected.push({ fingerprint: f.fingerprint, title: f.title, reason: `confidence ${f.confidence} < ${MIN_CONFIDENCE}` });
      return false;
    }
    if (!TYPE_LABELS.includes(f.type) || !PRIORITIES.includes(f.priority)) {
      rejected.push({ fingerprint: f.fingerprint, title: f.title, reason: `未知のラベル type=${f.type} priority=${f.priority}` });
      return false;
    }
    return true;
  });

  // collect からここまでの間に誰かが同じ issue を立てている可能性があるので再照合する。
  if (process.env.GITHUB_TOKEN) {
    const existing = await existingFingerprints();
    candidates = candidates.filter((f) => {
      if (!existing.has(f.fingerprint)) return true;
      rejected.push({
        fingerprint: f.fingerprint,
        title: f.title,
        reason: `既存 issue #${existing.get(f.fingerprint)} と同一指紋`,
      });
      return false;
    });
  }

  candidates.sort(
    (a, b) =>
      PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
      b.confidence - a.confidence,
  );

  const deferred = candidates.slice(MAX_ISSUES);
  const toCreate = candidates.slice(0, MAX_ISSUES);

  const created = [];
  for (const finding of toCreate) {
    if (DRY_RUN) {
      created.push({ ...summarize(finding), dry_run: true });
      continue;
    }
    const issue = await gh(`/repos/${repoSlug()}/issues`, {
      method: 'POST',
      body: {
        title: truncate(finding.title, 240),
        body: issueBody(finding),
        labels: labelsFor(finding),
      },
    });
    created.push({ ...summarize(finding), number: issue.number, url: issue.html_url });
    console.log(`[publish] #${issue.number} 起票: ${finding.title}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    repo: input.repo,
    model: input.model,
    usage: input.usage,
    thresholds: { max_issues: MAX_ISSUES, min_confidence: MIN_CONFIDENCE },
    created,
    deferred: deferred.map(summarize),
    rejected,
    signals_deferred_to_next_run: input.signals_deferred ?? 0,
  };

  await writeJson(reportFile, report);
  await appendSummary(renderSummary(report));

  console.log(
    `[publish] ${DRY_RUN ? '[DRY RUN] 起票予定' : '起票'} ${created.length} 件 / ` +
      `上限超過で見送り ${deferred.length} 件 / 条件外 ${rejected.length} 件`,
  );
  if (DRY_RUN) {
    console.log('[publish] DRY_RUN=true のため GitHub への書き込みは行っていません');
  }
  await setOutput('created_count', String(DRY_RUN ? 0 : created.length));
}

function labelsFor(finding) {
  return [DISCOVERED_LABEL, 'needs-triage', finding.type, PRIORITY_LABELS[finding.priority]];
}

/**
 * issue 本文。末尾の指紋コメントが重複排除の鍵なので、必ず埋め込む。
 * harness-ready を人間だけが付ける運用なので、そのことを本文に明記しておく。
 */
function issueBody(finding) {
  const signal = finding.signal ?? {};
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;

  return [
    finding.body.trim(),
    '',
    '---',
    '',
    '<details><summary>検出の詳細 (自動生成)</summary>',
    '',
    `- 検出ルール: \`${signal.rule_id ?? 'unknown'}\` (コレクタ: \`${signal.collector ?? 'unknown'}\`)`,
    `- 対象: \`${signal.target ?? 'unknown'}\`${signal.symbol ? ` / \`${signal.symbol}\`` : ''}`,
    `- 判定理由: ${finding.rationale}`,
    `- confidence: ${finding.confidence}`,
    '',
    '収集された事実:',
    '',
    '```json',
    JSON.stringify(signal.evidence ?? {}, null, 2),
    '```',
    '',
    '</details>',
    '',
    '> この issue は自動発見パイプラインが起票しました。内容は未レビューです。',
    '> 自動実装 harness に流す場合は、人間が内容を確認した上で `harness-ready` ラベルを付けてください。',
    '> 誤検出だった場合は `wontfix` を付けて close すると、同じ指摘は二度と起票されません。',
    '',
    `<!-- ${FINGERPRINT_MARKER}: ${finding.fingerprint} -->`,
    `<!-- discovery-model: ${process.env.DISCOVERY_MODEL ?? 'claude-haiku-4-5'} -->`,
    runUrl ? `<!-- discovery-run: ${runUrl} -->` : null,
  ]
    // null は「省略した任意行」。空文字列は Markdown の段落区切りなので落とさない。
    .filter((line) => line !== null)
    .join('\n');
}

async function existingFingerprints() {
  const slug = repoSlug();
  const issues = await ghPaginate(
    `/repos/${slug}/issues?state=all&labels=${encodeURIComponent(DISCOVERED_LABEL)}`,
  );
  const map = new Map();
  for (const issue of issues) {
    const fingerprint = extractFingerprint(issue.body);
    if (fingerprint && !map.has(fingerprint)) map.set(fingerprint, issue.number);
  }
  return map;
}

function summarize(finding) {
  return {
    fingerprint: finding.fingerprint,
    title: finding.title,
    type: finding.type,
    priority: finding.priority,
    confidence: finding.confidence,
    labels: labelsFor(finding),
  };
}

function renderSummary(report) {
  const lines = [
    `## 自動発見パイプライン ${report.dry_run ? '(DRY RUN — 起票していません)' : ''}`,
    '',
    `モデル: \`${report.model ?? 'n/a'}\` / ` +
      `入力 ${report.usage?.input_tokens ?? 0} tokens / 出力 ${report.usage?.output_tokens ?? 0} tokens`,
    '',
  ];

  if (report.created.length > 0) {
    lines.push(`### ${report.dry_run ? '起票予定' : '起票した issue'} (${report.created.length})`, '');
    lines.push('| 優先度 | 種別 | タイトル | confidence |', '|---|---|---|---|');
    for (const c of report.created) {
      const title = c.url ? `[#${c.number} ${c.title}](${c.url})` : c.title;
      lines.push(`| ${c.priority} | ${c.type} | ${title} | ${c.confidence} |`);
    }
    lines.push('');
  } else {
    lines.push('起票対象はありませんでした。', '');
  }

  if (report.deferred.length > 0) {
    lines.push(`### 上限 ${report.thresholds.max_issues} 件を超えたため次回へ見送り (${report.deferred.length})`, '');
    for (const d of report.deferred) lines.push(`- ${d.priority} ${d.title}`);
    lines.push('');
  }

  if (report.rejected.length > 0) {
    lines.push(`### 条件を満たさず破棄 (${report.rejected.length})`, '');
    for (const r of report.rejected) lines.push(`- ${r.title} — ${r.reason}`);
    lines.push('');
  }

  return lines.join('\n');
}

await main();
