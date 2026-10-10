// ドキュメントと実コードの乖離 (doc drift) を見るコレクタ。
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const id = 'docs';
export const enabled = true;
export const description = 'Markdown の記載と実ファイルの乖離';

const DOC_GLOBS = ['README.md', 'CLAUDE.md', 'docs', '.github'];
const EXT = '(?:js|mjs|cjs|ts|tsx|json|yml|yaml|md|sh)';
// バッククォートで囲まれたパス (スラッシュ無しも拾う)
const BACKTICK_PATH = new RegExp(`\`([A-Za-z0-9_.\\-/]+\\.${EXT})\``, 'g');
// 地の文やコードブロック中のパス。ディレクトリ区切りを 1 つ以上含むものだけを拾い、
// グロブ (src/**/*.js) やプレースホルダ (src/<関数名>.js) は文字種で自然に除外される。
const PLAIN_PATH = new RegExp(
  `(?:^|[\\s"'(\\[,;>])((?:[A-Za-z0-9_.\\-]+/)+[A-Za-z0-9_.\\-]+\\.${EXT})`,
  'gm',
);
const THIN_README_BYTES = 300;

export default async function collect({ repoRoot }) {
  const signals = [];
  const docs = await collectMarkdown(repoRoot);
  const ignored = await loadIgnorePatterns(repoRoot);

  for (const doc of docs) {
    const refs = extractRefs(doc.text);
    const unique = [...new Set(refs.map((r) => r.ref))];
    const docDir = path.posix.dirname(doc.rel);

    // 1. 存在しないパスを参照している。
    //    リポジトリルート基準とドキュメント自身のディレクトリ基準の両方で探す
    //    (.github/workflows/README.md の `ci.yml` は後者で解決される)。
    for (const ref of unique) {
      if (ref.includes('*')) continue;
      // .gitignore 対象は生成物 (.discovery/signals.json など)。
      // コミットされていないのは当然なので「壊れた参照」ではない。
      if (isIgnored(ref, ignored)) continue;
      if (await resolveRef(repoRoot, docDir, ref)) continue;
      signals.push({
        rule_id: 'doc-reference-missing',
        target: doc.rel,
        symbol: ref,
        severity_hint: 'P2',
        summary: `${doc.rel} が存在しないパス ${ref} を参照している`,
        evidence: { referenced_path: ref },
      });
    }

    // 2. 同じディレクトリのファイルを一部だけ列挙している (列挙が古くなっている兆候)。
    //    箇条書き・表・コードブロックに並んでいる参照だけを「列挙」と見なす。
    //    地の文で 2〜3 個のファイルに言及しただけの文章を誤検出しないため。
    const enumerated = [...new Set(refs.filter((r) => r.enumerated).map((r) => r.ref))];
    for (const [dir, dirRefs] of groupByDir(enumerated)) {
      if (dirRefs.length < 3) continue;
      const siblings = await listMatching(repoRoot, dir, dirRefs);
      if (siblings.length < 4) continue;
      const covered = dirRefs.filter((r) => siblings.includes(r)).length;
      const ratio = covered / siblings.length;
      if (ratio >= 0.5) continue;
      signals.push({
        rule_id: 'doc-drift-coverage',
        target: doc.rel,
        symbol: dir,
        severity_hint: 'P2',
        summary: `${doc.rel} が ${dir}/ のファイルを ${covered}/${siblings.length} 件しか列挙していない (${Math.round(
          ratio * 100,
        )}%)`,
        evidence: {
          directory: dir,
          listed: dirRefs.filter((r) => siblings.includes(r)),
          missing: siblings.filter((s) => !dirRefs.includes(s)).slice(0, 12),
          total: siblings.length,
        },
      });
    }
  }

  // 3. README が実質空
  const readme = docs.find((d) => d.rel === 'README.md');
  const sourceCount = (await listMatching(repoRoot, 'src', ['src/x.js'])).length;
  if (readme && readme.text.trim().length < THIN_README_BYTES && sourceCount >= 5) {
    signals.push({
      rule_id: 'readme-thin',
      target: 'README.md',
      severity_hint: 'P2',
      summary: `README.md が ${readme.text.trim().length} 文字しかないのに src/ には ${sourceCount} ファイルある`,
      evidence: { readme_bytes: readme.text.trim().length, source_files: sourceCount },
    });
  }

  return signals;
}

