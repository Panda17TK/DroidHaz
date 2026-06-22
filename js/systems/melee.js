// webapp/js/systems/melee.js
// プレイヤーの近接攻撃。装備中の近接武器（徒手空拳/刀）に応じてコンボ・効果を切り替える。
//  - 徒手空拳: 早い殴り＋怯み、3段目は蹴り（大ノックバック）。
//  - 刀: 振りが早く範囲が広い、連続斬りコンボ、ノックバックなし、まれに出血。

import { TILE, MELEE_SWING } from '../core/constants.js';
import { CONFIG } from '../core/config.js';
import { norm } from './physics.js';
import { forNearby } from './spatial.js';
import { damageTile } from './tiles.js';
import { hurtMob } from './combat-core.js';
import { spawnSlashFX, spawnPunchFX, spawnKickFX, spawnBleedFX } from './fx.js';
import { advanceCombo, resolveSwing, swingDir } from './melee-combo.js';

// 装備中の近接武器定義（既定は徒手空拳）。
export function equippedMelee(p) {
  const id = (p.meleeWeapons && p.meleeWeapons[p.curMelee || 0]) || 'fists';
  const W = CONFIG.melee && CONFIG.melee.weapons;
  return (W && (W[id] || W.fists)) || null;
}

export function doMelee(state, bus) {
  const p = state.player;
  const def = equippedMelee(p);
  if (!def) return;
  if ((p.sta || 0) <= 0) return; // スタミナ切れでは近接を振れない
  const mods = p.mods || { meleeMul: 1, dmg: 1 };

  // ===== コンボ段の決定（タイミングよく押すと継続）=====
  const within = (p.meleeComboT || 0) > 0;
  const sameWeapon = p._meleeComboId === def.id;
  const step = advanceCombo(p.meleeCombo || 0, def.combo, within, sameWeapon);
  const sw = resolveSwing(def, step);

  // スタミナ消費（蹴り＝フィニッシャは多め）
  const staCost = (sw.finisher ? 1.6 : 1) * (def.staCost || 7);
  p.sta = Math.max(0, p.sta - staCost);

  // クールダウン＆コンボ受付・描画ヒントを更新
  p.meleeCD = def.cd;
  p.meleeCombo = step;
  p.meleeComboT = def.comboWindow;
  p._meleeComboId = def.id;
  p.meleeT = MELEE_SWING;
  p.meleeKind = def.kind;
  p.meleeStep = step;
  p.meleeFinisher = !!sw.finisher;
  p.meleeDir = swingDir(step);

  const reach = sw.reach * p.buffs.range;
  const arc = sw.arc;
  const faceAng = Math.atan2(p.facing.y, p.facing.x);
  const dmg = Math.round(sw.dmg * p.buffs.dmg * mods.meleeMul);
  const kb = sw.kb;

  // 踏み込み（モーション）：振りに合わせて前方へステップする速度インパルス
  const lunge = sw.finisher ? ((def.finisher && def.finisher.lunge) || def.lunge || 0) : (def.lunge || 0);
  if (lunge) { p.vx += Math.cos(faceAng) * lunge; p.vy += Math.sin(faceAng) * lunge; }

  bus.emit('sfx', 'melee');

  // 見た目：刀は剣閃、徒手空拳は殴り／蹴りの衝撃。
  const cx = p.x + Math.cos(faceAng) * reach * 0.55;
  const cy = p.y + Math.sin(faceAng) * reach * 0.55;
  if (def.kind === 'blade') spawnSlashFX(state, p.x, p.y, faceAng, p.meleeDir);
  else if (sw.finisher) spawnKickFX(state, cx, cy, faceAng);
  else spawnPunchFX(state, cx, cy, faceAng);

  // ===== 即時ヒット（扇内の敵）=====
  const status = (CONFIG.melee && CONFIG.melee.status) || {};
  const maxReach = reach + 24;
  const meleeHit = (m) => {
    if (m.hp <= 0) return;
    const dx = m.x - p.x, dy = m.y - p.y; const d = Math.hypot(dx, dy);
    if (d < reach + Math.max(m.w, m.h) / 2) {
      const ang = Math.atan2(dy, dx) - faceAng;
      const a = Math.abs((ang + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (a <= arc / 2) {
        const n = norm(dx, dy);
        const landed = hurtMob(state, m, dmg, n.x, n.y, kb, { sparks: sw.finisher ? 7 : 4 });
        if (landed) {
          // 刀：まれに出血。徒手空拳：怯み（蹴りは長め）。
          if (def.kind === 'blade' && def.bleedChance && Math.random() < def.bleedChance) {
            m.bleedT = status.bleedDur || 10;
            spawnBleedFX(state, m.x, m.y);
          }
          if (def.kind === 'fist' && sw.stagger > 0) {
            m.stunT = Math.max(m.stunT || 0, sw.stagger);
          }
        }
      }
    }
  };
  if (state.mobGrid) forNearby(state.mobGrid, p.x, p.y, maxReach, meleeHit);
  else for (const m of state.mobs) meleeHit(m);

  // ===== 壁破壊（前方3x3）=====
  const ftx = Math.floor((p.x + p.facing.x * 22) / TILE);
  const fty = Math.floor((p.y + p.facing.y * 22) / TILE);
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const tx = ftx + ox, ty = fty + oy;
      if (tx < 0 || ty < 0 || tx >= state.dim.w || ty >= state.dim.h) continue;
      if (state.map[ty][tx] === '#') damageTile(state, tx, ty, dmg);
    }
  }

  // ===== 継続扇（弱）＆敵弾相殺は projectiles.updateSlashes が処理 =====
  state.slashes.push({
    x: p.x, y: p.y, ang: faceAng,
    t: 0, life: 0.30, reach: reach, arc: arc,
    tickInt: 0.07, tick: 0,
    dmg: Math.round(CONFIG.player.meleeSlashDmg * p.buffs.dmg * mods.meleeMul),
  });
}
