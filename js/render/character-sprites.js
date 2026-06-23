// js/render/character-sprites.js
// プレイアブルキャラクターの手続き描画（5体）＋武器シルエット＋近接スイング＋4モーション。
// renderer.js のプレイヤー描画はここに委譲する（HUD の武器アイコンも本モジュールを共有）。
//
// 設計（DESIGN: 2026-06-23-playable-characters）:
//  - 当たり判定(pl.w/h)・座標はゲーム側のまま。スプライトは BODY_SCALE で拡大して精緻化（見た目のみ）。
//  - モーション（被弾/弱体化/瀕死/息切れ）は character-motion.js の computePlayerMotion で導出し、
//    表情・姿勢（呼吸の上下/震え/のけぞり）・汗で表現。
//  - 武器は projType（遠隔）/ kind（近接）で見た目を分岐。挙動は既存システム側。

import { roundedRect } from './glyphs.js';
import { MELEE_SWING } from '../core/constants.js';
import { CHARACTERS } from '../state/characters.js';
import { computePlayerMotion, MOTION } from './character-motion.js';

const BODY_SCALE = 1.55; // 図形の拡大率（当たり判定は不変、見た目だけ精緻化）

// 遠隔武器の弾種 → 色とシルエット型。
const PROJ_COLOR = {
  arcane: '#9b7bff', fire: '#ff8a3c', ice: '#8fd8ff', thunder: '#ffe27a', curse: '#c07bff',
  book: '#d8c08a', water: '#6fd0ff', firework: '#ff7da6',
  bone: '#e8e6df', skull: '#cfd8c0',
  laser: '#ff5a7a', metal: '#cdd6e0', plasma: '#7affd0', missile: '#ffd07a',
};
const HOLD_TYPE = {
  arcane: 'wand', fire: 'wand', ice: 'wand', thunder: 'wand', curse: 'wand',
  book: 'thrown', firework: 'thrown', bone: 'thrown', skull: 'thrown', water: 'squirt',
  laser: 'gun', metal: 'gun', plasma: 'gun', missile: 'launcher',
};

function theme(id) { return (CHARACTERS[id] && CHARACTERS[id].theme) || {}; }
function skinOf(id) { return theme(id).skin || '#e7b48a'; }
function accentOf(id) { return theme(id).accent || '#e7c23c'; }

