import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// MEDIUM(pwa-sw): SW の手書き ASSETS が js/ の実体からドリフトすると、完全オフライン初回起動で
// 未登録モジュールの取得に失敗しゲームが起動しない（status.js / melee-combo.js がまさに欠落していた）。
// このテストで「全 js モジュールが precache 済み」を恒久的に保証する。
function walkJs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkJs(p, out);
    else if (name.endsWith('.js')) out.push('./' + p.split(/[\\/]/).join('/'));
  }
  return out;
}

test('SW ASSETS は js/ 配下の全モジュールを網羅する（オフライン整合・ドリフト防止）', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const files = walkJs('js');
  const missing = files.filter((f) => !sw.includes("'" + f + "'") && !sw.includes('"' + f + '"'));
  assert.deepEqual(missing, [], 'precache 未登録: ' + missing.join(', '));
});

// MEDIUM(pwa-sw): install 原子性と stale-while-revalidate の構造を固定する。
test('SW は CRITICAL シェルを原子的に addAll し、stale-while-revalidate を使う', () => {
  const sw = readFileSync('sw.js', 'utf8');
  // install: 重要シェルは addAll（原子的）→ 成功時のみ skipWaiting。
  assert.match(sw, /addAll\(CRITICAL\)/, 'CRITICAL を addAll している');
  assert.match(sw, /allSettled\(ASSETS/, '残りはベストエフォート(allSettled)');
  // fetch: 手動 CACHE bump 依存を解消する SWR を採用。
  assert.match(sw, /staleWhileRevalidate/, 'stale-while-revalidate を使う');
  // 旧来の「addAll(ASSETS).catch(()=>{}).then(skipWaiting)」(失敗握り潰し)が残っていない。
  assert.doesNotMatch(sw, /addAll\(ASSETS\)\s*\)\s*\.catch/, '失敗握り潰しの addAll(ASSETS) が無い');
});
