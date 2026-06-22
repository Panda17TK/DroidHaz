// webapp/js/render/enemy-sprites.js
// 敵キャラの「凝った」描画。種類ごとに固有のシルエット・目・装飾・歩行アニメを描く。
// 既存の状態オーバーレイ（回避点滅・溜めテレグラフ・HPバー）は renderer 側が担当し、
// ここでは「ボディ本体」だけを担う。原点は敵の中心、向きは m.faceX/faceY。

import { roundedRect } from './glyphs.js';

// 色ユーティリティ：#rrggbb を増減して陰影色を作る
function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// 向きに応じた目のオフセット（左右と上下を少しだけ寄せる）
function eyeShift(m) {
  const fx = m.faceX || 1, fy = m.faceY || 0;
  const l = Math.hypot(fx, fy) || 1;
  return { x: (fx / l) * 3, y: (fy / l) * 2 };
}

function drawEyes(ctx, m, spread, ry, opts) {
  opts = opts || {};
  const e = eyeShift(m);
  const r = opts.r || 2.4;
  // 白目
  if (!opts.noWhite) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-spread, ry, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(spread, ry, r + 1, 0, Math.PI * 2); ctx.fill();
  }
  // 瞳（向きに追従）
  ctx.fillStyle = opts.pupil || '#1a1f29';
  ctx.beginPath(); ctx.arc(-spread + e.x, ry + e.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(spread + e.x, ry + e.y, r, 0, Math.PI * 2); ctx.fill();
}

// 歩行の上下バウンド量（移動中だけ弾む）
function bob(m, time) {
  const px = (typeof m.prevX === 'number') ? m.prevX : m.x;
  const py = (typeof m.prevY === 'number') ? m.prevY : m.y;
  const moving = Math.hypot(m.x - px, m.y - py) > 0.05 || (m.vx * m.vx + m.vy * m.vy) > 4;
  const amp = moving ? 1.6 : 0.6;
  return Math.sin(time * 9 + (m.animSeed || 0)) * amp;
}

// ====== 種類別スプライト ======
// 各関数は (ctx, m, time, base) を受け、本体を描く。base は被弾/回避で上書きされた基調色。

function spriteWraith(ctx, m, time, base) {
  // 剣を持つ黒い人影：マント＋フード＋光る目＋向きの先に構える剣。
  const by = bob(m, time) * 0.6;
  const w = m.w, h = m.h;
  const ang = Math.atan2(m.faceY || 0, m.faceX || 1);
  ctx.save(); ctx.translate(0, by);
  // マント裾（左右に揺れる）
  const sway = Math.sin(time * 5 + (m.animSeed || 0)) * 2;
  ctx.fillStyle = shade(m.color, -8);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 4);
  ctx.lineTo(-w / 2 - 2 + sway, h / 2 + 4);
  ctx.lineTo(-w / 6, h / 2);
  ctx.lineTo(w / 6, h / 2 + 2);
  ctx.lineTo(w / 2 + 2 - sway, h / 2 + 4);
  ctx.lineTo(w / 2, -h / 4);
  ctx.closePath(); ctx.fill();
  // 胴（黒ローブ）＋フード
  ctx.fillStyle = base;
  roundedRect(ctx, -w / 2 + 1, -h / 2 + 2, w - 2, h - 2, 5); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -h / 2 - 4);
  ctx.lineTo(-w / 2 + 1, -h / 2 + 8);
  ctx.lineTo(w / 2 - 1, -h / 2 + 8);
  ctx.closePath(); ctx.fill();
  // フード内の闇
  ctx.fillStyle = '#05070a';
  roundedRect(ctx, -5, -h / 2 + 1, 10, 8, 3); ctx.fill();
  // 光る目
  const e = eyeShift(m);
  ctx.fillStyle = (m.hitFlash > 0) ? '#ffffff' : '#9ad1ff';
  ctx.beginPath(); ctx.arc(-2.6 + e.x * 0.5, -h / 2 + 5 + e.y * 0.4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2.6 + e.x * 0.5, -h / 2 + 5 + e.y * 0.4, 1.4, 0, Math.PI * 2); ctx.fill();
  // 剣（向きの先。突進/溜め中は引き上げ）
  ctx.save(); ctx.rotate(ang);
  if (m._charge) ctx.translate(0, -3);
  ctx.fillStyle = '#384353'; ctx.fillRect(3, -0.5, 5, 2.4);   // 柄
  ctx.fillStyle = '#9aa3b0'; ctx.fillRect(6, -2.6, 2, 5.6);   // 鍔
  ctx.fillStyle = '#cfd8e3'; ctx.fillRect(8, -1.4, 17, 2.6);  // 刃
  ctx.fillStyle = '#eef3f8'; ctx.fillRect(8, -1.4, 17, 1);    // 峰の光
  ctx.restore();
  ctx.restore();
}