// ===== 表情（顔パーツ）=====
// style: 'human' | 'skull' | 'robot'。motion.primary で目・口を変える。head は (0, hy) 中心、幅 hw。
function drawFace(ctx, hy, hw, style, motion, eyeColor) {
  const m = motion.primary;
  const ex = hw * 0.28;     // 目の左右オフセット
  const ey = hy - 0.5;      // 目の高さ
  const my = hy + hw * 0.42; // 口の高さ
  ctx.lineCap = 'round';

  if (style === 'robot') {
    // バイザー型LED：通常=シアン、被弾/瀕死=赤、弱体=黄。
    const led = (m === MOTION.HURT || m === MOTION.DYING) ? '#ff5a6a'
      : (m === MOTION.WEAK) ? '#ffd86a' : (eyeColor || '#5ad1ff');
    ctx.fillStyle = '#10161e'; roundedRect(ctx, -ex - 2.2, ey - 2.2, ex * 2 + 4.4, 4.4, 1.5); ctx.fill();
    if (m === MOTION.DYING || motion.dead) { // 点滅消灯気味
      ctx.fillStyle = (Math.floor((motion.tremble + 2) * 3) % 2) ? led : '#3a1014';
    } else ctx.fillStyle = led;
    ctx.fillRect(-ex - 1, ey - 1, 2, 2); ctx.fillRect(ex - 1, ey - 1, 2, 2);
    // 口＝スピーカーグリル（息切れで開く）
    ctx.strokeStyle = '#2a3540'; ctx.lineWidth = 1;
    const open = (m === MOTION.BREATH) ? 1.6 : 0.6;
    ctx.beginPath(); ctx.moveTo(-2, my); ctx.lineTo(2, my);
    ctx.moveTo(-2, my + open); ctx.lineTo(2, my + open); ctx.stroke();
    return;
  }

  // skull / human 共通の目
  const eyeFill = (style === 'skull') ? '#0a0d12' : (eyeColor || '#26303c');
  if (style === 'skull') {
    // 眼窩（黒い穴）＋奥の小さな光
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath(); ctx.ellipse(-ex, ey, 2.4, 2.8, 0, 0, Math.PI * 2); ctx.ellipse(ex, ey, 2.4, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    if (m !== MOTION.DYING && !motion.dead) {
      ctx.fillStyle = (m === MOTION.HURT) ? '#ff7a7a' : (m === MOTION.WEAK ? '#ffd86a' : '#9be8c0');
      ctx.fillRect(-ex - 0.7, ey - 0.7, 1.4, 1.4); ctx.fillRect(ex - 0.7, ey - 0.7, 1.4, 1.4);
    }
  }

  // 目の表情（human と、skull の上書き表現）
  if (m === MOTION.HURT || m === MOTION.DYING || motion.dead) {
    // >< / X 目
    ctx.strokeStyle = (style === 'skull') ? '#9be8c0' : eyeFill; ctx.lineWidth = 1.3;
    const k = (m === MOTION.HURT) ? 1 : 1.4;
    ctx.beginPath();
    ctx.moveTo(-ex - 1.4, ey - k); ctx.lineTo(-ex + 1.4, ey + k);
    ctx.moveTo(-ex - 1.4, ey + k); ctx.lineTo(-ex + 1.4, ey - k);
    ctx.moveTo(ex - 1.4, ey - k); ctx.lineTo(ex + 1.4, ey + k);
    ctx.moveTo(ex - 1.4, ey + k); ctx.lineTo(ex + 1.4, ey - k);
    ctx.stroke();
  } else if (style !== 'skull') {
    if (m === MOTION.WEAK || m === MOTION.BREATH) {
      // 半目（疲れ目：上まぶたの線＋小さな瞳）
      ctx.strokeStyle = eyeFill; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-ex - 1.6, ey - 0.6); ctx.lineTo(-ex + 1.6, ey - 0.6);
      ctx.moveTo(ex - 1.6, ey - 0.6); ctx.lineTo(ex + 1.6, ey - 0.6); ctx.stroke();
      ctx.fillStyle = eyeFill; ctx.fillRect(-ex - 0.8, ey, 1.6, 1.4); ctx.fillRect(ex - 0.8, ey, 1.6, 1.4);
    } else {
      // 通常：丸い瞳＋ハイライト
      ctx.fillStyle = eyeFill;
      ctx.fillRect(-ex - 1, ey - 1, 2.2, 2.6); ctx.fillRect(ex - 1, ey - 1, 2.2, 2.6);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-ex - 0.6, ey - 0.8, 0.9, 0.9); ctx.fillRect(ex - 0.6, ey - 0.8, 0.9, 0.9);
    }
  }

  // 口
  ctx.strokeStyle = (style === 'skull') ? '#0a0d12' : '#9a5b52';
  ctx.lineWidth = 1.2;
  if (m === MOTION.BREATH) {
    // 開いた口（はあはあ）
    ctx.fillStyle = (style === 'skull') ? '#0a0d12' : '#7a3b39';
    ctx.beginPath(); ctx.ellipse(0, my, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  } else if (m === MOTION.HURT) {
    ctx.fillStyle = (style === 'skull') ? '#0a0d12' : '#7a3b39';
    ctx.beginPath(); ctx.ellipse(0, my, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill(); // 痛みの口
  } else if (m === MOTION.DYING || motion.dead) {
    // 食いしばり（ギザ口）
    ctx.beginPath(); ctx.moveTo(-2.4, my); ctx.lineTo(-1.2, my + 1.2); ctx.lineTo(0, my); ctx.lineTo(1.2, my + 1.2); ctx.lineTo(2.4, my); ctx.stroke();
  } else if (m === MOTION.WEAK) {
    // へにゃり口（波）
    ctx.beginPath(); ctx.moveTo(-2.2, my); ctx.quadraticCurveTo(0, my + 1.6, 2.2, my); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-1.6, my); ctx.lineTo(1.6, my); ctx.stroke(); // 通常
  }

  // skull の歯（口の下に縦線）
  if (style === 'skull') {
    ctx.strokeStyle = '#0a0d12'; ctx.lineWidth = 0.6;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 1.1, my + 1.4); ctx.lineTo(i * 1.1, my + 3); ctx.stroke(); }
  }
}

