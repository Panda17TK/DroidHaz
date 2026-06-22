// js/render/save-menu.js
// REQ-TOUCH-2: セーブ/ロードのスロットUI（タッチ完結・固定3スロット）。
// 'save' / 'load' overlay（DESIGN §0.2 stack）の最上位に応じてモードを切替える。
// 確認は pause-menu の confirm overlay を共有（confirm() を注入）。
//
// 引数:
//   rootEl, { state, bus, uiCtl, confirm, slots }
//   slots: { listSlotMetas, saveToSlot, loadFromSlot, deleteSlot }（save-local の関数群）
//   confirm(title, message, onOk): confirm overlay を積んで OK 時に onOk 実行。

function fmtTime(sec) {
  const s = Math.max(0, sec | 0);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function fmtDate(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleString(); } catch (_e) { return ''; }
}

export function mountSaveMenu(rootEl, { state, bus, uiCtl, confirm, slots, onLoaded }) {
  if (!rootEl) return { render() {} };

  const el = document.createElement('div');
  el.className = 'overlay slot-overlay hidden';
  el.id = 'slot-overlay';
  el.innerHTML =
    '<div class="panel slot-panel" role="dialog" aria-label="セーブ/ロード">' +
    '  <h2 class="slot-title">セーブ</h2>' +
    '  <div class="slot-list"></div>' +
    '  <div class="form slot-actions"><button type="button" class="slot-back" aria-label="戻る">戻る</button></div>' +
    '</div>';
  rootEl.appendChild(el);

  const titleEl = el.querySelector('.slot-title');
  const listEl  = el.querySelector('.slot-list');
  el.querySelector('.slot-back').addEventListener('click', () => uiCtl.closeTop());

  // ロード後の遷移。呼び出し側が onLoaded を渡せばそれに委譲（タイトルからのロード等で
  // playing フェーズへ入れる）。無ければ既定：load を閉じて playing 直上なら pause を残す。
  function afterLoad() {
    if (onLoaded) { onLoaded(); return; }
    uiCtl.closeTop();
    if (!uiCtl.top()) uiCtl.push('pause');
  }

  function doSave(slotId, occupied) {
    const run = () => { slots.saveToSlot(state, bus, slotId); renderList('save'); };
    if (occupied) confirm('上書き確認', slotId + ' を上書きしますか？', run);
    else run();
  }
  function doLoad(slotId) {
    const r = slots.loadFromSlot(state, bus, slotId);
    if (r && r.ok) afterLoad();
    else renderList('load'); // 破損などは一覧を更新
  }
  function doDelete(slotId) {
    confirm('削除確認', slotId + ' のデータを削除しますか？', () => {
      slots.deleteSlot(slotId, bus);
      renderList(currentMode());
    });
  }

  function currentMode() {
    return titleEl.textContent === 'ロード' ? 'load' : 'save';
  }

  function renderList(mode) {
    const metas = slots.listSlotMetas();
    listEl.innerHTML = '';
    for (const m of metas) {
      const row = document.createElement('div');
      row.className = 'slot-row';

      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'slot-info';

      if (m.empty) {
        info.innerHTML = '<span class="slot-name">' + m.id + '</span><span class="slot-sub">Empty</span>';
        if (mode === 'load') { info.disabled = true; }
        else { info.addEventListener('click', () => doSave(m.id, false)); }
      } else if (m.broken) {
        info.classList.add('broken');
        info.innerHTML = '<span class="slot-name">' + m.id + '</span><span class="slot-sub">読み込み不可（破損）</span>';
        if (mode === 'save') { info.addEventListener('click', () => doSave(m.id, true)); }
        else { info.disabled = true; }
      } else {
        const s = m.summary || {};
        const stageStr = (m.mode === 'endless') ? 'ENDLESS' : ('STAGE ' + (s.stage | 0 || 1));
        info.innerHTML =
          '<span class="slot-name">' + m.id + ' <small>' + stageStr + '</small></span>' +
          '<span class="slot-sub">WAVE ' + (s.wave | 0) + ' / SCORE ' + (s.score | 0) +
            ' / ' + (s.weapon || '-') + ' / ' + fmtTime(s.playTimeSec | 0) + '</span>' +
          '<span class="slot-date">' + fmtDate(m.updatedAt) + '</span>';
        if (mode === 'save') info.addEventListener('click', () => doSave(m.id, true));
        else info.addEventListener('click', () => doLoad(m.id));
      }
      row.appendChild(info);

      // 削除導線（埋まっているスロットのみ）
      if (!m.empty) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'slot-del';
        del.setAttribute('aria-label', m.id + ' を削除');
        del.textContent = '🗑';
        del.addEventListener('click', () => doDelete(m.id));
        row.appendChild(del);
      }
      listEl.appendChild(row);
    }
  }

  function render(ui) {
    const top = ui.overlayStack[ui.overlayStack.length - 1] || null;
    const mode = (top === 'save') ? 'save' : (top === 'load') ? 'load' : null;
    el.classList.toggle('hidden', mode === null);
    if (mode) {
      titleEl.textContent = (mode === 'load') ? 'ロード' : 'セーブ';
      renderList(mode);
    }
  }

  return { render };
}
