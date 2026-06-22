// js/state/stages.js
// REQ-CONTENT-1 / STAGE-1: ステージ定義（データ駆動）。F5a では骨子（番号算出・メタ）まで。
// マップ実体・敵編成・AI挙動係数の本格定義は F5b/F5c で拡張する。
//
// 連続難易度ティア: 1 ラン中ウェーブは途切れず、STAGE_WAVES ごとに次ステージへ。

export const STAGE_WAVES = 5; // 1 ステージあたりのウェーブ数（暫定）

// 各ステージのメタ。mapId(専用マップ)・enemyPool(出現する通常敵)・gimmicks。
export const STAGES = [
  { id: 1, name: '崩落区画',   mapId: 'stage1', enemyPool: ['zombie'] },
  { id: 2, name: '廃液プラント', mapId: 'stage2', enemyPool: ['zombie', 'spitter'] },
  { id: 3, name: '封鎖回廊',   mapId: 'stage3', enemyPool: ['zombie', 'spitter', 'stalker'] },
  { id: 4, name: '中枢コア',   mapId: 'stage4', enemyPool: ['spitter', 'stalker'] },
];

export const STAGE_MAX = STAGES.length;

// REQ-STAGE-1: ウェーブ番号 → ステージ番号（1..stageMax）。超過分は stageMax に丸める
// （エンドレスは別途モードで扱う）。純関数。
export function stageForWave(waveNum, stageWaves = STAGE_WAVES, stageMax = STAGE_MAX) {
  const w = Math.max(1, waveNum | 0);
  const sw = Math.max(1, stageWaves | 0);
  const s = Math.floor((w - 1) / sw) + 1;
  return Math.min(s, Math.max(1, stageMax | 0));
}

// ステージ番号 → 定義（範囲外は最終ステージにクランプ）。
export function stageDef(stage) {
  const i = Math.min(STAGES.length - 1, Math.max(0, (stage | 0) - 1));
  return STAGES[i];
}

// REQ-STAGE-4: 難易度＝敵 AI 挙動の段階強化（HP/ダメージ水増しはしない）。
// 純関数。stage(ステージ番号。endless は実効ステージを渡す) から behavior 修正子を返す。
//   reactionMul (<1)  : attacks[].cd / windup を短縮（下限あり）
//   perceptionMul(>1) : seeRange 拡大
//   speedMul          : 控えめな機動UP
//   aggressionMul     : 攻撃頻度の目安（参考値）
//   dodge{chanceAdd,cdMul}: 回避を付与/強化
//   aiTier (0..3)     : 解禁される判断分岐（回避/遠隔追加 等）
//   extraAttacks[]    : 追加技（applyDifficultyToDef が aiTier に応じ付与）
//   spawnRateMul(<=1) : スポーン間隔の短縮（控えめ）
export function stageDifficulty(stage) {
  const t = Math.max(0, (Math.max(1, stage | 0)) - 1); // stage1→0
  return {
    reactionMul: Math.max(0.45, 1 - 0.12 * t),
    perceptionMul: 1 + 0.10 * t,
    speedMul: 1 + 0.04 * t,
    aggressionMul: 1 + 0.10 * t,
    dodge: { chanceAdd: Math.min(0.35, 0.06 * t), cdMul: Math.max(0.5, 1 - 0.08 * t) },
    aiTier: Math.min(3, t),
    extraAttacks: [],
    spawnRateMul: Math.max(0.6, 1 - 0.05 * t),
    // 水増し禁止: HP/ダメージ倍率は常に 1
    enemyHpMul: 1,
    enemyDmgMul: 1,
  };
}

// REQ-STAGE-3: そのステージで出現する通常敵キー（未定義なら null＝全種）。
export function stageEnemyKeys(stage) {
  const d = stageDef(stage);
  return (d && Array.isArray(d.enemyPool) && d.enemyPool.length) ? d.enemyPool.slice() : null;
}

// エンドレス用の実効ステージ（ウェーブから算出・上限なし）。
export function effectiveStage(state) {
  const wave = (state && state.wave && state.wave.num) || 1;
  if (state && state.mode === 'endless') return Math.floor((wave - 1) / STAGE_WAVES) + 1;
  return (state && state.stage) || stageForWave(wave);
}

// 現在の実効ステージに応じた AI 挙動修正子（spawner/attacks/save-local 共用）。
export function currentDifficulty(state) {
  return stageDifficulty(effectiveStage(state));
}

