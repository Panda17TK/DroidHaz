import { TILE } from '../core/constants.js';
import { CONFIG } from '../core/config.js';
import { norm, moveAndCollide, rectInter, dist2 } from './physics.js';
import { buildMobGrid, forNearby } from './spatial.js';
import { addShake, spawnDeathFX, addSlowmo, spawnBleedFX } from './fx.js';
import { runAttacks, updateMobActions } from './attacks.js';
import { tickStatus } from './status.js';
// mob 生成はデータ駆動の enemies.js に一本化。後方互換のため re-export。
import { makeMobFromKey, makeZombie, makeSpitter } from './enemies.js';
export { makeMobFromKey, makeZombie, makeSpitter };

// 敵撃破時のドロップ（CONFIG.drops で確率・量を制御）
function dropLoot(state, x, y, isElite) {
  const items = state.items;
  const d = CONFIG.drops;
  const am = ((state.player.mods && state.player.mods.ammoMul) || 1) * (d.ammoMulBase || 1);
  const r = Math.random();
  if (r < d.ammo9Chance) items.push({ type: 'ammo9', x, y, amt: Math.round((10 + (Math.random() * 10 | 0)) * am) });
  else if (r < d.ammo9Chance + d.ammo12Chance) items.push({ type: 'ammo12', x, y, amt: Math.max(1, Math.round((2 + (Math.random() * 3 | 0)) * am)) });
  if (Math.random() < d.ammoBeamChance) items.push({ type: 'ammoBeam', x: x + 4, y, amt: 1 });
  if (Math.random() < d.ammoNadeChance) items.push({ type: 'ammoNade', x: x - 4, y, amt: 1 });
  if (Math.random() < d.medChance) items.push({ type: 'med', x, y: y + 4, heal: 20 });
  if (Math.random() < d.buffSpeedChance) items.push({ type: 'buffSpeed', x, y });
  if (Math.random() < d.buffMeleeChance) items.push({ type: 'buffMelee', x, y });
  if (Math.random() < d.crateChance) items.push({ type: 'crate', x, y });
  // 刀の解放ドロップ（まれ）。未所持のときだけ抽選する。
  const mw = state.player && state.player.meleeWeapons;
  if (mw && mw.indexOf('katana') === -1 && Math.random() < (d.katanaChance || 0)) {
    items.push({ type: 'katana', x: x + 2, y: y - 2 });
  }
  // 中ボス/ボスは確定で補給クレートを複数ドロップ
  if (isElite) { const n = d.bossCrateBonus || 3; for (let i = 0; i < n; i++) items.push({ type: 'crate', x: x + (Math.random() * 20 - 10), y: y + (Math.random() * 20 - 10) }); }
}

// ====== Helpers ======
function isSolid(state, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= state.dim.w || ty >= state.dim.h) return true;
  const c = state.map[ty][tx];
  return c === '#' || c === 'D' || c === 'O';
}
function hasLineOfSight(state, x0, y0, x1, y1) {
  let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE);
  const tx = Math.floor(x1 / TILE), ty = Math.floor(y1 / TILE);
  const dx = Math.sign(tx - cx), dy = Math.sign(ty - cy);
  const nx = Math.abs(tx - cx), ny = Math.abs(ty - cy);
  let err = nx - ny, steps = 0;
  while (!(cx === tx && cy === ty)) {
    if (isSolid(state, cx, cy)) return false;
    const e2 = 2 * err;
    if (e2 > -ny) { err -= ny; cx += dx; }
    if (e2 < nx) { err += nx; cy += dy; }
    if (++steps > 600) break;
  }
  return true;
}

// その敵が「カイト型（距離を取る）」か：shot 系の攻撃を持つ通常敵
function isKiter(m) {
  const atks = m.def && m.def.attacks;
  if (!atks) return false;
  return m.tier === 'normal' && atks.some((a) => a.type === 'shot' && a.kite);
}

