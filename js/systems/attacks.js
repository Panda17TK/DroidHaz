// webapp/js/systems/attacks.js
// データ駆動の敵攻撃タイプ。CONFIG.enemies[*].attacks の各エントリを解釈する。
// 1エントリ = { type, cd, ... }。各 mob は a._cd[i] に個別クールダウンを持つ。
//
// 攻撃の追加は REGISTRY にエントリを足すだけ。エディタは type 一覧をここから取得する。

import { norm, rectInter, clamp, moveAndCollide } from './physics.js';
import { spawnEnemySlashFX, addShake, spawnAfterimageFX, spawnSparksFX, spawnMuzzleFX, recordPlayerHit } from './fx.js';
import { makeMobFromKey } from './enemies.js';
import { currentDifficulty } from '../state/stages.js';
import { TILE } from '../core/constants.js';

// 敵→プレイヤーへの被弾処理（無敵時間・ノックバック・SE・シェイク）
function hitPlayer(state, m, dmg, kb, bus, cfg) {
  const p = state.player;
  if (p.iTime > 0) return false;
  p.hp -= dmg;
  p.iTime = (cfg && cfg.player && cfg.player.iFrameMelee) || 0.9;
  const n = norm(p.x - m.x, p.y - m.y);
  p.vx += n.x * (kb || 240); p.vy += n.y * (kb || 240);
  if (bus && bus.emit) bus.emit('sfx', 'hit');
  addShake(state, 0.18, 6);
  recordPlayerHit(state, m.x, m.y);
  return true;
}

function fireBullet(state, m, ang, speed, dmg, life) {
  state.ebullets.push({
    x: m.x, y: m.y,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    life: life || 1.6, dmg: dmg,
  });
}

