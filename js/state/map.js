import { TILE } from '../core/constants.js';
// 初期スポーンも波中スポーンと同じデータ駆動経路（makeMobFromKey）に統一。
import { makeMobFromKey } from '../systems/enemies.js';
import { getMap } from './maps.js';

// opts.spawnEnemies=false で legend の初期敵マーカーを無視（ステージ切替時は
// 敵をウェーブスポナーに任せる）。
export function setupMap(state, opts) {
  const spawnEnemies = !(opts && opts.spawnEnemies === false);
  const def = getMap(state.mapId);
  const rows = def.rows;
  const H = rows.length, W = rows[0].length;
  const legend = def.legend || {};
  const wallHp = def.wallHp || 90;

  state.map      = rows.map(r => r.split(''));
  state.tileHP   = Array.from({ length: H }, () => Array(W).fill(Infinity));
  state.tileMaxHP= Array.from({ length: H }, () => Array(W).fill(Infinity));
  state.flow     = Array.from({ length: H }, () => Array(W).fill(Infinity));
  state.dim      = { w: W, h: H };
  state.items    = state.items || [];
  state.mobs     = state.mobs  || [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = state.map[y][x];
      if (c === '#' || c === 'D') continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      const mark = legend[c];
      if (mark) {
        if (mark.kind === 'player') { state.player.x = cx; state.player.y = cy; }
        else if (mark.kind === 'enemy') {
          if (spawnEnemies) {
            const mob = makeMobFromKey(state, mark.enemy, cx, cy, 1);
            if (mob) state.mobs.push(mob);
          }
        } else if (mark.kind === 'item') {
          const it = { type: mark.item, x: cx, y: cy };
          if (mark.amt != null) it.amt = mark.amt;
          if (mark.heal != null) it.heal = mark.heal;
          state.items.push(it);
        }
      }
      // マーカー/未知文字は床にする
      state.map[y][x] = '.';
    }
  }

  // 壁HP 初期化（境界は不壊、内部の '#' は破壊可能）
  const isBorder = (tx, ty) => tx === 0 || ty === 0 || tx === W - 1 || ty === H - 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (state.map[y][x] === '#') {
        const v = isBorder(x, y) ? Infinity : wallHp;
        state.tileHP[y][x] = v;
        state.tileMaxHP[y][x] = v;
      }
    }
  }

  // ドラム缶（固定の遮蔽物 'O'）をマップ依存の決定論で配置（毎回同じ＝固定オブジェクト）。
  placeBarrels(state, W, H);
}

// 'O'＝不壊の遮蔽物。床('.')のみに、短い並びで数か所だけ置く（領域を塞がない）。
function placeBarrels(state, W, H) {
  if (W < 8 || H < 8) return;
  const pcx = Math.floor((state.player.x || 0) / TILE);
  const pcy = Math.floor((state.player.y || 0) / TILE);
  // mapId 由来の決定論 PRNG
  let seed = 0; const id = String(state.mapId || '0');
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const groups = 3 + Math.floor(rnd() * 3); // 3〜5 グループ
  for (let g = 0; g < groups; g++) {
    const len = 2 + Math.floor(rnd() * 3);   // 2〜4 個の並び
    const horiz = rnd() < 0.5;
    const sx = 2 + Math.floor(rnd() * (W - 4));
    const sy = 2 + Math.floor(rnd() * (H - 4));
    for (let k = 0; k < len; k++) {
      const x = horiz ? sx + k : sx;
      const y = horiz ? sy : sy + k;
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if (state.map[y][x] !== '.') continue;
      if (Math.abs(x - pcx) <= 2 && Math.abs(y - pcy) <= 2) continue; // プレイヤー近傍は避ける
      state.map[y][x] = 'O';
    }
  }
}

// REQ-STAGE-2: ステージ専用マップへ安全点で切り替える。
// 残存エンティティ（敵/弾/グレ/FX/アイテム）を一掃し、地形を作り直してプレイヤーを
// 新マップの spawn へ再配置する。初期敵はウェーブスポナーに任せる（spawnEnemies:false）。
// フローフィールド再構築は呼び出し側で行う。
export function loadStageMap(state, mapId) {
  state.mapId = mapId;
  if (state.mobs) state.mobs.length = 0;
  if (state.bullets) state.bullets.length = 0;
  if (state.ebullets) state.ebullets.length = 0;
  if (state.grenades) state.grenades.length = 0;
  if (state.fx) state.fx.length = 0;
  if (state.items) state.items.length = 0;
  setupMap(state, { spawnEnemies: false });
}
