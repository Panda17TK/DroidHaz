// js/state/characters.js
// プレイアブルキャラクターのデータと適用ロジック（純ロジック＝テスト可能）。
//
// 方針（DESIGN: 2026-06-23-playable-characters）:
//  - 当たり判定(pl.w/h)・基礎ステータスは全キャラ共通＝バランス不変。
//    差別化は「武器・見た目・モーション」のみ。
//  - 武器はキャラ専用（キャラロック）。弾薬プールは共有し、表示ラベル/色だけテーマ別。
//  - 遠隔武器 def は CONFIG.weapons と同じ形 + projType（描画）+ 特殊効果フラグ（aoe/slow/bleed/pierce/homing）。
//    挙動は既存機構（explode/bleed/pierce/homing）を再利用する。

import { CONFIG } from '../core/config.js';

// 遠隔武器のアーキタイプ（hero の5種に対応。バランスはこれに準拠）。
//  single=拳銃 / spread=ショットガン / rapid=MG / beam=ビーム(貫通) / aoe=グレネード(爆発)
function single(o) { return Object.assign({ dmg: 34, fireRate: 0.22, magSize: 12, mag: 12, spread: 0.05, pellets: 1, ammoType: 'ammo9' }, o); }
function spread(o) { return Object.assign({ dmg: 22, fireRate: 0.60, magSize: 6, mag: 6, spread: 0.25, pellets: 6, ammoType: 'ammo12' }, o); }
function rapid(o)  { return Object.assign({ dmg: 17, fireRate: 0.08, magSize: 40, mag: 40, spread: 0.12, pellets: 1, ammoType: 'ammo9' }, o); }
function beam(o)   { return Object.assign({ dmg: 110, fireRate: 0.60, magSize: null, mag: 0, spread: 0, pellets: 1, ammoType: 'ammoBeam', pierce: true }, o); }
function aoe(o)    { return Object.assign({ dmg: 0, fireRate: 0.90, magSize: 1, mag: 1, spread: 0, pellets: 1, ammoType: 'ammoNade', aoe: true }, o); }

