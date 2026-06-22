// webapp/js/core/touch.js
// スマホ／タブレット向けの画面上タッチ操作（ツインスティック）。
// 既存の input（keys / aim / move / autoFire）に書き込むだけ。
//   - 左スティック: 移動（アナログ：倒し具合で速度可変）
//   - 右スティック: 照準＋射撃（ドラッグ方向に向き、押下中は K=発射）
//   - ボタン: 近接(J) / ダッシュ(Shift) / リロード / 武器切替 / 壁設置 / ポーズ / 設定
// 設定値は外部（settings-panel）が管理し、本モジュールは「読むだけ」。

import { loadSettings } from './settings.js';

export function isTouchDevice() {
  try {
    return (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window)
      || (navigator && navigator.maxTouchPoints > 0);
  } catch (_e) { return false; }
}

// 現在の実行環境（タッチ能力）を読み取る。
export function readTouchEnv() {
  let coarse = false, mtp = 0;
  try { coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch (_e) {}
  try { mtp = (navigator && navigator.maxTouchPoints) || (('ontouchstart' in window) ? 1 : 0); } catch (_e) {}
  return { maxTouchPoints: mtp, coarsePointer: coarse, native: false };
}

// REQ-TOUCH-4: タッチUIを表示すべきか（純関数）。
//  ① forceTouchUi==='on' → 表示 ② 'off' → 非表示
//  ③ 'auto' → maxTouchPoints>0 または coarse ポインタ または Native なら表示
export function shouldShowTouchUi(settings, env) {
  const mode = settings && settings.forceTouchUi;
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const e = env || {};
  return !!((e.maxTouchPoints > 0) || e.coarsePointer || e.native);
}

// REQ-CTRL-2: スティック入力の正規化（純関数）。
//   入力 {dx,dy,radius,deadZone,maxZone}（deadZone/maxZone は radius に対する割合）。
//   出力 {x,y,magnitude,active}。
//   - 半径比 deadZone 未満 → 中立（active=false, magnitude=0）。
//   - deadZone..maxZone を 0..1 に再マップ（指を離せば即中立）。
//   - maxZone 以上は magnitude=1 に clamp。
//   - x/y は単位方向 × magnitude（斜めでも縦横より速くならない）。
export function normalizeStick({ dx, dy, radius, deadZone, maxZone }) {
  const r = (typeof radius === 'number' && radius > 0) ? radius : 1;
  const dz = (typeof deadZone === 'number') ? deadZone : 0.18;
  const mz = (typeof maxZone === 'number') ? maxZone : 1;
  const len = Math.hypot(dx, dy);
  const raw = len / r; // 0..(>1)
  if (raw < dz) return { x: 0, y: 0, magnitude: 0, active: false };
  const nx = len ? dx / len : 0;
  const ny = len ? dy / len : 0;
  const span = Math.max(1e-6, mz - dz);
  let mag = (Math.min(raw, mz) - dz) / span;
  mag = Math.max(0, Math.min(1, mag));
  return { x: nx * mag, y: ny * mag, magnitude: mag, active: true };
}

// REQ-DISP-2: スティックの操作中心をセーフエリア内側に収める（純関数）。
//   base 半径 R を考慮し、(x,y) を [inset+R, viewport-inset-R] に clamp。
//   画面が極端に狭く範囲が反転する場合は中点を返す。
export function clampStickCenter(x, y, R, insets, vw, vh) {
  const ins = insets || { top: 0, right: 0, bottom: 0, left: 0 };
  const clamp1 = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  return {
    x: clamp1(x, ins.left + R, vw - ins.right - R),
    y: clamp1(y, ins.top + R, vh - ins.bottom - R),
  };
}

// :root に定義した env(safe-area-inset-*) の計算値を px で読む（非対応は 0）。
function readSafeInsets() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const px = (v) => { const n = parseFloat(cs.getPropertyValue(v)); return isFinite(n) ? n : 0; };
    return { top: px('--sat'), right: px('--sar'), bottom: px('--sab'), left: px('--sal') };
  } catch (_e) { return { top: 0, right: 0, bottom: 0, left: 0 }; }
}

