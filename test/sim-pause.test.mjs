import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSimPaused } from '../js/core/app-state.js';
import { createUiState, pushOverlay } from '../js/core/ui-state.js';

// HIGH-1: state.paused の唯一の導出述語。overlay / gameover / intermission / dev を一括判定。
function mk(over) {
  return Object.assign({ gameOver: false, ui: createUiState(), wave: { phase: 'active' } }, over);
}

test('通常プレイ中（overlay空・active・非gameover）は停止しない', () => {
  assert.equal(isSimPaused(mk()), false);
});

test('gameover は停止', () => {
  assert.equal(isSimPaused(mk({ gameOver: true })), true);
});

test('overlay 表示中は停止', () => {
  const s = mk();
  pushOverlay(s.ui, 'pause');
  assert.equal(isSimPaused(s), true);
});

test('HIGH-1: intermission 中は overlay が空でも停止（強化カード選択の凍結）', () => {
  assert.equal(isSimPaused(mk({ wave: { phase: 'intermission' } })), true);
});

test('HIGH-1: intermission 中は pause を開閉してもスタックに依らず停止のまま', () => {
  const s = mk({ wave: { phase: 'intermission' } });
  pushOverlay(s.ui, 'pause');          // Esc で開く
  assert.equal(isSimPaused(s), true);
  s.ui.overlayStack.length = 0;        // Esc で閉じる（スタック空）
  // 旧実装はここで paused=false に戻り、カード裏でシム再開＆ウェーブ二重進行していた。
  assert.equal(isSimPaused(s), true);
});

test('dev エディタ表示中は停止', () => {
  assert.equal(isSimPaused(mk({ _devOpen: true })), true);
});

test('null は安全側で停止、空オブジェクトは playing 扱い', () => {
  assert.equal(isSimPaused(null), true);
  assert.equal(isSimPaused({}), false);
});
