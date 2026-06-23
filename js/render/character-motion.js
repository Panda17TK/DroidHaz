// js/render/character-motion.js
// プレイヤーのモーション状態を state から導出する純関数（DOM 非依存＝テスト可能）。
// 4 モーション: 被弾(hurt) / 弱体化(weak) / 瀕死(dying) / 息切れ(breath)。
// 各キャラ描画関数がこの結果を解釈し、表情・姿勢・重畳キューを変える。

export const MOTION = {
  NORMAL: 'normal', HURT: 'hurt', WEAK: 'weak', DYING: 'dying', BREATH: 'breath',
  SHOCK: 'shock', POISON: 'poison', BURN: 'burn', // 状態異常の専用ダメージモーション
};

// 閾値（調整しやすいよう定数化）。
const HURT_ITIME = 0.6;   // 被弾直後フリンチ：iTime がこの値を超える間は hurt
const DYING_HP = 0.25;    // 瀕死：HP 割合
const BREATH_STA = 0.20;  // 息切れ：スタミナ割合

// state（または {player, gameOver}）と現在時刻(秒)から、主モーションと各フラグ・アニメ位相を返す。
export function computePlayerMotion(state, nowS) {
  const p = (state && state.player) || {};
  const hpMax = p.hpMax || 100;
  const staMax = p.staMax || 100;
  const hpr = Math.max(0, (p.hp || 0)) / (hpMax || 1);
  const star = (p.sta == null ? staMax : Math.max(0, p.sta)) / (staMax || 1);

  const dead = !!(state && state.gameOver) || hpr <= 0;
  const shock = (p.shockT || 0) > 0 && !dead;
  const poison = (p.poisonT || 0) > 0 && !dead;
  const burn = (p.burnT || 0) > 0 && !dead;
  const hurt = (p.iTime || 0) > HURT_ITIME && !dead;
  const weak = (p.weakT || 0) > 0 && !dead;
  const dying = hpr > 0 && hpr <= DYING_HP && !dead;
  const breath = star <= BREATH_STA && !dead;

  // 主ポーズ優先度: 瀕死/死亡 > 感電 > 毒 > 炎上 > 被弾 > 弱体化 > 息切れ > 通常。
  // （状態異常の専用モーションは被弾/弱体化より目立たせる）
  let primary = MOTION.NORMAL;
  if (dead || dying) primary = MOTION.DYING;
  else if (shock) primary = MOTION.SHOCK;
  else if (poison) primary = MOTION.POISON;
  else if (burn) primary = MOTION.BURN;
  else if (hurt) primary = MOTION.HURT;
  else if (weak) primary = MOTION.WEAK;
  else if (breath) primary = MOTION.BREATH;

  const t = nowS || 0;
  const fast = (dying || breath || dead || poison || burn);
  return {
    primary, hurt, weak, dying, breath, dead, shock, poison, burn,
    breathPhase: Math.sin(t * (fast ? 9 : 3.5)),                 // 呼吸の上下(-1..1)。息切れ/瀕死/毒で速く。
    tremble: (dying || dead || shock) ? Math.sin(t * 41) : 0,    // 瀕死/感電の微震動(-1..1)。
    zap: shock ? Math.sin(t * 70) : 0,                           // 感電の高速明滅(-1..1)。
    flinch: hurt ? Math.min(1, ((p.iTime || 0) - HURT_ITIME) / (1 - HURT_ITIME)) : 0, // 被弾の強さ(0..1)。
    // 副次キュー（重畳可）: 汗は息切れ/弱体化/瀕死/毒で出す。
    sweat: breath || weak || dying || dead || poison,
  };
}