// 汗のしずく（息切れ/弱体/瀕死で頬に）。
function drawSweat(ctx, hx, hy, nowS) {
  const t = (nowS || 0) % 1;
  ctx.fillStyle = 'rgba(150,210,255,0.85)';
  ctx.beginPath(); ctx.ellipse(hx, hy + t * 4, 1.1, 1.7, 0, 0, Math.PI * 2); ctx.fill();
}

// 上半身（胴+頭+顔）に適用する呼吸/震え/のけぞりのオフセットを返す。
function upperOffset(motion) {
  const bob = (motion.breath || motion.dying || motion.dead) ? motion.breathPhase * 1.1 : motion.breathPhase * 0.4;
  const tr = motion.tremble * 0.8;
  const lean = motion.flinch * 2.2; // 被弾でのけぞり（後方=+x、本体ローカルでは右）
  return { ox: tr + lean, oy: bob };
}

// ===== キャラ別ボディ =====
// 各 fn は (0,0)＝プレイヤー中心のローカル空間に描く。脚は下、頭は上(負y)。
// 引数 a: { motion, hitFlash, nowS }

function drawHeroBody(ctx, a) {
  const { motion, hitFlash, nowS } = a;
  const SKIN = '#e7b48a', SKIN_SH = '#c98f63';
  const SHIRT = hitFlash ? '#ff9aa2' : '#e7c23c', SHIRT_SH = hitFlash ? '#d8707a' : '#b9991f';
  const PANTS = '#33589e', HAIR = '#2a231f';
  const { ox, oy } = upperOffset(motion);
  // 脚
  ctx.fillStyle = PANTS; ctx.fillRect(-5, 5, 4, 8); ctx.fillRect(1, 5, 4, 8);
  ctx.fillStyle = '#1c2c52'; ctx.fillRect(-5, 11, 4, 2); ctx.fillRect(1, 11, 4, 2);
  ctx.save(); ctx.translate(ox, oy);
  // 腕
  ctx.fillStyle = SKIN; ctx.fillRect(-8, -2, 3, 7); ctx.fillRect(5, -2, 3, 7);
  // 胴
  ctx.fillStyle = SHIRT; ctx.fillRect(-6, -4, 12, 9);
  ctx.fillStyle = SHIRT_SH; ctx.fillRect(-6, 3, 12, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fillRect(-6, -4, 12, 2);
  // 頭
  ctx.fillStyle = SKIN; ctx.fillRect(-5, -13, 10, 10);
  ctx.fillStyle = SKIN_SH; ctx.fillRect(-5, -4, 10, 1);
  // 髪
  ctx.fillStyle = HAIR; ctx.fillRect(-6, -14, 12, 5);
  ctx.fillRect(-6, -14, 2, 7); ctx.fillRect(4, -14, 2, 7);
  drawFace(ctx, -8.5, 9, 'human', motion);
  if (motion.sweat) drawSweat(ctx, 4.5, -9, nowS);
  ctx.restore();
}

function drawMageBody(ctx, a) {
  const { motion, hitFlash, nowS } = a;
  const ROBE = hitFlash ? '#9a6bff' : '#5b3fae', ROBE_SH = '#3c2a78', SKIN = '#e7c6a0';
  const HAT = '#3a2a78', TRIM = '#cdbcff';
  const { ox, oy } = upperOffset(motion);
  // ローブ裾（広がり）
  ctx.fillStyle = ROBE; ctx.beginPath();
  ctx.moveTo(-7, 13); ctx.lineTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(7, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ROBE_SH; ctx.fillRect(-7, 11, 14, 2);
  ctx.save(); ctx.translate(ox, oy);
  // 腕（袖）
  ctx.fillStyle = ROBE; ctx.fillRect(-9, -2, 4, 8); ctx.fillRect(5, -2, 4, 8);
  ctx.fillStyle = TRIM; ctx.fillRect(-9, 5, 4, 1.5); ctx.fillRect(5, 5, 4, 1.5);
  // 胴（ローブ上部）
  ctx.fillStyle = ROBE; ctx.fillRect(-6, -4, 12, 8);
  ctx.fillStyle = TRIM; ctx.fillRect(-1, -4, 2, 8); // 前立て
  // 頭
  ctx.fillStyle = SKIN; ctx.fillRect(-5, -13, 10, 10);
  // とんがり帽子
  ctx.fillStyle = HAT; ctx.beginPath();
  ctx.moveTo(-8, -12); ctx.lineTo(2, -26); ctx.lineTo(8, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = TRIM; ctx.fillRect(-8, -13, 16, 2);
  ctx.fillStyle = accentOf('mage'); ctx.beginPath(); ctx.arc(2, -26, 1.8, 0, Math.PI * 2); ctx.fill(); // 帽子先の星玉
  drawFace(ctx, -8.5, 9, 'human', motion);
  if (motion.sweat) drawSweat(ctx, 4.5, -9, nowS);
  ctx.restore();
}

function drawJkBody(ctx, a) {
  const { motion, hitFlash, nowS } = a;
  const UNI = hitFlash ? '#ff9aa2' : '#2b3a66', SAILOR = '#eef3fb', SKIRT = '#26324f';
  const SKIN = '#f2cba6', HAIR = '#6b4a2e', RIBBON = '#ff5a7a';
  const { ox, oy } = upperOffset(motion);
  // 脚（素足＋ローファー）
  ctx.fillStyle = SKIN; ctx.fillRect(-4, 7, 3, 5); ctx.fillRect(1, 7, 3, 5);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-4, 11, 3, 2); ctx.fillRect(1, 11, 3, 2);
  // スカート（プリーツ）
  ctx.fillStyle = SKIRT; ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-5, 1); ctx.lineTo(5, 1); ctx.lineTo(7, 7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a2336'; ctx.lineWidth = 0.6;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 2); ctx.lineTo(i * 3, 7); ctx.stroke(); }
  ctx.save(); ctx.translate(ox, oy);
  // 腕
  ctx.fillStyle = SAILOR; ctx.fillRect(-8, -2, 3, 7); ctx.fillRect(5, -2, 3, 7);
  ctx.fillStyle = SKIN; ctx.fillRect(-8, 4, 3, 2); ctx.fillRect(5, 4, 3, 2);
  // 胴（セーラー服）
  ctx.fillStyle = SAILOR; ctx.fillRect(-6, -4, 12, 8);
  ctx.fillStyle = UNI; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, 1); ctx.lineTo(6, -4); ctx.lineTo(6, -2); ctx.lineTo(0, 2.5); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill(); // 襟
  ctx.fillStyle = RIBBON; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2.4, 2.2); ctx.lineTo(0, 1.5); ctx.lineTo(2.4, 2.2); ctx.closePath(); ctx.fill(); // リボン
  // 頭
  ctx.fillStyle = SKIN; ctx.fillRect(-5, -13, 10, 10);
  // 髪（前髪＋サイドテール）
  ctx.fillStyle = HAIR; ctx.fillRect(-6, -14, 12, 5);
  ctx.fillRect(-6, -14, 2, 9); ctx.fillRect(4, -14, 2, 9);
  ctx.beginPath(); ctx.ellipse(-7, -6, 1.8, 4, 0, 0, Math.PI * 2); ctx.ellipse(7, -6, 1.8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RIBBON; ctx.fillRect(-8, -9, 2.4, 2); ctx.fillRect(5.6, -9, 2.4, 2); // 髪留め
  drawFace(ctx, -8.5, 9, 'human', motion);
  if (motion.sweat) drawSweat(ctx, 5, -9, nowS);
  ctx.restore();
}

function drawSkeletonBody(ctx, a) {
  const { motion, hitFlash, nowS } = a;
  const BONE = hitFlash ? '#ffd2d2' : '#e8e6df', BONE_SH = '#b9b6ac';
  const { ox, oy } = upperOffset(motion);
  // 脚（骨）
  ctx.strokeStyle = BONE; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(-3, 12); ctx.moveTo(3, 4); ctx.lineTo(3, 12); ctx.stroke();
  ctx.save(); ctx.translate(ox, oy);
  // 腕（骨）
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-8, 5); ctx.moveTo(6, -2); ctx.lineTo(8, 5); ctx.stroke();
  // 肋骨＋背骨
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 5); ctx.stroke(); // 背骨
  for (let i = 0; i < 4; i++) {
    const ry = -3 + i * 2.2;
    ctx.beginPath(); ctx.moveTo(-5, ry); ctx.quadraticCurveTo(0, ry + 1.2, 5, ry); ctx.stroke();
  }
  // 骨盤
  ctx.fillStyle = BONE; roundedRect(ctx, -4, 4, 8, 3, 1.5); ctx.fill();
  // 頭蓋骨
  ctx.fillStyle = BONE; ctx.beginPath(); ctx.ellipse(0, -10, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BONE_SH; ctx.fillRect(-3, -4.5, 6, 1.5); // 顎下の影
  drawFace(ctx, -10.5, 9, 'skull', motion);
  if (motion.sweat) { ctx.fillStyle = 'rgba(155,232,192,0.8)'; drawSweat(ctx, 5, -11, nowS); }
  ctx.restore();
}

