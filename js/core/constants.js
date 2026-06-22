export const TILE = 32;
// Node（テスト環境）でも import できるよう window を安全に参照
const _dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
export const DPR  = Math.max(1, Math.min(2.5, _dpr));
export const MAX_DT = 0.05;
// 空間グリッドのセル一辺(px)。
// 制約: 当たり判定の取りこぼしを防ぐため CELL ≥ 最大mob径 + 2×最大クエリ半径 を満たすこと。
//   現状の最大mob径=46(overlord)、近傍クエリの最大半径≈s.reach+24。クエリ側が半径に
//   mob最大半径を加えて補正する前提で 48 とする（spatial.forNearby 参照）。
export const CELL = 48;
// 想定する最大 mob 半径(px)。近傍クエリの半径補正に使う（取りこぼし防止）。
export const MAX_MOB_RADIUS = 24;
// 固定タイムステップ（秒）。60Hz。通常弾(360px/s→6px/step)はタイル32pxに対し安全。
// 高速移動(縮地)は moveAndCollide で増分移動するためこの刻みでもすり抜けない。
export const FIXED_DT = 1 / 60;
// 近接スイングの描画演出時間(秒)。プレイヤーに刃を一閃させる長さ（CDとは独立）。
export const MELEE_SWING = 0.22;

export const CTX = (typeof window !== 'undefined' && typeof window.CTX === 'string')
  ? window.CTX
  : '';