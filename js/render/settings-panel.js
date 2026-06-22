// js/render/settings-panel.js
// REQ-TOUCH-3: 設定UIの独立モジュール。ポーズメニューと ⚙ ボタンの両方から
// 'settings' overlay（DESIGN §0.2 stack）として開く。touch.js は設定値を読むだけ。
//
// API: mountSettingsPanel({ rootEl, settings, onChange, onClose }) → { render(ui) }
//   onChange(settings): 値変更ごとに呼ぶ（永続化＋即時反映は呼び出し側）。
//   onClose(): 閉じる操作（呼び出し側で closeTopOverlay）。

export function mountSettingsPanel({ rootEl, settings, onChange, onClose }) {
  if (!rootEl) return { render() {} };

  const el = document.createElement('div');
  el.className = 'overlay settings-overlay hidden';
  el.id = 'settings-overlay';
  el.innerHTML =
    '<div class="panel settings-panel" role="dialog" aria-label="設定">' +
    '  <h2>設定</h2>' +
    '  <div class="set-list">' +
    '    <label class="set-row"><span>左右入れ替え</span>' +
    '      <input type="checkbox" data-k="swap" aria-label="左右スティック入れ替え"></label>' +
    '    <label class="set-row"><span>自動射撃</span>' +
    '      <input type="checkbox" data-k="autoFire" aria-label="自動射撃"></label>' +
    '    <label class="set-row"><span>振動（ハプティクス）</span>' +
    '      <input type="checkbox" data-k="haptics" aria-label="振動"></label>' +
    '    <label class="set-row"><span>透明度</span>' +
    '      <input type="range" data-k="opacity" min="0.3" max="1" step="0.05" aria-label="タッチUIの透明度"></label>' +
    '    <label class="set-row"><span>サイズ</span>' +
    '      <input type="range" data-k="scale" min="0.8" max="1.4" step="0.05" aria-label="タッチUIのサイズ"></label>' +
    '    <label class="set-row"><span>スティック無効域</span>' +
    '      <input type="range" data-k="deadZone" min="0.05" max="0.4" step="0.01" aria-label="スティックの無効域"></label>' +
    '    <label class="set-row"><span>タッチUI表示</span>' +
    '      <select data-k="forceTouchUi" aria-label="タッチUIの表示モード">' +
    '        <option value="auto">自動</option><option value="on">常に表示</option><option value="off">非表示</option>' +
    '      </select></label>' +
    '  </div>' +
    '  <div class="form set-actions"><button type="button" class="set-close" aria-label="閉じる">閉じる</button></div>' +
    '</div>';
  rootEl.appendChild(el);

  const q = (k) => el.querySelector('[data-k="' + k + '"]');
  const elSwap   = q('swap'),   elAuto    = q('autoFire'), elHap = q('haptics');
  const elOpac   = q('opacity'), elScale  = q('scale'),    elDz  = q('deadZone');
  const elForce  = q('forceTouchUi');

  function syncInputs() {
    elSwap.checked  = !!settings.swap;
    elAuto.checked  = !!settings.autoFire;
    elHap.checked   = !!settings.haptics;
    elOpac.value    = String(settings.opacity);
    elScale.value   = String(settings.scale);
    elDz.value      = String(settings.deadZone);
    elForce.value   = settings.forceTouchUi || 'auto';
  }
  function fire() { if (onChange) onChange(settings); }

  elSwap.addEventListener('change',  () => { settings.swap = elSwap.checked; fire(); });
  elAuto.addEventListener('change',  () => { settings.autoFire = elAuto.checked; fire(); });
  elHap.addEventListener('change',   () => { settings.haptics = elHap.checked; fire(); });
  elOpac.addEventListener('input',   () => { settings.opacity = parseFloat(elOpac.value); fire(); });
  elScale.addEventListener('input',  () => { settings.scale = parseFloat(elScale.value); fire(); });
  elDz.addEventListener('input',     () => { settings.deadZone = parseFloat(elDz.value); fire(); });
  elForce.addEventListener('change', () => { settings.forceTouchUi = elForce.value; fire(); });

  el.querySelector('.set-close').addEventListener('click', () => { if (onClose) onClose(); });

  function render(ui) {
    const top = ui.overlayStack[ui.overlayStack.length - 1] || null;
    const show = top === 'settings';
    el.classList.toggle('hidden', !show);
    if (show) { syncInputs(); try { elSwap.focus(); } catch (_e) {} }
  }

  return { render };
}
