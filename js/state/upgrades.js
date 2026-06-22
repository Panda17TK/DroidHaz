// webapp/js/state/upgrades.js
// ウェーブ間に提示する恒久強化カード（ラン中ずっと持続）。
// 効き幅は CONFIG.upgrades から読む（開発者モードで調整可能）。

import { CONFIG } from '../core/config.js';

export const UPGRADES = [
  { id: 'gun_dmg',   name: '火力強化', desc: () => `射撃ダメージ ×${CONFIG.upgrades.gunMul}`,
    apply(s) { s.player.mods.gunMul *= CONFIG.upgrades.gunMul; } },
  { id: 'fire_rate', name: '連射強化', desc: () => `発射間隔 ×${CONFIG.upgrades.fireMul}`,
    apply(s) { s.player.mods.fireMul *= CONFIG.upgrades.fireMul; } },
  { id: 'melee',     name: '近接強化', desc: () => `近接ダメージ ×${CONFIG.upgrades.meleeMul}`,
    apply(s) { s.player.mods.meleeMul *= CONFIG.upgrades.meleeMul; } },
  { id: 'max_hp',    name: '頑強', desc: () => `最大HP +${CONFIG.upgrades.maxHpAdd}・全回復`,
    apply(s) { s.player.hpMax += CONFIG.upgrades.maxHpAdd; s.player.hp = s.player.hpMax; } },
  { id: 'speed',     name: '俊足', desc: () => `移動速度 ×${CONFIG.upgrades.moveMul}`,
    apply(s) { s.player.mods.moveMul *= CONFIG.upgrades.moveMul; } },
  { id: 'ammo',      name: '弾薬調達', desc: () => `弾薬ドロップ ×${CONFIG.upgrades.ammoMul}・即時補給`,
    apply(s) {
      s.player.mods.ammoMul *= CONFIG.upgrades.ammoMul;
      const inv = s.player.inv;
      inv.ammo9 += 40; inv.ammo12 += 8; inv.ammoBeam += 2; inv.ammoNade += 1;
    } },
  { id: 'lifesteal', name: '吸血', desc: () => `撃破ごとに HP +${CONFIG.upgrades.lifestealAdd}`,
    apply(s) { s.player.mods.healOnKill += CONFIG.upgrades.lifestealAdd; } },
  { id: 'engineer',  name: '築城術', desc: () => `資材 +${CONFIG.upgrades.blocksAdd}・壁が頑丈に`,
    apply(s) { s.player.inv.blocks += CONFIG.upgrades.blocksAdd; s.player.mods.wallHp = (s.player.mods.wallHp || 70) + CONFIG.upgrades.wallHpAdd; } },
  // 刀の解放（未所持のときだけ提示）。近接武器に「刀」を追加して即装備。
  { id: 'katana_unlock', name: '刀を入手', desc: () => '近接武器「刀」を解放（Q/長押しで切替）',
    avail: (s) => ((s.player.meleeWeapons || []).indexOf('katana') === -1),
    apply(s) {
      if (!s.player.meleeWeapons) s.player.meleeWeapons = ['fists'];
      if (s.player.meleeWeapons.indexOf('katana') === -1) {
        s.player.meleeWeapons.push('katana');
        s.player.curMelee = s.player.meleeWeapons.length - 1;
      }
    } },
];

// 説明文（関数 or 文字列の両対応）
export function upgradeDesc(u) {
  return (typeof u.desc === 'function') ? u.desc() : u.desc;
}

export function pickUpgradeChoices(n, state) {
  // avail(state) を持つカードは条件を満たすときだけ候補に含める（例: 刀解放は未所持時のみ）。
  const pool = UPGRADES.filter((u) => (typeof u.avail === 'function' ? (state ? u.avail(state) : false) : true));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const k = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}

export function applyUpgrade(state, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (u) u.apply(state);
  return u;
}
