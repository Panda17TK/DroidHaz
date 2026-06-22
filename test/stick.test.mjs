import { test } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeStick } = await import('../js/core/touch.js');

const R = 60;

test('半径比 deadZone 未満は中立（active=false）', () => {
  // 18% 未満 → 10/60 ≈ 0.167
  const s = normalizeStick({ dx: 10, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.equal(s.active, false);
  assert.equal(s.magnitude, 0);
  assert.equal(s.x, 0); assert.equal(s.y, 0);
});

test('deadZone を超えると active かつ magnitude>0', () => {
  const s = normalizeStick({ dx: 30, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.equal(s.active, true);
  assert.ok(s.magnitude > 0 && s.magnitude < 1);
});

test('100%（maxZone）以上で magnitude∈[0.98,1.0]', () => {
  const s = normalizeStick({ dx: R, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.ok(s.magnitude >= 0.98 && s.magnitude <= 1.0, `mag=${s.magnitude}`);
  const s2 = normalizeStick({ dx: R * 3, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.equal(s2.magnitude, 1); // clamp
});

test('斜めでも縦横より速くならない（合成速度は magnitude 以下）', () => {
  const s = normalizeStick({ dx: R, dy: R, radius: R, deadZone: 0.18, maxZone: 1 });
  const speed = Math.hypot(s.x, s.y);
  assert.ok(speed <= 1.0 + 1e-9, `speed=${speed}`);
  assert.ok(Math.abs(speed - s.magnitude) < 1e-9, 'speed == magnitude');
});

test('方向は単位ベクトル × magnitude', () => {
  const s = normalizeStick({ dx: 0, dy: 40, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.equal(s.x, 0);
  assert.ok(s.y > 0);
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - s.magnitude) < 1e-9);
});

test('中心（dx=dy=0）は中立', () => {
  const s = normalizeStick({ dx: 0, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.equal(s.active, false);
  assert.equal(s.magnitude, 0);
});

test('deadZone 直上から 0 にリマップされる', () => {
  // raw = deadZone ちょうど → magnitude ≈ 0
  const s = normalizeStick({ dx: R * 0.18, dy: 0, radius: R, deadZone: 0.18, maxZone: 1 });
  assert.ok(s.magnitude < 1e-6, `mag=${s.magnitude}`);
});