// ===== 個別攻撃ハンドラ =====
// 各 handler(ctx) は「攻撃を実行できたら true」を返す。ctx は下の runAttacks が用意。
const REGISTRY = {
  // 近接：範囲(range)と扇(arc, 度) 内なら直接ダメージ
  melee(ctx) {
    const { state, m, a, dist, toP, bus, cfg } = ctx;
    if (dist >= (a.range || 14)) return false;
    if ((a.arc || 360) < 360) {
      const mv = norm(m.faceX || 0, m.faceY || 0);
      const dot = mv.x * toP.x + mv.y * toP.y;
      if (Math.acos(clamp(dot, -1, 1)) > (a.arc * Math.PI / 180) / 2) return false;
    }
    spawnEnemySlashFX(state, m.x, m.y, Math.atan2(toP.y, toP.x));
    hitPlayer(state, m, a.dmg || 10, m.contactKB || 220, bus, cfg);
    return true;
  },

  // 単発射撃（kite:true なら撃ったあと距離を取る挙動はAI側の見え方に任せる）
  shot(ctx) {
    const { state, m, a, dx, dy, see, bus } = ctx;
    if (!see) return false;
    const ang = Math.atan2(dy, dx);
    fireBullet(state, m, ang, a.speed || 220, a.dmg || 12, a.life);
    m.fireFlash = 0.12; m.faceX = Math.cos(ang); m.faceY = Math.sin(ang);
    spawnMuzzleFX(state, m.x + Math.cos(ang) * (m.w / 2), m.y + Math.sin(ang) * (m.h / 2), ang, '#b6ff9a');
    if (bus && bus.emit) bus.emit('sfx', 'shot');
    return true;
  },

  // 突進：プレイヤー方向へ強い速度を加える（接触ダメージはAIの contact 経由）
  lunge(ctx) {
    const { m, a, dist, toP, see } = ctx;
    if (!see || dist > (a.range || 90)) return false;
    m.vx += toP.x * (a.power || 360);
    m.vy += toP.y * (a.power || 360);
    return true;
  },

  // 溜め近接：windup(s) かけてテレグラフ → 実際の薙ぎ払いで強ダメージ。
  // 2フェーズを m._charge に持たせ、runAttacks のCDとは独立に進める。
  charge_melee(ctx) {
    const { state, m, a, dist, toP, see, bus, cfg } = ctx;
    // 溜め開始：射程に入って見えていれば
    if (!m._charge) {
      if (!see || dist > (a.range || 40)) return false;
      m._charge = { t: a.windup || 0.7, dir: { x: toP.x, y: toP.y } };
      if (bus && bus.emit) bus.emit('sfx', 'build'); // 溜め音
      return true; // CD 開始（連打防止）
    }
    return false;
  },

  // 縮地（ブリンク）：0.1s で最大 maxTiles マス、残像を残して瞬間移動。
  // 着地はプレイヤーの少し手前を狙う。移動は moveAndCollide で壁止まり。
  blink(ctx) {
    const { state, m, a, dist, toP, see } = ctx;
    if (!see) return false;
    if (dist < (a.minDist != null ? a.minDist : 60)) return false; // 近すぎる時は不要
    const maxTiles = a.maxTiles || 5;
    const stand = a.standoff != null ? a.standoff : 28; // 着地時にプレイヤーから取る距離
    const want = Math.max(0, Math.min(maxTiles * TILE, dist - stand));
    m._blink = { t: a.dur || 0.1, total: a.dur || 0.1, dx: toP.x * want, dy: toP.y * want, trail: 0 };
    return true;
  },

  // 連射バースト：扇状に count 発
  burst(ctx) {
    const { state, m, a, dx, dy, see, bus } = ctx;
    if (!see) return false;
    const base = Math.atan2(dy, dx);
    const count = a.count || 5;
    const spread = (a.spread || 40) * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
      fireBullet(state, m, base + t * spread, a.speed || 240, a.dmg || 8, a.life);
    }
    if (bus && bus.emit) bus.emit('sfx', 'mg');
    return true;
  },

  // 全方位弾（ボスらしさ）
  nova(ctx) {
    const { state, m, a, bus } = ctx;
    const count = a.count || 16;
    for (let i = 0; i < count; i++) {
      fireBullet(state, m, (i / count) * Math.PI * 2, a.speed || 180, a.dmg || 8, a.life);
    }
    if (bus && bus.emit) bus.emit('sfx', 'beam');
    addShake(state, 0.12, 5);
    return true;
  },

  // 雑魚召喚
  summon(ctx) {
    const { state, m, a } = ctx;
    const key = a.minion || 'zombie';
    const n = a.count || 2;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, r = 28 + Math.random() * 16;
      // REQ-STAGE-4: 召喚されたミニオンも現ステージの AI 挙動でスケールさせる
      const mob = makeMobFromKey(state, key, m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r, m.waveNum || 1, currentDifficulty(state));
      if (mob) state.mobs.push(mob);
    }
    return true;
  },

  // 地ならし：周囲に円形の衝撃（近距離のみ）
  slam(ctx) {
    const { state, m, a, dist, bus, cfg } = ctx;
    if (dist > (a.range || 70)) return false;
    hitPlayer(state, m, a.dmg || 16, a.power || 320, bus, cfg);
    addShake(state, 0.2, 8);
    return true;
  },

  // 短いチャージ後の高速突進（lunge の強化版・遠距離から）
  charge(ctx) {
    const { m, a, dist, toP, see } = ctx;
    if (!see || dist > (a.range || 220) || dist < 40) return false;
    m.vx += toP.x * (a.power || 600);
    m.vy += toP.y * (a.power || 600);
    return true;
  },

  // ホーミング弾（簡易：現在方向へ撃つが寿命が長い）
  homing(ctx) {
    const { state, m, a, dx, dy, see, bus } = ctx;
    if (!see) return false;
    const ang = Math.atan2(dy, dx);
    state.ebullets.push({
      x: m.x, y: m.y, vx: Math.cos(ang) * (a.speed || 160), vy: Math.sin(ang) * (a.speed || 160),
      life: a.life || 3.0, dmg: a.dmg || 10, homing: a.turn || 1.5,
    });
    if (bus && bus.emit) bus.emit('sfx', 'shot');
    return true;
  },

  // 自己ヒール（ボスの粘り）
  heal(ctx) {
    const { m, a } = ctx;
    if (m.hp >= m.maxhp) return false;
    m.hp = Math.min(m.maxhp, m.hp + (a.amount || 20));
    return true;
  },

  // 一時加速（狂乱）
  enrage(ctx) {
    const { m, a } = ctx;
    m.enrageT = a.duration || 3;
    m.enrageMul = a.mul || 1.6;
    return true;
  },

  // 設置型地雷
  mine(ctx) {
    const { state, m, a } = ctx;
    state.ebullets.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: a.life || 6, dmg: a.dmg || 18, mine: true });
    return true;
  },

  // 横薙ぎの広範囲弾幕
  barrage(ctx) {
    const { state, m, a, dx, dy, see, bus } = ctx;
    if (!see) return false;
    const base = Math.atan2(dy, dx);
    const count = a.count || 7, spread = (a.spread || 80) * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
      fireBullet(state, m, base + t * spread, a.speed || 200, a.dmg || 9, a.life);
    }
    if (bus && bus.emit) bus.emit('sfx', 'mg');
    return true;
  },

  // 防御態勢：短時間の被ダメ軽減
  guard(ctx) {
    const { m, a } = ctx;
    m.guardT = a.duration || 2;
    m.guardMul = a.mul || 0.4;
    return true;
  },
};

