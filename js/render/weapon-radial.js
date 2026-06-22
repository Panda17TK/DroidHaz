// js/render/weapon-radial.js
// REQ-CTRL-3（任意）: 武器のラジアル選択UI。武器ボタン長押しで開き、ドラッグ方向の
// 武器をハイライト、指を離して確定。中央付近で離すと変更なし（巡回は短タップで従来どおり）。
// 描画は純粋に表示のみ。選択角度→index の判定は純関数 radialAngleIndex に分離（テスト可能）。

// dx,dy（アンカー中心からのベクトル）→ スロット index。
// 上方向を起点に時計回りで割り当て。中央 deadR 未満は -1（＝変更なし）。
export function radialAngleIndex(dx, dy, count, deadR) {
  if (!count || count <= 0) return -1;
  const len = Math.hypot(dx, dy);
  if (len < (typeof deadR === 'number' ? deadR : 24)) return -1;
  const deg = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180（0=右, 90=下）
  const fromTop = (deg + 90 + 360) % 360;          // 0=上, 時計回り
  const seg = 360 / count;
  return Math.round(fromTop / seg) % count;
}

// スロット i の中心位置（上起点・時計回り）。半径 R、中心 (cx,cy)。
export function slotPosition(i, count, cx, cy, R) {
  const seg = (Math.PI * 2) / count;
  const ang = -Math.PI / 2 + i * seg; // 上起点
  return { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R };
}

export function mountWeaponRadial(rootEl, { state, onSelect, radius, list, curIndex }) {
  if (!rootEl) return { openAt() {}, update() {}, close() {}, isOpen: () => false };

  const el = document.createElement('div');
  el.className = 'weapon-radial hidden';
  el.setAttribute('aria-hidden', 'true');
  rootEl.appendChild(el);

  const R = radius || 96;
  const DEAD = 28;
  let open = false, anchorX = 0, anchorY = 0, current = -1, slots = [];

  // list/curIndex を差し替えれば武器以外（近接武器など）のラジアルにも使える。
  function weapons() { return (list ? list() : (state.player && state.player.weapons)) || []; }
  function curIdx() { return curIndex ? curIndex() : (state.player ? state.player.curW : -1); }

  function build() {
    el.innerHTML = '';
    slots = [];
    const ws = weapons();
    const n = ws.length;
    // 中央ハブ
    const hub = document.createElement('div');
    hub.className = 'wr-hub';
    hub.style.left = anchorX + 'px'; hub.style.top = anchorY + 'px';
    el.appendChild(hub);
    for (let i = 0; i < n; i++) {
      const p = slotPosition(i, n, anchorX, anchorY, R);
      const s = document.createElement('div');
      s.className = 'wr-slot';
      s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
      s.textContent = (ws[i] && ws[i].name) ? ws[i].name : ('武器' + (i + 1));
      el.appendChild(s);
      slots.push(s);
    }
    highlight();
  }

  function highlight() {
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.toggle('active', i === current);
      slots[i].classList.toggle('cur', i === curIdx());
    }
  }

  function openAt(x, y) {
    if (!weapons().length) return;
    anchorX = x; anchorY = y; current = -1; open = true;
    build();
    el.classList.remove('hidden');
  }

  function update(x, y) {
    if (!open) return;
    current = radialAngleIndex(x - anchorX, y - anchorY, weapons().length, DEAD);
    highlight();
  }

  function close(commit) {
    if (!open) return;
    const sel = current;
    open = false; current = -1;
    el.classList.add('hidden');
    el.innerHTML = '';
    slots = [];
    if (commit && sel >= 0 && onSelect) onSelect(sel);
  }

  return { openAt, update, close, isOpen: () => open };
}
