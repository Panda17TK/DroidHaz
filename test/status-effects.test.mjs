import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/core/config.js';
import { computePlayerMotion, MOTION } from '../js/render/character-motion.js';
import { ATTACK_TYPES } from '../js/systems/attacks.js';
import { updateEnemyBullets } from '../js/systems/projectiles.js';

function mkState(over) {
  return Object.assign({
    gameOver: false, fx: [],
    map: ['.....', '.....', '.....', '.....', '.....'], dim: { w: 5, h: 5 },
    player: { x: 0, y: 0, w: 22, h: 22, hp: 100, hpMax: 100, sta: 100, staMax: 100, iTime: 0, weakT: 0, shockT: 0, poisonT: 0, burnT: 0, vx: 0, vy: 0, isDashing: false },
  }, over);
}

// ===== モーション: 状態異常の優先度 =====
test('感電中は shock モーション', () => {
  const s = mkState(); s.player.shockT = 0.3;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.SHOCK);
});
test('毒中は poison モーション', () => {
  const s = mkState(); s.player.poisonT = 2;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.POISON);
});
test('炎上中は burn モーション', () => {
  const s = mkState(); s.player.burnT = 2;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.BURN);
});
test('優先度: 感電 > 毒 > 被弾', () => {
  const s = mkState(); s.player.shockT = 0.3; s.player.poisonT = 2; s.player.iTime = 0.7;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.SHOCK);
  s.player.shockT = 0;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.POISON);
});
test('優先度: 瀕死は感電/毒より優先', () => {
  const s = mkState(); s.player.hp = 20; s.player.shockT = 0.3; s.player.poisonT = 2;
  assert.equal(computePlayerMotion(s, 0).primary, MOTION.DYING);
});

// ===== 敵攻撃タイプの登録 =====
test('shock / poison / burn が攻撃タイプに登録されている', () => {
  assert.ok(ATTACK_TYPES.includes('shock'));
  assert.ok(ATTACK_TYPES.includes('poison'));
  assert.ok(ATTACK_TYPES.includes('burn'));
});

// ===== 敵弾による状態付与 =====
function shockBullet() { return { x: 0, y: 0, vx: 0, vy: 0, life: 1, dmg: 8, shock: true }; }
function poisonBullet() { return { x: 0, y: 0, vx: 0, vy: 0, life: 1, dmg: 6, poison: true }; }

test('電撃弾の被弾で shockT が付く', () => {
  const s = mkState(); s.ebullets = [shockBullet()];
  updateEnemyBullets(s, 0.016);
  assert.ok(s.player.shockT > 0, 'shockT 付与');
  assert.equal(s.ebullets.length, 0, '弾は消費');
});
test('毒弾の被弾で poisonT が付く', () => {
  const s = mkState(); s.ebullets = [poisonBullet()];
  updateEnemyBullets(s, 0.016);
  assert.ok(s.player.poisonT > 0, 'poisonT 付与');
});
test('火球弾の被弾で burnT が付く', () => {
  const s = mkState(); s.ebullets = [{ x: 0, y: 0, vx: 0, vy: 0, life: 1, dmg: 7, burn: true }];
  updateEnemyBullets(s, 0.016);
  assert.ok(s.player.burnT > 0, 'burnT 付与');
});
test('i-frame 中は状態異常が付かない', () => {
  const s = mkState(); s.player.iTime = 0.5; s.ebullets = [shockBullet()];
  updateEnemyBullets(s, 0.016);
  assert.equal(s.player.shockT, 0, 'i-frame 中は無効');
});
test('ダッシュ回避中は状態異常が付かない（弾き返し）', () => {
  const s = mkState(); s.player.isDashing = true; s.ebullets = [poisonBullet()];
  updateEnemyBullets(s, 0.016);
  assert.equal(s.player.poisonT, 0, 'ダッシュ中は無効');
});
