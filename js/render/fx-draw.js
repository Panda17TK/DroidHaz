// webapp/js/render/fx-draw.js
// FX の描画レジストリ。`type → draw(ctx, f, a)` で登録する。
// 新しい FX を追加するときは、systems/fx.js に spawn 関数を、ここに描画関数を足すだけ。
// （renderer 本体の if 連鎖を編集する必要がない）

import { roundedRect } from './glyphs.js';
import { radialAtOrigin, radialQuant } from './grad-cache.js';

export const FX_DRAW = {
  // 剣の一閃：外周ほど明るい三日月トレイル＋先端の光る刃。
  // a:1→0 で進行。前半でスイープし切り、後半は先端位置でフェードする。
  slash(ctx, f, a) {
    const p = 1 - a;                       // 0→1 進行
    const span = 2.6;                      // 総スイープ角(約150°)
    const half = span / 2;
    const r0 = 16, r1 = 56;
    const lead = -half + span * Math.min(1, p * 1.8);   // 先端角
    const tail = Math.max(-half, lead - span * 0.5);    // 三日月の後端
    const cl = Math.cos(lead), sl = Math.sin(lead);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    if (f.dir < 0) ctx.scale(1, -1); // 振り方向（コンボで左右交互）
    // 扇トレイル（環状セクター）
    ctx.beginPath();
    ctx.arc(0, 0, r1, tail, lead, false);
    ctx.arc(0, 0, r0, lead, tail, true);
    ctx.closePath();
    ctx.fillStyle = radialAtOrigin(ctx, r0, r1, [
      [0.0, 'rgba(120,170,235,0.0)'],
      [0.6, 'rgba(150,205,255,0.20)'],
      [0.9, 'rgba(225,242,255,0.72)'],
      [1.0, 'rgba(255,255,255,0.0)'],
    ], 'fx.slash.trail');
    ctx.fill();
    // 先端の光る刃＋外側グロー
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(245,251,255,0.95)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cl * (r0 + 3), sl * (r0 + 3));
    ctx.lineTo(cl * (r1 - 1), sl * (r1 - 1));
    ctx.stroke();
    ctx.fillStyle = 'rgba(210,235,255,0.55)';
    ctx.beginPath(); ctx.arc(cl * r1, sl * r1, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  // 敵の一閃（赤系・小ぶり）。slash と同じ三日月＋刃エッジ。
  eslash(ctx, f, a) {
    const p = 1 - a;
    const span = 2.2;
    const half = span / 2;
    const r0 = 14, r1 = 48;
    const lead = -half + span * Math.min(1, p * 1.8);
    const tail = Math.max(-half, lead - span * 0.5);
    const cl = Math.cos(lead), sl = Math.sin(lead);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    ctx.beginPath();
    ctx.arc(0, 0, r1, tail, lead, false);
    ctx.arc(0, 0, r0, lead, tail, true);
    ctx.closePath();
    ctx.fillStyle = radialAtOrigin(ctx, r0, r1, [
      [0.0, 'rgba(230,90,90,0.0)'],
      [0.6, 'rgba(255,120,120,0.22)'],
      [0.9, 'rgba(255,190,185,0.70)'],
      [1.0, 'rgba(255,255,255,0.0)'],
    ], 'fx.eslash.trail');
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,225,220,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cl * (r0 + 3), sl * (r0 + 3));
    ctx.lineTo(cl * (r1 - 1), sl * (r1 - 1));
    ctx.stroke();
    ctx.restore();
  },
  // 徒手空拳の殴り：前方に伸びる短い衝撃線＋小リング。
  punch(ctx, f, a) {
    const p = 1 - a;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(6 + p * 14, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,235,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(8 + p * 12, 0, 4 + p * 6, -1.1, 1.1); ctx.stroke();
    ctx.restore();
  },
  // 蹴り（3段目）：大きな衝撃リング＋放射状の線（ノックバック表現）。
  kick(ctx, f, a) {
    const p = 1 - a;
    const r = 8 + p * 26;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    ctx.strokeStyle = `rgba(255,236,180,${0.9 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.3, 1.3); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
    for (const ay of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(ay) * (r - 6), Math.sin(ay) * (r - 6));
      ctx.lineTo(Math.cos(ay) * (r + 8), Math.sin(ay) * (r + 8));
      ctx.stroke();
    }
    ctx.restore();
  },
  // 出血：赤い飛沫の粒子。
  bleed(ctx, f) {
    ctx.fillStyle = '#c8324b';
    ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
  },
  spark(ctx, f) {
    ctx.fillStyle = '#e6f3ff';
    ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
  },
  dust(ctx, f) {
    ctx.fillStyle = 'rgba(200,200,220,0.25)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 2 + f.t * 10, 0, Math.PI * 2); ctx.fill();
  },
  beam(ctx, f) {
    ctx.strokeStyle = 'rgba(220,240,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f.sx, f.sy); ctx.lineTo(f.ex, f.ey); ctx.stroke();
    ctx.lineWidth = 1;
  },
  blast(ctx, f, a) {
    const r = f.r * (0.6 + 0.4 * a);
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.fillStyle = radialQuant(ctx, r, [[0, 'rgba(255,230,150,0.6)'], [1, 'rgba(255,120,80,0.0)']], 'fx.blast');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  dmg(ctx, f) {
    ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = f.crit ? '#ffd166' : '#ffffff';
    ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
  },
  afterimage(ctx, f, a) {
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = f.color || '#cfe5ff';
    roundedRect(ctx, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 4); ctx.fill();
  },
  dodge(ctx, f, a) {
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, 10 + (1 - a) * 18, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
  },
  muzzle(ctx, f) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang || 0);
    ctx.fillStyle = f.color || '#fff1c0';
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(3, 4); ctx.lineTo(5, 0); ctx.lineTo(3, -4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  gib(ctx, f) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t * 14 + (f.s || 0));
    ctx.fillStyle = f.color || '#b24a4a';
    const s = f.s || 3;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  },
  splat(ctx, f, a) {
    ctx.fillStyle = f.color || '#b24a4a';
    ctx.globalAlpha = a * 0.4;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + (1 - a) * 0.5), 0, Math.PI * 2); ctx.fill();
  },
  deathflash(ctx, f, a) {
    const r = f.r * (0.4 + (1 - a) * 0.6);
    ctx.save(); ctx.translate(f.x, f.y);
    // 白の固定グラデをキャッシュし、フェードは globalAlpha（renderer 側で既に a を乗算済み）
    ctx.fillStyle = radialQuant(ctx, r, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 'fx.deathflash');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
};
