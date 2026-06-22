// webapp/js/systems/combat-core.js
// combat 系モジュール（combat/melee/projectiles）が共有する小さなヘルパ群。
// ここに置くことで循環 import を避ける。

import { norm } from './physics.js';
import { spawnSparksFX, spawnDamageNumber, spawnDodgeFX } from './fx.js';

// 敵にダメージ＋ノックバック＋被弾フラッシュ＋（任意で）ダメージ数字。
// 回避(dodge)・ガード(guard)を一元的に反映する単一チョークポイント。
export function hurtMob(state, m, dmg, nx, ny, kb, opts) {
  opts = opts || {};
  // 回避：被弾の瞬間にごく低確率で発動。発動中は当たり判定が消え、白く点滅。
  if (m.dodgeT > 0) { spawnDodgeFX(state, m.x, m.y); return false; }
  const dg = m.def && m.def.dodge;
  if (dg && dg.chance > 0 && (m.dodgeCDLeft || 0) <= 0 && Math.random() < dg.chance) {
    m.dodgeT = dg.duration || 0.15;
    m.dodgeCDLeft = dg.cd || 1.5;
    spawnDodgeFX(state, m.x, m.y);
    return false;
  }
  // ガード態勢：被ダメージ軽減
  if (m.guardT > 0 && m.guardMul) dmg *= m.guardMul;
  m.hp -= dmg;
  if (kb) { m.vx += (nx || 0) * kb; m.vy += (ny || 0) * kb; }
  m.hitFlash = 0.12;
  spawnSparksFX(state, m.x, m.y, opts.sparks != null ? opts.sparks : 5);
  if (opts.number !== false) spawnDamageNumber(state, m.x, m.y, dmg, { crit: !!opts.crit });
  return true; // 実際にヒットした（出血/怯み付与の判定に使う）
}

// 扇形（近接の継続ヒット＆弾相殺）の内外判定
export function pointInFan(px, py, s) {
  const dx = px - s.x, dy = py - s.y;
  const d = Math.hypot(dx, dy);
  if (d > s.reach) return false;
  const ang = Math.atan2(dy, dx);
  const a = Math.abs(((ang - s.ang) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  return a <= s.arc * 0.5;
}

// 自動射撃用：射程内かつ視線の通る最寄りの敵を返す（呼び出しは1フレーム1回想定）
export { norm };