export function createTouchControls(root, input, api, cfg) {
  if (!root) return null;
  api = api || {};
  cfg = cfg || loadSettings();
  const keys = input.keys;
  const aim  = input.aim;
  const move = input.move;

  const layer = document.createElement('div');
  layer.className = 'touch-controls';

  const BASE_R = 60; // 基準可動半径(px)。サイズ設定で拡縮
  const getR = () => BASE_R * cfg.scale;

  // ===== スティック（動的ベース）=====
  function makeZone(kind) {
    const z = document.createElement('div');
    z.className = 'tc-zone tc-zone-' + kind;
    const base = document.createElement('div'); base.className = 'tc-base';
    const knob = document.createElement('div'); knob.className = 'tc-knob';
    base.appendChild(knob);
    z.appendChild(base);

    let pid = null, cx = 0, cy = 0;

    function release() {
      pid = null;
      base.classList.remove('show');
      knob.style.transform = 'translate(-50%, -50%)';
      if (kind === 'move') { move.active = false; move.x = 0; move.y = 0; }
      else { aim.active = false; aim.x = 0; aim.y = 0; keys['k'] = false; }
    }

    function update(e) {
      const R = getR();
      const r = z.getBoundingClientRect();
      const dx = (e.clientX - r.left) - cx;
      const dy = (e.clientY - r.top) - cy;
      const len = Math.hypot(dx, dy);
      const cl = Math.min(len, R);
      const nx = len ? dx / len : 0;
      const ny = len ? dy / len : 0;
      knob.style.transform = `translate(calc(-50% + ${nx * cl}px), calc(-50% + ${ny * cl}px))`;
      // REQ-CTRL-2: deadZone を踏まえて 0..1 に再マップ（純関数）
      const st = normalizeStick({ dx, dy, radius: R, deadZone: cfg.deadZone || 0.18, maxZone: 1 });

      if (kind === 'move') {
        if (st.active) { move.active = true; move.x = st.x; move.y = st.y; }
        else { move.active = false; move.x = 0; move.y = 0; }
      } else {
        // 照準は方向のみ（倒し具合に依らず active 判定だけ deadZone を使う）
        if (st.active) { aim.active = true; aim.x = nx; aim.y = ny; keys['k'] = true; }
        else { aim.active = false; keys['k'] = false; }
      }
    }

    z.addEventListener('pointerdown', (e) => {
      if (pid !== null) return;
      pid = e.pointerId;
      try { z.setPointerCapture(pid); } catch (_e) {}
      const r = z.getBoundingClientRect();
      // REQ-DISP-2: 操作中心をセーフエリア内に clamp（ノッチ/ホームバー回避）
      const vw = (typeof window !== 'undefined' && window.innerWidth) || r.width;
      const vh = (typeof window !== 'undefined' && window.innerHeight) || r.height;
      const sc = clampStickCenter(e.clientX, e.clientY, getR(), readSafeInsets(), vw, vh);
      cx = sc.x - r.left; cy = sc.y - r.top;
      base.style.left = cx + 'px'; base.style.top = cy + 'px'; base.classList.add('show');
      update(e);
      e.preventDefault();
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === pid) { update(e); e.preventDefault(); } });
    z.addEventListener('pointerup',     (e) => { if (e.pointerId === pid) release(); });
    z.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) release(); });

    layer.appendChild(z);
    return z;
  }

  makeZone('move');
  makeZone('aim');

  // ===== ボタン =====
  function makeButton(cls, label, opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-btn tc-btn-' + cls;
    b.textContent = label;
    if (opts.aria) b.setAttribute('aria-label', opts.aria);
    if (opts.hold) {
      let pid = null;
      b.addEventListener('pointerdown', (e) => {
        pid = e.pointerId; try { b.setPointerCapture(pid); } catch (_e) {}
        opts.hold(true); b.classList.add('active'); e.preventDefault();
      });
      const up = (e) => { if (e.pointerId === pid) { pid = null; opts.hold(false); b.classList.remove('active'); } };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    } else {
      b.addEventListener('pointerdown', (e) => { opts.tap(); b.classList.add('active'); e.preventDefault(); });
      const up = () => b.classList.remove('active');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
    layer.appendChild(b);
    return b;
  }

  makeMeleeButton();  // 短タップ=近接攻撃 / 長押し=近接武器ラジアル（徒手空拳/刀）
  makeButton('dash',   'DASH', { aria: 'ダッシュ', hold: (on) => { keys['shift'] = on; } });
  makeButton('reload', 'R',    { aria: 'リロード', tap: () => { if (api.reload) api.reload(); } });
  makeWeaponButton(); // 短タップ=巡回 / 長押し=ラジアル（REQ-CTRL-3）
  makeButton('build',  '壁',   { aria: '壁を設置', tap: () => { if (api.build) api.build(); } });
  makeButton('pause',  'II',   { aria: 'ポーズ', tap: () => { if (api.pause) api.pause(); } });
  makeButton('settings', '⚙', { aria: '設定', tap: () => { if (api.openSettings) api.openSettings(); } });

  // 武器ボタン：短タップで巡回、長押し（200ms）でラジアル選択を開く。
  function makeWeaponButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-btn tc-btn-weapon';
    b.textContent = '武器';
    b.setAttribute('aria-label', '武器切替（長押しで一覧）');
    let pid = null, holdTimer = null, opened = false;
    const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    b.addEventListener('pointerdown', (e) => {
      pid = e.pointerId; try { b.setPointerCapture(pid); } catch (_e) {}
      opened = false; b.classList.add('active');
      const r = b.getBoundingClientRect();
      const ax = r.left + r.width / 2, ay = r.top + r.height / 2;
      clearHold();
      holdTimer = setTimeout(() => { opened = true; if (api.openWeaponRadial) api.openWeaponRadial(ax, ay); }, 200);
      e.preventDefault();
    });
    b.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      if (opened && api.updateWeaponRadial) api.updateWeaponRadial(e.clientX, e.clientY);
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; b.classList.remove('active'); clearHold();
      if (opened) { if (api.closeWeaponRadial) api.closeWeaponRadial(true); }
      else if (api.cycleWeapon) api.cycleWeapon();
      opened = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== pid) return;
      pid = null; b.classList.remove('active'); clearHold();
      if (opened && api.closeWeaponRadial) api.closeWeaponRadial(false);
      opened = false;
    });
    layer.appendChild(b);
    return b;
  }

  // 近接ボタン：短タップで攻撃（keys['j'] を一瞬パルス→エッジ検出）、長押しで武器ラジアル。
  function makeMeleeButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-btn tc-btn-melee';
    b.textContent = '近接';
    b.setAttribute('aria-label', '近接攻撃（長押しで武器一覧）');
    let pid = null, holdTimer = null, opened = false;
    const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    const attack = () => { keys['j'] = true; setTimeout(() => { keys['j'] = false; }, 80); };
    b.addEventListener('pointerdown', (e) => {
      pid = e.pointerId; try { b.setPointerCapture(pid); } catch (_e) {}
      opened = false; b.classList.add('active');
      const r = b.getBoundingClientRect();
      const ax = r.left + r.width / 2, ay = r.top + r.height / 2;
      clearHold();
      holdTimer = setTimeout(() => { opened = true; if (api.openMeleeRadial) api.openMeleeRadial(ax, ay); }, 220);
      e.preventDefault();
    });
    b.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      if (opened && api.updateMeleeRadial) api.updateMeleeRadial(e.clientX, e.clientY);
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; b.classList.remove('active'); clearHold();
      if (opened) { if (api.closeMeleeRadial) api.closeMeleeRadial(true); }
      else attack();
      opened = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== pid) return;
      pid = null; b.classList.remove('active'); clearHold();
      if (opened && api.closeMeleeRadial) api.closeMeleeRadial(false);
      opened = false;
    });
    layer.appendChild(b);
    return b;
  }

  // 設定値をコントロールに反映（外部から呼ばれる）。
  function apply() {
    layer.classList.toggle('tc-swap', !!cfg.swap);
    layer.style.setProperty('--tc-op', String(cfg.opacity));
    layer.style.setProperty('--tc-scale', String(cfg.scale));
    input.autoFire = !!cfg.autoFire;
  }
  // 外部（settings-panel）が設定を更新したら呼ぶ。
  function applySettings(next) {
    if (next && next !== cfg) Object.assign(cfg, next);
    apply();
  }
  // 表示/非表示（REQ-TOUCH-4）。
  function setVisible(v) { layer.style.display = v ? '' : 'none'; }

  apply();
  root.appendChild(layer);
  return { el: layer, applySettings, setVisible };
}
