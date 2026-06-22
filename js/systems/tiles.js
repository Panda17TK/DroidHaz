import { TILE } from '../core/constants.js';
import { rectInter } from './physics.js';
import { rebuildFlowField } from './flowfield.js';

export function damageTile(state, tx, ty, dmg) {
	if (tx < 0 || ty < 0 || tx >= state.dim.w || ty >= state.dim.h) return false;
	if (state.map[ty][tx] !== '#') return false;
	if (state.tileHP[ty][tx] === Infinity) return false;
	state.tileHP[ty][tx] -= dmg;
	if (state.tileHP[ty][tx] <= 0) {
		clearWall(state, tx, ty);
		state.player.inv.blocks++;
		rebuildFlowField(state); // 壁が消えたら経路を即再計算
		return true;
	}
	return false;
}
export function clearWall(state, tx, ty) {
	state.map[ty][tx] = '.'; state.tileHP[ty][tx] = Infinity; state.tileMaxHP[ty][tx] = Infinity;
}
export function canPlaceAt(state, tx, ty) {
	if (tx < 0 || ty < 0 || tx >= state.dim.w || ty >= state.dim.h) return false;
	if (state.map[ty][tx] !== '.') return false;
	const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2; const box = { x: cx, y: cy, w: TILE * 0.9, h: TILE * 0.9 };
	if (rectInter(box, state.player)) return false;
	for (const m of state.mobs) { if (rectInter(box, m)) return false; }
	return true;
}

// タイル系の毎フレーム更新の拡張ポイント（崩落アニメ・設置クールダウン等を将来ここへ）。
// 現状は damageTile/clearWall が即時にフローフィールドを再計算するため処理なし。
export function updateTiles(state, dt, bus, audio) {
}