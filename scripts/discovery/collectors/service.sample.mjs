// ============================================================================
// 本番サービス向けコレクタのテンプレート (既定で無効)
// ============================================================================
// このリポジトリはライブラリなのでコード静的解析が中心だが、実サービスを監視する場合は
// このファイルをコピーして enabled: true にし、必要な収集処理を書く。
// Judge と Publish は signals の形だけを見ているので、コレクタを足すだけで動く。
//
//   cp service.sample.mjs sentry.mjs   # Sentry のエラー集計
//   cp service.sample.mjs apm.mjs      # レイテンシ劣化
//   cp service.sample.mjs support.mjs  # サポートチケットのクラスタリング
//
// 返す signal の形 (必須は rule_id / target / summary):
//
//   {
//     rule_id: 'error-spike',        // ルール識別子。指紋の一部になるので安定させる
//     target: 'api/checkout',        // 対象の識別子。パス・エンドポイント・サービス名など
//     symbol: 'TypeError',           // 任意。同じ target 内の細分化に使う
//     severity_hint: 'P0',           // 任意。judge が最終判断するので外れていてもよい
//     summary: '...',                // 1 行の事実。推測や提案は書かない
//     evidence: { ... }              // 小さな JSON。生ログは入れない (トークン代が跳ねる)
//   }
//
// 指紋は fingerprintOf({rule_id, target, symbol}) で決まる。
// 日付・件数・バージョン番号を target や symbol に入れると毎回別物として起票されるので、
// それらは必ず evidence 側に置くこと。これが重複スパムを防ぐ唯一の肝。

export const id = 'service';
export const enabled = false;
export const description = '本番サービス監視コレクタのテンプレート (無効)';

export default async function collect({ repoRoot, env }) {
  if (!env.SENTRY_TOKEN) return [];

  // 実装例 (擬似コード):
  //
  // const res = await fetch(
  //   `https://sentry.io/api/0/projects/${env.SENTRY_ORG}/${env.SENTRY_PROJECT}/issues/` +
  //     `?statsPeriod=24h&query=is:unresolved&sort=freq`,
  //   { headers: { authorization: `Bearer ${env.SENTRY_TOKEN}` } },
  // );
  // const issues = await res.json();
  //
  // return issues.slice(0, 10).map((issue) => ({
  //   rule_id: 'error-spike',
  //   target: issue.culprit,              // 安定した識別子
  //   symbol: issue.metadata?.type,
  //   severity_hint: issue.count > 1000 ? 'P0' : 'P1',
  //   summary: `${issue.metadata?.type} が ${issue.culprit} で 24h に ${issue.count} 件発生`,
  //   evidence: {
  //     events_24h: issue.count,          // 変動する数値は evidence 側に置く
  //     users_affected: issue.userCount,
  //     first_seen: issue.firstSeen,
  //     permalink: issue.permalink,
  //   },
  // }));

  return [];
}
