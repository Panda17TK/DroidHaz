// webapp/js/core/config.js
// ゲーム全パラメータの単一の出所（Single Source of Truth）。
// 開発者モードのエディタはこの CONFIG を編集し、localStorage に永続化する。
//
// 重要: 各システムは「分割代入で値をコピー」せず、参照経由（CONFIG.xxx.yyy）で
//        読むこと。そうすればエディタの変更が次フレームから即座に反映される。

const STORAGE_KEY = 'arpg_config_v1';

// ===== 既定値（変更不可のテンプレート） =====
export const DEFAULT_CONFIG = {
  player: {
    baseSpeed: 110,
    speedMul: 1.2,       // 全体の移動速度倍率（旧 combat.js のハードコード 1.2）
    hpMax: 100,
    staMax: 100,
    staDrain: 22,        // ダッシュ中のスタミナ消費/s（軽め＝長く走れる）
    staRegen: 32,        // 非ダッシュ時のスタミナ回復/s（速め＝すぐ再使用）
    meleeDmg: 22,        // 近接の基礎ダメージ（mods.meleeMul と乗算）
    meleeReach: 51,      // 近接の射程(px)。元 34*1.5
    meleeCD: 0.32,       // 近接クールダウン(s)
    meleeKB: 240,        // 近接ノックバック
    meleeSlashDmg: 8,    // 近接の継続ヒット（残像扇）ダメージ
    dashMul: 2.4,        // ダッシュ時の速度倍率（キビキビ）
    dashBurst: 220,      // ダッシュ開始時の初速ブースト（押した瞬間に出やすく）
    iFrameMelee: 0.9,    // 被弾後の無敵時間(s)：近接
    iFrameBullet: 0.8,   // 被弾後の無敵時間(s)：弾
    bulletSpeed: 360,    // 通常弾の初速
    grenadeSpeed: 280,   // グレネード初速
    grenadeFuse: 1.0,    // グレネード信管(s)
    explodeRadius: 76,   // 爆発半径
    explodeDmg: 150,     // 爆発の最大ダメージ
    explodeSelfDmg: 25,  // 自爆ダメージ（近距離）
    weakDur: 1.2,        // 弱体化(被弾デバフ)の持続(s)：弱体化モーションのトリガ
    weakSlowMul: 0.82,   // 弱体化中の移動速度倍率
    // 状態異常（敵の電撃/毒/炎上 攻撃で付与）。専用ダメージモーションのトリガにもなる。
    shockDur: 0.45,      // 感電スタンの持続(s)：この間は移動/攻撃不能
    poisonDur: 4.0,      // 毒の持続(s)
    poisonDps: 7,        // 毒の毎秒ダメージ
    burnDur: 3.0,        // 炎上の持続(s)
    burnDps: 11,         // 炎上の毎秒ダメージ
  },

  // 近接武器（徒手空拳/刀）。コンボ・効果はデータ駆動。dmg は mods.meleeMul と乗算。
  melee: {
    // 出血の状態異常：10秒持続・移動速度×0.8・毎秒 最大HPの1%ダメージ
    status: { bleedDur: 10, bleedSlowMul: 0.8, bleedDotFrac: 0.01 },
    weapons: {
      fists: {
        id: 'fists', name: '徒手空拳', kind: 'fist',
        reach: 44, arc: Math.PI * 0.9, cd: 0.18, dmg: 16, kb: 70, stagger: 0.18,
        combo: 3, comboWindow: 0.55,
        staCost: 7, lunge: 150,   // スタミナ消費／踏み込み量
        // 3段目＝蹴り：当たった相手に大きなノックバック＋長めの怯み
        finisher: { reach: 50, arc: Math.PI * 0.8, dmg: 30, kb: 380, stagger: 0.30, lunge: 260 },
      },
      katana: {
        id: 'katana', name: '刀', kind: 'blade',
        reach: 66, arc: Math.PI * 1.15, cd: 0.14, dmg: 20, kb: 0,
        combo: 4, comboWindow: 0.5,
        bleedChance: 0.12,   // まれに出血を付与
        staCost: 9, lunge: 130,
      },
      // ===== キャラ別近接（kind が描画を分岐。挙動は fists/katana と同じ機構）=====
      staff: { // 魔法使い：杖殴り（やや長射程・遅め）
        id: 'staff', name: '杖', kind: 'staff',
        reach: 60, arc: Math.PI * 1.0, cd: 0.20, dmg: 18, kb: 180,
        combo: 3, comboWindow: 0.5, staCost: 8, lunge: 110,
      },
      bag: { // 女子高生：通学カバン（重い一撃・大ノックバック）
        id: 'bag', name: '通学カバン', kind: 'bag',
        reach: 50, arc: Math.PI * 1.0, cd: 0.22, dmg: 22, kb: 280,
        combo: 3, comboWindow: 0.5, staCost: 9, lunge: 120,
      },
      shinai: { // 女子高生：竹刀（速い連撃）
        id: 'shinai', name: '竹刀', kind: 'blade',
        reach: 64, arc: Math.PI * 1.1, cd: 0.15, dmg: 17, kb: 60,
        combo: 4, comboWindow: 0.5, staCost: 8, lunge: 130,
      },
      scythe: { // 骸骨：大鎌（広範囲・出血）
        id: 'scythe', name: '大鎌', kind: 'scythe',
        reach: 70, arc: Math.PI * 1.25, cd: 0.18, dmg: 24, kb: 40,
        combo: 3, comboWindow: 0.5, bleedChance: 0.2, staCost: 10, lunge: 120,
      },
      bonesword: { // 骸骨：骨剣
        id: 'bonesword', name: '骨剣', kind: 'blade',
        reach: 62, arc: Math.PI * 1.1, cd: 0.16, dmg: 19, kb: 0,
        combo: 4, comboWindow: 0.5, bleedChance: 0.1, staCost: 9, lunge: 130,
      },
      drill: { // ロボット：ドリル（高速・狭角の連突き）
        id: 'drill', name: 'ドリル', kind: 'drill',
        reach: 46, arc: Math.PI * 0.5, cd: 0.10, dmg: 12, kb: 30,
        combo: 5, comboWindow: 0.45, staCost: 6, lunge: 100,
      },
      arm: { // ロボット：アーム（重い拳・特大ノックバック）
        id: 'arm', name: 'アーム', kind: 'arm',
        reach: 52, arc: Math.PI * 0.9, cd: 0.20, dmg: 26, kb: 340,
        combo: 3, comboWindow: 0.5, staCost: 10, lunge: 200,
      },
    },
  },

  // AI 挙動の調整値
  ai: {
    sepRadius: 24,       // 分離の半径
    hpSlowMul: 0.5,      // 通常敵が瀕死(HP半減)で減速する倍率
    wanderSlow: 0.25,    // 非視認時の徘徊速度倍率
    wanderStuck: 0.6,    // スタック時の徘徊速度倍率
  },

  // プレイヤー武器（データ駆動）。dev-editor から編集可能。
  // 並び順がホットキー 1..5 / curW のインデックスに対応する。
  // autoReloadDelay: 射撃を止めてからオートリロードが走るまでの秒数（銃種で自然に変える）。
  //   R キーは即時リロード。弾倉が大きい/重い銃ほど長め。beam は弾倉なしで対象外。
  weapons: [
    { id: 'pistol',  name: 'Pistol',  dmg: 34, fireRate: 0.22, magSize: 12, mag: 12, spread: 0.05, pellets: 1, ammoType: 'ammo9',  autoReloadDelay: 1.2 },
    { id: 'shotgun', name: 'Shotgun', dmg: 22, fireRate: 0.60, magSize: 6,  mag: 6,  spread: 0.25, pellets: 6, ammoType: 'ammo12', autoReloadDelay: 2.4 },
    { id: 'mg',      name: 'MG',      dmg: 17, fireRate: 0.08, magSize: 40, mag: 40, spread: 0.12, pellets: 1, ammoType: 'ammo9',  autoReloadDelay: 3.2 },
    { id: 'beam',    name: 'Beam',    dmg: 110, fireRate: 0.60, magSize: null, mag: 0, spread: 0, pellets: 1, ammoType: 'ammoBeam' },
    { id: 'grenade', name: 'Grenade', dmg: 0,  fireRate: 0.90, magSize: 1,  mag: 1,  spread: 0,    pellets: 1, ammoType: 'ammoNade', autoReloadDelay: 1.6 },
  ],

  waves: {
    firstWaveDelay: 3.0,    // 開始直後の猶予(s)
    intermission: 4.0,      // 波間の休止(s)。カード未選択時の自動継続まで
    baseQuota: 6,           // 第1波の出現数
    quotaPerWave: 3,        // 波ごとの増加
    maxQuota: 40,
    hpScalePerWave: 0.12,   // 敵HPの波スケール（+12%/波）
    speedScalePerWave: 0.04,// 敵速度の波スケール
    liveCapBase: 8,         // 同時存在数の基準
    liveCapPerWave: 2,
    maxLiveCap: 28,
    spawnIntervalBase: 0.9, // 1体あたり出現間隔の基準
    spawnIntervalPerWave: 0.04,
    minSpawnInterval: 0.25,
    midBossEvery: 5,        // この波ごとに中ボスを1体追加
    bossEvery: 10,          // この波ごとにボスを1体追加
  },

  drops: {
    ammoMulBase: 1,         // 基礎の弾薬ドロップ倍率（mods.ammoMul と乗算）
    ammo9Chance: 0.55,
    ammo12Chance: 0.17,     // ammo9 を外した後の追加確率帯
    ammoBeamChance: 0.10,
    ammoNadeChance: 0.08,
    medChance: 0.18,
    buffSpeedChance: 0.05,
    buffMeleeChance: 0.04,
    crateChance: 0.04,
    katanaChance: 0.02,     // 刀（近接武器）の解放ドロップ：まれ。未所持時のみ抽選。
    // ボス/中ボス撃破時の追加ドロップ
    bossCrateBonus: 3,
  },

  // アイテム定義テーブル（取得効果・見た目）。新アイテムはここに足すだけ。
  //   glyph: render/glyphs.js のキー、color: 描画色／グロー色
  //   kind:  ammo|heal|key|buff|crate（items.js が解釈）
  items: {
    key:       { glyph: 'key',  color: '#ffd16b', kind: 'key' },
    ammo9:     { glyph: 'box',  color: '#9ad0ff', label: '9',  kind: 'ammo', pool: 'ammo9',    defAmt: 12, name: '9mm' },
    ammo12:    { glyph: 'box',  color: '#c9a56b', label: '12', kind: 'ammo', pool: 'ammo12',   defAmt: 4,  name: '12g' },
    ammoBeam:  { glyph: 'box',  color: '#a8ceff', label: 'B',  kind: 'ammo', pool: 'ammoBeam', defAmt: 1,  name: 'Beamセル' },
    ammoNade:  { glyph: 'box',  color: '#ffa8a8', label: 'G',  kind: 'ammo', pool: 'ammoNade', defAmt: 1,  name: 'Grenade' },
    med:       { glyph: 'med',  color: '#8fffc1', kind: 'heal', defHeal: 25 },
    buffRange: { glyph: 'ring', color: '#9ecbff', kind: 'buff', stat: 'range', mul: 2, dur: 15, label: '近接範囲' },
    buffMelee: { glyph: 'sword',color: '#ff9aa2', kind: 'buff', stat: 'dmg',   mul: 2, dur: 15, label: '近接火力' },
    buffSpeed: { glyph: 'bolt', color: '#ffe08a', kind: 'buff', stat: 'speed', mul: 2, dur: 12, label: '移動速度' },
    crate:     { glyph: 'crate',color: '#d8b483', kind: 'crate' },
    katana:    { glyph: 'sword',color: '#dfe8f2', kind: 'unlock', unlock: 'katana', name: '刀' },
  },
  // 武器クレートの補給量
  crateSupply: { ammo9: 40, ammo12: 8, ammoBeam: 2, ammoNade: 1 },

  // 恒久強化カードの効き幅（エディタで調整可能）
  upgrades: {
    gunMul: 1.25,    // 火力強化（乗算）
    fireMul: 0.85,   // 連射強化（発射間隔の乗算＝小さいほど速い）
    meleeMul: 1.35,  // 近接強化
    maxHpAdd: 25,    // 頑強（加算）
    moveMul: 1.12,   // 俊足
    ammoMul: 1.5,    // 弾薬調達
    lifestealAdd: 2, // 吸血（撃破ごとのHP回復量に加算）
    wallHpAdd: 40,   // 築城術（設置壁HPに加算）
    blocksAdd: 4,    // 築城術（資材）
  },

  // 敵アーキタイプ。tier: normal(攻撃2) / midboss(5) / boss(10)
  // attacks: 攻撃タイプ定義の配列（systems/attacks.js が解釈）。
  enemies: {
    zombie: {
      name: '剣の人影', tier: 'normal', color: '#23262e',
      hp: 55, speed: 72, w: 22, h: 22, seeRange: 240, contactKB: 220,
      attacks: [
        { type: 'melee', cd: 0.9, dmg: 10, range: 12, arc: 360 },
        { type: 'lunge', cd: 3.5, range: 90, power: 360 },
      ],
    },
    spitter: {
      name: '幽霊', tier: 'normal', color: '#cdd8ea',
      hp: 65, speed: 35, w: 22, h: 22, seeRange: 320, contactKB: 220,
      attacks: [
        { type: 'melee', cd: 3.0, dmg: 10, range: 9, arc: 90 },
        { type: 'shot', cd: 1.2, dmg: 12, speed: 220, kite: true },
      ],
    },
    // ストーカー：縮地で間合いを詰め、溜め近接で刺す。たまに回避する。
    stalker: {
      name: '狼', tier: 'normal', color: '#2b2b34',
      hp: 60, speed: 64, w: 22, h: 22, seeRange: 340, contactKB: 200,
      dodge: { chance: 0.18, duration: 0.15, cd: 2.0 }, // 回避：18%・0.15s無敵・CD2s
      attacks: [
        { type: 'blink', cd: 3.0, maxTiles: 5, dur: 0.1, minDist: 70, standoff: 28 },
        { type: 'charge_melee', cd: 2.4, range: 40, reach: 30, windup: 0.6, dmg: 18, kb: 320 },
      ],
    },
    // 電撃型：電撃弾で感電（短時間スタン）させてくる。
    tesla: {
      name: '帯電体', tier: 'normal', color: '#5ad1ff',
      hp: 58, speed: 50, w: 22, h: 22, seeRange: 340, contactKB: 200,
      attacks: [
        { type: 'shock', cd: 1.8, dmg: 9, speed: 320, life: 1.3 },
        { type: 'melee', cd: 1.2, dmg: 8, range: 12, arc: 360 },
      ],
    },
    // 毒型：毒弾で継続ダメージを与えてくる。
    spore: {
      name: '胞子虫', tier: 'normal', color: '#8bd86a',
      hp: 70, speed: 40, w: 22, h: 22, seeRange: 320, contactKB: 200,
      attacks: [
        { type: 'poison', cd: 1.6, dmg: 6, speed: 190, life: 2.4 },
        { type: 'melee', cd: 2.0, dmg: 8, range: 10, arc: 90 },
      ],
    },
    // 炎型：火球弾で炎上（継続ダメージ）させてくる。
    pyro: {
      name: '火炎甲虫', tier: 'normal', color: '#ff7a3c',
      hp: 64, speed: 46, w: 22, h: 22, seeRange: 320, contactKB: 200,
      attacks: [
        { type: 'burn', cd: 1.8, dmg: 7, speed: 210, life: 2.0 },
        { type: 'melee', cd: 1.4, dmg: 9, range: 12, arc: 360 },
      ],
    },
  },
};

