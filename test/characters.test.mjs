import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/core/config.js';
import {
  CHARACTERS, CHARACTER_IDS, getCharacter,
  applyCharacter, unlockableFor, findRangedDef,
} from '../js/state/characters.js';
import { computePlayerMotion, MOTION } from '../js/render/character-motion.js';

function mkState(charId) {
  return {
    charId: charId || 'hero',
    gameOver: false,
    player: { weapons: [], meleeWeapons: [], curW: 3, curMelee: 2, hpMax: 100, hp: 100, sta: 100, staMax: 100, iTime: 0, weakT: 0 },
  };
}

// ===== applyCharacter =====
test('5キャラが登録されている', () => {
  assert.deepEqual(CHARACTER_IDS, ['hero', 'mage', 'jk', 'skeleton', 'robot']);
  for (const id of CHARACTER_IDS) assert.ok(CHARACTERS[id], id);
});

test('hero: CONFIG.weapons をそのまま初期遠隔に、近接は徒手空拳', () => {
  const s = mkState();
  applyCharacter(s, 'hero');
  assert.equal(s.charId, 'hero');
  assert.equal(s.player.drawId, 'hero');
  assert.equal(s.player.weapons.length, CONFIG.weapons.length);
  assert.equal(s.player.weapons[0].id, 'pistol');
  assert.deepEqual(s.player.meleeWeapons, ['fists']);
  assert.equal(s.player.curW, 0);
  assert.equal(s.player.curMelee, 0);
});

test('mage: 初期遠隔=魔法弾 / 近接=杖', () => {
  const s = mkState();
  applyCharacter(s, 'mage');
  assert.equal(s.charId, 'mage');
  assert.equal(s.player.weapons[0].id, 'mbolt');
  assert.deepEqual(s.player.meleeWeapons, ['staff']);
});

test('robot: 初期遠隔=レーザー+ガトリング / 近接=ドリル', () => {
  const s = mkState();
  applyCharacter(s, 'robot');
  assert.deepEqual(s.player.weapons.map((w) => w.id), ['laser', 'gatling']);
  assert.deepEqual(s.player.meleeWeapons, ['drill']);
});

test('weapons はコピー（変更してもレジストリ/CONFIG を汚さない）', () => {
  const s = mkState();
  applyCharacter(s, 'mage');
  s.player.weapons[0].dmg = 9999;
  const s2 = mkState();
  applyCharacter(s2, 'mage');
  assert.notEqual(s2.player.weapons[0].dmg, 9999);
});

test('未知キャラは hero にフォールバック', () => {
  const s = mkState();
  applyCharacter(s, 'nope');
  assert.equal(s.charId, 'hero');
  assert.equal(getCharacter('nope').id, 'hero');
});

// ===== unlock ドロップ枠 =====
test('unlockableFor: mage 既定では火球/氷槍/雷が解放候補', () => {
  const s = mkState();
  applyCharacter(s, 'mage');
  const u = unlockableFor(s);
  assert.deepEqual(u.ranged.map((w) => w.id).sort(), ['fireball', 'icelance', 'thunder']);
});

test('unlockableFor: 既に所持している武器は候補から外れる', () => {
  const s = mkState();
  applyCharacter(s, 'mage');
  s.player.weapons.push(findRangedDef('mage', 'fireball'));
  const u = unlockableFor(s);
  assert.ok(!u.ranged.find((w) => w.id === 'fireball'));
  assert.ok(u.ranged.find((w) => w.id === 'thunder'));
});

test('findRangedDef: 火球は AoE フラグ付き', () => {
  const def = findRangedDef('mage', 'fireball');
  assert.equal(def.id, 'fireball');
  assert.equal(def.aoe, true);
});

test('skeleton の呪い弾は bleed フラグ付き', () => {
  const def = findRangedDef('skeleton', 'curse');
  assert.equal(def.bleed, true);
});

// ===== computePlayerMotion =====
test('通常: HP満タン・スタミナ満タン・無被弾 → normal', () => {
  assert.equal(computePlayerMotion(mkState(), 0).primary, MOTION.NORMAL);
});

test('被弾: iTime 高 → hurt', () => {
  const s = mkState(); s.player.iTime = 0.7;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.HURT);
});

test('弱体化: weakT>0 → weak', () => {
  const s = mkState(); s.player.weakT = 0.5;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.WEAK);
});

test('瀕死: HP<=25% → dying', () => {
  const s = mkState(); s.player.hp = 24;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.DYING);
});

test('息切れ: スタミナ<=20% → breath', () => {
  const s = mkState(); s.player.sta = 18;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.BREATH);
});

test('優先度: 瀕死は被弾より優先', () => {
  const s = mkState(); s.player.hp = 20; s.player.iTime = 0.7;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.DYING);
});

test('ゲームオーバーは dead かつ dying ポーズ', () => {
  const s = mkState(); s.gameOver = true;
  const m = computePlayerMotion(s, 0);
  assert.equal(m.dead, true);
  assert.equal(m.primary, MOTION.DYING);
});
