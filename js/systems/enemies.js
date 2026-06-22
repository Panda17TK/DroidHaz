// webapp/js/systems/enemies.js
// CONFIG.enemies のロスター定義から mob 実体を生成する（データ駆動）。
// tier ごとの攻撃数の目安: normal=2 / midboss=5 / boss=10。

import { CONFIG } from '../core/config.js';

// 中ボス・ボスは既定ロスターに含めず、ここで「組み込みテンプレート」を提供する。
// （エディタからは CONFIG.enemies に保存される。未定義なら以下で補完）
export const BUILTIN_BOSSES = {
  brute: {
    name: 'ブルート(中ボス)', tier: 'midboss', color: '#d08a3a',
    hp: 420, speed: 58, w: 34, h: 34, seeRange: 320, contactKB: 320,
    attacks: [
      { type: 'melee',        cd: 0.8, dmg: 16, range: 22, arc: 360 },
      { type: 'charge_melee', cd: 3.2, range: 60, reach: 40, windup: 0.8, dmg: 30, kb: 480 },
      { type: 'slam',         cd: 4.0, dmg: 18, range: 80, power: 360 },
      { type: 'burst',        cd: 2.5, dmg: 8, count: 5, spread: 40, speed: 240 },
      { type: 'summon',       cd: 8.0, minion: 'zombie', count: 2 },
    ],
  },
  warlock: {
    name: 'ウォーロック(中ボス)', tier: 'midboss', color: '#7a5ad0',
    hp: 360, speed: 48, w: 30, h: 30, seeRange: 360, contactKB: 240,
    dodge: { chance: 0.25, duration: 0.15, cd: 1.6 }, // 賢く回避する
    attacks: [
      { type: 'shot',    cd: 1.0, dmg: 12, speed: 240 },
      { type: 'nova',    cd: 5.0, dmg: 8, count: 14, speed: 180 },
      { type: 'blink',   cd: 4.0, maxTiles: 5, dur: 0.1, minDist: 80, standoff: 120 }, // 距離を取る縮地
      { type: 'summon',  cd: 7.0, minion: 'spitter', count: 2 },
      { type: 'heal',    cd: 9.0, amount: 40 },
    ],
  },
  overlord: {
    name: 'オーバーロード(ボス)', tier: 'boss', color: '#d04a6a',
    hp: 1200, speed: 52, w: 46, h: 46, seeRange: 480, contactKB: 360,
    dodge: { chance: 0.12, duration: 0.12, cd: 2.5 }, // ボスもごく稀に回避
    attacks: [
      { type: 'melee',   cd: 0.7, dmg: 20, range: 30, arc: 360 },
      { type: 'slam',    cd: 3.5, dmg: 22, range: 100, power: 420 },
      { type: 'charge',  cd: 4.5, range: 260, power: 700 },
      { type: 'nova',    cd: 4.0, dmg: 10, count: 20, speed: 200 },
      { type: 'burst',   cd: 2.0, dmg: 9, count: 7, spread: 50, speed: 260 },
      { type: 'barrage', cd: 3.0, dmg: 9, count: 9, spread: 90, speed: 200 },
      { type: 'homing',  cd: 3.5, dmg: 12, speed: 160, turn: 2, life: 3.5 },
      { type: 'summon',  cd: 6.0, minion: 'zombie', count: 3 },
      { type: 'enrage',  cd: 12.0, mul: 1.6, duration: 4 },
      { type: 'heal',    cd: 14.0, amount: 80 },
    ],
  },
};

// roster: 通常敵キー一覧（CONFIG.enemies のうち tier=normal）
export function normalKeys() {
  return Object.keys(CONFIG.enemies).filter((k) => (CONFIG.enemies[k].tier || 'normal') === 'normal');
}
export function midbossKeys() {
  const fromCfg = Object.keys(CONFIG.enemies).filter((k) => CONFIG.enemies[k].tier === 'midboss');
  return fromCfg.length ? fromCfg : Object.keys(BUILTIN_BOSSES).filter((k) => BUILTIN_BOSSES[k].tier === 'midboss');
}
export function bossKeys() {
  const fromCfg = Object.keys(CONFIG.enemies).filter((k) => CONFIG.enemies[k].tier === 'boss');
  return fromCfg.length ? fromCfg : Object.keys(BUILTIN_BOSSES).filter((k) => BUILTIN_BOSSES[k].tier === 'boss');
}

function defOf(key) {
  return CONFIG.enemies[key] || BUILTIN_BOSSES[key] || null;
}

// aiTier>=2/3 で付与する既定の追加技（mods.extraAttacks 未指定時のフォールバック）。
const DEFAULT_EXTRA_ATTACKS = [
  { type: 'shot',  cd: 1.6, dmg: 8, speed: 220 },
  { type: 'burst', cd: 3.0, dmg: 6, count: 3, spread: 30, speed: 220 },
];

