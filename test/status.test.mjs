import { test } from 'node:test';
import assert from 'node:assert/strict';

const { applyBleed, applyStun, tickStatus } = await import('../js/systems/status.js');

const CFG = { bleedDur: 10, bleedSlowMul: 0.8, bleedDotFrac: 0.01 };

test('applyBleed: 持続を設定（10s）', () => {
  const m = { hp: 100, maxhp: 100 };
  applyBleed(m, CFG);
  assert.equal(m.bleedT, 10);
});

test('tickStatus: 出血は毎秒 最大HPの1%・移動×0.8', () => {
  const m = { hp: 100, maxhp: 100, bleedT: 10 };
  const r = tickStatus(m, 1, CFG);          // dt=1s
  assert.equal(r.slowMul, 0.8);
  assert.equal(r.stunned, false);
  assert.ok(Math.abs(m.hp - 99) < 1e-9, `hp=${m.hp}`); // -1%
  assert.ok(Math.abs(m.bleedT - 9) < 1e-9);
});

test('tickStatus: 出血終了で減速が解ける', () => {
  const m = { hp: 50, maxhp: 100, bleedT: 0 };
  const r = tickStatus(m, 0.5, CFG);
  assert.equal(r.slowMul, 1);
  assert.equal(m.hp, 50);
});

test('applyStun/tickStatus: 怯み中は stunned=true、時間で解ける', () => {
  const m = { hp: 100, maxhp: 100 };
  applyStun(m, 0.2);
  assert.equal(m.stunT, 0.2);
  let r = tickStatus(m, 0.1, CFG);
  assert.equal(r.stunned, true);
  r = tickStatus(m, 0.1, CFG);     // 0.2 経過
  assert.equal(m.stunT, 0);
});

test('applyStun: 長い方を優先（短い怯みで上書きしない）', () => {
  const m = { hp: 1, maxhp: 1, stunT: 0.3 };
  applyStun(m, 0.1);
  assert.equal(m.stunT, 0.3);
});

test('tickStatus: 出血DoTで HP は 0 未満にもなり得る（撃破判定は呼び出し側）', () => {
  const m = { hp: 1, maxhp: 100, bleedT: 10 };
  tickStatus(m, 2, CFG);   // -2%/of100 = -2
  assert.ok(m.hp < 0);
});
