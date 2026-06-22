// js/services/native.js
// Capacitor ネイティブ統合の集約。すべて「任意依存」：プラグインが無い Web/PWA では
// 完全に no-op（例外を投げない）。動的 import で読み込み、失敗は握りつぶす。
//
// F4a(REQ-NATIVE-4): 中断/復帰の自動ポーズ。
//   - Web: document の visibilitychange（タブ非表示）。
//   - Native: @capacitor/app の appStateChange（isActive=false）。
//   - 復帰時は自動再開しない（ポーズを積むだけ）。
// F4b(REQ-NATIVE-2): Android 戻るボタン。いきなり終了せず overlay を順に閉じ、
//   pause で Back→終了確認→OK で exitApp。

import { topOverlay } from '../core/ui-state.js';

// HIGH-3: bare-specifier の動的 import（import('@capacitor/...')）は WebView で解決できず、
// バンドラ無し構成では実 APK 上でも常に失敗していた（ネイティブ機能が全滅）。
// Capacitor はネイティブ起動時に window.Capacitor（registerPlugin/Plugins/isNativePlatform）を
// グローバル注入するため、ブリッジ経由でプラグインを「同期」取得する（import 不要・バンドラ不要）。
function capBridge() {
  try {
    const cap = (typeof window !== 'undefined') && window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return cap;
  } catch (_e) { return null; }
}

// 名前で Capacitor プラグインのプロキシを得る（非ネイティブ/不在は null）。
//   既に登録済みなら Plugins[name]、無ければ registerPlugin(name) でブリッジプロキシを生成。
function getPlugin(name) {
  const cap = capBridge();
  if (!cap) return null;
  try {
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    if (typeof cap.registerPlugin === 'function') return cap.registerPlugin(name);
  } catch (_e) {}
  return null;
}

// 同期のベストエフォート判定（UI 分岐用。確実な判定は getCapApp 経由）。
export function isNativePlatform() {
  try {
    const cap = (typeof window !== 'undefined') && window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch (_e) { return false; }
}

// Native Android か（pause メニューの「終了」ボタン表示などに使う・同期判定）。
export function isNativeAndroid() {
  try {
    const cap = (typeof window !== 'undefined') && window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform()
      && cap.getPlatform && cap.getPlatform() === 'android');
  } catch (_e) { return false; }
}

// アプリ終了（Native のみ。Web は no-op）。
export function exitApp() {
  const App = getPlugin('App');
  if (App && App.exitApp) { try { App.exitApp(); } catch (_e) {} }
}

// REQ-NATIVE-4 純ロジック：いま自動ポーズすべきか（playing 中のみ）。
export function shouldAutoPause(state) {
  if (!state || state.gameOver) return false;
  const stack = state.ui && state.ui.overlayStack;
  return !(stack && stack.length > 0); // overlay 表示中は既に停止しているので何もしない
}

// バックグラウンド化（Web=タブ非表示 / Native=非アクティブ）で handler を呼ぶ。
export function onAppBackground(handler) {
  if (typeof handler !== 'function') return;
  // Web/PWA（デスクトップ含む）
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => { if (document.hidden) handler(); });
    }
  } catch (_e) {}
  // Native（任意）
  const App = getPlugin('App');
  if (App && App.addListener) {
    try { App.addListener('appStateChange', (st) => { if (st && st.isActive === false) handler(); }); } catch (_e) {}
  }
}

// REQ-NATIVE-2 純ロジック：Android Back で何をすべきかを返す。
//   'openPause'   … playing 中（stack 空）→ ポーズを開く
//   'confirmExit' … pause が最上位 → 終了確認を出す
//   'noop'        … gameover（最下位固定）→ 何もしない
//   'closeTop'    … settings/save/load/confirm → 最上位を閉じる（=cancel/戻る）
export function androidBackAction(ui) {
  const top = ui ? topOverlay(ui) : null;
  if (top === null) return 'openPause';
  if (top === 'gameover') return 'noop';
  if (top === 'pause') return 'confirmExit';
  return 'closeTop';
}

// Android のハードウェア戻るボタンを購読（Web では never fire = no-op）。
export function onAndroidBack(handler) {
  if (typeof handler !== 'function') return;
  const App = getPlugin('App');
  if (App && App.addListener) {
    try { App.addListener('backButton', () => handler()); } catch (_e) {}
  }
}

// REQ-NATIVE-1: 触覚フィードバック（Native のみ。Web/非対応は no-op・例外なし）。
//   style: 'light' | 'medium' | 'heavy'（ImpactStyle の enum 値は文字列なので直接渡す）
export function hapticImpact(style) {
  const Haptics = getPlugin('Haptics');
  if (!Haptics || !Haptics.impact) return;
  try {
    const s = (style === 'heavy') ? 'HEAVY' : (style === 'light') ? 'LIGHT' : 'MEDIUM';
    Haptics.impact({ style: s });
  } catch (_e) {}
}

// REQ-NATIVE-3: 起動時のステータスバー/スプラッシュ整え（Native のみ。Web は no-op）。
//   - StatusBar: 暗背景に合わせ light アイコン＋背景色 #0b0e13（Android 15/16+ の
//     edge-to-edge で色制御が効かない場合があるため、失敗は無視＝破綻回避を優先）。
//   - SplashScreen: 初期化完了後に hide()。失敗時フェイルセーフとして遅延 hide も試みる。
export function initNativeChrome(opts) {
  const bg = (opts && opts.background) || '#0b0e13';
  const SB = getPlugin('StatusBar');
  if (SB) {
    try { SB.setStyle && SB.setStyle({ style: 'DARK' }); } catch (_e) {}
    try { SB.setBackgroundColor && SB.setBackgroundColor({ color: bg }); } catch (_e) {}
  }
  const SS = getPlugin('SplashScreen');
  if (SS && SS.hide) {
    const hide = () => { try { SS.hide(); } catch (_e) {} };
    hide();
    // フェイルセーフ：何らかの理由で残った場合に備えて少し後にも hide。
    try { setTimeout(hide, 3000); } catch (_e) {}
  }
}