export const ATTACK_TYPES = Object.keys(REGISTRY);

// mob の攻撃配列を順に評価し、CD が明けていて条件を満たすものを実行する。
export function runAttacks(state, m, dt, bus, cfg) {
  const def = m.def;
  if (!def || !Array.isArray(def.attacks)) return;
  const p = state.player;
  const dx = p.x - m.x, dy = p.y - m.y;
  const dist = Math.hypot(dx, dy);
  const toP = norm(dx, dy);
  const see = m._see; // AI が直前に計算してセット
  if (!m._cd) m._cd = def.attacks.map(() => 0);

  const ctx = { state, m, dx, dy, dist, toP, see, bus, cfg, a: null };
  for (let i = 0; i < def.attacks.length; i++) {
    const a = def.attacks[i];
    if (m._cd[i] > 0) { m._cd[i] -= dt; continue; }
    const fn = REGISTRY[a.type];
    if (!fn) continue;
    ctx.a = a;
    if (fn(ctx)) {
      // 狂乱中は攻撃クールダウンも短縮
      const cdScale = (m.enrageT > 0) ? (1 / (m.enrageMul || 1.6)) : 1;
      m._cd[i] = (a.cd || 1.0) * cdScale;
    }
  }
}

// 溜め近接・縮地など「複数フレームにまたがる行動」を毎フレーム進める。
// ai.js から各 mob について runAttacks の後に呼ぶ。
export function updateMobActions(state, m, dt, bus, cfg) {
  // --- 溜め近接 ---
  if (m._charge) {
    m._charge.t -= dt;
    if (m._charge.t <= 0) {
      // 薙ぎ払い発動：定義から該当攻撃のダメージ/範囲を引く
      const def = (m.def && m.def.attacks) || [];
      const a = def.find((x) => x.type === 'charge_melee') || {};
      const p = state.player;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      const reach = (a.reach || a.range || 40) + Math.max(p.w, p.h) / 2;
      spawnEnemySlashFX(state, m.x, m.y, Math.atan2(p.y - m.y, p.x - m.x));
      addShake(state, 0.12, 5);
      if (d < reach && p.iTime <= 0) {
        p.hp -= (a.dmg || 28);
        p.iTime = (cfg && cfg.player && cfg.player.iFrameMelee) || 0.9;
        const n = norm(p.x - m.x, p.y - m.y);
        p.vx += n.x * (a.kb || 360); p.vy += n.y * (a.kb || 360);
        if (bus && bus.emit) bus.emit('sfx', 'hit');
        recordPlayerHit(state, m.x, m.y);
      }
      m._charge = null;
    }
  }

  // --- 縮地（ブリンク）---
  if (m._blink) {
    const b = m._blink;
    const step = Math.min(dt, b.t);
    const frac = step / b.total;
    // 残像を一定間隔で
    b.trail -= step;
    if (b.trail <= 0) { spawnAfterimageFX(state, m.x, m.y, m.w, m.h, m.color); b.trail = 0.02; }
    moveAndCollide(state, m, b.dx * (frac / 1), 0);
    moveAndCollide(state, m, 0, b.dy * (frac / 1));
    b.t -= step;
    if (b.t <= 0) { spawnSparksFX(state, m.x, m.y, 4); m._blink = null; }
  }

  // --- 回避クールダウン ---
  if (m.dodgeT > 0) m.dodgeT -= dt;
  if (m.dodgeCDLeft > 0) m.dodgeCDLeft -= dt;
}
