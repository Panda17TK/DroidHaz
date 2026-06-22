import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { hasLineOfSight } = await import(BASE + 'systems/los.js');
const { rebuildFlowField } = await import(BASE + 'systems/flowfield.js');

// 小さな手書きマップで state を組む（TILE=32 前提）
function mkState(rows) {
  const h = rows.length, w = rows[0].length;
  const map = rows.map((r) => r.split(''));
  const flow = Array.from({ length: h }, () => Array(w).fill(Infinity));
  return { dim: { w, h }, map, flow, player: { x: 0, y: 0 } };
}

test('LOS: 開けた空間は見通せる', () => {
  const s = mkState([
    '......',
    '......',
    '......',
  ]);
  // タイル(0,0)中心 → (5,2)中心
  assert.equal(hasLineOfSight(s, 16, 16, 5 * 32 + 16, 2 * 32 + 16), true);
});

test('LOS: 壁があると遮られる', () => {
  const s = mkState([
    '......',
    '..##..',
    '......',
  ]);
  // (0,1) から (5,1) の間に壁(2..3,1)
  assert.equal(hasLineOfSight(s, 16, 1 * 32 + 16, 5 * 32 + 16, 1 * 32 + 16), false);
});

test('flowfield: プレイヤーセルが距離0、隣接が増加', () => {
  const s = mkState([
    '....',
    '....',
    '....',
  ]);
  s.player.x = 16; s.player.y = 16; // タイル(0,0)
  rebuildFlowField(s);
  assert.equal(s.flow[0][0], 0);
  assert.equal(s.flow[0][1], 1);
  assert.equal(s.flow[1][0], 1);
  // 対角は経路距離2（4近傍 BFS）
  assert.equal(s.flow[1][1], 2);
});

test('flowfield: 壁の向こうは迂回距離になる', () => {
  const s = mkState([
    '....',
    '###.',
    '....',
  ]);
  s.player.x = 16; s.player.y = 16; // (0,0)
  rebuildFlowField(s);
  // (0,2) は壁(0..2,1)で塞がれ、右端(3,*)を回り込む → 大きい距離
  assert.ok(s.flow[2][0] > 3 && Number.isFinite(s.flow[2][0]));
});
