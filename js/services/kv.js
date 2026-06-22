// js/services/kv.js
// 永続キー・バリュー層。Web では localStorage、ネイティブ(Capacitor)では
// OS の Preferences にもミラーして耐久性を上げる。
//
// 設計:
//  - ゲーム側は同期 API（getItem/setItem/removeItem）でアクセスしたい。
//    そこで localStorage を「同期ソース・オブ・トゥルース」とし、
//    Preferences へは非同期でミラー（fire-and-forget）。
//  - 起動時 hydrate() で Preferences → localStorage を補完（localStorage が
//    OS のストレージ逼迫で消えても、次回起動で復元できる）。
//  - Capacitor 不在（純Web/PWA）では完全に localStorage のみで動作。

const NS = 'arena_'; // ミラー対象のキー接頭辞（このゲームのデータのみ扱う）

let prefs = null;        // Capacitor Preferences プラグイン
let nativeReady = false;

// 動的 import で Capacitor を任意依存に（Web ビルドには含めなくてよい）
export async function initKv() {
  try {
    const cap = await import('@capacitor/core').catch(() => null);
    if (!cap || !cap.Capacitor || !cap.Capacitor.isNativePlatform || !cap.Capacitor.isNativePlatform()) {
      return false; // Web/PWA：localStorage のみ
    }
    const mod = await import('@capacitor/preferences').catch(() => null);
    if (!mod || !mod.Preferences) return false;
    prefs = mod.Preferences;
    nativeReady = true;
    await hydrate();
    return true;
  } catch (_e) {
    return false;
  }
}

// Preferences に保存済みの値で localStorage を補完（localStorage 側が空のキーのみ）
async function hydrate() {
  if (!nativeReady) return;
  try {
    const { keys } = await prefs.keys();
    for (const k of keys) {
      if (!k.startsWith(NS)) continue;
      if (localStorage.getItem(k) != null) continue; // 既にあるなら触らない
      const { value } = await prefs.get({ key: k });
      if (value != null) {
        try { localStorage.setItem(k, value); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

function mirrorSet(key, value) {
  if (!nativeReady) return;
  try { prefs.set({ key, value }); } catch (_e) {}
}
function mirrorRemove(key) {
  if (!nativeReady) return;
  try { prefs.remove({ key }); } catch (_e) {}
}

// ===== 同期 API（localStorage 互換）=====
export function getItem(key) {
  try { return localStorage.getItem(key); } catch (_e) { return null; }
}
export function setItem(key, value) {
  try { localStorage.setItem(key, value); } catch (_e) {}
  if (key.startsWith(NS)) mirrorSet(key, value);
}
export function removeItem(key) {
  try { localStorage.removeItem(key); } catch (_e) {}
  if (key.startsWith(NS)) mirrorRemove(key);
}
