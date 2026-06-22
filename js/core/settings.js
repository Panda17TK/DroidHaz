// webapp/js/core/settings.js
// タッチ操作の設定を localStorage に永続化する。
// 値の読み出しは正規化（範囲 clamp / enum 検証）してから返す。

const KEY = 'arpg_touch_settings_v1';

export const DEFAULTS = {
  swap: false,             // 左右スティックの入れ替え（true: 照準=左 / 移動=右）
  opacity: 0.9,            // コントロールの不透明度 0.3..1
  scale: 1.0,             // コントロールのサイズ倍率 0.8..1.4
  autoFire: false,         // 自動射撃（最寄りの敵にオート照準して発射）
  forceTouchUi: 'auto',    // タッチUI常時表示 'auto' | 'on' | 'off'（REQ-TOUCH-4）
  haptics: true,           // 振動（Native のみ実効。Web は no-op）
  deadZone: 0.18,          // スティック無効域 0.05..0.4
};

const TOUCH_UI_MODES = ['auto', 'on', 'off'];

function clamp(v, lo, hi, def) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

// 任意の入力を DEFAULTS に対して正規化（壊れた値で UI が破綻しないように）。
export function normalizeSettings(obj) {
  const o = (obj && typeof obj === 'object') ? obj : {};
  return {
    swap: !!o.swap,
    opacity: clamp(o.opacity, 0.3, 1, DEFAULTS.opacity),
    scale: clamp(o.scale, 0.8, 1.4, DEFAULTS.scale),
    autoFire: !!o.autoFire,
    forceTouchUi: TOUCH_UI_MODES.indexOf(o.forceTouchUi) !== -1 ? o.forceTouchUi : DEFAULTS.forceTouchUi,
    haptics: (typeof o.haptics === 'boolean') ? o.haptics : DEFAULTS.haptics,
    deadZone: clamp(o.deadZone, 0.05, 0.4, DEFAULTS.deadZone),
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : {});
  } catch (_e) {
    return Object.assign({}, DEFAULTS);
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(normalizeSettings(s))); } catch (_e) {}
}
