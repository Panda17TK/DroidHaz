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
