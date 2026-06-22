import { test } from 'node:test';
import assert from 'node:assert/strict';

const { shouldShowTouchUi } = await import('../js/core/touch.js');
const { normalizeSettings, DEFAULTS } = await import('../js/core/settings.js');

const ENV_DESKTOP = { maxTouchPoints: 0, coarsePointer: false, native: false };
const ENV_TOUCHPC = { maxTouchPoints: 10, coarsePointer: false, native: false };
const ENV_PHONE   = { maxTouchPoints: 5, coarsePointer: true, native: false };
const ENV_NATIVE  = { maxTouchPoints: 0, coarsePointer: false, native: true };

test('forceTouchUi=on は環境に関わらず表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'on' }, ENV_DESKTOP), true);
});

test('forceTouchUi=off は環境に関わらず非表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'off' }, ENV_PHONE), false);
});

test('auto: デスクトップ（非タッチ）は非表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'auto' }, ENV_DESKTOP), false);
});

test('auto: Windows タッチPC（maxTouchPoints>0）は表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'auto' }, ENV_TOUCHPC), true);
});

test('auto: スマホ（coarse pointer）は表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'auto' }, ENV_PHONE), true);
});

test('auto: Native は表示', () => {
  assert.equal(shouldShowTouchUi({ forceTouchUi: 'auto' }, ENV_NATIVE), true);
});

test('normalizeSettings: 既定値を補完', () => {
  const s = normalizeSettings({});
  assert.deepEqual(s, DEFAULTS);
});

test('normalizeSettings: 範囲外を clamp', () => {
  const s = normalizeSettings({ opacity: 5, scale: 0.1, deadZone: 9 });
  assert.equal(s.opacity, 1);
  assert.equal(s.scale, 0.8);
  assert.equal(s.deadZone, 0.4);
});

test('normalizeSettings: 不正な enum / 型は既定に戻す', () => {
  const s = normalizeSettings({ forceTouchUi: 'bogus', haptics: 'yes', swap: 1 });
  assert.equal(s.forceTouchUi, 'auto');
  assert.equal(s.haptics, DEFAULTS.haptics);
  assert.equal(s.swap, true); // truthy → bool
});

test('normalizeSettings: 有効値は保持', () => {
  const s = normalizeSettings({ forceTouchUi: 'on', opacity: 0.5, deadZone: 0.25, haptics: false });
  assert.equal(s.forceTouchUi, 'on');
  assert.equal(s.opacity, 0.5);
  assert.equal(s.deadZone, 0.25);
  assert.equal(s.haptics, false);
});
