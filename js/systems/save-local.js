// js/systems/save-local.js
// ローカル永続のスロットセーブ（静的PWA / ネイティブ共通：サーバ不要）。
// 保存は kv（Web=localStorage、ネイティブ=Preferences ミラー）経由。
//
// REQ-SAVE-1/2: schema v4。レコードは {schemaVersion, appVersion, createdAt,
//   updatedAt, slotName, mode, summary{wave,score,weapon,playTimeSec,stage}, state}。
//   migrate() で v2(フラット)→v3→v4 に移行。破損/未対応は読まずにエラー扱い。
// REQ-TOUCH-2: 固定 3 スロット（slot1/2/3）。一覧に summary を表示。
//
// 純関数（serializeGame/buildSummary/migrate/validateGameData）は kv 非依存で
// 単体テスト可能。スロット I/O（saveToSlot/loadFromSlot/…）のみ kv を触る。

import { makeMobFromKey, makeZombie } from './enemies.js';
import { rebuildFlowField } from './flowfield.js';
import { stageForWave, currentDifficulty } from '../state/stages.js';
import { getItem, setItem, removeItem } from '../services/kv.js';

export const SCHEMA_VERSION = 4;
export const APP_VERSION = '1.0';
export const SLOT_IDS = ['slot1', 'slot2', 'slot3']; // 固定 3 スロット

const KEY_PREFIX = 'arena_save_'; // arena_save_<slot> = JSON(v4 record)

function clampNum(v, lo, hi, def) {
  if (typeof v !== 'number' || !isFinite(v)) return def;
  return Math.max(lo, Math.min(hi, v));
}
export function isValidSlot(slotId) { return SLOT_IDS.indexOf(slotId) !== -1; }

// ========== シリアライズ（ゲームデータのみ。メタは付けない）==========
export function serializeGame(state) {
  const weapons = state.player.weapons.map((w) => ({ id: w.id, mag: w.mag }));
  const mobs = state.mobs.map((m) => ({ kind: m.kind, x: m.x, y: m.y, hp: m.hp, maxhp: m.maxhp, waveNum: m.waveNum }));
  return {
    player: {
      x: state.player.x, y: state.player.y, hp: state.player.hp, hpMax: state.player.hpMax,
      inv: state.player.inv, curW: state.player.curW,
      weapons, buffs: state.player.buffs, mods: state.player.mods, sta: state.player.sta,
      meleeWeapons: (state.player.meleeWeapons || ['fists']).slice(), curMelee: state.player.curMelee || 0,
    },
    wave: state.wave, stats: state.stats,
    map: state.map, tileHP: state.tileHP, tileMaxHP: state.tileMaxHP, items: state.items,
    mobs,
    spawner: state.timers ? { elapsed: state.timers.elapsed || 0, spawnTimer: state.timers.spawn || 5 } : null,
    dim: state.dim,
    // ステージ進行（schema v4）
    mode: state.mode || 'stage',
    stage: state.stage || 1,
    mapId: state.mapId || null,
  };
}

// ========== summary（スロット一覧表示用）==========
// g: serializeGame の出力（または v2 フラットデータ）。playTimeSec は任意上書き。
export function buildSummary(g, playTimeSec) {
  const p = (g && g.player) || {};
  const w = Array.isArray(p.weapons) ? p.weapons[p.curW | 0] : null;
  const stats = (g && g.stats) || {};
  const pts = (typeof playTimeSec === 'number' && isFinite(playTimeSec))
    ? Math.max(0, Math.floor(playTimeSec))
    : (typeof stats.timeMs === 'number' ? Math.floor(stats.timeMs / 1000) : 0);
  const wave = (g && g.wave && typeof g.wave.num === 'number') ? (g.wave.num | 0) : 1;
  return {
    wave,
    score: (typeof stats.kills === 'number') ? (stats.kills | 0) : 0,
    weapon: w ? (w.id || '') : '',
    playTimeSec: pts,
    stage: (g && typeof g.stage === 'number') ? (g.stage | 0) : stageForWave(wave),
  };
}

// ========== バリデーション／マイグレーション（純）==========
export function validateGameData(g) {
  if (!g || typeof g !== 'object') throw new Error('empty game data');
  if (!g.player || !g.map || !g.tileHP || !g.tileMaxHP) throw new Error('invalid save shape');
  return true;
}

// v3 ラップ済みレコードを v4 へ底上げ（mode 既定・summary.stage 補完）。
function liftV3toV4(rec) {
  rec.schemaVersion = SCHEMA_VERSION;
  if (rec.mode !== 'endless') rec.mode = (rec.mode === 'stage') ? 'stage' : (rec.state && rec.state.mode) || 'stage';
  if (!rec.summary) rec.summary = buildSummary(rec.state);
  if (typeof rec.summary.stage !== 'number') {
    rec.summary.stage = (rec.state && typeof rec.state.stage === 'number')
      ? rec.state.stage : stageForWave(rec.summary.wave || 1);
  }
  return rec;
}