function spriteGhost(ctx, m, time, base) {
  // 幽霊：半透明の浮遊体＋波打つ裾＋落ちくぼんだ目。発射時は前方が光る。
  const w = m.w, h = m.h;
  const fl = Math.sin(time * 3.5 + (m.animSeed || 0)) * 1.6;
  ctx.save(); ctx.translate(0, fl);
  ctx.globalAlpha *= 0.9;
  // 体（丸い上半身）
  ctx.fillStyle = base;
  roundedRect(ctx, -w * 0.44, -h * 0.5, w * 0.88, h * 0.78, w * 0.4); ctx.fill();
  // 裾（波打つ三角）
  ctx.beginPath();
  const yb = h * 0.24;
  ctx.moveTo(-w * 0.44, yb - 2);
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const x = -w * 0.44 + (w * 0.88) * (i / n);
    const dn = (i % 2 === 0) ? h * 0.2 : 0;
    ctx.lineTo(x, yb + dn + Math.sin(time * 6 + i + (m.animSeed || 0)) * 1.2);
  }
  ctx.lineTo(w * 0.44, yb - 2);
  ctx.closePath(); ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(-w * 0.14, -h * 0.2, w * 0.16, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  // 目・口（落ちくぼんだ闇・向きに追従）
  const e = eyeShift(m);
  ctx.fillStyle = '#10141c';
  ctx.beginPath(); ctx.ellipse(-3.4 + e.x * 0.5, -h * 0.14 + e.y * 0.5, 1.9, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.4 + e.x * 0.5, -h * 0.14 + e.y * 0.5, 1.9, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(e.x * 0.5, -h * 0.01 + e.y * 0.5, 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  if (m.fireFlash > 0) {
    const mx = e.x * 2.4, my = e.y * 2.4;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 10);
    gr.addColorStop(0, 'rgba(190,225,255,0.9)'); gr.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function spriteWolf(ctx, m, time, base) {
  // 狼：四足のシルエット＋耳＋赤い目。進行方向に回転。
  const w = m.w, h = m.h;
  const ang = Math.atan2(m.faceY || 0, m.faceX || 1);
  const gait = Math.sin(time * 12 + (m.animSeed || 0));
  ctx.save(); ctx.rotate(ang);
  // 脚（4本・前後に動く）
  ctx.fillStyle = shade(m.color, -24);
  ctx.fillRect(-w * 0.34, h * 0.16 + gait * 1.6, 3, 6);
  ctx.fillRect(-w * 0.10, h * 0.16 - gait * 1.6, 3, 6);
  ctx.fillRect(w * 0.14, h * 0.16 + gait * 1.6, 3, 6);
  ctx.fillRect(w * 0.34, h * 0.16 - gait * 1.6, 3, 6);
  // 尻尾（後方・揺れ）
  ctx.strokeStyle = base; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w * 0.46, -2); ctx.lineTo(-w * 0.66, -5 + gait * 2.5); ctx.stroke();
  ctx.lineWidth = 1;
  // 胴（横長）＋首頭
  ctx.fillStyle = base;
  roundedRect(ctx, -w * 0.48, -h * 0.26, w * 0.86, h * 0.52, 5); ctx.fill();
  roundedRect(ctx, w * 0.24, -h * 0.24, w * 0.32, h * 0.42, 4); ctx.fill();
  ctx.fillRect(w * 0.52, -2.5, 6, 5); // 鼻先
  // 耳（三角）
  ctx.fillStyle = shade(m.color, -16);
  ctx.beginPath(); ctx.moveTo(w * 0.26, -h * 0.22); ctx.lineTo(w * 0.30, -h * 0.46); ctx.lineTo(w * 0.40, -h * 0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.42, -h * 0.2); ctx.lineTo(w * 0.46, -h * 0.46); ctx.lineTo(w * 0.54, -h * 0.2); ctx.closePath(); ctx.fill();
  // 背の毛並み
  ctx.strokeStyle = shade(m.color, 18); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.22); ctx.lineTo(w * 0.2, -h * 0.22); ctx.stroke();
  // 赤い目
  ctx.fillStyle = (m.hitFlash > 0) ? '#ffffff' : '#ff4a4a';
  ctx.fillRect(w * 0.42, -3.2, 2.4, 2);
  ctx.restore();
}

function spriteElite(ctx, m, time, base) {
  // 中ボス／ボス共通の重厚な見た目（甲殻＋複眼＋ボスは王冠）
  const w = m.w, h = m.h;
  const breathe = Math.sin(time * 3 + (m.animSeed || 0)) * 1.2;
  ctx.save(); ctx.translate(0, breathe * 0.3);
  // 胴体（甲殻）
  ctx.fillStyle = base;
  roundedRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
  // 装甲プレート
  ctx.fillStyle = shade(m.color, -26);
  roundedRect(ctx, -w / 2, -h / 2, w, h * 0.32, 8); ctx.fill();
  ctx.fillStyle = shade(m.color, 20);
  roundedRect(ctx, -w / 2 + 4, h * 0.06, w - 8, h * 0.34, 5); ctx.fill();
  // トゲ（肩）
  ctx.fillStyle = shade(m.color, -40);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * (w / 2 - 2), -h / 2 + 4);
    ctx.lineTo(sx * (w / 2 + 6), -h / 2 - 2);
    ctx.lineTo(sx * (w / 2 - 2), -h / 2 + 12);
    ctx.closePath(); ctx.fill();
  }
  // 発射時の砲門グロー（向きの先）
  if (m.fireFlash > 0) {
    const ex2 = eyeShift(m), mx = ex2.x * 3, my = ex2.y * 3;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 14);
    gr.addColorStop(0, 'rgba(255,220,140,0.9)');
    gr.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2); ctx.fill();
  }
  // 複眼（4つの光る目）
  const e = eyeShift(m);
  const eyeColor = (m.enrageT > 0) ? '#ff5a5a' : '#ffd166';
  ctx.fillStyle = eyeColor;
  for (const ex of [-5, 5]) for (const ey of [-3, 1]) {
    ctx.beginPath(); ctx.arc(ex + e.x * 0.6, ey + e.y * 0.6, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  // ボスは王冠
  if (m.tier === 'boss') {
    ctx.fillStyle = '#ffd166';
    const cy = -h / 2 - 4;
    ctx.beginPath();
    ctx.moveTo(-8, cy + 6); ctx.lineTo(-8, cy);
    ctx.lineTo(-4, cy + 4); ctx.lineTo(0, cy - 2);
    ctx.lineTo(4, cy + 4); ctx.lineTo(8, cy);
    ctx.lineTo(8, cy + 6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

const SPRITES = {
  zombie: spriteWraith,  // 剣を持つ黒い人影
  spitter: spriteGhost,  // 幽霊
  stalker: spriteWolf,   // 狼
};

// 敵本体を描く（renderer から呼ぶ）。base は被弾/回避で決まる基調色。
export function drawEnemyBody(ctx, m, time, base) {
  if (m.tier === 'midboss' || m.tier === 'boss') { spriteElite(ctx, m, time, base); return; }
  const fn = SPRITES[m.kind];
  if (fn) { fn(ctx, m, time, base); return; }
  // フォールバック（未知の敵）：角丸＋目
  ctx.fillStyle = base;
  roundedRect(ctx, -m.w / 2, -m.h / 2, m.w, m.h, 4); ctx.fill();
  drawEyes(ctx, m, 4, -3, {});
}