function drawRobotBody(ctx, a) {
  const { motion, hitFlash, nowS } = a;
  const METAL = hitFlash ? '#ffb3b8' : '#aeb8c4', METAL_SH = '#7d8794', PANEL = '#5a6573';
  const ACC = accentOf('robot');
  const { ox, oy } = upperOffset(motion);
  // 脚（メカ脚）
  ctx.fillStyle = METAL_SH; ctx.fillRect(-5, 5, 4, 8); ctx.fillRect(1, 5, 4, 8);
  ctx.fillStyle = '#2a3038'; ctx.fillRect(-5, 11, 4, 2); ctx.fillRect(1, 11, 4, 2);
  ctx.save(); ctx.translate(ox, oy);
  // 腕（関節）
  ctx.fillStyle = METAL_SH; ctx.fillRect(-9, -2, 4, 7); ctx.fillRect(5, -2, 4, 7);
  ctx.fillStyle = ACC; ctx.fillRect(-9, 1, 4, 1); ctx.fillRect(5, 1, 4, 1);
  // 胴（パネル＋コアライト）
  ctx.fillStyle = METAL; roundedRect(ctx, -6, -4, 12, 9, 2); ctx.fill();
  ctx.fillStyle = PANEL; ctx.fillRect(-5, -1, 10, 1);
  ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(0, 1.5, 1.8, 0, Math.PI * 2); ctx.fill(); // コア
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-6, -4, 12, 2);
  // 頭（角型）＋アンテナ
  ctx.fillStyle = METAL; roundedRect(ctx, -5, -13, 10, 10, 2); ctx.fill();
  ctx.fillStyle = METAL_SH; ctx.fillRect(-5, -4, 10, 1);
  ctx.strokeStyle = METAL_SH; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, -17); ctx.stroke();
  ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(0, -17.6, 1.4, 0, Math.PI * 2); ctx.fill();
  drawFace(ctx, -8.5, 9, 'robot', motion, ACC);
  if (motion.sweat) { // ロボは汗の代わりに排熱スパーク
    ctx.fillStyle = 'rgba(255,180,90,0.8)'; ctx.fillRect(5, -10 + ((nowS || 0) % 1) * 3, 1.4, 1.4);
  }
  ctx.restore();
}

