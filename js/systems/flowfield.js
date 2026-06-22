import { TILE } from '../core/constants.js';
import { isSolidChar, solidAt } from './physics.js';

export function rebuildFlowField(state) {
	const H = state.dim.h, W = state.dim.w;
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) state.flow[y][x] = Infinity;
	const q = []; const sx = Math.floor(state.player.x / TILE), sy = Math.floor(state.player.y / TILE);
	if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
	state.flow[sy][sx] = 0; q.push([sx, sy]);
	while (q.length) {
		const [cx, cy] = q.shift(); const d = state.flow[cy][cx];
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const nx = cx + dx, ny = cy + dy;
			if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
			if (isSolidChar(solidAt(state, nx, ny))) continue;
			if (state.flow[ny][nx] > d + 1) { state.flow[ny][nx] = d + 1; q.push([nx, ny]); }
		}
	}
}