// REQ-PERF-2: FX 密度。低性能時に粒子数を間引くための純関数（最低 1 は残す）。
// density は state.fxDensity（0<d<=1、既定 1）。
export function fxCount(base, density) {
	const d = (typeof density === 'number' && density > 0) ? Math.min(1, density) : 1;
	return Math.max(1, Math.round(base * d));
}

export function spawnSlashFX(state, x, y, ang, dir) {
	state.fx.push({ type: 'slash', x, y, ang, dir: dir || 1, t: 0, life: 0.30 });
}

// 徒手空拳の殴り：前方の小さな衝撃（白いリング＋火花）。
export function spawnPunchFX(state, x, y, ang) {
	state.fx.push({ type: 'punch', x, y, ang, t: 0, life: 0.16 });
	const n = fxCount(3, state.fxDensity);
	for (let i = 0; i < n; i++) {
		const a = ang + (Math.random() - 0.5) * 0.8, sp = 80 + Math.random() * 80;
		state.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.14 });
	}
}

// 蹴り（コンボ3段目）：大きめの衝撃リング＋ノックバック表現の火花。
export function spawnKickFX(state, x, y, ang) {
	state.fx.push({ type: 'kick', x, y, ang, t: 0, life: 0.22 });
	const n = fxCount(6, state.fxDensity);
	for (let i = 0; i < n; i++) {
		const a = ang + (Math.random() - 0.5) * 0.7, sp = 140 + Math.random() * 140;
		state.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.2 });
	}
}

// 出血付与/継続：赤い飛沫。
export function spawnBleedFX(state, x, y, n = 4) {
	const c = fxCount(n, state.fxDensity);
	for (let i = 0; i < c; i++) {
		const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 70;
		state.fx.push({ type: 'bleed', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 20, t: 0, life: 0.45 });
	}
}

// ダメージ数字ポップ
export function spawnDamageNumber(state, x, y, dmg, opts) {
	opts = opts || {};
	state.fx.push({
		type: 'dmg', x: x + (Math.random() * 10 - 5), y: y - 6,
		vx: (Math.random() * 30 - 15), vy: -42,
		t: 0, life: 0.7, text: String(Math.max(1, Math.round(dmg))),
		crit: !!opts.crit,
	});
}

// 画面シェイク（既存の値より強い時だけ更新）
export function addShake(state, t, mag) {
	if (!state.shake) state.shake = { t: 0, mag: 0 };
	state.shake.t = Math.max(state.shake.t, t);
	state.shake.mag = Math.max(state.shake.mag, mag);
}

// ヒットストップ（一瞬のスロー）
export function addHitstop(state, t) {
	state.hitstop = Math.max(state.hitstop || 0, t);
}

// 残像（縮地などの高速移動の軌跡）
export function spawnAfterimageFX(state, x, y, w, h, color) {
	state.fx.push({ type: 'afterimage', x, y, w, h, color: color || '#cfe5ff', t: 0, life: 0.25 });
}

// 回避成功の白フラッシュ＋リング
export function spawnDodgeFX(state, x, y) {
	state.fx.push({ type: 'dodge', x, y, t: 0, life: 0.22 });
}

// 被弾方向インジケータ：ダメージ源の方向を記録（画面端に矢印表示）
export function recordPlayerHit(state, srcX, srcY) {
	const p = state.player;
	const ang = Math.atan2(srcY - p.y, srcX - p.x);
	if (!state.dmgMarks) state.dmgMarks = [];
	state.dmgMarks.push({ ang, t: 0, life: 1.1 });
	if (state.dmgMarks.length > 8) state.dmgMarks.shift();
}

// ボス撃破などのスローモーション発動
export function addSlowmo(state, duration, factor) {
	if (!state.slowmo) state.slowmo = { t: 0, factor: 0.25 };
	if (duration > state.slowmo.t) { state.slowmo.t = duration; state.slowmo.factor = factor || 0.25; }
}

// 発射のマズルフラッシュ（向き ang・色 color）
export function spawnMuzzleFX(state, x, y, ang, color) {
	state.fx.push({ type: 'muzzle', x, y, ang, color: color || '#fff1c0', t: 0, life: 0.09 });
	// 火花を前方へ少し（密度で間引き）
	const sparks = fxCount(3, state.fxDensity);
	for (let i = 0; i < sparks; i++) {
		const a = ang + (Math.random() - 0.5) * 0.5, sp = 120 + Math.random() * 120;
		state.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.18 });
	}
}

// 死亡演出：破片（gib）を飛散させ、フェードするスプライト痕を残す
export function spawnDeathFX(state, x, y, color, big) {
	const n = fxCount(big ? 22 : 12, state.fxDensity);
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2, sp = (big ? 120 : 80) + Math.random() * (big ? 200 : 140);
		state.fx.push({
			type: 'gib', x, y,
			vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
			s: 2 + Math.random() * (big ? 4 : 3),
			color: color || '#b24a4a',
			t: 0, life: 0.45 + Math.random() * 0.35,
		});
	}
	// 血/汚れの広がり
	state.fx.push({ type: 'splat', x, y, r: big ? 26 : 16, color: color || '#b24a4a', t: 0, life: 0.5 });
	// 中心のフラッシュ
	state.fx.push({ type: 'deathflash', x, y, r: big ? 40 : 24, t: 0, life: 0.22 });
}


export function spawnSparksFX(state, x, y, n = 6) {
	const c = fxCount(n, state.fxDensity);
	for (let i = 0; i < c; i++) {
		const a = Math.random() * Math.PI * 2;
		const sp = 60 + Math.random() * 120;
		state.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.25 });
	}
}

export function spawnEnemySlashFX(state, x, y, ang) {
	state.fx.push({ type: 'eslash', x, y, ang, t: 0, life: 0.26 });
}

export function spawnDustFX(state, x, y, n = 8) {
	const c = fxCount(n, state.fxDensity);
	for (let i = 0; i < c; i++) {
		const a = Math.random() * Math.PI * 2;
		const sp = 20 + Math.random() * 40;
		state.fx.push({ type: 'dust', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.35 });
	}
}

export function spawnBeamFX(state, sx, sy, ex, ey) {
	state.fx.push({ type: 'beam', sx, sy, ex, ey, t: 0, life: 0.10 });
}

export function spawnBlastFX(state, x, y, r) {
	state.fx.push({ type: 'blast', x, y, r, t: 0, life: 0.22 });
}

export function updateFX(state, dt/*, bus */) {
	// 被弾方向マーカーの寿命
	if (state.dmgMarks) {
		for (let i = state.dmgMarks.length - 1; i >= 0; i--) {
			state.dmgMarks[i].t += dt;
			if (state.dmgMarks[i].t >= state.dmgMarks[i].life) state.dmgMarks.splice(i, 1);
		}
	}
	const arr = state.fx;
	for (let i = arr.length - 1; i >= 0; i--) {
		const f = arr[i];
		f.t += dt;
		// 破片は重力＋空気抵抗で弧を描いて落ちる
		if (f.type === 'gib') {
			f.vy = (f.vy || 0) + 320 * dt;
			f.vx = (f.vx || 0) * Math.pow(0.12, dt);
		}
		if (typeof f.x === 'number') f.x += (f.vx || 0) * dt;
		if (typeof f.y === 'number') f.y += (f.vy || 0) * dt;
		if (f.t >= f.life) arr.splice(i, 1);
	}
}