// ===== 実行時 CONFIG（これを各システムが参照） =====
export const CONFIG = deepClone(DEFAULT_CONFIG);

// ----- ユーティリティ -----
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// src の値を dst に「既存キーのみ」マージ（壊れた保存データで未知キーが増えるのを防ぐ）
function mergeInto(dst, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(dst)) {
    if (!(k in src)) continue;
    if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
      mergeInto(dst[k], src[k]);
    } else {
      dst[k] = src[k];
    }
  }
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) mergeInto(CONFIG, JSON.parse(raw));
  } catch (_e) { /* 壊れた保存は無視して既定値 */ }
  return CONFIG;
}

export function saveConfig() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG)); } catch (_e) {}
}

export function resetConfig() {
  mergeInto(CONFIG, deepClone(DEFAULT_CONFIG));
  // DEFAULT に存在するキーで CONFIG 側が変質している場合に備え、丸ごと置換もしておく
  const fresh = deepClone(DEFAULT_CONFIG);
  for (const k of Object.keys(CONFIG)) delete CONFIG[k];
  Object.assign(CONFIG, fresh);
  saveConfig();
  return CONFIG;
}

export function exportConfig() { return JSON.stringify(CONFIG, null, 2); }

export function importConfig(json) {
  const obj = (typeof json === 'string') ? JSON.parse(json) : json;
  mergeInto(CONFIG, obj);
  saveConfig();
  return CONFIG;
}
