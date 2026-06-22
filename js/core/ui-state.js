// js/core/ui-state.js
// オーバーレイスタックの純ロジック（DOM・canvas 非依存＝単体テスト可能）。
// DESIGN.md §0.1/0.2: pause/settings/save/load/confirm/gameover/dev を
// 1 つのスタックで管理し、push/closeTop/closeAll を「唯一の遷移API」とする。
//
// 規則:
//  - overlayStack が非空のとき paused 相当（isUiPaused）。
//  - gameover は最下位固定で、closeTopOverlay では閉じない（リスタート/再生成で消す）。
//  - gameover 表示中は pause を積まない。
//  - 同一 overlay を連続して積まない（多重 push 防止）。
//  - overlay を閉じた直後は resumeGuard=1（暴発防止：呼び出し側が hold 入力をリセット）。

export const OVERLAYS = ['pause', 'settings', 'save', 'load', 'confirm', 'gameover', 'dev', 'scores', 'continue'];

export function createUiState() {
  return { overlayStack: [], resumeGuard: 0 };
}

// 非空 → UI ポーズ中（ゲーム更新を止める）。
export function isUiPaused(ui) {
  return ui.overlayStack.length > 0;
}

export function topOverlay(ui) {
  const n = ui.overlayStack.length;
  return n ? ui.overlayStack[n - 1] : null;
}

export function hasOverlay(ui, name) {
  return ui.overlayStack.indexOf(name) !== -1;
}

// overlay を積む。積めなかった/積まなかった場合も現在の最上位を返す。
export function pushOverlay(ui, name) {
  if (OVERLAYS.indexOf(name) === -1) return topOverlay(ui);
  // gameover 表示中は pause を積まない（誤操作・再開不能防止）
  if (name === 'pause' && hasOverlay(ui, 'gameover')) return topOverlay(ui);
  // 多重 push 防止（最上位と同じものは積まない）
  if (topOverlay(ui) === name) return name;
  ui.overlayStack.push(name);
  return name;
}

// 最上位を閉じる。Esc / Android Back / 閉じるボタンが共通で呼ぶ唯一の処理。
export function closeTopOverlay(ui) {
  const top = topOverlay(ui);
  if (top == null) return null;
  // gameover は最下位固定で閉じない（リスタート等で別途消す）
  if (top === 'gameover') return top;
  ui.overlayStack.pop();
  ui.resumeGuard = 1; // 閉じた直後 1 フレームは入力暴発を抑止
  return topOverlay(ui);
}

// gameover は残して他を全て閉じる。
export function closeAllOverlays(ui) {
  const keepGameover = hasOverlay(ui, 'gameover');
  ui.overlayStack.length = 0;
  if (keepGameover) ui.overlayStack.push('gameover');
  ui.resumeGuard = 1;
  return topOverlay(ui);
}

// Esc / Back の共通入口：空かつ playing なら pause を開き、そうでなければ最上位を閉じる。
// （Android 固有の「pause で Back→終了確認」は F4b が別途上乗せする）
export function requestBack(ui) {
  if (ui.overlayStack.length === 0) return pushOverlay(ui, 'pause');
  return closeTopOverlay(ui);
}

// 暴発防止フレームを消費する（呼び出し側が 1 度だけ true を受け取る）。
export function consumeResumeGuard(ui) {
  if (ui.resumeGuard > 0) { ui.resumeGuard = 0; return true; }
  return false;
}
