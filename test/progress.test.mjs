import { test } from 'node:test';
import assert from 'node:assert/strict';

// mock kv（localStorage）
class LS {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new LS();

const {
  DEFAULT_PROGRESS, normalizeProgress, markStageReached, isEndlessUnlocked,
  readProgress, writeProgress,
} = await import('../js/systems/progress.js');

test('normalizeProgress は既定を補完', () => {
  assert.deepEqual(normalizeProgress({}), DEFAULT_PROGRESS);
  assert.deepEqual(normalizeProgress(null), DEFAULT_PROGRESS);
});

test('normalizeProgress は不正値を矯正', () => {
  const p = normalizeProgress({ bestStage: -3, lastMode: 'x', endlessUnlocked: 1 });
  assert.equal(p.bestStage, 1);
  assert.equal(p.lastMode, 'stage');
  assert.equal(p.endlessUnlocked, true);
});

test('markStageReached: bestStage を更新（後退しない）', () => {
  let p = normalizeProgress({});
  p = markStageReached(p, 3, 4);
  assert.equal(p.bestStage, 3);
  p = markStageReached(p, 2, 4); // 後退しない
  assert.equal(p.bestStage, 3);
});

test('markStageReached: stageMax 到達でエンドレス解放＋全クリア', () => {
  let p = normalizeProgress({});
  assert.equal(isEndlessUnlocked(p), false);
  p = markStageReached(p, 4, 4);
  assert.equal(p.allCleared, true);
  assert.equal(p.endlessUnlocked, true);
  assert.equal(isEndlessUnlocked(p), true);
});

test('markStageReached: stageMax 未満では解放しない', () => {
  const p = markStageReached(normalizeProgress({}), 3, 4);
  assert.equal(p.endlessUnlocked, false);
});

test('read/write 往復', () => {
  writeProgress({ bestStage: 2, endlessUnlocked: true, lastMode: 'endless' });
  const p = readProgress();
  assert.equal(p.bestStage, 2);
  assert.equal(p.endlessUnlocked, true);
  assert.equal(p.lastMode, 'endless');
});

test('未保存時は既定を返す', () => {
  globalThis.localStorage = new LS(); // クリア
  assert.deepEqual(readProgress(), DEFAULT_PROGRESS);
});
