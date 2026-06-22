export function mountHUD(hud, toast, state, bus) {
  // 静的な構造を一度だけ構築（バーは width だけ毎フレーム更新）
  hud.innerHTML =
    '<div class="hud-bars">' +
    '  <div class="bar hp"><span class="fill"></span><label></label></div>' +
    '  <div class="bar sta"><span class="fill"></span><label></label></div>' +
    '</div>' +
    '<div class="hud-line" id="hud-line"></div>';

  const hpFill = hud.querySelector('.bar.hp .fill');
  const hpLab  = hud.querySelector('.bar.hp label');
  const staFill = hud.querySelector('.bar.sta .fill');
  const staLab  = hud.querySelector('.bar.sta label');
  const lineEl  = hud.querySelector('#hud-line');

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function renderHUD() {
    const p = state.player;
    const w = p.weapons[p.curW] || { name: '(none)' };

    const hp = Math.max(0, Math.round(p.hp));
    hpFill.style.width = hp + '%';
    hpFill.className = 'fill' + (hp <= 25 ? ' low' : '');
    hpLab.textContent = 'HP ' + hp;

    const sta = Math.max(0, Math.min(100, Math.round(p.sta)));
    staFill.style.width = sta + '%';
    staLab.textContent = 'STA ' + sta;

    const elapsed = state.gameOver ? (state.stats.timeMs || 0)
                                   : (performance.now() - (state.runStart || performance.now()));
    const inv = p.inv;
    const magTxt = (w.magSize == null) ? '∞' : (w.mag + '/' + w.magSize);
    const wave = state.wave || { num: 1, phase: 'active' };
    const waveTxt = (wave.phase === 'intermission')
      ? 'WAVE ' + wave.num + ' クリア'
      : 'WAVE ' + wave.num + '（残 ' + ((wave.toSpawn | 0) + state.mobs.length) + '）';

    lineEl.innerHTML =
      '<span class="hud-wave">' + waveTxt + '</span>' +
      '　武器: <b>' + (w.name || '') + '</b> <b>' + magTxt + '</b>' +
      '　予備: 9mm ' + (inv.ammo9 | 0) + ' / 12g ' + (inv.ammo12 | 0) +
      ' / Beam ' + (inv.ammoBeam | 0) + ' / Nade ' + (inv.ammoNade | 0) +
      '<br>時間: <b>' + fmtTime(elapsed) + '</b>' +
      '　撃破: <b>' + (state.stats.kills | 0) + '</b>' +
      '　敵: ' + state.mobs.length +
      '　資材: ' + (inv.blocks | 0) +
      buffText(p.buffs);
  }

  function buffText(b) {
    const parts = [];
    if (b.tRange > 0) parts.push('範囲×' + b.range + '(' + b.tRange.toFixed(0) + 's)');
    if (b.tDmg   > 0) parts.push('火力×' + b.dmg + '(' + b.tDmg.toFixed(0) + 's)');
    if (b.tSpeed > 0) parts.push('速度×' + b.speed + '(' + b.tSpeed.toFixed(0) + 's)');
    return parts.length ? '<br><span class="hud-buff">' + parts.join('　') + '</span>' : '';
  }

  setInterval(renderHUD, 100);

  bus.on('ui:toast', msg => {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 1200);
  });
}
