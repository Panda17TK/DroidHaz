import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { radialAtOrigin, verticalLinear, radialQuant, clearGradCache } =
  await import(BASE + 'render/grad-cache.js');

// createRadialGradient/LinearGradient の呼び出し回数を数えるモック ctx
function mockCtx() {
  const grad = { addColorStop() {} };
  const calls = { radial: 0, linear: 0 };
  return {
    calls,
    createRadialGradient() { calls.radial++; return grad; },
    createLinearGradient() { calls.linear++; return grad; },
  };
}

test('radialAtOrigin は同一キーで生成1回（キャッシュ命中）', () => {
  clearGradCache();
  const ctx = mockCtx();
  const stops = [[0, '#fff'], [1, '#000']];
  radialAtOrigin(ctx, 0, 40, stops, 'k1');
  radialAtOrigin(ctx, 0, 40, stops, 'k1');
  radialAtOrigin(ctx, 0, 40, stops, 'k1');
  assert.equal(ctx.calls.radial, 1);
});

test('radialAtOrigin は異キーで都度生成', () => {
  clearGradCache();
  const ctx = mockCtx();
  radialAtOrigin(ctx, 0, 40, [[0, '#fff']], 'a');
  radialAtOrigin(ctx, 0, 40, [[0, '#fff']], 'b');
  assert.equal(ctx.calls.radial, 2);
});

test('verticalLinear は高さ毎にキャッシュ', () => {
  clearGradCache();
  const ctx = mockCtx();
  verticalLinear(ctx, 720, [[0, '#000']], 'bg');
  verticalLinear(ctx, 720, [[0, '#000']], 'bg'); // 命中
  verticalLinear(ctx, 1080, [[0, '#000']], 'bg'); // 別サイズ→新規
  assert.equal(ctx.calls.linear, 2);
});

test('radialQuant は半径を2px丸めてキャッシュ命中率を上げる', () => {
  clearGradCache();
  const ctx = mockCtx();
  radialQuant(ctx, 16.0, [[0, '#f00']], 'q');
  radialQuant(ctx, 16.9, [[0, '#f00']], 'q'); // 16.9→丸め16 と一致
  radialQuant(ctx, 17.1, [[0, '#f00']], 'q'); // →18 で別
  assert.equal(ctx.calls.radial, 2);
});
