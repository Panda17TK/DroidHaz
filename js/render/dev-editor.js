// webapp/js/render/dev-editor.js
// 開発者モード：CONFIG を GUI で編集し、localStorage に永続化する。
// 起動: バッククォート(`) または「DEV」ボタン。エディタ表示中はゲームをポーズ。
//
// 機能:
//  - 数値パラメータ（player/waves/drops/upgrades）のライブ編集
//  - 敵ロスターの編集：基本ステータス＋攻撃タイプ（normal=2/midboss=5/boss=10 を目安に上限管理）
//  - 保存 / リセット / エクスポート / インポート
//  - デバッグ操作：ゴッドモード、指定ウェーブへジャンプ、敵スポーン

import { CONFIG, saveConfig, resetConfig, exportConfig, importConfig } from '../core/config.js';
import { ATTACK_TYPES } from '../systems/attacks.js';
import { makeMobFromKey } from '../systems/enemies.js';
import { startWave } from '../systems/spawner.js';

const TIER_ATTACK_LIMIT = { normal: 2, midboss: 5, boss: 10 };

export function mountDevEditor(overlayEl, bus, state) {
  if (!overlayEl) return;
  let open = false;

  function setOpen(v) {
    open = v;
    overlayEl.classList.toggle('hidden', !open);
    if (open) { state._devPausedPrev = state.paused; state.paused = true; render(); }
    else { state.paused = state._devPausedPrev || false; }
  }
  function toggle() { setOpen(!open); }

  // バッククォートで開閉
  addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === 'Backquote' || e.code === 'Backquote') { e.preventDefault(); toggle(); }
  });
  bus.on('dev:toggle', toggle);

  // ---- レンダリング ----
  function numRow(obj, key, label, step) {
    const id = 'cfg_' + Math.random().toString(36).slice(2);
    const row = el('label', 'dev-row',
      `<span>${label || key}</span><input type="number" step="${step || 'any'}" value="${obj[key]}" id="${id}">`);
    const inp = row.querySelector('input');
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isNaN(v)) { obj[key] = v; saveConfig(); }
    });
    return row;
  }

  function section(title, obj, labels) {
    const box = el('div', 'dev-section', `<h3>${title}</h3>`);
    Object.keys(obj).forEach((k) => {
      if (typeof obj[k] === 'number') box.appendChild(numRow(obj, k, (labels && labels[k]) || k));
    });
    return box;
  }

  function attackEditor(enemyKey) {
    const def = CONFIG.enemies[enemyKey];
    const limit = TIER_ATTACK_LIMIT[def.tier || 'normal'] || 2;
    const box = el('div', 'dev-attacks', `<div class="dev-sub">攻撃 (${(def.attacks || []).length}/${limit})</div>`);

    (def.attacks || []).forEach((a, idx) => {
      const card = el('div', 'dev-atk');
      // type 選択
      const sel = document.createElement('select');
      ATTACK_TYPES.forEach((t) => {
        const o = document.createElement('option'); o.value = t; o.textContent = t;
        if (t === a.type) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener('change', () => { a.type = sel.value; saveConfig(); });
      const head = el('div', 'dev-atk-head');
      head.appendChild(sel);
      const del = el('button', 'dev-mini', 'x');
      del.addEventListener('click', () => { def.attacks.splice(idx, 1); saveConfig(); render(); });
      head.appendChild(del);
      card.appendChild(head);

      // 数値パラメータ（type 以外の number キー）
      Object.keys(a).forEach((k) => {
        if (k === 'type') return;
        if (typeof a[k] === 'number') card.appendChild(numRow(a, k, k));
      });
      box.appendChild(card);
    });

    if ((def.attacks || []).length < limit) {
      const add = el('button', 'dev-mini add', '+ 攻撃を追加');
      add.addEventListener('click', () => {
        if (!def.attacks) def.attacks = [];
        def.attacks.push({ type: 'melee', cd: 1.0, dmg: 10, range: 14, arc: 360 });
        saveConfig(); render();
      });
      box.appendChild(add);
    }
    return box;
  }

  function enemyEditor() {
    const box = el('div', 'dev-section', '<h3>敵ロスター</h3>');
    Object.keys(CONFIG.enemies).forEach((key) => {
      const def = CONFIG.enemies[key];
      const wrap = el('div', 'dev-enemy');
      wrap.appendChild(el('div', 'dev-enemy-name', `${def.name || key} <small>[${def.tier || 'normal'}]</small>`));
      // 基本ステータス
      ['hp', 'speed', 'w', 'h', 'seeRange', 'contactKB'].forEach((k) => {
        if (typeof def[k] === 'number') wrap.appendChild(numRow(def, k, k));
      });
      // tier 選択（攻撃数の上限が変わる）
      const tierSel = document.createElement('select');
      ['normal', 'midboss', 'boss'].forEach((t) => {
        const o = document.createElement('option'); o.value = t; o.textContent = t;
        if ((def.tier || 'normal') === t) o.selected = true; tierSel.appendChild(o);
      });
      tierSel.addEventListener('change', () => { def.tier = tierSel.value; saveConfig(); render(); });
      const tierRow = el('label', 'dev-row', '<span>tier</span>');
      tierRow.appendChild(tierSel);
      wrap.appendChild(tierRow);
      wrap.appendChild(attackEditor(key));
      // スポーンボタン（デバッグ）
      const sp = el('button', 'dev-mini', '＋この敵をスポーン');
      sp.addEventListener('click', () => {
        const mob = makeMobFromKey(state, key, state.player.x + 160, state.player.y, state.wave.num || 1);
        if (mob) state.mobs.push(mob);
        bus.emit('ui:toast', (def.name || key) + ' をスポーン');
      });
      wrap.appendChild(sp);
      box.appendChild(wrap);
    });
    return box;
  }

  function weaponEditor() {
    const box = el('div', 'dev-section', '<h3>武器</h3>');
    CONFIG.weapons.forEach((w) => {
      const wrap = el('div', 'dev-enemy');
      wrap.appendChild(el('div', 'dev-enemy-name', w.name || w.id));
      ['dmg', 'fireRate', 'magSize', 'spread', 'pellets'].forEach((k) => {
        if (typeof w[k] === 'number') wrap.appendChild(numRow(w, k, k));
      });
      box.appendChild(wrap);
    });
    box.appendChild(el('div', 'dev-sub', '※ dmg/fireRate/spread/pellets はラン中即時反映。magSize はリスタートから'));
    return box;
  }

  function debugTools() {
    const box = el('div', 'dev-section', '<h3>デバッグ</h3>');
    // ゴッドモード
    const god = el('label', 'dev-row', `<span>ゴッドモード</span>`);
    const gc = document.createElement('input'); gc.type = 'checkbox'; gc.checked = !!state.devGod;
    gc.addEventListener('change', () => { state.devGod = gc.checked; });
    god.appendChild(gc); box.appendChild(god);

    // ウェーブジャンプ
    const jumpRow = el('label', 'dev-row', `<span>WAVEへジャンプ</span>`);
    const ji = document.createElement('input'); ji.type = 'number'; ji.min = '1'; ji.value = String(state.wave.num || 1);
    jumpRow.appendChild(ji);
    const jb = el('button', 'dev-mini', 'GO');
    jb.addEventListener('click', () => {
      const n = Math.max(1, parseInt(ji.value, 10) || 1);
      state.mobs.length = 0;
      startWave(state, n);
      bus.emit('ui:toast', 'WAVE ' + n);
    });
    jumpRow.appendChild(jb); box.appendChild(jumpRow);

    // 全敵消去
    const clr = el('button', 'dev-mini', '全敵を消去');
    clr.addEventListener('click', () => { state.mobs.length = 0; });
    box.appendChild(clr);
    return box;
  }

  function ioTools() {
    const box = el('div', 'dev-section', '<h3>保存 / 入出力</h3>');
    const ta = document.createElement('textarea');
    ta.className = 'dev-io'; ta.value = exportConfig();

    const exp = el('button', 'dev-mini', 'エクスポート↑');
    exp.addEventListener('click', () => { ta.value = exportConfig(); });
    const imp = el('button', 'dev-mini', 'インポート↓');
    imp.addEventListener('click', () => {
      try { importConfig(ta.value); bus.emit('ui:toast', 'インポート成功'); render(); }
      catch (e) { bus.emit('ui:toast', 'インポート失敗: JSON不正'); }
    });
    const rst = el('button', 'dev-mini danger', '既定にリセット');
    rst.addEventListener('click', () => { resetConfig(); bus.emit('ui:toast', '既定値にリセット'); render(); });

    const btns = el('div', 'dev-btns');
    btns.appendChild(exp); btns.appendChild(imp); btns.appendChild(rst);
    box.appendChild(btns);
    box.appendChild(ta);
    return box;
  }

  function render() {
    const body = overlayEl.querySelector('.dev-body');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(section('プレイヤー', CONFIG.player));
    body.appendChild(section('AI', CONFIG.ai));
    body.appendChild(section('ウェーブ', CONFIG.waves));
    body.appendChild(section('ドロップ', CONFIG.drops));
    body.appendChild(section('強化倍率', CONFIG.upgrades));
    body.appendChild(weaponEditor());
    body.appendChild(enemyEditor());
    body.appendChild(debugTools());
    body.appendChild(ioTools());
  }

  // クローズボタン
  const closeBtn = overlayEl.querySelector('.dev-close');
  if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));

  // 初期は閉じる
  overlayEl.classList.add('hidden');
}

// 小さな DOM ヘルパ
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
