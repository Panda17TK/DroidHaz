import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDamageVoice, pickLine, voicePools, triggerDamageVoice, triggerBreathVoice, updateVoice } from '../js/systems/voices.js';

// ===== 分類（純） =====
test('状態異常付与が最優先で分類される', () => {
  assert.equal(classifyDamageVoice({ drop: 30, shockRose: true }), 'shock');
  assert.equal(classifyDamageVoice({ drop: 30, poisonRose: true }), 'poison');
  assert.equal(classifyDamageVoice({ drop: 30, burnRose: true }), 'burn');
});
test('被ダメ量で 強(>=18)/弱 を分ける', () => {
  assert.equal(classifyDamageVoice({ drop: 20 }), 'heavy');
  assert.equal(classifyDamageVoice({ drop: 8 }), 'light');
});
test('DoT 程度の微量ダメージは null（吹き出しを出さない）', () => {
  assert.equal(classifyDamageVoice({ drop: 0.2 }), null);
});

// ===== セリフ =====
test('各カテゴリに 10 種類前後のバリエーションがある', () => {
  const p = voicePools();
  assert.ok(p.heavy.length >= 8 && p.light.length >= 8 && p.breath.length >= 6);
  for (const k of ['heavy', 'light', 'shock', 'poison', 'burn', 'breath']) {
    assert.ok(typeof pickLine(k) === 'string' && pickLine(k).length > 0, k);
  }
});

// ===== トリガ／寿命 =====
test('triggerDamageVoice で playerVoice がセットされる', () => {
  const s = {};
  triggerDamageVoice(s, 'heavy');
  assert.ok(s.playerVoice && s.playerVoice.kind === 'heavy');
});
test('updateVoice で寿命を超えたら消える', () => {
  const s = {};
  triggerDamageVoice(s, 'light');
  updateVoice(s, 2.0);
  assert.equal(s.playerVoice, null);
});
test('息切れボイスは CD 経過で出る', () => {
  const s = {};
  triggerBreathVoice(s, 0.016); // 初回 CD=0 → 即発火
  assert.ok(s.playerVoice && s.playerVoice.kind === 'breath');
});
