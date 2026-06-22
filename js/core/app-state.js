// js/core/app-state.js
// REQ-APP-1: アプリ・フェーズの状態モデル（DESIGN §8.0.1）。純ロジック＝テスト可能。
// overlayStack/paused の上位に「アプリ全体のフェーズ」を 1 つ持つ。
//   title   … タイトル画面（シミュレーション停止）
//   playing … プレイ中（既存。§0 の paused/overlayStack はこの中で機能）

export const APP_PHASES = ['title', 'playing'];

export function isPlaying(state) {
  return !!state && state.appPhase === 'playing';
}
export function isTitle(state) {
  return !state || state.appPhase === 'title' || state.appPhase == null;
}

// 許可された遷移か（現状は title<->playing を相互許可。未知フェーズは不可）。
export function canTransition(from, to) {
  return APP_PHASES.indexOf(to) !== -1;
}

// フェーズを設定（許可された遷移のみ適用）。適用後のフェーズを返す。
export function setAppPhase(state, phase) {
  if (!state) return null;
  const from = state.appPhase || 'title';
  if (!canTransition(from, phase)) return from;
  state.appPhase = phase;
  return state.appPhase;
}

// シミュレーションを止めるべきかの「唯一の述語」（純ロジック＝テスト可能）。
// DESIGN §0.1: state.paused の所有者を 1 箇所に集約するため、main.js syncUi() は
// これを唯一のソースとして state.paused を導出する。
//   ・gameover            … 停止（リスタートまで）
//   ・overlay 表示中       … 停止（pause/settings/save/… のスタック非空）
//   ・ウェーブ間 intermission … 停止（強化カード選択中。カード確定まで凍結）
//   ・開発者エディタ表示中  … 停止（dev のみ）
export function isSimPaused(state) {
  if (!state) return true;
  if (state.gameOver) return true;
  const ui = state.ui;
  if (ui && ui.overlayStack && ui.overlayStack.length > 0) return true;
  if (state.wave && state.wave.phase === 'intermission') return true;
  if (state._devOpen) return true;
  return false;
}