// ====== Main ======
export function updateAI(state, dt, bus/*, audio */) {
  const p = state.player;
  const mobs = state.mobs;

  // 近傍探索用グリッド（main.js が各フレーム先頭で構築）。未構築なら保険で作る。
  if (!state.mobGrid) state.mobGrid = buildMobGrid(state);

  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.hp <= 0) {
      state.stats.kills = (state.stats.kills | 0) + 1;
      const heal = (p.mods && p.mods.healOnKill) || 0;
      if (heal) p.hp = Math.min(p.hpMax || 100, p.hp + heal);
      const isElite = (m.tier === 'midboss' || m.tier === 'boss');
      // 死亡演出：破片飛散＋汚れ＋フラッシュ（エリートは派手に＋画面揺れ）
      spawnDeathFX(state, m.x, m.y, m.color, isElite);
      if (isElite) {
        addShake(state, 0.25, 8);
        // ボスは長め＆強めのスロー、中ボスは控えめ
        addSlowmo(state, m.tier === 'boss' ? 1.1 : 0.6, m.tier === 'boss' ? 0.18 : 0.3);
        state.killCam = { x: m.x, y: m.y, t: 0, life: m.tier === 'boss' ? 1.1 : 0.6, boss: m.tier === 'boss' };
      }
      if (bus && bus.emit) bus.emit('sfx', isElite ? 'boom' : 'break');
      dropLoot(state, m.x, m.y, isElite);
      mobs.splice(i, 1);
      continue;
    }

    // 減衰・タイマ
    m.vx *= Math.pow(0.02, dt);
    m.vy *= Math.pow(0.02, dt);
    if (m.bumpCD > 0) m.bumpCD -= dt;
    if (m.hitFlash > 0) m.hitFlash -= dt;
    if (m.fireFlash > 0) m.fireFlash -= dt;
    if (m.enrageT > 0) m.enrageT -= dt;
    if (m.guardT > 0) m.guardT -= dt;

    // 状態異常（出血DoT/減速・怯み）。出血中は赤い飛沫を散らす。
    const st = tickStatus(m, dt, CONFIG.melee && CONFIG.melee.status);
    if (m.bleedT > 0 && Math.random() < dt * 6) spawnBleedFX(state, m.x, m.y, 1);

    // スタック検出
    const moved = Math.hypot(m.x - (m.prevX || m.x), m.y - (m.prevY || m.y));
    if (moved < 0.2) m.stuckT = (m.stuckT || 0) + dt; else m.stuckT = 0;

    // 速度：HP半減で減速、狂乱で加速。ボスは減速しない。
    const slow = (m.tier === 'normal' && m.hp <= (m.maxhp || m.hp) * 0.5) ? CONFIG.ai.hpSlowMul : 1;
    const enr = (m.enrageT > 0) ? (m.enrageMul || 1.6) : 1;
    // 怯み中は移動停止、出血中は減速（st.slowMul）。
    let eff = (m.baseSpeed || 60) * slow * enr * st.slowMul;
    if (st.stunned) eff = 0;

    const dx = p.x - m.x, dy = p.y - m.y;
    const dist = Math.hypot(dx, dy);
    const see = dist < (m.seeRange || 240) && hasLineOfSight(state, m.x, m.y, p.x, p.y);
    m._see = see;

    // 溜め中／縮地中は通常移動・分離を止める（行動を最優先）
    if (m._charge || m._blink) {
      updateMobActions(state, m, dt, bus, CONFIG);
      m.prevX = m.x; m.prevY = m.y;
      continue;
    }

    // ===== 分離（近傍グリッド＋平方距離）=====
    let sepX = 0, sepY = 0, sepN = 0;
    const sepRadius = CONFIG.ai.sepRadius;
    const sepR2 = sepRadius * sepRadius;
    forNearby(state.mobGrid, m.x, m.y, sepRadius, (o) => {
      if (o === m || o.hp <= 0) return;
      const d2 = dist2(m.x, m.y, o.x, o.y);
      if (d2 > 0 && d2 < sepR2) {
        const d = Math.sqrt(d2);
        const w = (sepRadius - d) / sepRadius;
        sepX += ((m.x - o.x) / d) * w; sepY += ((m.y - o.y) / d) * w; sepN++;
      }
    });
    if (sepN) { const v = norm(sepX, sepY); m.vx += v.x * eff * 0.5; m.vy += v.y * eff * 0.5; }

    // ===== 移動 =====
    let moveX = 0, moveY = 0;
    if (isKiter(m) && see) {
      // カイト：見えている時は距離を取る
      const away = norm(dx, dy);
      moveX -= away.x * eff * dt; moveY -= away.y * eff * dt;
      if (away.x || away.y) { m.faceX = -away.x; m.faceY = -away.y; }
    } else {
      // フローフィールド追従（団子防止に分離込み）
      const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
      let here = Infinity;
      if (state.flow[ty] && typeof state.flow[ty][tx] !== 'undefined') here = state.flow[ty][tx];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let best = Infinity, dirx = 0, diry = 0;
      for (let k = 0; k < 4; k++) {
        const nx = tx + dirs[k][0], ny = ty + dirs[k][1];
        if (nx < 0 || ny < 0 || nx >= state.dim.w || ny >= state.dim.h) continue;
        if (isSolid(state, nx, ny)) continue;
        const v = state.flow[ny] ? state.flow[ny][nx] : Infinity;
        if (v < best) { best = v; dirx = dirs[k][0]; diry = dirs[k][1]; }
      }
      if (best < here && best < Infinity) {
        const v = norm(dirx, diry);
        moveX += v.x * eff * dt; moveY += v.y * eff * dt;
        if (v.x || v.y) { m.faceX = v.x; m.faceY = v.y; }
      } else if (see) {
        const v = norm(dx, dy);
        moveX += v.x * eff * dt; moveY += v.y * eff * dt;
        if (v.x || v.y) { m.faceX = v.x; m.faceY = v.y; }
      } else {
        const a = Math.random() * Math.PI * 2;
        const walk = m.stuckT > 0.7 ? CONFIG.ai.wanderStuck : CONFIG.ai.wanderSlow;
        moveX += Math.cos(a) * eff * walk * dt; moveY += Math.sin(a) * eff * walk * dt;
      }
    }

    if (m.stuckT > 1.0) {
      const a = Math.random() * Math.PI * 2;
      m.vx += Math.cos(a) * 80; m.vy += Math.sin(a) * 80; m.stuckT = 0;
    }

    moveAndCollide(state, m, moveX + m.vx * dt, 0);
    moveAndCollide(state, m, 0, moveY + m.vy * dt);

    // 接触ノックバック
    if (rectInter(m, p) && (!m.bumpCD || m.bumpCD <= 0)) {
      const n = norm(p.x - m.x, p.y - m.y);
      if (p.isDashing) { m.vx -= n.x * 380; m.vy -= n.y * 380; }
      else { p.vx += n.x * 260; p.vy += n.y * 260; m.vx -= n.x * (m.contactKB || 220); m.vy -= n.y * (m.contactKB || 220); }
      m.bumpCD = 0.28;
    }

    // ===== データ駆動の攻撃 =====（怯み中は攻撃も中断）
    if (!st.stunned) runAttacks(state, m, dt, bus, CONFIG);
    // 溜め近接・縮地・回避クールダウンなど、複数フレーム行動を進める
    updateMobActions(state, m, dt, bus, CONFIG);

    m.prevX = m.x; m.prevY = m.y;
  }
}
