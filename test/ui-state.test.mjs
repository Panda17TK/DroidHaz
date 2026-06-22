import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  createUiState, isUiPaused, topOverlay, hasOverlay,
  pushOverlay, closeTopOverlay, closeAllOverlays, requestBack, consumeResumeGuard,
} = await import('../js/core/ui-state.js');

test('初期状態は空・非ポーズ', () => {
  const ui = createUiState();
  assert.equal(ui.overlayStack.length, 0);
  assert.equal(isUiPaused(ui), false);
  assert.equal(topOverlay(ui), null);
});

test('push で積み、非空なら paused 相当', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  assert.deepEqual(ui.overlayStack, ['pause']);
  assert.equal(isUiPaused(ui), true);
  assert.equal(topOverlay(ui), 'pause');
});

test('多重 push 防止（同じ最上位は積まない）', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  pushOverlay(ui, 'pause');
  assert.deepEqual(ui.overlayStack, ['pause']);
});

test('スタックを積み上げ closeTop で1枚ずつ閉じる', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  pushOverlay(ui, 'settings');
  assert.equal(topOverlay(ui), 'settings');
  closeTopOverlay(ui);
  assert.equal(topOverlay(ui), 'pause');
  closeTopOverlay(ui);
  assert.equal(topOverlay(ui), null);
  assert.equal(isUiPaused(ui), false);
});

test('未知の overlay 名は積まない', () => {
  const ui = createUiState();
  pushOverlay(ui, 'bogus');
  assert.equal(ui.overlayStack.length, 0);
});

test('gameover 表示中は pause を積めない', () => {
  const ui = createUiState();
  pushOverlay(ui, 'gameover');
  pushOverlay(ui, 'pause');
  assert.deepEqual(ui.overlayStack, ['gameover']);
  assert.equal(hasOverlay(ui, 'pause'), false);
});

test('gameover は closeTop で閉じない（最下位固定）', () => {
  const ui = createUiState();
  pushOverlay(ui, 'gameover');
  const top = closeTopOverlay(ui);
  assert.equal(top, 'gameover');
  assert.deepEqual(ui.overlayStack, ['gameover']);
});

test('gameover の上には他を積めて closeTop で剥がせる', () => {
  const ui = createUiState();
  pushOverlay(ui, 'gameover');
  pushOverlay(ui, 'confirm'); // リスタート確認など
  assert.equal(topOverlay(ui), 'confirm');
  closeTopOverlay(ui);
  assert.equal(topOverlay(ui), 'gameover');
});

test('closeAll は gameover を残して他を全消去', () => {
  const ui = createUiState();
  pushOverlay(ui, 'gameover');
  pushOverlay(ui, 'confirm');
  closeAllOverlays(ui);
  assert.deepEqual(ui.overlayStack, ['gameover']);

  const ui2 = createUiState();
  pushOverlay(ui2, 'pause');
  pushOverlay(ui2, 'settings');
  closeAllOverlays(ui2);
  assert.deepEqual(ui2.overlayStack, []);
});

test('requestBack: 空＆playing なら pause を開く', () => {
  const ui = createUiState();
  requestBack(ui);
  assert.deepEqual(ui.overlayStack, ['pause']);
});

test('requestBack: overlay があれば最上位を閉じる', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  pushOverlay(ui, 'settings');
  requestBack(ui);
  assert.equal(topOverlay(ui), 'pause');
});

test('closeTop で暴発防止フラグが立ち、1度だけ消費できる', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  closeTopOverlay(ui);
  assert.equal(consumeResumeGuard(ui), true);
  assert.equal(consumeResumeGuard(ui), false);
});

test('状態列：playing→pause→settings→Back→Back で playing に戻る', () => {
  const ui = createUiState();
  assert.equal(isUiPaused(ui), false);
  requestBack(ui); // pause
  assert.equal(topOverlay(ui), 'pause');
  pushOverlay(ui, 'settings');
  requestBack(ui); // close settings
  assert.equal(topOverlay(ui), 'pause');
  requestBack(ui); // close pause
  assert.equal(isUiPaused(ui), false);
});
