import { test } from 'node:test';
import assert from 'node:assert/strict';

const { pickAutoTarget } = await import('../js/systems/autoaim.js');

const P = { x: 0, y: 0 };
const losAll = () => true;

test('敵不在なら null（発射しない）', () => {
  assert.equal(pickAutoTarget(P, [], losAll, 500), null);
});

test('最寄りの敵を選ぶ', () => {
  const mobs = [
    { id: 1, x: 100, y: 0, hp: 10 },
    { id: 2, x: 30, y: 0, hp: 10 },
    { id: 3, x: 60, y: 0, hp: 10 },
  ];
  assert.equal(pickAutoTarget(P, mobs, losAll, 500).id, 2);
});

test('射程外は除外', () => {
  const mobs = [{ id: 1, x: 1000, y: 0, hp: 10 }];
  assert.equal(pickAutoTarget(P, mobs, losAll, 480), null);
});

test('射線が通らない敵は除外', () => {
  const mobs = [
    { id: 1, x: 30, y: 0, hp: 10 },   // 近いが LOS なし
    { id: 2, x: 80, y: 0, hp: 10 },   // 遠いが LOS あり
  ];
  const los = (m) => m.id !== 1;
  assert.equal(pickAutoTarget(P, mobs, los, 500).id, 2);
});

test('hp<=0 の敵は除外', () => {
  const mobs = [
    { id: 1, x: 20, y: 0, hp: 0 },
    { id: 2, x: 50, y: 0, hp: 5 },
  ];
  assert.equal(pickAutoTarget(P, mobs, losAll, 500).id, 2);
});

test('同距離なら HP の低い敵を優先', () => {
  const mobs = [
    { id: 1, x: 40, y: 0, hp: 30 },
    { id: 2, x: 0, y: 40, hp: 10 }, // 同距離 (40)・HP低
    { id: 3, x: -40, y: 0, hp: 50 },
  ];
  assert.equal(pickAutoTarget(P, mobs, losAll, 500).id, 2);
});

test('同距離・同HP なら id 昇順', () => {
  const mobs = [
    { id: 9, x: 40, y: 0, hp: 10 },
    { id: 3, x: 0, y: 40, hp: 10 },
    { id: 7, x: -40, y: 0, hp: 10 },
  ];
  assert.equal(pickAutoTarget(P, mobs, losAll, 500).id, 3);
});

test('losFn 省略時は全敵が候補（最寄り）', () => {
  const mobs = [{ id: 1, x: 90, y: 0, hp: 1 }, { id: 2, x: 20, y: 0, hp: 1 }];
  assert.equal(pickAutoTarget(P, mobs, null, 500).id, 2);
});
