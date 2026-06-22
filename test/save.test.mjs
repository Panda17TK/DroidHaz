import { test } from 'node:test';
import assert from 'node:assert/strict';

// mock kv: kv.js は localStorage を同期ソースに使うので Map ベースで差し替える。
class LS {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new LS();

const {
  SCHEMA_VERSION, SLOT_IDS, buildSummary, migrate, validateGameData,
  readSlotMeta, listSlotMetas, deleteSlot,
} = await import('../js/systems/save-local.js');

const KEY = (id) => 'arena_save_' + id;

function v2flat() {
  return {
    schema: 2,
    player: { weapons: [{ id: 'pistol', mag: 7 }, { id: 'smg', mag: 30 }], curW: 1 },
    wave: { num: 5 },
    stats: { kills: 42, timeMs: 123000 },
    map: [['.']], tileHP: [[1]], tileMaxHP: [[1]],
  };
}

test('buildSummary はゲームデータから wave/score/weapon/playTime を抽出', () => {
  const s = buildSummary(v2flat());
  assert.equal(s.wave, 5);
  assert.equal(s.score, 42);
  assert.equal(s.weapon, 'smg');
  assert.equal(s.playTimeSec, 123); // timeMs/1000
});

test('buildSummary は playTimeSec の上書きを優先', () => {
  const s = buildSummary(v2flat(), 7.9);
  assert.equal(s.playTimeSec, 7); // floor
});

test('migrate: v2 フラット → 最新レコードに包み summary を付与', () => {
  const rec = migrate(v2flat());
  assert.equal(rec.schemaVersion, SCHEMA_VERSION);
  assert.ok(rec.state && rec.state.player, 'state にゲームデータが入る');
  assert.equal(rec.summary.wave, 5);
  assert.equal(rec.summary.weapon, 'smg');
  assert.ok(rec.createdAt && rec.updatedAt);
});

test('SCHEMA_VERSION は 4', () => {
  assert.equal(SCHEMA_VERSION, 4);
});

test('migrate: v3 → v4（mode 既定 stage・summary.stage 補完）', () => {
  const v3 = {
    schemaVersion: 3, appVersion: '1.0', createdAt: 1, updatedAt: 2, slotName: 'slot1',
    summary: { wave: 7, score: 3, weapon: 'gun', playTimeSec: 12 },
    state: { player: { weapons: [], curW: 0 }, wave: { num: 7 }, map: [['.']], tileHP: [[1]], tileMaxHP: [[1]] },
  };
  const rec = migrate(v3);
  assert.equal(rec.schemaVersion, 4);
  assert.equal(rec.mode, 'stage');
  assert.equal(rec.summary.stage, 2); // wave7 → stage2（STAGE_WAVES=5）
});

test('migrate: v4（mode/summary.stage 付き）はそのまま通る', () => {
  const v4 = {
    schemaVersion: 4, appVersion: '1.0', createdAt: 1, updatedAt: 2, slotName: 'slot1', mode: 'endless',
    summary: { wave: 12, score: 9, weapon: 'mg', playTimeSec: 30, stage: 3 },
    state: { player: { weapons: [], curW: 0 }, wave: { num: 12 }, stage: 3, mode: 'endless', map: [['.']], tileHP: [[1]], tileMaxHP: [[1]] },
  };
  const rec = migrate(v4);
  assert.equal(rec.schemaVersion, 4);
  assert.equal(rec.mode, 'endless');
  assert.equal(rec.summary.stage, 3);
});

test('buildSummary は stage を含む（state.stage 優先・無ければ wave から算出）', () => {
  const g1 = v2flat(); g1.stage = 4;
  assert.equal(buildSummary(g1).stage, 4);
  const g2 = v2flat(); // wave5 → stage1
  assert.equal(buildSummary(g2).stage, 1);
});

test('migrate: schemaVersion付きラップ済みで summary 欠落を補完（最新版へ底上げ）', () => {
  const rec = migrate({
    schemaVersion: 3,
    state: { player: { weapons: [{ id: 'gun', mag: 1 }], curW: 0 }, wave: { num: 3 }, stats: { kills: 9 }, map: [['.']], tileHP: [[1]], tileMaxHP: [[1]] },
  });
  assert.equal(rec.schemaVersion, SCHEMA_VERSION);
  assert.equal(rec.summary.wave, 3);
  assert.equal(rec.summary.score, 9);
});

test('migrate: 未来バージョンは例外（読み込み不可）', () => {
  assert.throws(() => migrate({ schemaVersion: 99, state: { player: {}, map: [['.']], tileHP: [[1]], tileMaxHP: [[1]] } }), /too new/);
});

test('migrate: 破損/空オブジェクトは例外', () => {
  assert.throws(() => migrate(null), /empty/);
  assert.throws(() => migrate({}), /invalid save shape/);
});

test('validateGameData は不正形状で例外', () => {
  assert.throws(() => validateGameData({ player: {} }), /invalid save shape/);
  assert.ok(validateGameData({ player: {}, map: [], tileHP: [], tileMaxHP: [] }));
});

test('readSlotMeta: 空スロットは empty', () => {
  const m = readSlotMeta('slot3');
  assert.equal(m.empty, true);
  assert.equal(m.broken, false);
});

test('readSlotMeta: v3 レコードを保存→summary が読める', () => {
  const rec = migrate(v2flat());
  localStorage.setItem(KEY('slot1'), JSON.stringify(rec));
  const m = readSlotMeta('slot1');
  assert.equal(m.empty, false);
  assert.equal(m.broken, false);
  assert.equal(m.summary.wave, 5);
  assert.equal(m.summary.score, 42);
});

test('readSlotMeta: 壊れた JSON は broken（クラッシュしない）', () => {
  localStorage.setItem(KEY('slot2'), '{this is not json');
  const m = readSlotMeta('slot2');
  assert.equal(m.empty, false);
  assert.equal(m.broken, true);
});

test('readSlotMeta: v2 フラットを保存→migrate 経由で summary が読める', () => {
  localStorage.setItem(KEY('slot1'), JSON.stringify(v2flat()));
  const m = readSlotMeta('slot1');
  assert.equal(m.broken, false);
  assert.equal(m.summary.wave, 5);
});

test('listSlotMetas は固定3スロットを返す', () => {
  const list = listSlotMetas();
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((m) => m.id), SLOT_IDS);
});

test('deleteSlot で空になる', () => {
  localStorage.setItem(KEY('slot1'), JSON.stringify(migrate(v2flat())));
  assert.equal(readSlotMeta('slot1').empty, false);
  deleteSlot('slot1', null);
  assert.equal(readSlotMeta('slot1').empty, true);
});
