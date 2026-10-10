// 依存とビルド設定のコレクタ。npm audit と package.json の整合性。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readTextOrNull } from '../lib.mjs';

const exec = promisify(execFile);

export const id = 'deps';
export const enabled = true;
export const description = '依存脆弱性 (npm audit) と package.json の整合性';

// CI が参照するのにプロジェクト側に無いと黙って skip されるスクリプト。
const EXPECTED_SCRIPTS = ['test', 'lint'];

export default async function collect({ repoRoot }) {
  const signals = [];

  const pkgText = await readTextOrNull(path.join(repoRoot, 'package.json'));
  if (!pkgText) return signals;
  const pkg = JSON.parse(pkgText);

  const lock =
    (await readTextOrNull(path.join(repoRoot, 'package-lock.json'))) ??
    (await readTextOrNull(path.join(repoRoot, 'npm-shrinkwrap.json')));

  const depCount =
    Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;

  if (!lock && depCount > 0) {
    signals.push({
      rule_id: 'no-lockfile',
      target: 'package.json',
      severity_hint: 'P1',
      summary: `依存が ${depCount} 件あるのに package-lock.json がない (CI が npm install にフォールバックし、ビルドが再現しない)`,
      evidence: { dependency_count: depCount },
    });
  }

  for (const name of EXPECTED_SCRIPTS) {
    if (pkg.scripts?.[name]) continue;
    const ciReferences = await ciReferencesScript(repoRoot, name);
    if (!ciReferences) continue;
    signals.push({
      rule_id: 'missing-npm-script',
      target: 'package.json',
      symbol: name,
      severity_hint: 'P2',
      summary: `CI が npm run ${name} を参照しているが package.json に ${name} スクリプトがなく、無言でスキップされている`,
      evidence: { script: name },
    });
  }

  signals.push(...(await auditSignals(repoRoot, { hasLock: Boolean(lock), depCount })));

  return signals;
}

async function ciReferencesScript(repoRoot, name) {
  const dir = path.join(repoRoot, '.github', 'workflows');
  const { readdir } = await import('node:fs/promises');
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return false;
  }
  for (const f of files) {
    const text = await readTextOrNull(path.join(dir, f));
    if (text && new RegExp(`npm run ${name}\\b|"${name}"`).test(text)) return true;
  }
  return false;
}

async function auditSignals(repoRoot, { hasLock, depCount }) {
  // lockfile が無いと npm audit は走らない。no-lockfile 側で報告済みなので黙って抜ける。
  if (!hasLock || depCount === 0) return [];

  let report;
  try {
    const { stdout } = await exec('npm', ['audit', '--json', '--audit-level=low'], {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
    });
    report = JSON.parse(stdout);
  } catch (err) {
    // 脆弱性があると npm audit は非ゼロ終了する。その場合も stdout に JSON が出ている。
    if (!err.stdout) {
      console.warn(`[deps] npm audit を実行できませんでした: ${err.message}`);
      return [];
    }
    try {
      report = JSON.parse(err.stdout);
    } catch {
      console.warn('[deps] npm audit の出力を JSON として解釈できませんでした');
      return [];
    }
  }

  const severityToPriority = { critical: 'P0', high: 'P0', moderate: 'P1', low: 'P2', info: 'P3' };
  return Object.values(report.vulnerabilities ?? {})
    .filter((v) => v.severity !== 'info')
    .map((v) => ({
      rule_id: 'dep-vulnerability',
      target: 'package.json',
      symbol: v.name,
      severity_hint: severityToPriority[v.severity] ?? 'P2',
      summary: `依存 ${v.name} に ${v.severity} の脆弱性 (${v.via
        ?.map((x) => (typeof x === 'string' ? x : x.title))
        .filter(Boolean)
        .slice(0, 2)
        .join('; ')})`,
      evidence: {
        package: v.name,
        severity: v.severity,
        range: v.range,
        fix_available: Boolean(v.fixAvailable),
        advisories: (v.via ?? [])
          .filter((x) => typeof x !== 'string')
          .map((x) => ({ title: x.title, url: x.url, cvss: x.cvss?.score }))
          .slice(0, 3),
      },
    }));
}
