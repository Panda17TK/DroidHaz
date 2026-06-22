// webapp/js/render/upgrades.js
// ウェーブ間の強化カード選択オーバーレイ。
// 'wave:intermission' を受けてカード3枚を表示し、選択で 'wave:choose' を emit。

import { applyUpgrade, upgradeDesc } from '../state/upgrades.js';

export function mountUpgrades(overlayEl, bus, state) {
  if (!overlayEl) return;
  const listEl = overlayEl.querySelector('#upgrade-cards');
  const titleEl = overlayEl.querySelector('#upgrade-title');

  function close() { overlayEl.classList.add('hidden'); }

  // 強化確定 → 'wave:choose' を emit（次ウェーブ進行と paused 解除は main.js が単一点で行う）。
  // HIGH-1: かつて state.paused を直接書き、startNextWave も直呼びしていたが、
  // pause 開閉での paused clobber → カード裏でのシム再開＆ウェーブ二重進行を招いた。
  function choose(id) {
    applyUpgrade(state, id);
    bus.emit('upgrade:chosen', { id }); // 強化確定（ハプティクス等の演出フック）
    close();
    bus.emit('wave:choose', { id });    // 次ウェーブへ（main.js が startNextWave + syncUi）
  }

  bus.on('wave:intermission', (payload) => {
    if (state.gameOver) return;
    const choices = (payload && payload.choices) || [];
    if (!choices.length) return;

    if (titleEl) titleEl.textContent = 'WAVE ' + (payload.wave | 0) + ' クリア！ 強化を選択';
    if (listEl) {
      listEl.innerHTML = '';
      choices.forEach((u) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'upgrade-card';
        card.innerHTML = '<div class="uc-name"></div><div class="uc-desc"></div>';
        card.querySelector('.uc-name').textContent = u.name;
        card.querySelector('.uc-desc').textContent = upgradeDesc(u);
        card.addEventListener('click', () => choose(u.id));
        listEl.appendChild(card);
      });
    }
    overlayEl.classList.remove('hidden');
    // 停止は main.js が 'wave:intermission' を受けて syncUi()→isSimPaused() で導出する
    // （state.paused をここで直接書かない＝単一所有を守る）。
  });

  // リスタート時は閉じる
  bus.on('game:restart', close);
}
