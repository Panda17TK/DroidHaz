// webapp/js/systems/items.js
// アイテム取得処理。効果は CONFIG.items のテーブルで定義（データ駆動）。

import { clamp } from './physics.js';
import { CONFIG } from '../core/config.js';

// buff の stat 名 → player.buffs のタイマ/値キー
const BUFF_KEYS = {
  range: { val: 'range', timer: 'tRange' },
  dmg:   { val: 'dmg',   timer: 'tDmg' },
  speed: { val: 'speed', timer: 'tSpeed' },
};

function applyPickup(state, bus, it) {
  const p = state.player;
  const def = CONFIG.items[it.type];
  if (!def) return;
  switch (def.kind) {
    case 'key':
      p.inv.key = true; bus.emit('ui:toast', '鍵を手に入れた'); break;
    case 'ammo': {
      const n = it.amt || def.defAmt || 1;
      p.inv[def.pool] = (p.inv[def.pool] | 0) + n;
      bus.emit('ui:toast', `${def.name || def.pool} +${n}`);
      break;
    }
    case 'heal': {
      const h = it.heal || def.defHeal || 25;
      p.hp = clamp(p.hp + h, 0, p.hpMax || 100);
      bus.emit('ui:toast', `体力 +${h}`);
      break;
    }
    case 'buff': {
      const k = BUFF_KEYS[def.stat];
      if (k) { p.buffs[k.val] = def.mul; p.buffs[k.timer] = def.dur; }
      bus.emit('ui:toast', `${def.label} ×${def.mul}（${def.dur}s）`);
      break;
    }
    case 'crate':
      onWeaponCrate(state, bus); break;
    case 'unlock': {
      // 近接武器（刀など）の解放。所持していなければ追加して即装備。
      const id = def.unlock;
      if (!p.meleeWeapons) p.meleeWeapons = ['fists'];
      if (id && p.meleeWeapons.indexOf(id) === -1) {
        p.meleeWeapons.push(id);
        p.curMelee = p.meleeWeapons.length - 1;
      }
      bus.emit('ui:toast', '近接武器を解放: ' + (def.name || id));
      break;
    }
  }
  bus.emit('sfx', 'pickup');
}

export function updateItems(state, dt, bus, audio) {
  const p = state.player;
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    if (Math.abs(it.x - p.x) < (p.w / 2 + 10) && Math.abs(it.y - p.y) < (p.h / 2 + 10)) {
      applyPickup(state, bus, it);
      state.items.splice(i, 1);
    }
  }
}

function onWeaponCrate(state, bus) {
  // 全武器所持のため、クレートは弾薬補給（リサプライ）
  const inv = state.player.inv;
  const s = CONFIG.crateSupply;
  inv.ammo9    = (inv.ammo9    | 0) + s.ammo9;
  inv.ammo12   = (inv.ammo12   | 0) + s.ammo12;
  inv.ammoBeam = (inv.ammoBeam | 0) + s.ammoBeam;
  inv.ammoNade = (inv.ammoNade | 0) + s.ammoNade;
  bus.emit('ui:toast', `弾薬補給（9mm+${s.ammo9} / 12g+${s.ammo12} / Beam+${s.ammoBeam} / Nade+${s.ammoNade}）`);
}