export const CHARACTERS = {
  hero: {
    id: 'hero', name: '主人公', blurb: '剣と銃の万能型',
    drawId: 'hero',
    // hero の遠隔は CONFIG.weapons（dev-editor 互換）。melee は徒手空拳＋刀。
    rangedFromConfig: true,
    melee: ['fists'], dropPool: { ranged: [], melee: ['katana'] },
    theme: { skin: '#e7b48a', accent: '#e7c23c', ammo: { ammo9: '9mm', ammo12: '12g', ammoBeam: 'Beam', ammoNade: 'Nade' } },
  },
  mage: {
    id: 'mage', name: '魔法使い', blurb: '杖と魔法の遠隔型',
    drawId: 'mage',
    ranged: [
      single({ id: 'mbolt', name: '魔法弾', projType: 'arcane' }),
    ],
    melee: ['staff'],
    dropPool: {
      ranged: [
        aoe({ id: 'fireball', name: '火球', projType: 'fire' }),
        rapid({ id: 'icelance', name: '氷槍', projType: 'ice', dmg: 14, slow: true, ammoType: 'ammo12', magSize: 18, mag: 18 }),
        beam({ id: 'thunder', name: '雷', projType: 'thunder' }),
      ],
      melee: [],
    },
    theme: { skin: '#e7c6a0', accent: '#7b5cff', ammo: { ammo9: '魔力', ammo12: '氷片', ammoBeam: '雷石', ammoNade: '火種' } },
  },
  jk: {
    id: 'jk', name: '女子高生', blurb: '投擲と近接の機動型',
    drawId: 'jk',
    ranged: [
      single({ id: 'textbook', name: '教科書投げ', projType: 'book', dmg: 30 }),
    ],
    melee: ['bag'],
    dropPool: {
      ranged: [
        rapid({ id: 'watergun', name: '水鉄砲', projType: 'water', dmg: 11 }),
        aoe({ id: 'firework', name: '花火', projType: 'firework' }),
      ],
      melee: ['shinai'],
    },
    theme: { skin: '#f2cba6', accent: '#ff7da6', ammo: { ammo9: '紙束', ammo12: '画鋲', ammoBeam: '電池', ammoNade: '花火玉' } },
  },
  skeleton: {
    id: 'skeleton', name: '骸骨', blurb: '骨と呪いの死霊型',
    drawId: 'skeleton',
    ranged: [
      single({ id: 'bonethrow', name: '投げ骨', projType: 'bone', dmg: 32 }),
    ],
    melee: ['scythe'],
    dropPool: {
      ranged: [
        spread({ id: 'curse', name: '呪い弾', projType: 'curse', bleed: true, pellets: 3, dmg: 16, ammoType: 'ammo12' }),
        aoe({ id: 'skullbomb', name: '頭蓋骨爆弾', projType: 'skull' }),
      ],
      melee: ['bonesword'],
    },
    theme: { skin: '#e8e6df', accent: '#9be8c0', ammo: { ammo9: '骨片', ammo12: '呪符', ammoBeam: '霊力', ammoNade: '頭蓋' } },
  },
  robot: {
    id: 'robot', name: 'ロボット', blurb: 'エネルギー兵装の重火力型',
    drawId: 'robot',
    ranged: [
      beam({ id: 'laser', name: 'レーザー', projType: 'laser' }),
      rapid({ id: 'gatling', name: 'マシンガン', projType: 'metal' }),
    ],
    melee: ['drill'],
    dropPool: {
      ranged: [
        aoe({ id: 'missile', name: 'ミサイル', projType: 'missile', homing: true }),
        single({ id: 'plasma', name: 'プラズマ', projType: 'plasma', dmg: 44, fireRate: 0.30, ammoType: 'ammo12', magSize: 8, mag: 8 }),
      ],
      melee: ['arm'],
    },
    theme: { skin: '#b9c2cc', accent: '#5ad1ff', ammo: { ammo9: '弾', ammo12: 'セル', ammoBeam: 'EN', ammoNade: '弾頭' } },
  },
};

export const CHARACTER_IDS = ['hero', 'mage', 'jk', 'skeleton', 'robot'];

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS.hero;
}

// hero は CONFIG.weapons（編集可）、他はキャラ定義の ranged を初期遠隔とする。
function initialRanged(c) {
  if (c.rangedFromConfig) return CONFIG.weapons;
  return c.ranged || [];
}

// 指定キャラを state に適用する（武器/近接/ドロップ枠/描画ID）。
// 当たり判定・基礎ステータスは変更しない（バランス不変）。
export function applyCharacter(state, id) {
  if (!state || !state.player) return null;
  const c = getCharacter(id);
  state.charId = c.id;
  state.player.drawId = c.drawId || c.id;
  state.player.weapons = initialRanged(c).map((w) => Object.assign({}, w));
  state.player.curW = 0;
  state.player.meleeWeapons = (c.melee || ['fists']).slice();
  state.player.curMelee = 0;
  return c;
}

// 解放ドロップ用: キャラの dropPool から、未所持の遠隔/近接 unlock id を引く。
export function unlockableFor(state) {
  const c = getCharacter(state && state.charId);
  const pool = c.dropPool || { ranged: [], melee: [] };
  const ownedR = new Set((state.player.weapons || []).map((w) => w.id));
  const ownedM = new Set(state.player.meleeWeapons || []);
  const ranged = (pool.ranged || []).filter((w) => !ownedR.has(w.id));
  const melee = (pool.melee || []).filter((mid) => !ownedM.has(mid));
  return { ranged, melee };
}

// 遠隔 unlock id から def を引く（hero=CONFIG.weapons, 他=ranged+dropPool.ranged）。
export function findRangedDef(charId, weaponId) {
  const c = getCharacter(charId);
  const all = (c.rangedFromConfig ? CONFIG.weapons : (c.ranged || []))
    .concat((c.dropPool && c.dropPool.ranged) || []);
  const def = all.find((w) => w.id === weaponId);
  return def ? Object.assign({}, def) : null;
}
