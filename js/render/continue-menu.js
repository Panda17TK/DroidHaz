// js/render/continue-menu.js
// REQ-SAVE-2: タイトルの「つづきから」overlay（top==='continue'）。
//   ① セーブからつづける → load overlay（既存 save-menu）を開く
//   ② ステージから始める → 到達済みステージ(1..bestStage)＋解放時 endless を選び新規ラン開始
//
// 引数: { uiCtl, getProgress, stages, actions }
//   stages: { STAGES, STAGE_MAX }
//   actions: { loadFromSave(), startStage(stage), startEndless() }

export function mountContinueMenu(rootEl, { uiCtl, getProgress, stages, actions }) {
  if (!rootEl) return { render() {} };

  const el = document.createElement('div');
  el.className = 'overlay continue-overlay hidden';
  el.id = 'continue-overlay';
  el.innerHTML =
    '<div class="panel continue-panel" role="dialog" aria-label="つづきから">' +
    '  <h2>つづきから</h2>' +
    '  <button type="button" class="ct-load" aria-label="セーブデータからロード">💾 セーブデータからロード</button>' +
    '  <h3 class="ct-h3">ステージから始める</h3>' +
    '  <div class="ct-stages"></div>' +
    '  <div class="form ct-actions"><button type="button" class="ct-back" aria-label="戻る">戻る</button></div>' +
    '</div>';
  rootEl.appendChild(el);

  const stagesEl = el.querySelector('.ct-stages');
  el.querySelector('.ct-load').addEventListener('click', () => actions.loadFromSave());
  el.querySelector('.ct-back').addEventListener('click', () => uiCtl.closeTop());

  function renderStages() {
    const prog = getProgress ? getProgress() : { bestStage: 1, endlessUnlocked: false };
    const best = Math.max(1, prog.bestStage | 0);
    const max = stages.STAGE_MAX;
    stagesEl.innerHTML = '';
    for (let i = 0; i < stages.STAGES.length; i++) {
      const st = stages.STAGES[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ct-stage';
      const unlocked = st.id <= best;
      b.disabled = !unlocked;
      b.setAttribute('aria-label', 'ステージ' + st.id + ' ' + st.name + (unlocked ? '' : '（未到達）'));
      b.innerHTML = '<span class="ct-num">STAGE ' + st.id + '</span><span class="ct-name">' +
        (unlocked ? st.name : '🔒') + '</span>';
      if (unlocked) b.addEventListener('click', () => actions.startStage(st.id));
      stagesEl.appendChild(b);
    }
    if (prog.endlessUnlocked) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ct-stage ct-endless';
      b.setAttribute('aria-label', 'エンドレス');
      b.innerHTML = '<span class="ct-num">ENDLESS</span><span class="ct-name">∞</span>';
      b.addEventListener('click', () => actions.startEndless());
      stagesEl.appendChild(b);
    }
  }

  function render(ui) {
    const top = ui.overlayStack[ui.overlayStack.length - 1] || null;
    const show = top === 'continue';
    el.classList.toggle('hidden', !show);
    if (show) renderStages();
  }

  return { render };
}
