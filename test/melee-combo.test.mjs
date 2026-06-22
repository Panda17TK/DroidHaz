import { test } from 'node:test';
import assert from 'node:assert/strict';

const { advanceCombo, isFinisher, swingDir, resolveSwing } =
  await import('../js/systems/melee-combo.js');

const FIST = {
  id: 'fists', kind: 'fist', reach: 44, arc: 2.8, dmg: 16, kb: 70, stagger: 0.18,
  combo: 3, comboWindow: 0.55, finisher: { reach: 50, arc: 2.5, dmg: 30, kb: 380, stagger: 0.3 },
};
const KATANA = { id: 'katana', kind: 'blade', reach: 66, arc: 3.6, dmg: 20, kb: 0, combo: 4, bleedChance: 0.12 };

test('advanceCombo: 受付内＆同武器で段が進む', () => {
  assert.equal(advanceCombo(0, 3, true, true), 1);
  assert.equal(advanceCombo(1, 3, true, true), 2);
});

test('advanceCombo: 最終段の次は 0 に巡回', () => {
  assert.equal(advanceCombo(2, 3, true, true), 0);
  assert.equal(advanceCombo(3, 4, true, true), 0);
});

test('advanceCombo: 受付外/別武器は 0 にリセット', () => {
  assert.equal(advanceCombo(1, 3, false, true), 0);
  assert.equal(advanceCombo(1, 3, true, false), 0);
});

test('isFinisher: 徒手空拳は最終段(2)のみ蹴り', () => {
  assert.equal(isFinisher(FIST, 0), false);
  assert.equal(isFinisher(FIST, 1), false);
  assert.equal(isFinisher(FIST, 2), true);
});

test('isFinisher: 刃武器は常に false（蹴りなし）', () => {
  assert.equal(isFinisher(KATANA, 3), false);
});

test('swingDir: 段ごとに左右交互', () => {
  assert.equal(swingDir(0), 1);
  assert.equal(swingDir(1), -1);
  assert.equal(swingDir(2), 1);
});

test('resolveSwing: 蹴り段は finisher パラメータ（大KB）', () => {
  const s = resolveSwing(FIST, 2);
  assert.equal(s.finisher, true);
  assert.equal(s.kb, 380);
  assert.equal(s.dmg, 30);
});

test('resolveSwing: 通常段は基礎パラメータ', () => {
  const s = resolveSwing(FIST, 0);
  assert.equal(s.finisher, false);
  assert.equal(s.kb, 70);
  assert.equal(s.dmg, 16);
});
