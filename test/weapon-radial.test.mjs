import { test } from 'node:test';
import assert from 'node:assert/strict';

const { radialAngleIndex, slotPosition } = await import('../js/render/weapon-radial.js');

test('中央 deadR 未満は -1（変更なし）', () => {
  assert.equal(radialAngleIndex(0, 0, 5, 28), -1);
  assert.equal(radialAngleIndex(5, 5, 5, 28), -1);
});

test('count<=0 は -1', () => {
  assert.equal(radialAngleIndex(0, -100, 0, 24), -1);
});

test('上方向はスロット0', () => {
  // dy 負 = 上
  assert.equal(radialAngleIndex(0, -100, 4, 24), 0);
});

test('4分割: 右=1, 下=2, 左=3', () => {
  assert.equal(radialAngleIndex(100, 0, 4, 24), 1);  // 右
  assert.equal(radialAngleIndex(0, 100, 4, 24), 2);  // 下
  assert.equal(radialAngleIndex(-100, 0, 4, 24), 3); // 左
});

test('境界付近でも 0..count-1 に収まる', () => {
  for (let deg = 0; deg < 360; deg += 7) {
    const a = deg * Math.PI / 180;
    const idx = radialAngleIndex(Math.cos(a) * 80, Math.sin(a) * 80, 5, 24);
    assert.ok(idx >= 0 && idx < 5, `deg=${deg} idx=${idx}`);
  }
});

test('slotPosition: スロット0 は中心の真上', () => {
  const p = slotPosition(0, 4, 100, 200, 50);
  assert.ok(Math.abs(p.x - 100) < 1e-9);
  assert.ok(Math.abs(p.y - 150) < 1e-9); // 上 = y-R
});

test('slotPosition: 半径 R を保つ', () => {
  for (let i = 0; i < 5; i++) {
    const p = slotPosition(i, 5, 0, 0, 60);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 60) < 1e-6);
  }
});