const BODY = { hero: drawHeroBody, mage: drawMageBody, jk: drawJkBody, skeleton: drawSkeletonBody, robot: drawRobotBody };

// ===== 武器シルエット（遠隔・構え／HUD共用）。原点から +x 方向へ描く =====
export function drawWeaponSilhouette(ctx, def, recoil) {
  const r = recoil || 0;
  const pt = def && def.projType;
  if (!pt) { drawGunById(ctx, (def && def.id) || 'pistol', r); return; }
  const color = PROJ_COLOR[pt] || '#cdd6e0';
  const hold = HOLD_TYPE[pt] || 'gun';
  if (hold === 'wand') {
    ctx.fillStyle = '#6b4c2b'; ctx.fillRect(4 - r, -1.2, 13, 2.4);            // 杖の柄
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(18 - r, 0, 3.2, 0, Math.PI * 2); ctx.fill(); // 先端オーブ
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(17 - r, -1, 1, 0, Math.PI * 2); ctx.fill();
  } else if (hold === 'gun' || hold === 'launcher') {
    ctx.fillStyle = '#2b323c'; ctx.fillRect(5 - r, -2.4, hold === 'launcher' ? 13 : 16, 4.8);
    ctx.fillStyle = color; ctx.fillRect((hold === 'launcher' ? 16 : 19) - r, -1.6, hold === 'launcher' ? 5 : 6, 3.2); // エミッタ
    if (hold === 'launcher') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(20 - r, 0, 2, 0, Math.PI * 2); ctx.fill(); }
  } else if (hold === 'squirt') {
    ctx.fillStyle = '#3a6ea5'; roundedRect(ctx, 5 - r, -2.4, 10, 5, 1.5); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(14 - r, -1, 5, 2);
  } else { // thrown：手に持つ小物
    ctx.fillStyle = color; roundedRect(ctx, 6 - r, -2.6, 5, 5, 1.2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(6 - r, 1, 5, 1);
  }
}

