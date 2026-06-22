// js/systems/progress.js
// REQ-MODE-1 / SAVE-2（一部）: ラン横断の進行度（到達ステージ・エンドレス解放・最終モード）。
// 永続化は kv 経由（接頭辞 arena_）。純関数（normalize/markStageReached）はテスト可能。

import { getItem, setItem } from '../services/kv.js';

const KEY = 'arena_progress';

export const DEFAULT_PROGRESS = {
  bestStage: 1,
  allCleared: false,
  endlessUnlocked: false,
  lastMode: 'stage', // 'stage' | 'endless'
};

export function normalizeProgress(o) {
  const p = (o && typeof o === 'object') ? o : {};
  return {
    bestStage: Math.max(1, (p.bestStage | 0) || 1),
    allCleared: !!p.allCleared,
    endlessUnlocked: !!p.endlessUnlocked,
    lastMode: (p.lastMode === 'endless') ? 'endless' : 'stage',
  };
}

// 純: ステージ到達で進行を更新。stageMax 到達でエンドレス解放（全クリア）。
export function markStageReached(progress, stage, stageMax) {
  const p = normalizeProgress(progress);
  const s = Math.max(1, stage | 0);
  if (s > p.bestStage) p.bestStage = s;
  if (s >= Math.max(1, stageMax | 0)) { p.allCleared = true; p.endlessUnlocked = true; }
  return p;
}

export function isEndlessUnlocked(progress) {
  return !!normalizeProgress(progress).endlessUnlocked;
}

// ===== 永続化 =====
export function readProgress() {
  try { return normalizeProgress(JSON.parse(getItem(KEY) || '{}')); }
  catch (_e) { return normalizeProgress({}); }
}

export function writeProgress(progress) {
  try { setItem(KEY, JSON.stringify(normalizeProgress(progress))); return { ok: true }; }
  catch (_e) { return { ok: false }; }
}
