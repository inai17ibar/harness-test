#!/usr/bin/env node
// .github/labels.yml を GitHub のラベルに冪等に反映する。
// 新規作成と色/説明の更新だけを行い、yml に無いラベルは削除しない
// (手で追加した運用ラベルを消してしまわないため)。
import path from 'node:path';
import { gh, ghPaginate, parseListOfMaps, readTextOrNull, repoRoot, repoSlug } from './lib.mjs';

const DRY_RUN = process.env.DRY_RUN === 'true';

const file = path.join(repoRoot(), '.github', 'labels.yml');
const text = await readTextOrNull(file);
if (!text) throw new Error('.github/labels.yml が見つかりません');

const desired = parseListOfMaps(text, '.github/labels.yml');
for (const label of desired) {
  if (!label.name) throw new Error(`.github/labels.yml に name の無いエントリがあります: ${JSON.stringify(label)}`);
}

const slug = repoSlug();
const existing = new Map(
  (await ghPaginate(`/repos/${slug}/labels`)).map((l) => [l.name, l]),
);

let created = 0;
let updated = 0;
for (const label of desired) {
  const current = existing.get(label.name);
  const body = { name: label.name, color: label.color ?? 'EDEDED', description: label.description ?? '' };

  if (!current) {
    if (DRY_RUN) console.log(`[labels] 作成予定: ${label.name}`);
    else await gh(`/repos/${slug}/labels`, { method: 'POST', body });
    created++;
  } else if (
    current.color.toLowerCase() !== body.color.toLowerCase() ||
    (current.description ?? '') !== body.description
  ) {
    if (DRY_RUN) console.log(`[labels] 更新予定: ${label.name}`);
    else
      await gh(`/repos/${slug}/labels/${encodeURIComponent(label.name)}`, {
        method: 'PATCH',
        body,
      });
    updated++;
  }
}

console.log(
  `[labels] ${desired.length} 件を同期${DRY_RUN ? ' (DRY RUN)' : ''}: ` +
    `作成 ${created} / 更新 ${updated} / 変更なし ${desired.length - created - updated}`,
);
