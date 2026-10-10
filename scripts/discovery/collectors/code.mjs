// コード静的解析コレクタ。src/ の実装とテストの構造だけを見る決定的なルール群。
// LLM は一切使わない。ここで出すのは「事実」のみで、優先度の最終判断は judge に任せる。
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const id = 'code';
export const enabled = true;
export const description = 'src/ の構造・コメント・ガード節の静的解析';

const SRC = 'src';
const TODO_PATTERN = /(?:\/\/|\/\*|\*)\s*(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/i;

export default async function collect({ repoRoot }) {
  const signals = [];
  const srcDir = path.join(repoRoot, SRC);

  let names;
  try {
    names = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return signals;
    throw err;
  }

  const implNames = names.filter((f) => !f.endsWith('.test.js'));
  const testNames = new Set(names.filter((f) => f.endsWith('.test.js')));

  for (const f of implNames) {
    const expected = f.replace(/\.js$/, '.test.js');
    if (!testNames.has(expected)) {
      signals.push({
        rule_id: 'missing-test',
        target: `${SRC}/${f}`,
        severity_hint: 'P1',
        summary: `実装 ${SRC}/${f} に対応するテスト ${SRC}/${expected} が存在しない`,
        evidence: { expected_test: `${SRC}/${expected}` },
      });
    }
  }

  for (const t of testNames) {
    const expected = t.replace(/\.test\.js$/, '.js');
    if (!implNames.includes(expected)) {
      signals.push({
        rule_id: 'orphan-test',
        target: `${SRC}/${t}`,
        severity_hint: 'P1',
        summary: `テスト ${SRC}/${t} に対応する実装 ${SRC}/${expected} が存在しない`,
        evidence: { expected_impl: `${SRC}/${expected}` },
      });
    }
  }

  // 本文を読むルール群
  const bodies = new Map();
  for (const f of names) {
    bodies.set(f, await readFile(path.join(srcDir, f), 'utf8'));
  }

  const exportsByFile = new Map();
  for (const [f, src] of bodies) {
    exportsByFile.set(f, parseExports(src));

    src.split(/\r?\n/).forEach((line, i) => {
      const m = line.match(TODO_PATTERN);
      if (!m) return;
      signals.push({
        rule_id: 'todo-comment',
        target: `${SRC}/${f}`,
        symbol: `L${i + 1}`,
        severity_hint: 'P2',
        summary: `${m[1].toUpperCase()} コメントが残っている: ${SRC}/${f}:${i + 1}`,
        evidence: { kind: m[1].toUpperCase(), line: i + 1, text: m[2].trim().slice(0, 160) },
      });
    });
  }

  signals.push(...unguardedDivisors(exportsByFile));
  signals.push(...duplicateBodies(exportsByFile));
  signals.push(...undocumentedExports(bodies, exportsByFile));

  return signals;
}

/** `export function f(a, b) {...}` と `export const f = (a, b) => ...` を拾う。 */
function parseExports(src) {
  const found = [];

  for (const m of src.matchAll(/export\s+function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
    const body = braceBody(src, src.indexOf('{', m.index + m[0].length));
    found.push({ name: m[1], params: splitParams(m[2]), body, index: m.index });
  }

  for (const m of src.matchAll(
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\(?([^)=>]*)\)?\s*=>\s*/g,
  )) {
    const after = src.slice(m.index + m[0].length);
    const body = after.startsWith('{')
      ? braceBody(src, src.indexOf('{', m.index + m[0].length))
      : after.split(/;|\n/)[0];
    found.push({ name: m[1], params: splitParams(m[2]), body, index: m.index });
  }

  return found;
}

function splitParams(raw) {
  return raw
    .split(',')
    .map((p) => p.trim().replace(/[=:].*$/, '').trim())
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
}

function braceBody(src, open) {
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

/**
 * 引数で割る / 剰余を取るのに、ゼロ除算のガードが見当たらない関数。
 * ガードありと見なす条件: throw がある、または引数名に触れる if / 三項 / 短絡がある。
 * (divide.js のように既にガードがある関数は出さず、modulo.js のような
 *  同種の関数間の不統一だけを拾うことを狙っている)
 */
function unguardedDivisors(exportsByFile) {
  const signals = [];
  for (const [f, fns] of exportsByFile) {
    if (f.endsWith('.test.js')) continue;
    for (const fn of fns) {
      const divisors = new Set(
        [...fn.body.matchAll(/[/%]\s*([A-Za-z_$][\w$]*)/g)]
          .map((m) => m[1])
          .filter((name) => fn.params.includes(name)),
      );
      if (divisors.size === 0) continue;

      const guarded =
        /\bthrow\b/.test(fn.body) ||
        [...divisors].some((p) =>
          new RegExp(`(\\bif\\s*\\(|\\?\\?|\\|\\||&&|\\?)[^\\n]*\\b${p}\\b`).test(fn.body),
        );
      if (guarded) continue;

      signals.push({
        rule_id: 'unguarded-divisor',
        target: `src/${f}`,
        symbol: fn.name,
        severity_hint: 'P1',
        summary: `${fn.name}() が引数 ${[...divisors].join(', ')} で除算/剰余を行うが 0 のガードがない`,
        evidence: { divisors: [...divisors], params: fn.params, body: fn.body.trim().slice(0, 200) },
      });
    }
  }
  return signals;
}

/** 空白とコメントを落として同一本文になる関数ペア。 */
function duplicateBodies(exportsByFile) {
  const byHash = new Map();
  for (const [f, fns] of exportsByFile) {
    if (f.endsWith('.test.js')) continue;
    for (const fn of fns) {
      const normalized = fn.body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\s+/g, '');
      if (normalized.length < 12) continue;
      const key = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
      if (!byHash.has(key)) byHash.set(key, []);
      byHash.get(key).push({ file: `src/${f}`, name: fn.name });
    }
  }

  const signals = [];
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file));
    signals.push({
      rule_id: 'duplicate-body',
      target: sorted.map((g) => g.file).join('+'),
      symbol: sorted.map((g) => g.name).join('+'),
      severity_hint: 'P2',
      summary: `本文が同一の関数が ${sorted.length} 箇所にある: ${sorted
        .map((g) => `${g.file}:${g.name}`)
        .join(', ')}`,
      evidence: { occurrences: sorted },
    });
  }
  return signals;
}

/**
 * JSDoc のない export。
 * ただし「プロジェクトが既に JSDoc を書く習慣を持っている」場合だけ報告する。
 * 一度も JSDoc を使っていないリポジトリで全 export を指摘すると初日に数十件のスパムになるため、
 * これは規約逸脱の検出であって、規約の押し付けではない。
 */
function undocumentedExports(bodies, exportsByFile) {
  const all = [];
  for (const [f, fns] of exportsByFile) {
    if (f.endsWith('.test.js')) continue;
    const src = bodies.get(f);
    for (const fn of fns) {
      const before = src.slice(0, fn.index);
      all.push({ file: `src/${f}`, name: fn.name, documented: /\*\/\s*$/.test(before) });
    }
  }
  if (all.length === 0) return [];

  const documentedRatio = all.filter((e) => e.documented).length / all.length;
  if (documentedRatio < 0.3) return [];

  return all
    .filter((e) => !e.documented)
    .map((e) => ({
      rule_id: 'undocumented-export',
      target: e.file,
      symbol: e.name,
      severity_hint: 'P3',
      summary: `${e.name}() に JSDoc がない (このリポジトリは export の ${Math.round(
        documentedRatio * 100,
      )}% に JSDoc を付けている)`,
      evidence: { documented_ratio: Number(documentedRatio.toFixed(2)) },
    }));
}
