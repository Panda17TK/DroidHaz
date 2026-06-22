import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = '../js/';
const { MAPS, getMap } = await import(BASE + 'state/maps.js');

test('全マップの行幅が均一', () => {
  for (const m of MAPS) {
    const w = m.rows[0].length;
    for (const r of m.rows) assert.equal(r.length, w, `map ${m.id} の行幅不一致`);
  }
});

test('各マップに player スポーン(P)が1つ', () => {
  for (const m of MAPS) {
    const count = m.rows.join('').split('').filter((c) => c === 'P').length;
    assert.equal(count, 1, `map ${m.id} の P 数`);
  }
});

test('getMap は id 一致 / 既定で先頭', () => {
  assert.equal(getMap('corridors').id, 'corridors');
  assert.equal(getMap().id, MAPS[0].id);
  assert.equal(getMap('nonexistent').id, MAPS[0].id);
});

test('legend のマーカーは壁文字と衝突しない', () => {
  for (const m of MAPS) {
    for (const k of Object.keys(m.legend)) {
      assert.ok(k !== '#' && k !== 'D' && k !== '.', `map ${m.id} legend ${k} が予約文字`);
    }
  }
});
