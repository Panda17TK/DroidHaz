// js/systems/scores.js
// ローカルランキングのデータ＆整形（kv 経由）。overlay.js（ゲームオーバー画面）と
// render/scores-menu.js（タイトルのスコア）で共有し、二重実装を避ける。

import { getItem, setItem } from '../services/kv.js';

export const KEY_SCORES = 'arena_scores';

export function readScores() {
  try { return JSON.parse(getItem(KEY_SCORES) || '[]'); } catch (_e) { return []; }
}
export function writeScores(list) {
  try { setItem(KEY_SCORES, JSON.stringify(list)); } catch (_e) {}
}

// 到達WAVE優先→生存時間でソートし上位 n 件。
export function topScores(n = 10) {
  return readScores()
    .slice()
    .sort((a, b) => (b.wave - a.wave) || (b.timeMs - a.timeMs))
    .slice(0, n);
}

export function fmtTime(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
