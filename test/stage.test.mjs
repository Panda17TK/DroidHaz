import { test } from 'node:test';
import assert from 'node:assert/strict';

const { stageForWave, stageDifficulty, effectiveStage, stageEnemyKeys, stageDef, STAGES, STAGE_WAVES, STAGE_MAX } =
  await import('../js/state/stages.js');
const { applyDifficultyToDef } = await import('../js/systems/enemies.js');
const { getMap, MAPS } = await import('../js/state/maps.js');

function baseDef() {
  return {
    hp: 100, speed: 60, seeRange: 240,
    attacks: [
      { type: 'melee', cd: 0.8, dmg: 10, range: 22 },
      { type: 'charge_melee', cd: 3.2, windup: 0.8, dmg: 30 },
    ],
  };
}

// ===== stageDifficulty（AI 挙動・水増し禁止） =====
test('stage 増で反応が速く・知覚が広く・回避が増える（単調）', () => {
  const a = stageDifficulty(1), b = stageDifficulty(2), c = stageDifficulty(4);
  assert.ok(b.reactionMul < a.reactionMul);
  assert.ok(c.reactionMul < b.reactionMul);
  assert.ok(b.perceptionMul > a.perceptionMul);
  assert.ok(c.dodge.chanceAdd >= b.dodge.chanceAdd);
  assert.ok(b.aiTier >= a.aiTier);
});

test('HP/ダメージ倍率は常に 1（水増し禁止）', () => {
  for (const s of [1, 2, 3, 8, 50]) {
    const m = stageDifficulty(s);
    assert.equal(m.enemyHpMul, 1);
    assert.equal(m.enemyDmgMul, 1);
  }
});

test('reactionMul は下限で頭打ち、aiTier は 3 上限', () => {
  const big = stageDifficulty(99);
  assert.ok(big.reactionMul >= 0.45);
  assert.equal(big.aiTier, 3);
});

test('stage1 は素のまま（tier0・倍率1）', () => {
  const m = stageDifficulty(1);
  assert.equal(m.aiTier, 0);
  assert.equal(m.reactionMul, 1);
  assert.equal(m.perceptionMul, 1);
});

// ===== applyDifficultyToDef =====
test('cd/windup を短縮し seeRange を拡大（HP は不変）', () => {
  const d = baseDef();
  const out = applyDifficultyToDef(d, stageDifficulty(3));
  assert.ok(out.attacks[0].cd < d.attacks[0].cd);
  assert.ok(out.attacks[1].windup < d.attacks[1].windup);
  assert.ok(out.seeRange > d.seeRange);
  assert.equal(out.hp, d.hp); // 水増しなし
  // 元 def は不変（クローン）
  assert.equal(d.attacks[0].cd, 0.8);
});

test('tier>=1 で回避を付与', () => {
  const out1 = applyDifficultyToDef(baseDef(), stageDifficulty(1)); // tier0
  const out2 = applyDifficultyToDef(baseDef(), stageDifficulty(2)); // tier1
  assert.ok(!out1.dodge);
  assert.ok(out2.dodge && out2.dodge.chance > 0);
});

test('tier>=2 で技が増え、tier>=3 でさらに増える', () => {
  const n = baseDef().attacks.length;
  const t1 = applyDifficultyToDef(baseDef(), stageDifficulty(2)).attacks.length; // tier1
  const t2 = applyDifficultyToDef(baseDef(), stageDifficulty(3)).attacks.length; // tier2
  const t3 = applyDifficultyToDef(baseDef(), stageDifficulty(4)).attacks.length; // tier3
  assert.equal(t1, n);
  assert.equal(t2, n + 1);
  assert.equal(t3, n + 2);
});

test('mods 無しは def をそのまま返す（後方互換）', () => {
  const d = baseDef();
  assert.equal(applyDifficultyToDef(d, null), d);
});

// ===== effectiveStage =====
test('stage モードは state.stage、endless はウェーブから算出（上限なし）', () => {
  assert.equal(effectiveStage({ mode: 'stage', stage: 2, wave: { num: 99 } }), 2);
  const eff = effectiveStage({ mode: 'endless', wave: { num: 5 * STAGE_WAVES + 1 } });
  assert.ok(eff > STAGE_MAX); // 上限を超えてスケールし続ける
});

// ===== REQ-STAGE-3: enemyPool =====
test('stageEnemyKeys はステージの出現敵を返す', () => {
  assert.deepEqual(stageEnemyKeys(1), ['zombie']);
  assert.ok(stageEnemyKeys(3).includes('stalker'));
  // 範囲外は最終ステージにクランプ
  assert.deepEqual(stageEnemyKeys(99), stageDef(STAGE_MAX).enemyPool);
});

// ===== REQ-CONTENT-1: 各ステージに固有マップが存在し 30x20 =====
test('各ステージの mapId が実在し、別レイアウト・30x20', () => {
  const seen = new Set();
  for (const s of STAGES) {
    const m = getMap(s.mapId);
    assert.equal(m.id, s.mapId, 'mapId ' + s.mapId + ' が実在');
    assert.equal(m.rows.length, 20);
    assert.ok(m.rows.every((r) => r.length === 30), s.mapId + ' は全行30幅');
    const sig = m.rows.join('\n');
    assert.ok(!seen.has(sig), s.mapId + ' は他ステージと別レイアウト');
    seen.add(sig);
  }
});

test('各ステージマップにプレイヤー開始(P)が1つ', () => {
  for (const s of STAGES) {
    const def = MAPS.find((m) => m.id === s.mapId);
    const p = def.rows.join('').split('').filter((c) => c === 'P').length;
    assert.equal(p, 1, s.mapId);
  }
});