function drawGunById(ctx, id, r) {
  if (id === 'shotgun') {
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(5 - r, -2, 14, 4);
    ctx.fillStyle = '#6b727b'; ctx.fillRect(13 - r, -1.4, 11, 2.8);
    ctx.fillStyle = '#222a32'; ctx.fillRect(10 - r, 2, 5, 2);
  } else if (id === 'mg') {
    ctx.fillStyle = '#2b323c'; ctx.fillRect(5 - r, -2.4, 19, 4.6);
    ctx.fillStyle = '#6b737d'; ctx.fillRect(16 - r, -1.2, 9, 2.4);
    ctx.fillStyle = '#161d27'; ctx.fillRect(8 - r, 2, 4, 5);
  } else if (id === 'beam') {
    ctx.fillStyle = '#26384a'; ctx.fillRect(5 - r, -2.6, 14, 5.2);
    ctx.fillStyle = '#7fe0ff'; ctx.fillRect(17 - r, -1.4, 7, 2.8);
    ctx.fillStyle = '#bff2ff'; ctx.fillRect(22 - r, -0.8, 2, 1.6);
  } else if (id === 'grenade') {
    ctx.fillStyle = '#33402c'; ctx.fillRect(5 - r, -2.6, 12, 5.2);
    ctx.fillStyle = '#1c2417'; ctx.fillRect(14 - r, -3, 6, 6);
  } else {
    ctx.fillStyle = '#2b3340'; ctx.fillRect(5 - r, -2, 11, 4);
    ctx.fillStyle = '#161d27'; ctx.fillRect(14 - r, -1.4, 3, 2.8);
    ctx.fillStyle = '#384353'; ctx.fillRect(5 - r, 1, 3, 4);
  }
}

