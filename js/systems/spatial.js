// webapp/js/systems/spatial.js
// 一様グリッド（spatial hash）による近傍探索。敵×敵の分離や弾×敵の判定を
// O(n^2)→近傍セルのみの走査に落とすための broad-phase。
//
// 性能メモ:
//  - キーは数値（cx*STRIDE+cy）。文字列連結を避けて GC/ハッシュ往復を削減。
//  - クエリ半径には MAX_MOB_RADIUS を足し、mob が中心セルの外へはみ出していても
//    取りこぼさない（大型ボス対策）。

import { CELL, MAX_MOB_RADIUS } from '../core/constants.js';

// 座標を非負化するためのオフセット（負のセル座標を避ける）。十分大きく取る。
const ORIGIN = 1 << 14;        // 16384
const STRIDE = 1 << 15;        // 32768（cx,cy が ORIGIN±範囲に収まる前提）

function cellKey(cx, cy) { return (cx + ORIGIN) * STRIDE + (cy + ORIGIN); }

// グリッドを構築（mob を所属セルに振り分け）。cell はセル一辺(px)。
export function buildMobGrid(state, cell) {
  const c = cell || CELL;
  const map = new Map(); // numeric key -> mob[]
  const mobs = state.mobs;
  for (let i = 0; i < mobs.length; i++) {
    const m = mobs[i];
    if (m.hp <= 0) continue;
    const key = cellKey(Math.floor(m.x / c), Math.floor(m.y / c));
    let arr = map.get(key);
    if (!arr) { arr = []; map.set(key, arr); }
    arr.push(m);
  }
  return { cell: c, map };
}

// 走査するセル範囲を求める共通処理（radius に mob 最大半径を加味）。
function cellBounds(grid, x, y, radius) {
  const c = grid.cell;
  const r = radius + MAX_MOB_RADIUS; // mob が隣セルへはみ出していても拾う
  return {
    mincx: Math.floor((x - r) / c), maxcx: Math.floor((x + r) / c),
    mincy: Math.floor((y - r) / c), maxcy: Math.floor((y + r) / c),
  };
}

// (x,y) 中心・半径 radius に重なりうるセルの mob を cb で列挙。
// 各 mob はちょうど1セルに属するので重複呼び出しはない。
export function forNearby(grid, x, y, radius, cb) {
  const b = cellBounds(grid, x, y, radius);
  for (let cy = b.mincy; cy <= b.maxcy; cy++) {
    for (let cx = b.mincx; cx <= b.maxcx; cx++) {
      const arr = grid.map.get(cellKey(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) cb(arr[i]);
    }
  }
}

// 近傍の中で最初に test を満たす mob を返す（弾ヒット用）。
export function findNearby(grid, x, y, radius, test) {
  const b = cellBounds(grid, x, y, radius);
  for (let cy = b.mincy; cy <= b.maxcy; cy++) {
    for (let cx = b.mincx; cx <= b.maxcx; cx++) {
      const arr = grid.map.get(cellKey(cx, cy));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        if (test(arr[i])) return arr[i];
      }
    }
  }
  return null;
}
