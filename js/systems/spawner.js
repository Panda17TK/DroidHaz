import { CONFIG } from '../core/config.js';
import { hasLineOfSight } from './los.js';
import { pickUpgradeChoices } from '../state/upgrades.js';
import { makeMobFromKey, normalKeys, midbossKeys, bossKeys } from './enemies.js';
import { stageForWave, currentDifficulty, effectiveStage, stageEnemyKeys, stageDef, STAGE_WAVES, STAGE_MAX } from '../state/stages.js';
import { loadStageMap } from '../state/map.js';
import { rebuildFlowField } from './flowfield.js';

// ウェーブ制スポナー（パラメータは CONFIG.waves を参照）

export function updateSpawner(state, dt, bus, audio) {
  const w = state.wave;
  const C = CONFIG.waves;
  state.timers.elapsed += dt;

  if (w.phase === 'active') {
    if (w.toSpawn > 0) {
      w.spawnCD -= dt;
      if (w.spawnCD <= 0 && countAlive(state) < liveCap(w.num)) {
        // REQ-STAGE-4: スポーン間隔も難易度で控えめに短縮
        if (spawnNormal(state, bus, w.num)) { w.toSpawn--; w.spawnCD = spawnInterval(w.num) * currentDifficulty(state).spawnRateMul; }
        else w.spawnCD = 0.2;
      }
    }
    if (w.toSpawn <= 0 && countAlive(state) === 0 && state.timers.elapsed > C.firstWaveDelay) {
      enterIntermission(state, bus);
    }
  } else if (w.phase === 'intermission') {
    w.interT -= dt;
    if (w.interT <= 0) startNextWave(state, bus);
  }
}

export function startWave(state, n) {
  const w = state.wave;
  const C = CONFIG.waves;
  w.num = n;
  w.phase = 'active';
  w.toSpawn = Math.min(C.maxQuota, C.baseQuota + (n - 1) * C.quotaPerWave);
  w.spawnCD = 0.4;
  w.choices = null;
  state.stats.wave = n;

  // 中ボス／ボスを即時投入（数 = 波数 / 周期 の整数部、最低1体）
  if (C.bossEvery > 0 && n % C.bossEvery === 0) {
    spawnElite(state, bossKeys(), n);
  } else if (C.midBossEvery > 0 && n % C.midBossEvery === 0) {
    spawnElite(state, midbossKeys(), n);
  }
}

export function startNextWave(state, bus) {
  const nextNum = state.wave.num + 1;
  // REQ-STAGE-1/2: ステージ帯を跨いだら state.stage 更新→専用マップへ安全点で切替→stage:enter。
  // （マップ切替は startWave の前に行い、直後に投入されるエリートを新マップに置く）
  const newStage = stageForWave(nextNum);
  if (newStage !== (state.stage || 1) && newStage <= STAGE_MAX) {
    state.stage = newStage;
    const d = stageDef(newStage);
    if (d && d.mapId && d.mapId !== state.mapId) {
      loadStageMap(state, d.mapId);
      rebuildFlowField(state);
    }
    if (bus && bus.emit) bus.emit('stage:enter', { stage: newStage, wave: nextNum });
  }
  startWave(state, nextNum); // マップ切替後にスポーン
  // 定義済みステージ帯を踏破＝全クリア（エンドレス解放トリガ）。一度だけ。
  const rawStage = Math.floor((state.wave.num - 1) / STAGE_WAVES) + 1;
  if (rawStage > STAGE_MAX && !state._stageAllCleared) {
    state._stageAllCleared = true;
    if (bus && bus.emit) bus.emit('stage:cleared', { wave: state.wave.num });
  }
  if (bus && bus.emit) {
    const C = CONFIG.waves;
    const isBoss = C.bossEvery > 0 && state.wave.num % C.bossEvery === 0;
    const isMid = !isBoss && C.midBossEvery > 0 && state.wave.num % C.midBossEvery === 0;
    bus.emit('ui:toast', 'WAVE ' + state.wave.num + (isBoss ? ' ‼ BOSS' : isMid ? ' ★ MIDBOSS' : ''));
  }
}

function enterIntermission(state, bus) {
  const w = state.wave;
  w.phase = 'intermission';
  w.interT = CONFIG.waves.intermission;
  w.choices = pickUpgradeChoices(3, state);
  if (bus && bus.emit) bus.emit('wave:intermission', { wave: w.num, choices: w.choices });
}

function countAlive(state) { let n = 0; for (const m of state.mobs) if (m.hp > 0) n++; return n; }
function liveCap(n) { const C = CONFIG.waves; return Math.min(C.maxLiveCap, C.liveCapBase + n * C.liveCapPerWave); }
function spawnInterval(n) { const C = CONFIG.waves; return Math.max(C.minSpawnInterval, C.spawnIntervalBase - n * C.spawnIntervalPerWave); }

function tileFree(state, tx, ty, size) {
  if (tx < 0 || ty < 0 || tx >= state.dim.w || ty >= state.dim.h) return false;
  if (state.map[ty][tx] !== '.') return false;
  const cx = (tx + 0.5) * 32, cy = (ty + 0.5) * 32; const box = { x: cx, y: cy, w: size || 32, h: size || 32 };
  if (Math.abs(box.x - state.player.x) < (box.w / 2 + state.player.w / 2) && Math.abs(box.y - state.player.y) < (box.h / 2 + state.player.h / 2)) return false;
  for (const m of state.mobs) { if (Math.abs(box.x - m.x) < (box.w / 2 + m.w / 2) && Math.abs(box.y - m.y) < (box.h / 2 + m.h / 2)) return false; }
  return true;
}

function pickTile(state, minDist) {
  for (let tries = 0; tries < 200; tries++) {
    const tx = 1 + Math.floor(Math.random() * (state.dim.w - 2));
    const ty = 1 + Math.floor(Math.random() * (state.dim.h - 2));
    if (!tileFree(state, tx, ty, 40)) continue;
    const cx = (tx + 0.5) * 32, cy = (ty + 0.5) * 32;
    const dx = cx - state.player.x, dy = cy - state.player.y;
    if (dx * dx + dy * dy < minDist * minDist) continue;
    if (hasLineOfSight(state, state.player.x, state.player.y, cx, cy)) continue;
    return { cx, cy };
  }
  return null;
}

function spawnNormal(state, bus, waveNum) {
  // REQ-STAGE-3: ステージの enemyPool に限定（未定義/不一致は全種にフォールバック）。
  const all = normalKeys();
  if (!all.length) return false;
  const pool = stageEnemyKeys(effectiveStage(state));
  const keys = (pool && pool.length) ? pool.filter((k) => all.indexOf(k) !== -1) : all;
  const use = keys.length ? keys : all;
  const t = pickTile(state, 32 * 8);
  if (!t) return false;
  const key = use[Math.floor(Math.random() * use.length)];
  const mob = makeMobFromKey(state, key, t.cx, t.cy, waveNum, currentDifficulty(state));
  if (!mob) return false;
  state.mobs.push(mob);
  if (bus && bus.emit) bus.emit('sfx', 'spawn');
  return true;
}

function spawnElite(state, keys, waveNum) {
  if (!keys || !keys.length) return false;
  const t = pickTile(state, 32 * 6);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const cx = t ? t.cx : state.player.x + 200;
  const cy = t ? t.cy : state.player.y;
  const mob = makeMobFromKey(state, key, cx, cy, waveNum, currentDifficulty(state));
  if (mob) state.mobs.push(mob);
  return !!mob;
}
