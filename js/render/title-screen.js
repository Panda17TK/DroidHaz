// js/render/title-screen.js
// REQ-TITLE-1 / MODE-1(基礎): タイトル画面。appPhase==='title' のとき表示。
// 設定/スコア/つづき は既存 overlay stack を再利用（二重実装しない）。
//
// 引数: { state, getProgress, hasSaves, getCharId, actions }
//   actions: { start(mode), continue(), openSettings(), openScores(), onModeChange(mode), onCharChange(id) }

import { CHARACTERS, CHARACTER_IDS } from '../state/characters.js';

export function mountTitleScreen(rootEl, { state, getProgress, hasSaves, getCharId, actions }) {
  if (!rootEl) return { render() {} };

  const el = document.createElement('div');
  el.className = 'title-screen hidden';
  el.innerHTML =
    '<div class="title-inner" role="dialog" aria-label="タイトル">' +
    '  <h1 class="title-logo">DROIDHAZ</h1>' +
    '  <p class="title-sub">見下ろし型サバイバル・シューター</p>' +
    '  <div class="title-chars" role="group" aria-label="キャラクター選択"></div>' +
    '  <p class="title-char-blurb"></p>' +
    '  <div class="title-mode" role="group" aria-label="モード選択">' +
    '    <button type="button" class="tm-btn" data-mode="stage" aria-label="ステージモード">ステージ</button>' +
    '    <button type="button" class="tm-btn" data-mode="endless" aria-label="エンドレスモード">エンドレス</button>' +
    '  </div>' +
    '  <div class="title-menu">' +
    '    <button type="button" class="tt-btn" data-act="start" aria-label="はじめから">▶ はじめから</button>' +
    '    <button type="button" class="tt-btn" data-act="continue" aria-label="つづきから">↩ つづきから</button>' +
    '    <button type="button" class="tt-btn" data-act="settings" aria-label="設定">⚙ 設定</button>' +
    '    <button type="button" class="tt-btn" data-act="scores" aria-label="スコア">★ スコア</button>' +
    '  </div>' +
    '  <p class="title-hint"></p>' +
    '</div>';
  rootEl.appendChild(el);

  const modeBtns = Array.from(el.querySelectorAll('.tm-btn'));
  const btn = (act) => el.querySelector('.tt-btn[data-act="' + act + '"]');
  const hintEl = el.querySelector('.title-hint');
  const charsEl = el.querySelector('.title-chars');
  const blurbEl = el.querySelector('.title-char-blurb');

  // キャラ選択ボタンを生成（名前は textContent で安全に挿入）。
  const charBtns = {};
  for (const id of CHARACTER_IDS) {
    const c = CHARACTERS[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-char';
    b.dataset.char = id;
    b.style.setProperty('--char-accent', (c.theme && c.theme.accent) || '#8aa0c0');
    b.style.setProperty('--char-skin', (c.theme && c.theme.skin) || '#e7b48a');
    const chip = document.createElement('span'); chip.className = 'tc-char-chip';
    const nm = document.createElement('span'); nm.className = 'tc-char-name'; nm.textContent = c.name;
    b.appendChild(chip); b.appendChild(nm);
    b.setAttribute('aria-label', 'キャラ: ' + c.name);
    b.addEventListener('click', () => { if (actions.onCharChange) actions.onCharChange(id); refresh(); });
    charsEl.appendChild(b);
    charBtns[id] = b;
  }

  let mode = (state.mode === 'endless') ? 'endless' : 'stage';

  function setMode(m) {
    const prog = getProgress ? getProgress() : null;
    if (m === 'endless' && !(prog && prog.endlessUnlocked)) return; // ロック中は無視
    mode = m; state.mode = m;
    if (actions.onModeChange) actions.onModeChange(m);
    refresh();
  }

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  btn('start').addEventListener('click', () => actions.start(mode));
  btn('continue').addEventListener('click', () => { if (!btn('continue').disabled) actions.continue(); });
  btn('settings').addEventListener('click', () => actions.openSettings());
  btn('scores').addEventListener('click', () => actions.openScores());

  function refresh() {
    const prog = getProgress ? getProgress() : null;
    const endlessOk = !!(prog && prog.endlessUnlocked);
    // モードボタンの選択/ロック表示
    for (const b of modeBtns) {
      const m = b.dataset.mode;
      b.classList.toggle('sel', m === mode);
      if (m === 'endless') {
        b.disabled = !endlessOk;
        b.textContent = endlessOk ? 'エンドレス' : 'エンドレス🔒';
      }
    }
    // つづき: セーブがある or 到達ステージ>1 or エンドレス解放のいずれかで有効
    const canContinue = (hasSaves && hasSaves()) || (prog && (prog.bestStage > 1 || prog.endlessUnlocked));
    const cb = btn('continue');
    cb.disabled = !canContinue;
    // ヒント
    const bs = prog ? prog.bestStage : 1;
    hintEl.textContent = endlessOk
      ? '全ステージ制覇！ エンドレス解放中（到達ステージ ' + bs + '）'
      : '到達ステージ ' + bs + ' ／ 全制覇でエンドレス解放';
    // キャラ選択のハイライト＋説明
    const cid = getCharId ? getCharId() : 'hero';
    for (const id of CHARACTER_IDS) if (charBtns[id]) charBtns[id].classList.toggle('sel', id === cid);
    const cc = CHARACTERS[cid] || CHARACTERS.hero;
    if (blurbEl) blurbEl.textContent = cc.name + ' — ' + (cc.blurb || '');
  }

  function render() {
    const show = (state.appPhase === 'title' || state.appPhase == null);
    el.classList.toggle('hidden', !show);
    if (show) {
      if (state.mode === 'endless' && getProgress && getProgress().endlessUnlocked) mode = 'endless';
      else mode = 'stage';
      refresh();
      try { btn('start').focus(); } catch (_e) {}
    }
  }

  return { render };
}
