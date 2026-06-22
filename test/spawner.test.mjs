import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/core/config.js';
import { startWave, startNextWave } from '../js/systems/spawner.js';
import { stageDef, stageForWave } from '../js/state/stages.js';

// 中ボス/ボスの即時投入を無効化し、ウェーブ進行ロジックだけを決定論的に検証する。
CONFIG.waves.bossEvery = 0;
CONFIG.waves.midBossEvery = 0;

function mkMap(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

function mkState() {
  const W = 9, H = 9;
  return {
    dim: { w: W, h: H },
    map: mkMap(W, H),
    mobs: [],
    player: { x: 4 * 32 + 16, y: 4 * 32 + 16, w: 22, h: 22 },
    wave: { num: 1, phase: 'active', toSpawn: 0, spawnCD: 0, choices: ['x'], interT: 9 },
    stats: { wave: 1 },
    timers: { elapsed: 0 },
    mode: 'stage',
    stage: 1,
    mapId: stageDef(1).mapId,
    _stageAllCleared: false,
  };
}

const noBus = { emit() {} };

test('startWave: num/phase/quota/choices を設定する', () => {
  const s = mkState();
  startWave(s, 3);
  assert.equal(s.wave.num, 3);
  assert.equal(s.wave.phase, 'active');
  assert.equal(s.wave.choices, null);
  assert.ok(s.wave.toSpawn >= 1, 'toSpawn は正');
  assert.equal(s.stats.wave, 3);
});

test('startNextWave: wave をちょうど1進める（HIGH-1 の二重進行が無い）', () => {
  const s = mkState();
  startWave(s, 1);
  startNextWave(s, noBus);
  assert.equal(s.wave.num, 2);
  startNextWave(s, noBus);
  assert.equal(s.wave.num, 3);
});

test('startNextWave: 同一ステージ帯内では stage を変えない', () => {
  const s = mkState();
  startWave(s, 1);
  const before = s.stage;
  startNextWave(s, noBus); // 1->2
  if (stageForWave(2) === before) assert.equal(s.stage, before);
});
