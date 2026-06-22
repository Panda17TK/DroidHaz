// js/systems/status.js
// 敵の状態異常（出血・怯み）の純ロジック。mob を破壊的更新するが、乱数/FX/state に依存せず
// 決定的なのでテスト可能。FX 生成や撃破処理は呼び出し側（ai.js）が行う。

// 出血を付与（10秒など cfg.bleedDur）。重ねがけは持続を上書き（リフレッシュ）。
export function applyBleed(m, cfg) {
  m.bleedT = (cfg && cfg.bleedDur) || 10;
}

// 怯み（スタン）を付与。短いほど「少し怯む」。既存より長い場合のみ更新。
export function applyStun(m, sec) {
  if (!(sec > 0)) return;
  m.stunT = Math.max(m.stunT || 0, sec);
}

// 1フレーム分の状態異常処理。戻り値で移動倍率と怯み中かを返す。
//   - 出血: 持続を減らし、毎秒 最大HPの cfg.bleedDotFrac 割合をダメージ。移動 ×cfg.bleedSlowMul。
//   - 怯み: 持続を減らし、その間は stunned=true。
export function tickStatus(m, dt, cfg) {
  let slowMul = 1, stunned = false;
  if (m.bleedT > 0) {
    m.bleedT -= dt;
    if (m.bleedT < 0) m.bleedT = 0;
    const maxhp = m.maxhp || m.hp || 1;
    m.hp -= maxhp * ((cfg && cfg.bleedDotFrac) || 0.01) * dt;
    slowMul *= (cfg && cfg.bleedSlowMul) || 0.8;
  }
  if (m.stunT > 0) {
    m.stunT -= dt;
    if (m.stunT < 0) m.stunT = 0;
    stunned = true;
  }
  return { slowMul, stunned };
}
