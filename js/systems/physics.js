import { TILE } from '../core/constants.js';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function norm(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }
// 平方距離（範囲判定は sqrt 不要）。閾値も2乗して比較する。
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function rectInter(a, b) { return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2; }
export function isSolidChar(c) { return c === '#' || c === 'D' || c === 'O'; }
export function solidAt(state, tx, ty) {
	const { w, h } = state.dim;
	if (tx < 0 || ty < 0 || tx >= w || ty >= h) return '#';
	return state.map[ty][tx];
}
export function forTiles(state, aabb, cb) {
	const x0 = Math.floor((aabb.x - aabb.w / 2) / TILE), x1 = Math.floor((aabb.x + aabb.w / 2) / TILE);
	const y0 = Math.floor((aabb.y - aabb.h / 2) / TILE), y1 = Math.floor((aabb.y + aabb.h / 2) / TILE);
	for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) cb(tx, ty, solidAt(state, tx, ty));
}
export function moveAndCollide(state, ent, dx, dy) {
	ent.x += dx; let hitX = false;
	forTiles(state, ent, (tx, ty, c) => {
		if (isSolidChar(c)) {
			const left = tx * TILE, right = left + TILE;
			if (ent.x - ent.w / 2 < right && ent.x + ent.w / 2 > left && ent.y + ent.h / 2 > ty * TILE && ent.y - ent.h / 2 < (ty + 1) * TILE) {
				if (dx > 0) ent.x = left - ent.w / 2, hitX = true; else if (dx < 0) ent.x = right + ent.w / 2, hitX = true;
			}
		}
	});
	ent.y += dy; let hitY = false;
	forTiles(state, ent, (tx, ty, c) => {
		if (isSolidChar(c)) {
			const top = ty * TILE, bottom = top + TILE;
			if (ent.x + ent.w / 2 > tx * TILE && ent.x - ent.w / 2 < (tx + 1) * TILE && ent.y - ent.h / 2 < bottom && ent.y + ent.h / 2 > top) {
				if (dy > 0) ent.y = top - ent.h / 2, hitY = true; else if (dy < 0) ent.y = bottom + ent.h / 2, hitY = true;
			}
		}
	});
	return { hitX, hitY };
}