// REQ-STAGE-4（純）: behavior 修正子を敵 def へ適用したクローンを返す。
// HP/ダメージは触らない（水増し禁止）。反応(cd/windup)・知覚(seeRange)・機動(speed)・
// 回避(dodge)・技(extraAttacks)を aiTier に応じて決定的に変える。
export function applyDifficultyToDef(def, mods) {
  if (!def || !mods) return def;
  const out = Object.assign({}, def);
  if (def.seeRange) out.seeRange = Math.round(def.seeRange * (mods.perceptionMul || 1));
  if (def.speed) out.speed = Math.round(def.speed * (mods.speedMul || 1));

  const rm = mods.reactionMul || 1;
  let attacks = (def.attacks || []).map((a) => {
    const na = Object.assign({}, a);
    if (typeof na.cd === 'number') na.cd = Math.max(0.15, na.cd * rm);
    if (typeof na.windup === 'number') na.windup = Math.max(0.1, na.windup * rm);
    return na;
  });

  const tier = mods.aiTier || 0;
  // 回避: tier>=1 で付与/強化（既存 dodge は据え置き強化）
  let dodge = def.dodge ? Object.assign({}, def.dodge) : null;
  if (tier >= 1) {
    if (!dodge) dodge = { chance: 0, duration: 0.15, cd: 1.6 };
    const dm = mods.dodge || {};
    dodge.chance = Math.min(0.5, (dodge.chance || 0) + (dm.chanceAdd || 0));
    dodge.cd = Math.max(0.4, (dodge.cd || 1.6) * (dm.cdMul || 1));
  }
  if (dodge) out.dodge = dodge;

  // 技のレパートリー: tier>=2 で1つ、tier>=3 でさらに1つ追加
  const extras = (mods.extraAttacks && mods.extraAttacks.length) ? mods.extraAttacks : DEFAULT_EXTRA_ATTACKS;
  if (tier >= 2 && extras[0]) attacks = attacks.concat([Object.assign({}, extras[0])]);
  if (tier >= 3 && extras[1]) attacks = attacks.concat([Object.assign({}, extras[1])]);

  out.attacks = attacks;
  out._aiTier = tier;
  return out;
}

// 波スケールを適用して mob 実体を作る。mods（stageDifficulty の出力）があれば
// def に挙動修正子を適用してから生成する（無ければ従来どおり）。
export function makeMobFromKey(state, key, x, y, waveNum, mods) {
  const baseDef = defOf(key);
  if (!baseDef) return null;
  const def = mods ? applyDifficultyToDef(baseDef, mods) : baseDef;
  const w = CONFIG.waves;
  const hs = 1 + (waveNum - 1) * w.hpScalePerWave;
  const ss = 1 + (waveNum - 1) * w.speedScalePerWave;
  const hp = Math.round(def.hp * hs);
  return {
    kind: key,
    def,                       // 攻撃評価のため定義を参照
    tier: def.tier || 'normal',
    x, y,
    w: def.w || 22, h: def.h || 22,
    hp, maxhp: hp,
    baseSpeed: Math.round(def.speed * ss),
    seeRange: def.seeRange || 240,
    contactKB: def.contactKB || 220,
    color: def.color || '#b24a4a',
    vx: 0, vy: 0,
    shootCD: 0, meleeCD: 0, bumpCD: 0,
    _cd: (def.attacks || []).map(() => Math.random() * 0.6), // 初期CDをばらけさせる
    aiTier: def._aiTier || 0,
    faceX: 1, faceY: 0,
    prevX: x, prevY: y, stuckT: 0,
    hitFlash: 0, enrageT: 0, guardT: 0,
    dodgeT: 0, dodgeCDLeft: 0, _charge: null, _blink: null,
    fireFlash: 0,
    animSeed: Math.random() * Math.PI * 2, // 個体ごとに動きの位相をずらす
    waveNum,
  };
}

// 後方互換：以前の makeZombie/makeSpitter を温存（save-remote 等が import）
export function makeZombie(x, y) { return makeMobFromKey({ }, 'zombie', x, y, 1) || legacyZombie(x, y); }
export function makeSpitter(x, y) { return makeMobFromKey({ }, 'spitter', x, y, 1) || legacySpitter(x, y); }

function legacyZombie(x, y) {
  return { kind: 'zombie', def: CONFIG.enemies.zombie, tier: 'normal', x, y, w: 22, h: 22, hp: 55, maxhp: 55, baseSpeed: 72, seeRange: 240, contactKB: 220, color: '#b24a4a', vx: 0, vy: 0, shootCD: 0, meleeCD: 0, bumpCD: 0, _cd: [0, 0], faceX: 1, faceY: 0, prevX: x, prevY: y, stuckT: 0, hitFlash: 0, waveNum: 1 };
}
function legacySpitter(x, y) {
  return { kind: 'spitter', def: CONFIG.enemies.spitter, tier: 'normal', x, y, w: 22, h: 22, hp: 65, maxhp: 65, baseSpeed: 35, seeRange: 320, contactKB: 220, color: '#3aa06f', vx: 0, vy: 0, shootCD: 0, meleeCD: 0, bumpCD: 0, _cd: [0, 0], faceX: 1, faceY: 0, prevX: x, prevY: y, stuckT: 0, hitFlash: 0, waveNum: 1 };
}
