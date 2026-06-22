// webapp/js/render/grad-cache.js
// グラデーションのキャッシュ。createRadialGradient/LinearGradient は座標を内部に焼き込むため、
// 「原点(0,0)中心」で作って ctx.translate と併用すれば位置に依らず再利用できる。
// キーは見た目を決めるパラメータ（半径・色・サイズ）。

const cache = new Map();

// 原点中心の放射グラデーション（r0..r1, 色stops）。translate して使う。
// stops: [[offset, 'rgba(...)'], ...]
export function radialAtOrigin(ctx, r0, r1, stops, key) {
  let g = cache.get(key);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, r0, 0, 0, r1);
    for (const [off, col] of stops) g.addColorStop(off, col);
    cache.set(key, g);
  }
  return g;
}

// 縦方向リニアグラデ（0..h）。h ごとにキャッシュ。
export function verticalLinear(ctx, h, stops, key) {
  const k = key + '|' + h;
  let g = cache.get(k);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [off, col] of stops) g.addColorStop(off, col);
    cache.set(k, g);
  }
  return g;
}

// 原点中心の放射グラデ（r0..r1）だが r が動的（サイズ量子化してキャッシュ）。
// 連続的に変わる半径を 2px 刻みに丸めてキャッシュ命中率を上げる。
export function radialQuant(ctx, r, stops, keyBase) {
  const rq = Math.max(1, Math.round(r / 2) * 2);
  const k = keyBase + '|' + rq;
  let g = cache.get(k);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, rq);
    for (const [off, col] of stops) g.addColorStop(off, col);
    cache.set(k, g);
  }
  return g;
}

// キャンバスサイズ変更などで作り直したい時に呼ぶ（任意）
export function clearGradCache() { cache.clear(); }
