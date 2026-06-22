// webapp/js/render/upgrades.js
// ウェーブ間の強化カード選択オーバーレイ。
// 'wave:intermission' を受けてカード3枚を表示し、選択で 'wave:choose' を emit。

import { applyUpgrade, upgradeDesc } from '../state/upgrades.js';
import { startNextWave } from '../systems/spawner.js';

export function mountUpgrades(overlayEl, bus, state) {
  if (!overlayEl) return;
  const listEl = overlayEl.querySelector('#upgrade-cards');
  const titleEl = overlayEl.querySelector('#upgrade-title');

  function close() { overlayEl.classList.add('hidden'); }

  function choose(id) {
    applyUpgrade(state, id);
    bus.emit('upgrade:chosen', { id }); // 強化確定（ハプティクス等の演出フック）
    close();
    state.paused = false;
    startNextWave(state, bus);
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
    state.paused = true; // 選択中は時間を止める（恒久強化をじっくり選べる）
  });

  // リスタート時は閉じる
  bus.on('game:restart', close);
}
