#!/usr/bin/env node
// ============================================================================
// [1/3] Collect — 事実収集。LLM を一切使わない決定的な段。
// ============================================================================
// collectors/ 配下のプラグインを実行して signals を集め、
// 「既に起票済み / 却下済み」の指紋を除いた新規分だけを signals.json に書く。
//
// 新規 signal が 0 件なら judge を呼ばずに終了する。これが最大のコスト削減で、
// リポジトリに変更がない日は API 課金が発生しない。
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DISCOVERED_LABEL,
  extractFingerprint,
  fingerprintOf,
  ghPaginate,
  parseListOfMaps,
  readTextOrNull,
  repoRoot,
  repoSlug,
  setOutput,
  writeJson,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// closed になった指摘を再提示しない期間。wontfix ラベル付きは無期限に抑止する。
const SUPPRESS_DAYS = Number(process.env.DISCOVERY_SUPPRESS_DAYS ?? 90);

async function main() {
  const root = repoRoot();
  const outFile = process.env.DISCOVERY_SIGNALS ?? path.join(root, '.discovery', 'signals.json');

  const collectors = await loadCollectors();
  const allow = (process.env.DISCOVERY_COLLECTORS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const raw = [];
  const collectorStatus = [];
  for (const collector of collectors) {
    const selected = allow.length > 0 ? allow.includes(collector.id) : collector.enabled;
    if (!selected) {
      collectorStatus.push({ id: collector.id, status: 'skipped' });
      continue;
    }
    try {
      const signals = await collector.run({ repoRoot: root, env: process.env });
      raw.push(...signals.map((s) => ({ ...s, collector: collector.id })));
      collectorStatus.push({ id: collector.id, status: 'ok', count: signals.length });
    } catch (err) {
      // 1 つのコレクタの失敗で実行全体を落とさない。
      console.error(`[collect] コレクタ ${collector.id} が失敗: ${err.message}`);
      collectorStatus.push({ id: collector.id, status: 'error', error: err.message });
    }
  }

  // 指紋付与 + 同一実行内の重複排除
  const byFingerprint = new Map();
  for (const signal of raw) {
    const fingerprint = fingerprintOf(signal);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, { ...signal, fingerprint });
  }

  const known = await knownFingerprints(root);
  const fresh = [...byFingerprint.values()].filter((s) => !known.suppressed.has(s.fingerprint));

  const payload = {
    generated_at: new Date().toISOString(),
    repo: process.env.GITHUB_REPOSITORY ?? safeSlug(),
    head_sha: process.env.GITHUB_SHA ?? null,
    collectors: collectorStatus,
    stats: {
      collected: raw.length,
      unique: byFingerprint.size,
      already_known: byFingerprint.size - fresh.length,
      new: fresh.length,
    },
    suppression: {
      open_issues: known.open.size,
      closed_within_days: SUPPRESS_DAYS,
      closed_issues: known.closed.size,
      wontfix: known.wontfix.size,
      ignore_file: known.fromFile.size,
    },
    signals: fresh,
  };

  await writeJson(outFile, payload);

  console.log(
    `[collect] ${raw.length} 件収集 / 重複除去後 ${byFingerprint.size} 件 / ` +
      `既知 ${payload.stats.already_known} 件を抑止 / 新規 ${fresh.length} 件`,
  );
  for (const c of collectorStatus) {
    console.log(`  - ${c.id}: ${c.status}${c.count !== undefined ? ` (${c.count})` : ''}`);
  }

  await setOutput('new_signals', String(fresh.length));
  await setOutput('signals_file', outFile);
}

async function loadCollectors() {
  const dir = path.join(HERE, 'collectors');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs')).sort();
  const loaded = [];
  for (const file of files) {
    const mod = await import(path.join(dir, file));
    if (typeof mod.default !== 'function') {
      throw new Error(`collectors/${file} が default export の関数を持っていません`);
    }
    loaded.push({
      id: mod.id ?? file.replace(/\.mjs$/, ''),
      enabled: mod.enabled !== false,
      description: mod.description ?? '',
      run: mod.default,
    });
  }
  return loaded;
}

/**
 * 既に扱った指摘の指紋を集める。抑止の根拠は 3 つ:
 *   open issue        … 対応待ち。再提示しない
 *   closed issue      … SUPPRESS_DAYS 日は再提示しない (修正済み or 判断済み)
 *   wontfix / ignore  … 無期限に抑止 (人間が「これは出すな」と決めたもの)
 * closed を永久抑止にしないのは、修正が巻き戻ったときに再検出できるようにするため。
 */
async function knownFingerprints(root) {
  const open = new Set();
  const closed = new Set();
  const wontfix = new Set();
  const fromFile = new Set();

  const ignoreText = await readTextOrNull(path.join(root, '.github', 'discovery-ignore.yml'));
  if (ignoreText) {
    for (const entry of parseListOfMaps(ignoreText, '.github/discovery-ignore.yml')) {
      if (entry.fingerprint) fromFile.add(entry.fingerprint);
    }
  }

  if (process.env.GITHUB_TOKEN) {
    try {
      const slug = repoSlug();
      const issues = await ghPaginate(
        `/repos/${slug}/issues?state=all&labels=${encodeURIComponent(DISCOVERED_LABEL)}`,
      );
      const cutoff = Date.now() - SUPPRESS_DAYS * 86_400_000;
      for (const issue of issues) {
        const fingerprint = extractFingerprint(issue.body);
        if (!fingerprint) continue;
        const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
        if (labels.includes('wontfix')) wontfix.add(fingerprint);
        else if (issue.state === 'open') open.add(fingerprint);
        else if (Date.parse(issue.closed_at ?? issue.updated_at) >= cutoff) closed.add(fingerprint);
      }
    } catch (err) {
      // 既存 issue を読めないまま起票すると重複を量産するので、ここは致命的エラーにする。
      throw new Error(`既存 issue の指紋取得に失敗しました (重複起票を避けるため中断): ${err.message}`);
    }
  } else {
    console.warn('[collect] GITHUB_TOKEN が無いため既存 issue による抑止は行いません');
  }

  return {
    open,
    closed,
    wontfix,
    fromFile,
    suppressed: new Set([...open, ...closed, ...wontfix, ...fromFile]),
  };
}

function safeSlug() {
  try {
    return repoSlug();
  } catch {
    return null;
  }
}

await main();
