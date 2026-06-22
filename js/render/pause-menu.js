// js/render/pause-menu.js
// REQ-TOUCH-1: ポーズメニュー（タッチ完結）。DESIGN.md §0.2 の overlay stack に乗る。
// 表示/遷移は ui-state（純ロジック）に従い、本モジュールは「描画＋操作 → uiCtl 呼び出し」のみ。
//
// uiCtl: { push(name), closeTop(), closeAll(), top() } … いずれも呼び出し後に main 側で syncUi。
// hooks: { onSettings?, onSave?, onLoad?, onRestartConfirmed, isNativeAndroid?, onQuitConfirmed? }

export function mountPauseMenu(rootEl, { state, uiCtl, hooks }) {
  if (!rootEl) return { render() {} };

  // ===== ポーズ overlay =====
  const pauseEl = document.createElement('div');
  pauseEl.className = 'overlay pause-overlay hidden';
  pauseEl.id = 'pause-overlay';
  pauseEl.innerHTML =
    '<div class="panel pause-panel" role="dialog" aria-label="ポーズメニュー">' +
    '  <h2>ポーズ</h2>' +
    '  <div class="pause-menu">' +
    '    <button type="button" class="pm-btn" data-act="resume" aria-label="再開">▶ 再開</button>' +
    '    <button type="button" class="pm-btn" data-act="save" aria-label="セーブ">💾 セーブ</button>' +
    '    <button type="button" class="pm-btn" data-act="load" aria-label="ロード">📂 ロード</button>' +
    '    <button type="button" class="pm-btn" data-act="settings" aria-label="設定">⚙ 設定</button>' +
    '    <button type="button" class="pm-btn" data-act="restart" aria-label="リスタート">↻ リスタート</button>' +
    '    <button type="button" class="pm-btn" data-act="title" aria-label="タイトルへ">⌂ タイトルへ</button>' +
    '    <button type="button" class="pm-btn pm-quit" data-act="quit" aria-label="終了">✕ 終了</button>' +
    '  </div>' +
    '</div>';

  // ===== 確認ダイアログ overlay（リスタート/終了） =====
  const confirmEl = document.createElement('div');
  confirmEl.className = 'overlay confirm-overlay hidden';
  confirmEl.id = 'confirm-overlay';
  confirmEl.innerHTML =
    '<div class="panel confirm-panel" role="alertdialog" aria-label="確認">' +
    '  <h2 class="cf-title">確認</h2>' +
    '  <p class="cf-msg"></p>' +
    '  <div class="form cf-actions">' +
    '    <button type="button" class="cf-ok" aria-label="OK">OK</button>' +
    '    <button type="button" class="cf-cancel" aria-label="キャンセル">キャンセル</button>' +
    '  </div>' +
    '</div>';

  rootEl.appendChild(pauseEl);
  rootEl.appendChild(confirmEl);

  const btn = (act) => pauseEl.querySelector('.pm-btn[data-act="' + act + '"]');
  const cfTitle  = confirmEl.querySelector('.cf-title');
  const cfMsg    = confirmEl.querySelector('.cf-msg');
  const cfOk     = confirmEl.querySelector('.cf-ok');
  const cfCancel = confirmEl.querySelector('.cf-cancel');

  let pendingOk = null; // 確認 OK 時に実行するコールバック

  function requestConfirm(title, message, onOk) {
    pendingOk = onOk || null;
    cfTitle.textContent = title || '確認';
    cfMsg.textContent = message || '';
    uiCtl.push('confirm');
  }

  // --- ポーズメニュー操作 ---
  btn('resume').addEventListener('click', () => uiCtl.closeTop());
  btn('save').addEventListener('click', () => { if (hooks.onSave) hooks.onSave(); });
  btn('load').addEventListener('click', () => { if (hooks.onLoad) hooks.onLoad(); });
  btn('settings').addEventListener('click', () => { if (hooks.onSettings) hooks.onSettings(); });
  btn('restart').addEventListener('click', () => {
    requestConfirm('リスタート', '最初からやり直しますか？（現在の進行は失われます）',
      () => { uiCtl.closeAll(); if (hooks.onRestartConfirmed) hooks.onRestartConfirmed(); });
  });
  btn('title').addEventListener('click', () => {
    requestConfirm('タイトルへ', 'タイトルに戻りますか？（現在の進行は失われます）',
      () => { uiCtl.closeAll(); if (hooks.onTitleConfirmed) hooks.onTitleConfirmed(); });
  });
  btn('quit').addEventListener('click', () => {
    requestConfirm('終了', 'アプリを終了しますか？',
      () => { if (hooks.onQuitConfirmed) hooks.onQuitConfirmed(); });
  });

  // --- 確認ダイアログ操作 ---
  cfOk.addEventListener('click', () => {
    const cb = pendingOk; pendingOk = null;
    // 既定は confirm を閉じて pause に戻す。cb 側で closeAll する場合もある。
    if (uiCtl.top() === 'confirm') uiCtl.closeTop();
    if (cb) cb();
  });
  cfCancel.addEventListener('click', () => { pendingOk = null; uiCtl.closeTop(); });

  // ===== stack → DOM 反映 =====
  function render(ui) {
    const top = ui.overlayStack[ui.overlayStack.length - 1] || null;
    pauseEl.classList.toggle('hidden', top !== 'pause');
    confirmEl.classList.toggle('hidden', top !== 'confirm');

    // セーブはゲームオーバー中不可
    const saveBtn = btn('save');
    if (saveBtn) saveBtn.disabled = !!state.gameOver;
    // 終了は Native Android のみ表示
    const quitBtn = btn('quit');
    if (quitBtn) quitBtn.style.display = (hooks.isNativeAndroid && hooks.isNativeAndroid()) ? '' : 'none';
    // 設定ハンドラが無ければ設定ボタンを隠す（F2c で常設化）
    const setBtn = btn('settings');
    if (setBtn) setBtn.style.display = hooks.onSettings ? '' : 'none';

    if (top === 'pause') { try { btn('resume').focus(); } catch (_e) {} }
    else if (top === 'confirm') { try { cfOk.focus(); } catch (_e) {} }
  }

  return { render, requestConfirm };
}
