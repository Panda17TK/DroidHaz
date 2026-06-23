// js/systems/voices.js
// 被弾・息切れ時にプレイヤーの頭上へ出す「ダメージボイス」（吹き出しテキスト）。
// 音声ファイルは使わず、状況別のセリフをランダムに選んで state.playerVoice に積む（renderer が描画）。
//   分類: 状態異常(感電/毒/炎上) > 強攻撃(高ダメージ) > 弱攻撃(低ダメージ)。息切れは別系統。

const POOLS = {
  heavy: ['ぐああっ！', 'がはっ…！', 'づっ、重い！', '効くぅっ！', 'ぐおっ！', 'たまらん！', 'ぐぬぅっ！', 'いっ…痛だっ！', 'くっ、効いた！', 'ぐふっ！'],
  light: ['いてっ', 'ちくっ', 'あいたっ', 'うっ', 'ぬあっ', 'おっと', 'やられた', 'ちょ、', 'あぶなっ', 'くっ'],
  shock: ['しびれるっ！', 'ビリビリ！', 'か、感電…！', '体が動かんっ！'],
  poison: ['うっ、毒…', '気持ち悪い…', '体が蝕まれる…', '視界が緑に…'],
  burn: ['熱っ！', '燃えてるっ！', 'あちちっ！', '消してくれ…！'],
  breath: ['はぁ…はぁ…', 'ぜぇ…ぜぇ…', '息が…つづかない', 'もう走れない…', 'つかれた…', 'スタミナが…', 'ひと休み…', 'はぁ、きつい…'],
};

export function voicePools() { return POOLS; }

// 被弾の分類（純）：状態異常付与が最優先、次に被ダメ量で強/弱。DoT のみ（微量）は null。
export function classifyDamageVoice({ drop, shockRose, poisonRose, burnRose }) {
  if (shockRose) return 'shock';
  if (poisonRose) return 'poison';
  if (burnRose) return 'burn';
  if (drop >= 18) return 'heavy';
  if (drop >= 3) return 'light';
  return null;
}

export function pickLine(kind) {
  const arr = POOLS[kind] || POOLS.light;
  return arr[(Math.random() * arr.length) | 0];
}

// 吹き出しをセット。直近の吹き出しが新しいうちは潰さない（連発抑制）。
function setVoice(state, text, kind, life) {
  const v = state.playerVoice;
  if (v && v.t < 0.3) return;
  state.playerVoice = { text, kind, t: 0, life: life || 1.3 };
}

export function triggerDamageVoice(state, kind) {
  if (!kind) return;
  setVoice(state, pickLine(kind), kind, 1.1); // 約1秒（フェードイン/表示/フェードアウト込み）
}

// 息切れボイス：スタミナ低下中に一定間隔で出す（CD は内部管理）。
export function triggerBreathVoice(state, dt) {
  state._breathVoiceCD = (state._breathVoiceCD == null ? 0 : state._breathVoiceCD) - dt;
  if (state._breathVoiceCD <= 0) {
    setVoice(state, pickLine('breath'), 'breath', 1.2);
    state._breathVoiceCD = 3.5 + Math.random() * 2;
  }
}

// 吹き出しの寿命を進める（毎フレーム）。
export function updateVoice(state, dt) {
  const v = state.playerVoice;
  if (v) { v.t += dt; if (v.t >= v.life) state.playerVoice = null; }
}
