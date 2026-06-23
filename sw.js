/* DroidHaz — Service Worker（静的PWA）
 * アプリシェル（HTML/JS/CSS/アイコン）をキャッシュしてオフライン起動を可能にする。
 * すべて相対パス＝GitHub Pages の任意サブパスでも動作する。
 */
const CACHE = 'droidhaz-v22';

// install 時に必ず揃えるアプリシェル（これだけは原子的に addAll。失敗時は install を
// 失敗させ、直前の正常な SW/キャッシュを温存する）。残りの ASSETS はベストエフォート。
const CRITICAL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/game.css',
  './js/main.js',
];

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
  './js/render/character-motion.js', './js/render/character-sprites.js',
  './js/render/facing.js',
  './js/services/audio.js', './js/services/kv.js',
  './js/services/native.js',
  './js/state/binds.js', './js/state/data.js', './js/state/map.js', './js/state/maps.js',
  './js/state/state.js', './js/state/types.js', './js/state/upgrades.js', './js/state/stages.js',
  './js/state/characters.js',
  './js/systems/ai.js', './js/systems/attacks.js', './js/systems/combat-core.js',
  './js/systems/combat.js', './js/systems/enemies.js', './js/systems/flowfield.js',
  './js/systems/fx.js', './js/systems/items.js', './js/systems/los.js',
  './js/systems/melee.js', './js/systems/melee-combo.js', './js/systems/physics.js',
  './js/systems/projectiles.js', './js/systems/save-local.js', './js/systems/spatial.js',
  './js/systems/spawner.js', './js/systems/status.js',
  './js/systems/tiles.js', './js/systems/autoaim.js', './js/systems/progress.js',
  './js/systems/scores.js', './js/systems/voices.js',
];

self.addEventListener('install', (e) => {
  // 重要シェルは原子的に（失敗→install reject→旧 SW 温存）。残りはベストエフォートで
  // 事前キャッシュ（一部の 404/瞬断で更新全体を止めない）。成功時のみ skipWaiting。
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CRITICAL); // ここが失敗したら waitUntil が reject し install 失敗（安全側）
    await Promise.allSettled(ASSETS.map((u) => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// stale-while-revalidate：キャッシュがあれば即返しつつ裏で更新。これにより、デプロイ後の
// 更新が CACHE 文字列の手動 bump を忘れても次回ロードで反映される（cache-first の弱点を解消）。
// 無ければネットワーク取得し、成功時のみキャッシュする（エラー/opaque は保存しない）。
async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') { cache.put(req, res.clone()).catch(() => {}); }
    return res;
  }).catch(() => null);
  if (cached) { e.waitUntil(fetching.catch(() => {})); return cached; }
  const net = await fetching;
  return net || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_e) { return; }
  if (url.origin !== self.location.origin) return; // 同一オリジンの GET のみ扱う
  e.respondWith(staleWhileRevalidate(req, e));
});
