// Node 組み込みテストランナー（node --test）で動く、純粋関数の単体テスト。
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { clamp, norm, rectInter, dist2, isSolidChar } = await import(BASE + 'systems/physics.js');

test('clamp 範囲内/外', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('norm は単位ベクトル', () => {
  const n = norm(3, 4);
  assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9);
  // ゼロ入力でも NaN にならない
  const z = norm(0, 0);
  assert.ok(Number.isFinite(z.x) && Number.isFinite(z.y));
});

test('dist2 は平方距離', () => {
  assert.equal(dist2(0, 0, 3, 4), 25);
  assert.equal(dist2(1, 1, 1, 1), 0);
});

test('rectInter は AABB 重なり', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 5, y: 0, w: 10, h: 10 };
  const c = { x: 100, y: 0, w: 10, h: 10 };
  assert.equal(rectInter(a, b), true);
  assert.equal(rectInter(a, c), false);
});

test('isSolidChar', () => {
  assert.equal(isSolidChar('#'), true);
  assert.equal(isSolidChar('D'), true);
  assert.equal(isSolidChar('.'), false);
});