// 近接アイコン（HUD用・原点中心）。kind 別。
export function drawMeleeIcon(ctx, kind) {
  if (kind === 'blade') {
    ctx.save(); ctx.rotate(-0.5);
    ctx.fillStyle = '#cfd8e3'; ctx.fillRect(-1.5, -12, 3, 18);
    ctx.fillStyle = '#caa45a'; ctx.fillRect(-3, 5, 6, 2);
    ctx.fillStyle = '#7a5a32'; ctx.fillRect(-1.5, 6, 3, 5);
    ctx.restore();
  } else if (kind === 'staff') {
    ctx.fillStyle = '#6b4c2b'; ctx.fillRect(-1.5, -10, 3, 20);
    ctx.fillStyle = '#9b7bff'; ctx.beginPath(); ctx.arc(0, -11, 3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'bag') {
    ctx.fillStyle = '#2b3a66'; roundedRect(ctx, -7, -5, 14, 11, 2); ctx.fill();
    ctx.fillStyle = '#1a2336'; ctx.fillRect(-7, -2, 14, 2);
    ctx.strokeStyle = '#cdb389'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -5, 4, Math.PI, 0); ctx.stroke();
  } else if (kind === 'scythe') {
    ctx.fillStyle = '#5a4632'; ctx.fillRect(-1.2, -10, 2.4, 20);
    ctx.strokeStyle = '#cfd8c0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(2, -10, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else if (kind === 'drill') {
    ctx.fillStyle = '#7d8794'; ctx.fillRect(-2, 2, 4, 8);
    ctx.fillStyle = '#cdd6e0'; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(3, 2); ctx.lineTo(0, -11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a6573'; ctx.lineWidth = 0.7; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-2.4 + i, -2 - i * 2.5); ctx.lineTo(2.4 - i, -1 - i * 2.5); ctx.stroke(); }
  } else if (kind === 'arm') {
    ctx.fillStyle = '#aeb8c4'; roundedRect(ctx, -6, -6, 12, 12, 3); ctx.fill();
    ctx.fillStyle = '#5a6573'; ctx.fillRect(-6, -1, 12, 2);
    ctx.fillStyle = '#5ad1ff'; ctx.fillRect(-2, -5, 4, 2);
  } else { // fist
    ctx.fillStyle = '#e7b48a'; roundedRect(ctx, -7, -5, 14, 11, 3); ctx.fill();
    ctx.fillStyle = '#c98f63'; ctx.fillRect(-7, 2, 14, 2);
    ctx.fillStyle = '#a9744b'; for (let i = 0; i < 3; i++) ctx.fillRect(-5 + i * 4, -4, 1, 4);
  }
}

// 近接スイング（攻撃中の演出）。kind 別。ang=照準角。sp=進行0..1, dir=±1。
function drawMeleeSwing(ctx, kind, pl, ang) {
  const sp = 1 - pl.meleeT / MELEE_SWING;
  const dir = pl.meleeDir || 1;
  const finisher = !!pl.meleeFinisher;

  if (kind === 'blade') {
    const chop = (-1.5 + 2.2 * sp) * dir, adv = Math.sin(sp * Math.PI) * 5, len = 34, bw = 5;
    ctx.save(); ctx.rotate(ang + chop); ctx.translate(adv, 0);
    ctx.fillStyle = '#8a6a36'; ctx.fillRect(7, -4, 3, 8);
    ctx.fillStyle = '#d3deec'; ctx.beginPath();
    ctx.moveTo(10, -bw / 2); ctx.lineTo(10 + len, -1.3); ctx.lineTo(10 + len + 6, 0); ctx.lineTo(10 + len, 1.3); ctx.lineTo(10, bw / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(11, -1.1); ctx.lineTo(10 + len, -0.6); ctx.stroke();
    ctx.restore();
  } else if (kind === 'staff') {
    const sweep = (-1.2 + 2.4 * sp) * dir;
    ctx.save(); ctx.rotate(ang + sweep);
    ctx.fillStyle = '#6b4c2b'; ctx.fillRect(6, -1.4, 26, 2.8);
    ctx.fillStyle = '#9b7bff'; ctx.beginPath(); ctx.arc(34, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(34, 0, 7 * Math.sin(sp * Math.PI), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  } else if (kind === 'bag') {
    const arc = (-1.4 + 2.6 * sp) * dir, adv = Math.sin(sp * Math.PI) * 6;
    ctx.save(); ctx.rotate(ang + arc); ctx.translate(adv, 0);
    ctx.fillStyle = '#cdb389'; ctx.lineWidth = 2; ctx.strokeStyle = '#cdb389'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.fillStyle = '#2b3a66'; roundedRect(ctx, 16, -7, 14, 14, 2); ctx.fill();
    ctx.fillStyle = '#1a2336'; ctx.fillRect(16, -1, 14, 2);
    ctx.restore();
  } else if (kind === 'scythe') {
    const reap = (-1.8 + 2.8 * sp) * dir;
    ctx.save(); ctx.rotate(ang + reap);
    ctx.fillStyle = '#5a4632'; ctx.fillRect(6, -1.2, 30, 2.4);
    ctx.strokeStyle = '#cfd8c0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(34, 0, 12, Math.PI * 1.15 * dir, Math.PI * 1.9 * dir, dir < 0); ctx.stroke();
    ctx.restore();
  } else if (kind === 'drill') {
    const thrust = Math.sin(sp * Math.PI) * 14, spin = sp * 30;
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = '#7d8794'; ctx.fillRect(2, -2, 10 + thrust, 4);
    ctx.save(); ctx.translate(12 + thrust, 0); ctx.rotate(spin);
    ctx.fillStyle = '#cdd6e0'; ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, 3.5); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.restore();
  } else if (kind === 'arm') {
    const thrust = Math.sin(sp * Math.PI) * 18;
    ctx.save(); ctx.rotate(ang);
    ctx.strokeStyle = '#7d8794'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(8 + thrust, 0); ctx.stroke();
    ctx.fillStyle = '#aeb8c4'; roundedRect(ctx, 8 + thrust, -5, 9, 10, 2); ctx.fill();
    ctx.fillStyle = '#5ad1ff'; ctx.fillRect(11 + thrust, -3, 3, 2);
    ctx.restore();
  } else if (finisher) { // 蹴り（fists の3段目）
    const thrust = Math.sin(sp * Math.PI) * 16;
    ctx.save(); ctx.rotate(ang);
    ctx.strokeStyle = '#6f8db0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 4 * dir); ctx.lineTo(11 + thrust, 1 * dir); ctx.stroke();
    ctx.fillStyle = '#8fb0d8'; ctx.beginPath(); ctx.arc(13 + thrust, 1 * dir, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else { // 殴り（fist）
    const hook = (-0.9 + 1.8 * sp) * dir, ext = 6 + Math.sin(sp * Math.PI) * 7;
    ctx.save(); ctx.rotate(ang + hook);
    ctx.strokeStyle = '#7ab0ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2 + ext, 0); ctx.stroke();
    ctx.fillStyle = '#cfe0ff'; ctx.beginPath(); ctx.arc(4 + ext, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ===== メイン：プレイヤー1体を描く（renderer から呼ぶ）=====
// ix,iy=補間済みワールド座標, A=補間係数, nowS=現在秒。
export function drawCharacter(ctx, state, ix, iy, A, nowS) {
  const pl = state.player;
  const ang = Math.atan2(pl.facing.y, pl.facing.x);
  const recoil = pl.recoil || 0;
  const px = ix - Math.cos(ang) * recoil, py = iy - Math.sin(ang) * recoil;
  const motion = computePlayerMotion(state, nowS);
  const flip = pl.facing.x < 0 ? -1 : 1;
  const hitFlash = pl.iTime > 0 && (Math.floor(pl.iTime * 20) % 2 === 0);
  const id = pl.drawId || state.charId || 'hero';

  // 接地影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(ix, iy + pl.h / 2 - 1, pl.w * 0.5, pl.h * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  // ダッシュ残像（キャラのアクセント色）
  if (pl.isDashing) {
    ctx.globalAlpha = 0.2; ctx.fillStyle = accentOf(id);
    roundedRect(ctx, px - pl.facing.x * 8 - 9, py - pl.facing.y * 8 - 12, 18, 26, 6); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save(); ctx.translate(px, py);

  // 本体（拡大して精緻化。被弾でやや沈む）
  ctx.save();
  ctx.scale(BODY_SCALE, BODY_SCALE);
  if (flip < 0) ctx.scale(-1, 1);
  (BODY[id] || BODY.hero)(ctx, { motion, hitFlash, nowS });
  ctx.restore();

  // 構え＋遠隔武器（照準方向・通常スケール＝攻撃判定と整合）
  ctx.save(); ctx.rotate(ang);
  ctx.fillStyle = skinOf(id); ctx.fillRect(3, -1.6, 6 - recoil * 0.4, 3.2); // 前腕
  drawWeaponSilhouette(ctx, pl.weapons[pl.curW] || {}, recoil);
  if (pl.muzzleT > 0) {
    const def = pl.weapons[pl.curW] || {};
    ctx.fillStyle = def.projType ? (PROJ_COLOR[def.projType] || '#fff1c0') : '#fff1c0';
    ctx.beginPath(); ctx.moveTo(26 - recoil, 0); ctx.lineTo(19 - recoil, 3.5); ctx.lineTo(21 - recoil, 0); ctx.lineTo(19 - recoil, -3.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // 近接スイング（kind 別）
  if (pl.meleeT > 0) drawMeleeSwing(ctx, pl.meleeKind, pl, ang);

  ctx.restore();
}
