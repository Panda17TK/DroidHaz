// js/systems/autoaim.js
// REQ-CTRL-1b: 自動照準の対象選定（純関数）。
// losFn(m) は「その敵への射線が通るか」を返す注入関数（state/DOM 非依存にして
// 単体テスト可能にするため）。射線が通る敵のみを対象にし、壁越しの無駄撃ちを避ける。
//
// 優先順位:
//   ① 最寄り（距離が近い）
//   ② 射線が通る敵のみ（losFn で除外）
//   ③ 同距離なら HP の低い敵
//   ④ それも同じなら id 昇順
// 敵が一体もいなければ null（= 発射しない）。

function idOf(m) { return (typeof m.id === 'number') ? m.id : Number.POSITIVE_INFINITY; }

function isBetter(m, d2, best, bestD2) {
  const EPS = 1e-6;
  if (d2 < bestD2 - EPS) return true;
  if (d2 > bestD2 + EPS) return false;
  if (m.hp < best.hp) return true;       // 同距離 → HP 低
  if (m.hp > best.hp) return false;
  return idOf(m) < idOf(best);           // さらに同じ → id 昇順
}

export function pickAutoTarget(player, mobs, losFn, maxR) {
  if (!player || !Array.isArray(mobs)) return null;
  const R = (typeof maxR === 'number' && isFinite(maxR)) ? maxR : Infinity;
  const R2 = R * R;
  let best = null, bestD2 = Infinity;
  for (const m of mobs) {
    if (!m || m.hp <= 0) continue;
    const dx = m.x - player.x, dy = m.y - player.y, d2 = dx * dx + dy * dy;
    if (d2 > R2) continue;
    if (losFn && !losFn(m)) continue;    // 射線が通る敵のみ
    if (best === null || isBetter(m, d2, best, bestD2)) { best = m; bestD2 = d2; }
  }
  return best;
}
