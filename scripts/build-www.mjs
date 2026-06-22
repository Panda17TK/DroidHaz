// scripts/build-www.mjs
// 静的アセットを www/ に集約する（Capacitor の webDir 用）。
// バンドラ不要：必要なファイル/ディレクトリをそのままコピーするだけ。
// Web(PWA) 配信時は不要。`npx cap copy` の前に `npm run build` で実行する。

import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'www';
const ITEMS = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css',
  'js',
  'icons',
];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const item of ITEMS) {
  if (!existsSync(item)) {
    console.warn('[build-www] skip (missing):', item);
    continue;
  }
  await cp(item, `${OUT}/${item}`, { recursive: true });
}

console.log('[build-www] wrote', OUT, 'with', ITEMS.length, 'entries');
