import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { computeView, clampCamera } = await import(BASE + 'render/view.js');

const TILE = 32, VTY = 15;
// マップは 30x20（state/maps.js のアリーナ相当）
const MAP = { mapW: 30, mapH: 20, tileSize: TILE, viewTilesY: VTY };

function view(w, h) { return computeView({ canvasW: w, canvasH: h, ...MAP }); }

test('縦長スマホ 1080x2160 で可視縦タイル≈15', () => {
  const v = view(1080, 2160);
  const tilesY = v.viewH / TILE;
  assert.ok(Math.abs(tilesY - 15) < 0.5, `tilesY=${tilesY}`);
});

test('横スマホ 2160x1080 で縦≈15 かつ横30タイルが収まる', () => {
  const v = view(2160, 1080);
  const tilesY = v.viewH / TILE;
  const tilesX = v.viewW / TILE;
  assert.ok(Math.abs(tilesY - 15) < 0.5, `tilesY=${tilesY}`);
  assert.ok(tilesX >= 30 - 1e-6, `tilesX=${tilesX} should fit full 30-wide map`);
});

test('zoom は fitZoom 以上（黒余白防止が最優先）', () => {
  for (const [w, h] of [[1080, 2160], [2160, 1080], [1920, 1080], [800, 600]]) {
    const v = view(w, h);
    assert.ok(v.zoom >= v.fitZoom - 1e-9, `zoom=${v.zoom} fit=${v.fitZoom} @${w}x${h}`);
  }
});

test('viewW/viewH は world サイズ以下（はみ出し＝黒余白が出ない）', () => {
  const worldW = MAP.mapW * TILE, worldH = MAP.mapH * TILE;
  for (const [w, h] of [[1080, 2160], [2160, 1080], [400, 400], [3000, 500]]) {
    const v = view(w, h);
    assert.ok(v.viewW <= worldW + 1e-6, `viewW=${v.viewW} > worldW=${worldW} @${w}x${h}`);
    assert.ok(v.viewH <= worldH + 1e-6, `viewH=${v.viewH} > worldH=${worldH} @${w}x${h}`);
  }
});

test('clampCamera は 0..camBounds に収める', () => {
  const v = view(1080, 2160);
  // 範囲外の目標
  const a = clampCamera(-9999, -9999, v.viewW, v.viewH, v.camBounds);
  assert.equal(a.camX, 0); assert.equal(a.camY, 0);
  const b = clampCamera(1e9, 1e9, v.viewW, v.viewH, v.camBounds);
  assert.equal(b.camX, v.camBounds.maxX);
  assert.equal(b.camY, v.camBounds.maxY);
});

test('マップが画面より小さくても black margin が出ない（極端な横長）', () => {
  // 3000x500 は横に極端 → fitZoom が効いて viewW ≤ worldW
  const v = view(3000, 500);
  assert.ok(v.viewW <= MAP.mapW * TILE + 1e-6);
});