// 任意バージョンの parsed object を v4 レコードへ正規化する。未対応は例外。
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('empty record');

  // v4（既に正規形）
  if (raw.schemaVersion === SCHEMA_VERSION && raw.state) {
    validateGameData(raw.state);
    return liftV3toV4(raw); // mode/summary.stage の欠落を保険で補完
  }
  // 未来バージョン（読み込み不可）
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error('schema too new: ' + raw.schemaVersion);
  }
  // v3（ラップ済みだが mode/summary.stage なし）→ v4
  if (raw.schemaVersion === 3 && raw.state) {
    validateGameData(raw.state);
    return liftV3toV4(raw);
  }
  // v1/v2（フラット：player/map 等がトップレベル）→ v4 へ包む
  const v = (typeof raw.schema === 'number') ? raw.schema
          : (typeof raw.schemaVersion === 'number') ? raw.schemaVersion : 1;
  if (v <= 2) {
    validateGameData(raw);
    const now = Date.now();
    return liftV3toV4({
      schemaVersion: 3, appVersion: APP_VERSION,
      createdAt: now, updatedAt: now, slotName: '',
      summary: buildSummary(raw), state: raw,
    });
  }
  throw new Error('unsupported schema: ' + v);
}

// ========== 復元（ゲームデータ → state）==========
function reinitArraysToMatch(state, d) {
  const H = (d && d.dim && d.dim.h) || (d && d.map ? d.map.length : 0);
  const W = (d && d.dim && d.dim.w) || (H > 0 ? d.map[0].length : 0);
  if (!H || !W) throw new Error('bad map size');
  state.dim = { w: W, h: H };
  state.map = d.map.map((row) => row.slice());
  state.tileHP = new Array(H); state.tileMaxHP = new Array(H);
  for (let y = 0; y < H; y++) {
    state.tileHP[y] = d.tileHP[y].slice();
    state.tileMaxHP[y] = d.tileMaxHP[y].slice();
  }
}

export function applyGameData(state, d) {
  validateGameData(d);
  reinitArraysToMatch(state, d);

  const pp = d.player;
  state.player.hpMax = clampNum(pp.hpMax, 1, 100000, state.player.hpMax);
  state.player.x = clampNum(pp.x, -1e6, 1e6, state.player.x);
  state.player.y = clampNum(pp.y, -1e6, 1e6, state.player.y);
  state.player.hp = clampNum(pp.hp, 0, state.player.hpMax, state.player.hp);
  state.player.inv = (pp.inv && typeof pp.inv === 'object') ? pp.inv : state.player.inv;
  state.player.curW = Math.max(0, Math.min(state.player.weapons.length - 1, (pp.curW | 0)));
  if (pp.buffs && typeof pp.buffs === 'object') state.player.buffs = pp.buffs;
  if (pp.mods && typeof pp.mods === 'object') state.player.mods = pp.mods;
  // 近接武器ロードアウト（旧データは徒手空拳のみ）。curMelee は範囲内に丸める。
  state.player.meleeWeapons = (Array.isArray(pp.meleeWeapons) && pp.meleeWeapons.length) ? pp.meleeWeapons.slice() : ['fists'];
  state.player.curMelee = Math.max(0, Math.min(state.player.meleeWeapons.length - 1, (pp.curMelee | 0)));
  state.player.sta = clampNum(pp.sta, 0, state.player.staMax || 100, state.player.sta);
  if (d.wave && typeof d.wave === 'object') { state.wave = d.wave; state.wave.num = clampNum(d.wave.num, 1, 100000, 1) | 0; }
  if (d.stats && typeof d.stats === 'object') state.stats = d.stats;
  // ステージ進行（schema v4。旧データは wave から算出）
  state.mode = (d.mode === 'endless') ? 'endless' : 'stage';
  state.stage = (typeof d.stage === 'number') ? (d.stage | 0) : stageForWave((d.wave && d.wave.num) || 1);
  if (d.mapId) state.mapId = d.mapId;
  state._stageAllCleared = false;

  state.items.length = 0;
  (Array.isArray(d.items) ? d.items : []).forEach((it) => state.items.push(Object.assign({}, it)));

  state.mobs.length = 0;
  // 復元する敵も現ステージの AI 挙動でスケール（state.stage/mode は上で復元済み）
  const mods = currentDifficulty(state);
  (Array.isArray(d.mobs) ? d.mobs : []).forEach((m) => {
    const obj = makeMobFromKey(state, m.kind, m.x, m.y, m.waveNum || (state.wave && state.wave.num) || 1, mods) || makeZombie(m.x, m.y);
    if (typeof m.hp === 'number') obj.hp = m.hp;
    if (typeof m.maxhp === 'number') obj.maxhp = m.maxhp;
    state.mobs.push(obj);
  });

  if (Array.isArray(pp.weapons)) {
    for (const sw of state.player.weapons) {
      const found = pp.weapons.find((v) => v.id === sw.id);
      if (found && typeof found.mag === 'number') {
        const max = (sw.magSize == null ? Infinity : sw.magSize);
        sw.mag = Math.max(0, Math.min(max, found.mag));
      }
    }
  }

  state.bullets.length = 0; state.ebullets.length = 0; state.grenades.length = 0; state.fx.length = 0;
  if (!state.timers) state.timers = {};
  if (d.spawner) { state.timers.elapsed = d.spawner.elapsed || 0; state.timers.spawn = d.spawner.spawnTimer || 5; }
  rebuildFlowField(state);
  state.player.iTime = 0;
  return true;
}

