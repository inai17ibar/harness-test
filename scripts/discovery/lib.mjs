// 発見パイプライン共通ユーティリティ。
// 外部依存なし (Node 22 標準 API のみ)。judge.mjs だけが @anthropic-ai/sdk を使う。
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const FINGERPRINT_MARKER = 'discovery-fingerprint';
export const DISCOVERED_LABEL = 'ai-discovered';

export const TYPE_LABELS = [
  'type:bug',
  'type:feature',
  'type:refactor',
  'type:test',
  'type:docs',
  'type:security',
  'type:chore',
];
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
export const PRIORITY_LABELS = {
  P0: 'P0:critical',
  P1: 'P1:high',
  P2: 'P2:medium',
  P3: 'P3:low',
};

/**
 * 指摘の同一性を決める指紋。rule_id + 対象パス + シンボル名のみから作るので、
 * 同じ問題は何度スキャンしても同じ指紋になる (= 重複起票を検出できる)。
 * 本文や優先度は含めない — LLM の言い回しが揺れても指紋は動かないことが重要。
 */
export function fingerprintOf({ rule_id, target, symbol }) {
  return createHash('sha256')
    .update([rule_id, target, symbol ?? ''].join('\u0000'))
    .digest('hex')
    .slice(0, 12);
}

export function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!m) throw new Error(`origin リモートから owner/repo を判定できませんでした: ${url}`);
  return m[1];
}

export function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

export async function gh(apiPath, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN が未設定です');
  const res = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'harness-discovery',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${apiPath} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function ghPaginate(apiPath, { max = 400 } = {}) {
  const out = [];
  for (let page = 1; out.length < max; page++) {
    const sep = apiPath.includes('?') ? '&' : '?';
    const batch = await gh(`${apiPath}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export function extractFingerprint(body) {
  const m = String(body ?? '').match(new RegExp(`${FINGERPRINT_MARKER}:\\s*([0-9a-f]{12})`));
  return m ? m[1] : null;
}

/**
 * 手書き設定用の極小 YAML パーサ。
 * 対応するのは「トップレベルが `- key: value` のフラットなリスト」だけ。
 * ネスト・複数行文字列・アンカー・配列値は非対応で、見つけたら例外にする
 * (黙って無視すると ignore リストが効かない事故につながるため)。
 */
export function parseListOfMaps(text, file) {
  const items = [];
  let current = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) return;
    const head = line.match(/^- {0,2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (head) {
      current = { [head[1]]: unquote(head[2]) };
      items.push(current);
      return;
    }
    const kv = line.match(/^ {2,}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv && current) {
      current[kv[1]] = unquote(kv[2]);
      return;
    }
    throw new Error(
      `${file}:${i + 1} 解釈できない行です。対応形式は "- key: value" のフラットなリストのみ: ${raw}`,
    );
  });
  return items;
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export async function readTextOrNull(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Actions の step output / step summary への出力 (ローカル実行では無視される)。 */
export async function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

export async function appendSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, { flag: 'a' });
}

export function truncate(s, max) {
  const t = String(s ?? '');
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
