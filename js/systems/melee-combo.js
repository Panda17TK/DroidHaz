// js/systems/melee-combo.js
// 近接コンボの純ロジック（DOM・state 非依存でテスト可能）。
//
// ルール:
//  - タイミングよく（前段から comboWindow 以内かつ同じ武器で）押すとコンボが進む。
//  - 受付外（時間切れ／武器変更）なら 0 段目に戻る。
//  - count 段でひと巡り（例: 徒手空拳=3段で 3段目が蹴り、刀=4段で連続斬り）。

// 次のコンボ段を返す。within=受付時間内か, sameWeapon=同武器か。
export function advanceCombo(prevStep, count, within, sameWeapon) {
  if (!within || !sameWeapon) return 0;
  return ((prevStep | 0) + 1) % count;
}

// その段がフィニッシャ（徒手空拳の蹴り）か。fist の最終段(=count-1)のみ true。
export function isFinisher(def, step) {
  if (!def || def.kind !== 'fist' || !def.finisher) return false;
  return step === (def.combo - 1);
}

// 段に応じた振り方向（見た目の左右交互）。0:右回り,1:左回り…
export function swingDir(step) {
  return (step % 2 === 0) ? 1 : -1;
}

// その攻撃に使う実効パラメータ（reach/arc/dmg/kb/stagger）を段から解決。
export function resolveSwing(def, step) {
  if (isFinisher(def, step)) {
    const f = def.finisher;
    return {
      reach: f.reach, arc: f.arc, dmg: f.dmg, kb: f.kb,
      stagger: f.stagger || 0, finisher: true,
    };
  }
  return {
    reach: def.reach, arc: def.arc, dmg: def.dmg, kb: def.kb || 0,
    stagger: def.stagger || 0, finisher: false,
  };
}
