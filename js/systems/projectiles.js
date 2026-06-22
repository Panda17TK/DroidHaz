// webapp/js/systems/projectiles.js
// 飛翔体・継続効果の毎フレーム更新：プレイヤー弾 / グレネード / 敵弾 / 近接の継続扇 / 爆発。
// combat.js から呼ばれる。ダメージは combat-core.hurtMob に集約。

import { TILE } from '../core/constants.js';
import { CONFIG } from '../core/config.js';
import { norm } from './physics.js';
import { forNearby, findNearby } from './spatial.js';
import { damageTile } from './tiles.js';
import { hurtMob, pointInFan } from './combat-core.js';
import { spawnBlastFX, spawnSparksFX, addShake, addHitstop, recordPlayerHit } from './fx.js';

function isSolidTile(state, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return state.map[ty] && (state.map[ty][tx] === '#' || state.map[ty][tx] === 'D' || state.map[ty][tx] === 'O');
}

// プレイヤー弾
export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
    if (state.map[ty] && (state.map[ty][tx] === '#' || state.map[ty][tx] === 'D' || state.map[ty][tx] === 'O')) {
      damageTile(state, tx, ty, b.dmg);
      state.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    if (state.mobGrid) {
      const m = findNearby(state.mobGrid, b.x, b.y, 24, (mm) =>
        mm.hp > 0 && Math.abs(mm.x - b.x) < mm.w / 2 && Math.abs(mm.y - b.y) < mm.h / 2);
      if (m) {
        const n = norm(m.x - b.x, m.y - b.y);
        hurtMob(state, m, b.dmg, n.x, n.y, 160, { number: true });
        hit = true;
      }
    }
    if (hit || b.life <= 0) state.bullets.splice(i, 1);
  }
}

// グレネード
export function updateGrenades(state, dt) {
  for (let i = state.grenades.length - 1; i >= 0; i--) {
    const g = state.grenades[i];
    g.x += g.vx * dt; g.y += g.vy * dt; g.fuse -= dt;
    if (isSolidTile(state, g.x, g.y) || g.fuse <= 0) {
      explode(state, g.x, g.y);
      state.grenades.splice(i, 1);
    }
  }
}

// 敵弾（ホーミング/地雷を含む）
export function updateEnemyBullets(state, dt) {
  const p = state.player;
  for (let i = state.ebullets.length - 1; i >= 0; i--) {
    const b = state.ebullets[i];
    if (b.homing) {
      const want = Math.atan2(p.y - b.y, p.x - b.x);
      const cur = Math.atan2(b.vy, b.vx);
      const diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, diff));
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const na = cur + turn;
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    if (!b.mine) { b.x += b.vx * dt; b.y += b.vy * dt; }
    b.life -= dt;
    if ((!b.mine && isSolidTile(state, b.x, b.y)) || b.life <= 0) {
      state.ebullets.splice(i, 1);
      continue;
    }
    const hitR = b.mine ? 14 : 3;
    const hitP = (Math.abs(p.x - b.x) < p.w / 2 + hitR) && (Math.abs(p.y - b.y) < p.h / 2 + hitR);
    if (hitP) {
      if (p.isDashing) {
        const n = norm(b.x - p.x, b.y - p.y);
        b.vx = n.x * 260; b.vy = n.y * 260; b.life = Math.min(b.life, 0.9);
        continue;
      }
      if (p.iTime <= 0) {
        p.hp -= b.dmg; p.iTime = CONFIG.player.iFrameBullet;
        const n = norm(p.x - b.x, p.y - b.y);
        p.vx += n.x * 180; p.vy += n.y * 180;
        addShake(state, 0.18, 6);
        recordPlayerHit(state, b.x, b.y);
      }
      state.ebullets.splice(i, 1);
    }
  }
}

// 近接の継続扇（敵への追撃＋敵弾の相殺）
export function updateSlashes(state, dt) {
  for (let i = state.slashes.length - 1; i >= 0; i--) {
    const s = state.slashes[i];
    s.t += dt; s.tick -= dt;
    if (s.tick <= 0) {
      s.tick = s.tickInt;
      const slashHit = (m) => {
        if (m.hp > 0 && pointInFan(m.x, m.y, s)) {
          const n = norm(m.x - s.x, m.y - s.y);
          hurtMob(state, m, s.dmg, n.x, n.y, 140, { number: false, sparks: 2 });
        }
      };
      if (state.mobGrid) forNearby(state.mobGrid, s.x, s.y, s.reach + 24, slashHit);
      else for (const m of state.mobs) slashHit(m);
      for (let j = state.ebullets.length - 1; j >= 0; j--) {
        const b = state.ebullets[j];
        if (pointInFan(b.x, b.y, s)) {
          state.ebullets.splice(j, 1);
          spawnSparksFX(state, b.x, b.y, 4);
        }
      }
    }
    if (s.t >= s.life) state.slashes.splice(i, 1);
  }
}

// 爆発（グレネード/将来の自爆敵で共用）
export function explode(state, x, y) {
  const r = CONFIG.player.explodeRadius;
  const maxDmg = CONFIG.player.explodeDmg;
  const blastHit = (m) => {
    const dx = m.x - x, dy = m.y - y; const d = Math.hypot(dx, dy);
    if (d < r + Math.max(m.w, m.h) / 2) {
      const fall = 1 - d / r; const dmg = Math.round(maxDmg * fall);
      if (dmg > 0) {
        const n = norm(dx, dy);
        hurtMob(state, m, dmg, n.x, n.y, 280 * fall, { number: true, sparks: 8 });
      }
    }
  };
  if (state.mobGrid) forNearby(state.mobGrid, x, y, r + 24, blastHit);
  else for (const m of state.mobs) blastHit(m);
  addShake(state, 0.25, 11);
  addHitstop(state, 0.05);
  const dp = Math.hypot(state.player.x - x, state.player.y - y);
  if (dp < r * 0.7) {
    const fall = 1 - dp / (r * 0.7);
    state.player.hp -= Math.round(CONFIG.player.explodeSelfDmg * fall);
    recordPlayerHit(state, x, y);
    const n = norm(state.player.x - x, state.player.y - y);
    state.player.vx += n.x * 200 * fall; state.player.vy += n.y * 200 * fall;
  }
  const tx0 = Math.max(1, Math.floor((x - r) / TILE));
  const ty0 = Math.max(1, Math.floor((y - r) / TILE));
  const tx1 = Math.min(state.dim.w - 2, Math.floor((x + r) / TILE));
  const ty1 = Math.min(state.dim.h - 2, Math.floor((y + r) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d <= r && state.map[ty][tx] === '#') damageTile(state, tx, ty, 120 * (1 - d / r));
    }
  }
  spawnBlastFX(state, x, y, r);
}