// ========== スロット I/O（kv 経由）==========
function rawSlot(slotId) { return getItem(KEY_PREFIX + slotId); }

// スロットの表示用メタ（破損・空も安全に返す）。
export function readSlotMeta(slotId) {
  const raw = rawSlot(slotId);
  if (!raw) return { id: slotId, empty: true, broken: false };
  try {
    const rec = migrate(JSON.parse(raw));
    return {
      id: slotId, empty: false, broken: false,
      summary: rec.summary, updatedAt: rec.updatedAt || null,
      appVersion: rec.appVersion || '', mode: rec.mode || 'stage',
    };
  } catch (e) {
    return { id: slotId, empty: false, broken: true, error: String((e && e.message) || e) };
  }
}

export function listSlotMetas() { return SLOT_IDS.map(readSlotMeta); }

export function saveToSlot(state, bus, slotId, playTimeSec) {
  try {
    if (!isValidSlot(slotId)) throw new Error('bad slot id');
    const g = serializeGame(state);
    const now = Date.now();
    // createdAt は既存があれば保持
    let createdAt = now;
    try { const prev = JSON.parse(rawSlot(slotId)); if (prev && prev.createdAt) createdAt = prev.createdAt; } catch (_e) {}
    let pts = playTimeSec;
    if (typeof pts !== 'number') {
      try { pts = state.runStart ? (performance.now() - state.runStart) / 1000 : 0; } catch (_e) { pts = 0; }
    }
    const rec = {
      schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION,
      createdAt, updatedAt: now, slotName: slotId,
      mode: state.mode || 'stage',
      summary: buildSummary(g, pts), state: g,
    };
    setItem(KEY_PREFIX + slotId, JSON.stringify(rec));
    bus && bus.emit('ui:toast', 'セーブしました (' + slotId + ')');
    return { ok: true };
  } catch (e) {
    try { console.error('[save]', e); } catch (_) {}
    bus && bus.emit('ui:toast', 'セーブ失敗');
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export function loadFromSlot(state, bus, slotId) {
  try {
    const raw = rawSlot(slotId);
    if (!raw) { bus && bus.emit('ui:toast', '空きスロットです'); return { ok: false, empty: true }; }
    const rec = migrate(JSON.parse(raw));
    applyGameData(state, rec.state);
    bus && bus.emit('ui:toast', 'ロードしました (' + slotId + ')');
    return { ok: true };
  } catch (e) {
    try { console.error('[load]', e); } catch (_) {}
    bus && bus.emit('ui:toast', '読み込み不可（破損データ）');
    return { ok: false, broken: true };
  }
}

export function deleteSlot(slotId, bus) {
  try {
    removeItem(KEY_PREFIX + slotId);
    bus && bus.emit('ui:toast', '削除しました (' + slotId + ')');
    return { ok: true };
  } catch (e) {
    bus && bus.emit('ui:toast', '削除失敗');
    return { ok: false };
  }
}

// ========== 互換：prompt ベースの緊急フォールバック（デスクトップ向け）==========
export function saveChooser(state, _storage, bus) {
  const s = (typeof window !== 'undefined' && window.prompt)
    ? window.prompt('保存スロット（slot1 / slot2 / slot3）', 'slot1') : 'slot1';
  if (!s) { bus && bus.emit('ui:toast', 'キャンセル'); return Promise.resolve(); }
  saveToSlot(state, bus, isValidSlot(s) ? s : 'slot1');
  return Promise.resolve();
}
export function loadChooser(state, _storage, bus) {
  const metas = listSlotMetas().filter((m) => !m.empty);
  if (!metas.length) { bus && bus.emit('ui:toast', 'セーブがありません'); return Promise.resolve(); }
  const lines = metas.map((m, i) => (i + 1) + ': ' + m.id + (m.broken ? '（破損）' : ' WAVE ' + (m.summary ? m.summary.wave : '?')));
  const ans = (typeof window !== 'undefined' && window.prompt)
    ? window.prompt('ロードする番号:\n' + lines.join('\n'), '1') : null;
  const idx = ans ? (parseInt(ans, 10) - 1) : -1;
  if (idx >= 0 && idx < metas.length) loadFromSlot(state, bus, metas[idx].id);
  else bus && bus.emit('ui:toast', 'キャンセル');
  return Promise.resolve();
}
