/* DroidHaz — Service Worker（静的PWA）
 * アプリシェル（HTML/JS/CSS/アイコン）をキャッシュしてオフライン起動を可能にする。
 * すべて相対パス＝GitHub Pages の任意サブパスでも動作する。
 */
const CACHE = 'droidhaz-v16';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/game.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/core/config.js', './js/core/constants.js', './js/core/events.js',
  './js/core/input.js', './js/core/settings.js', './js/core/touch.js',
  './js/core/ui-state.js', './js/core/app-state.js',
  './js/render/dev-editor.js', './js/render/enemy-sprites.js', './js/render/fx-draw.js',
  './js/render/glyphs.js', './js/render/grad-cache.js', './js/render/hud.js',
  './js/render/overlay.js', './js/render/renderer.js', './js/render/upgrades.js',
  './js/render/view.js', './js/render/pause-menu.js', './js/render/save-menu.js',
  './js/render/settings-panel.js', './js/render/weapon-radial.js',
  './js/render/title-screen.js', './js/render/scores-menu.js', './js/render/continue-menu.js',
  './js/services/audio.js', './js/services/storage.js', './js/services/kv.js',
  './js/services/native.js',
  './js/state/binds.js', './js/state/data.js', './js/state/map.js', './js/state/maps.js',
  './js/state/state.js', './js/state/types.js', './js/state/upgrades.js', './js/state/stages.js',
  './js/systems/ai.js', './js/systems/attacks.js', './js/systems/combat-core.js',
  './js/systems/combat.js', './js/systems/enemies.js', './js/systems/flowfield.js',
  './js/systems/fx.js', './js/systems/items.js', './js/systems/los.js',
  './js/systems/melee.js', './js/systems/physics.js', './js/systems/projectiles.js',
  './js/systems/save-local.js', './js/systems/spatial.js', './js/systems/spawner.js',
  './js/systems/tiles.js', './js/systems/autoaim.js', './js/systems/progress.js',
  './js/systems/scores.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 静的アセットは cache-first（無ければ取得してキャッシュ）
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