/**
 * Markdown からパス参照を行単位で抽出する。
 * enumerated は「箇条書き・表・コードブロックの中にある」= 一覧を書いている文脈かどうか。
 */
function extractRefs(text) {
  const refs = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const structural = inFence || /^\s*(?:[-*+]|\d+\.)\s/.test(line) || /^\s*\|/.test(line);
    const found = new Set([
      ...[...line.matchAll(BACKTICK_PATH)].map((m) => m[1]),
      ...[...line.matchAll(PLAIN_PATH)].map((m) => m[1]),
    ]);
    for (const ref of found) refs.push({ ref, enumerated: structural });
  }
  return refs;
}

async function collectMarkdown(repoRoot) {
  const out = [];
  for (const entry of DOC_GLOBS) {
    const abs = path.join(repoRoot, entry);
    const info = await statOrNull(abs);
    if (!info) continue;
    if (info.isFile() && entry.endsWith('.md')) {
      out.push({ rel: entry, text: await readFile(abs, 'utf8') });
    } else if (info.isDirectory()) {
      for (const rel of await walkMarkdown(repoRoot, entry)) {
        out.push({ rel, text: await readFile(path.join(repoRoot, rel), 'utf8') });
      }
    }
  }
  return out;
}

async function walkMarkdown(repoRoot, rel, depth = 0) {
  if (depth > 3) return [];
  const found = [];
  for (const entry of await readdir(path.join(repoRoot, rel), { withFileTypes: true })) {
    const childRel = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) found.push(...(await walkMarkdown(repoRoot, childRel, depth + 1)));
    else if (entry.name.endsWith('.md')) found.push(childRel);
  }
  return found;
}

function groupByDir(refs) {
  const map = new Map();
  for (const ref of refs) {
    const dir = path.posix.dirname(ref);
    if (dir === '.') continue;
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir).push(ref);
  }
  return map;
}

/**
 * dir 配下で、既に参照されているファイルと同じ「種類」のものを数える。
 * 種類は拡張子 + .test. を含むかで判定する — CLAUDE.md が *.test.js を列挙しているとき、
 * 実装ファイルまで母数に入れて偽の乖離を作らないため。
 */
async function listMatching(repoRoot, dir, refs) {
  const kinds = new Set(refs.map(kindOf));
  let entries;
  try {
    entries = await readdir(path.join(repoRoot, dir));
  } catch {
    return [];
  }
  return entries
    .map((name) => path.posix.join(dir, name))
    .filter((rel) => (kinds.size === 0 ? rel.endsWith('.js') : kinds.has(kindOf(rel))))
    .sort();
}

function kindOf(rel) {
  const base = path.posix.basename(rel);
  const isTest = /\.test\.[^.]+$/.test(base);
  return `${isTest ? 'test' : 'impl'}:${path.posix.extname(base)}`;
}

async function statOrNull(p) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

/**
 * .gitignore から「生成物」の判定材料を作る。
 * 対応するのは `dir/` 形式のディレクトリ指定と単純なファイル名のみ。
 * 否定 (!) やグロブを含む複雑な行は無視する — 取りこぼしても
 * 「存在しないパスを参照している」と報告されるだけで、害は小さい。
 */
async function loadIgnorePatterns(repoRoot) {
  const text = await readFile(path.join(repoRoot, '.gitignore'), 'utf8').catch(() => '');
  const dirs = [];
  const files = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!') || line.includes('*')) continue;
    if (line.endsWith('/')) dirs.push(line.replace(/^\//, ''));
    else files.push(line.replace(/^\//, ''));
  }
  return { dirs, files };
}

function isIgnored(ref, { dirs, files }) {
  const normalized = ref.replace(/^\.\//, '');
  if (dirs.some((d) => normalized.startsWith(d))) return true;
  return files.includes(normalized) || files.includes(path.posix.basename(normalized));
}

/** ref をリポジトリルートとドキュメントのディレクトリの両方から解決する。 */
async function resolveRef(repoRoot, docDir, ref) {
  const candidates = [path.join(repoRoot, ref)];
  if (docDir && docDir !== '.') candidates.push(path.join(repoRoot, docDir, ref));
  for (const c of candidates) {
    if (await statOrNull(c)) return c;
  }
  return null;
}
