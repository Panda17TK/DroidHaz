import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fxCount } = await import('../js/systems/fx.js');
const { clampStickCenter } = await import('../js/core/touch.js');

// ===== REQ-PERF-2: FX 密度 =====
test('density=1 は据え置き', () => {
  assert.equal(fxCount(12, 1), 12);
  assert.equal(fxCount(3, 1), 3);
});

test('density=0.5 で半減', () => {
  assert.equal(fxCount(12, 0.5), 6);
  assert.equal(fxCount(22, 0.5), 11);
});

test('最低 1 は残す', () => {
  assert.equal(fxCount(3, 0.1), 1);
  assert.equal(fxCount(1, 0.3), 1);
});

test('density 未指定/不正は 1 扱い', () => {
  assert.equal(fxCount(8, undefined), 8);
  assert.equal(fxCount(8, 0), 8);
  assert.equal(fxCount(8, -1), 8);
});

test('density>1 は 1 にクランプ', () => {
  assert.equal(fxCount(8, 3), 8);
});

// ===== REQ-DISP-2: スティック中心のセーフエリア clamp =====
const INSETS = { top: 60, right: 20, bottom: 34, left: 20 };

test('画面端タップでも base 半径分内側に収まる', () => {
  const R = 60, vw = 800, vh = 1600;
  // 下端ギリギリ
  const a = clampStickCenter(400, 1599, R, INSETS, vw, vh);
  assert.ok(a.y <= vh - INSETS.bottom - R + 1e-9, `y=${a.y}`);
  // 左上隅
  const b = clampStickCenter(0, 0, R, INSETS, vw, vh);
  assert.ok(b.x >= INSETS.left + R - 1e-9);
  assert.ok(b.y >= INSETS.top + R - 1e-9);
});

test('内側のタップはそのまま', () => {
  const R = 60;
  const p = clampStickCenter(400, 800, R, INSETS, 800, 1600);
  assert.equal(p.x, 400);
  assert.equal(p.y, 800);
});

test('範囲反転（極小画面）でも例外なく中点を返す', () => {
  const R = 60;
  const p = clampStickCenter(50, 50, R, INSETS, 100, 100);
  assert.ok(isFinite(p.x) && isFinite(p.y));
});
