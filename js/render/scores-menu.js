// js/render/scores-menu.js
// REQ-TITLE-1: スコア（ローカルランキング）overlay。top==='scores' のとき表示。
// データは overlay.js と同じ arena_scores（kv 経由）。読み取り専用。

import { topScores, fmtTime, escapeHtml } from '../systems/scores.js';

export function mountScoresMenu(rootEl, { uiCtl }) {
  if (!rootEl) return { render() {} };

  const el = document.createElement('div');
  el.className = 'overlay scores-overlay hidden';
  el.id = 'scores-overlay';
  el.innerHTML =
    '<div class="panel scores-panel" role="dialog" aria-label="スコア">' +
    '  <h2>ランキング（上位10件）</h2>' +
    '  <div class="scores-board"></div>' +
    '  <div class="form scores-actions"><button type="button" class="scores-close" aria-label="閉じる">閉じる</button></div>' +
    '</div>';
  rootEl.appendChild(el);

  const boardEl = el.querySelector('.scores-board');
  el.querySelector('.scores-close').addEventListener('click', () => uiCtl.closeTop());

  function renderBoard() {
    const list = topScores();
    boardEl.innerHTML = list.length
      ? list.map((r, i) =>
          (i + 1) + '. ' + escapeHtml(r.name || '(no name)') +
          ' — WAVE ' + (r.wave | 0) + ' / ' + fmtTime(r.timeMs)).join('<br>')
      : '<i>まだ記録がありません</i>';
  }

  function render(ui) {
    const top = ui.overlayStack[ui.overlayStack.length - 1] || null;
    const show = top === 'scores';
    el.classList.toggle('hidden', !show);
    if (show) renderBoard();
  }

  return { render };
}
