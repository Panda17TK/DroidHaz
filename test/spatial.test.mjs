import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { buildMobGrid, forNearby, findNearby } = await import(BASE + 'systems/spatial.js');

function mkState(mobs) { return { mobs }; }

test('forNearby は近傍セルの mob のみ列挙', () => {
  const mobs = [
    { x: 10, y: 10, hp: 1 },
    { x: 20, y: 20, hp: 1 },
    { x: 1000, y: 1000, hp: 1 }, // 遠い
  ];
  const grid = buildMobGrid(mkState(mobs), 48);
  const found = [];
  forNearby(grid, 15, 15, 30, (m) => found.push(m));
  assert.ok(found.includes(mobs[0]));
  assert.ok(found.includes(mobs[1]));
  assert.ok(!found.includes(mobs[2]));
});

test('死亡 mob はグリッドに含めない', () => {
  const mobs = [{ x: 10, y: 10, hp: 0 }];
  const grid = buildMobGrid(mkState(mobs), 48);
  let count = 0;
  forNearby(grid, 10, 10, 50, () => count++);
  assert.equal(count, 0);
});

test('findNearby は条件一致で早期 return', () => {
  const mobs = [
    { x: 10, y: 10, hp: 1, id: 'a' },
    { x: 12, y: 12, hp: 1, id: 'b' },
  ];
  const grid = buildMobGrid(mkState(mobs), 48);
  const hit = findNearby(grid, 11, 11, 20, (m) => m.hp > 0);
  assert.ok(hit && (hit.id === 'a' || hit.id === 'b'));
  const miss = findNearby(grid, 5000, 5000, 20, () => true);
  assert.equal(miss, null);
});

test('グリッド結果は全走査と一致（無作為配置）', () => {
  const mobs = [];
  for (let i = 0; i < 200; i++) mobs.push({ x: Math.random() * 2000, y: Math.random() * 2000, hp: 1 });
  const grid = buildMobGrid(mkState(mobs), 48);
  const cx = 1000, cy = 1000, r = 100, r2 = r * r;
  const viaGrid = new Set();
  forNearby(grid, cx, cy, r, (m) => {
    const dx = m.x - cx, dy = m.y - cy;
    if (dx * dx + dy * dy <= r2) viaGrid.add(m);
  });
  const viaScan = new Set();
  for (const m of mobs) {
    const dx = m.x - cx, dy = m.y - cy;
    if (dx * dx + dy * dy <= r2) viaScan.add(m);
  }
  assert.equal(viaGrid.size, viaScan.size);
  for (const m of viaScan) assert.ok(viaGrid.has(m));
});
