import { TILE } from '../core/constants.js';
import { isSolidChar, solidAt } from './physics.js';

export function hasLineOfSight(state, x0, y0, x1, y1) {
	let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE);
	const tx = Math.floor(x1 / TILE), ty = Math.floor(y1 / TILE);
	const dx = Math.sign(tx - cx), dy = Math.sign(ty - cy);
	const nx = Math.abs(tx - cx), ny = Math.abs(ty - cy);
	let err = nx - ny, guard = 0;
	while (!(cx === tx && cy === ty) && guard++ < 1200) {
		if (isSolidChar(solidAt(state, cx, cy))) return false;
		const e2 = 2 * err; if (e2 > -ny) { err -= ny; cx += dx; } if (e2 < nx) { err += nx; cy += dy; }
	}
	return true;
}