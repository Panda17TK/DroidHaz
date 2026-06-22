import { test } from 'node:test';
import assert from 'node:assert/strict';

const { APP_PHASES, isPlaying, isTitle, canTransition, setAppPhase } =
  await import('../js/core/app-state.js');
const { stageForWave, stageDef, STAGE_WAVES, STAGE_MAX } =
  await import('../js/state/stages.js');

// ===== REQ-APP-1: アプリ・フェーズ =====
test('既定/未設定は title 扱い', () => {
  assert.equal(isTitle({}), true);
  assert.equal(isPlaying({}), false);
  assert.equal(isTitle({ appPhase: 'title' }), true);
});

test('setAppPhase は有効フェーズのみ適用', () => {
  const s = { appPhase: 'title' };
  assert.equal(setAppPhase(s, 'playing'), 'playing');
  assert.equal(isPlaying(s), true);
  assert.equal(setAppPhase(s, 'title'), 'title');
  assert.equal(isTitle(s), true);
});

test('setAppPhase は未知フェーズを無視（現状維持）', () => {
  const s = { appPhase: 'playing' };
  assert.equal(setAppPhase(s, 'bogus'), 'playing');
  assert.equal(s.appPhase, 'playing');
});

test('canTransition は APP_PHASES のみ許可', () => {
  assert.equal(canTransition('title', 'playing'), true);
  assert.equal(canTransition('playing', 'title'), true);
  assert.equal(canTransition('title', 'bogus'), false);
  assert.equal(APP_PHASES.length, 2);
});

// ===== REQ-STAGE-1: stageForWave =====
test('stageForWave: 既定 5 ウェーブごとに 1 ステージ', () => {
  assert.equal(stageForWave(1), 1);
  assert.equal(stageForWave(5), 1);
  assert.equal(stageForWave(6), 2);
  assert.equal(stageForWave(10), 2);
  assert.equal(stageForWave(11), 3);
});

test('stageForWave: stageMax で頭打ち', () => {
  assert.equal(stageForWave(9999), STAGE_MAX);
});

test('stageForWave: 引数を変えられる（純）', () => {
  assert.equal(stageForWave(4, 3, 9), 2); // (4-1)/3+1 = 2
  assert.equal(stageForWave(7, 3, 9), 3);
});

test('stageDef: 範囲外は最終ステージにクランプ', () => {
  assert.equal(stageDef(1).id, 1);
  assert.equal(stageDef(STAGE_MAX).id, STAGE_MAX);
  assert.equal(stageDef(999).id, STAGE_MAX);
  assert.equal(stageDef(0).id, 1);
});

test('STAGE_WAVES/STAGE_MAX は正の整数', () => {
  assert.ok(STAGE_WAVES >= 1);
  assert.ok(STAGE_MAX >= 1);
});
