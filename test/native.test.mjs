import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  shouldAutoPause, androidBackAction,
  hapticImpact, initNativeChrome, exitApp, isNativeAndroid, isNativePlatform,
} = await import('../js/services/native.js');
const { createUiState, pushOverlay } = await import('../js/core/ui-state.js');

function mkState(over) {
  return { gameOver: !!over, ui: createUiState() };
}

test('playing 中はバックグラウンドで自動ポーズする', () => {
  const s = mkState(false);
  assert.equal(shouldAutoPause(s), true);
});

test('gameover 中は自動ポーズしない', () => {
  const s = mkState(true);
  assert.equal(shouldAutoPause(s), false);
});

test('既に overlay 表示中（停止済み）は何もしない', () => {
  const s = mkState(false);
  pushOverlay(s.ui, 'settings');
  assert.equal(shouldAutoPause(s), false);
});

test('overlay を閉じて playing に戻れば再び自動ポーズ対象', () => {
  const s = mkState(false);
  pushOverlay(s.ui, 'pause');
  s.ui.overlayStack.length = 0; // 閉じた
  assert.equal(shouldAutoPause(s), true);
});

test('state 不正でも例外を投げず false', () => {
  assert.equal(shouldAutoPause(null), false);
  assert.equal(shouldAutoPause({}), true); // gameOver/stack 無し → playing 扱い
});

// ===== REQ-NATIVE-2: Android Back の状態遷移 =====
test('Back: playing（空）→ openPause', () => {
  const ui = createUiState();
  assert.equal(androidBackAction(ui), 'openPause');
});

test('Back: settings/save/load → closeTop', () => {
  for (const name of ['settings', 'save', 'load']) {
    const ui = createUiState();
    pushOverlay(ui, 'pause');
    pushOverlay(ui, name);
    assert.equal(androidBackAction(ui), 'closeTop', name);
  }
});

test('Back: pause が最上位 → confirmExit（終了確認）', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  assert.equal(androidBackAction(ui), 'confirmExit');
});

test('Back: confirm が最上位 → closeTop（=cancel）', () => {
  const ui = createUiState();
  pushOverlay(ui, 'pause');
  pushOverlay(ui, 'confirm');
  assert.equal(androidBackAction(ui), 'closeTop');
});

test('Back: gameover → noop（いきなり終了しない）', () => {
  const ui = createUiState();
  pushOverlay(ui, 'gameover');
  assert.equal(androidBackAction(ui), 'noop');
});

test('Back: ui 未指定でも例外なく openPause', () => {
  assert.equal(androidBackAction(null), 'openPause');
});

// ===== F4c: Native 専用 API は非ネイティブ（Web/Node）で no-op・例外なし =====
test('非ネイティブ判定は false', () => {
  assert.equal(isNativePlatform(), false);
  assert.equal(isNativeAndroid(), false);
});

test('hapticImpact / initNativeChrome / exitApp は例外を投げない（no-op）', () => {
  assert.doesNotThrow(() => hapticImpact('light'));
  assert.doesNotThrow(() => hapticImpact('medium'));
  assert.doesNotThrow(() => hapticImpact('heavy'));
  assert.doesNotThrow(() => initNativeChrome({ background: '#0b0e13' }));
  assert.doesNotThrow(() => initNativeChrome());
  assert.doesNotThrow(() => exitApp());
});
