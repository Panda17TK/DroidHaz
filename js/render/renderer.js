import { clamp } from '../systems/physics.js';
import { TILE, MELEE_SWING } from '../core/constants.js';
import { CONFIG } from '../core/config.js';
import { roundedRect, keyGlyph, boxGlyph, medGlyph, ringGlyph, swordGlyph, boltGlyph, crateGlyph } from './glyphs.js';
import { drawEnemyBody } from './enemy-sprites.js';
import { FX_DRAW } from './fx-draw.js';
import { verticalLinear, radialQuant, radialAtOrigin } from './grad-cache.js';
import { computeView, clampCamera } from './view.js';

// グリフ名 → 描画関数（CONFIG.items.glyph から引く）
const GLYPH_DRAW = {
  key:   (ctx, def) => { ctx.fillStyle = def.color; keyGlyph(ctx); },
  box:   (ctx, def) => { ctx.fillStyle = def.color; boxGlyph(ctx, def.label || ''); },
  med:   (ctx, def) => { ctx.fillStyle = def.color; medGlyph(ctx); },
  ring:  (ctx) => ringGlyph(ctx),
  sword: (ctx) => swordGlyph(ctx),
  bolt:  (ctx) => boltGlyph(ctx),
  crate: (ctx) => crateGlyph(ctx),
};

// #rrggbb / #rgb → rgba(r,g,b,alpha)
function hexToRgba(hex, alpha) {
  let c = String(hex).replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// 補間描画位置：直近ステップの px0/py0 から現在位置へ alpha で線形補間。
// px0 が無い（生成直後/初回）の場合は現在位置をそのまま使う。
function rx(ent, a) { return (ent.px0 == null) ? ent.x : ent.px0 + (ent.x - ent.px0) * a; }
function ry(ent, a) { return (ent.py0 == null) ? ent.y : ent.py0 + (ent.y - ent.py0) * a; }

// 背景パララックス：奥行きの異なる2層の塵をカメラに対しゆっくり逆スクロール。
// 決定論的に配置するのでチラつかない。スクリーン空間に描画。
function drawParallax(ctx, W, H, camX, camY) {
  // ベースの暗いグラデ（縦方向・サイズ依存なのでキャッシュ）
  ctx.fillStyle = verticalLinear(ctx, H, [[0, '#0a0d12'], [1, '#0d1119']], 'parallaxBg');
  ctx.fillRect(0, 0, W, H);

  const layers = [
    { factor: 0.15, count: 40, size: 1, alpha: 0.18, span: 900 },
    { factor: 0.35, count: 28, size: 2, alpha: 0.12, span: 700 },
  ];
  for (const L of layers) {
    const ox = -camX * L.factor, oy = -camY * L.factor;
    ctx.fillStyle = `rgba(160,190,230,${L.alpha})`;
    for (let i = 0; i < L.count; i++) {
      // 決定論的な疑似乱数で点を配置
      const hx = (i * 2654435761) >>> 0, hy = (i * 40503 + 12345) >>> 0;
      let xx = ((hx % L.span) + ox) % L.span; if (xx < 0) xx += L.span;
      let yy = ((hy % L.span) + oy) % L.span; if (yy < 0) yy += L.span;
      // span を画面サイズに折り返してタイル状に敷く
      for (let tx = -L.span; tx < W + L.span; tx += L.span) {
        for (let ty = -L.span; ty < H + L.span; ty += L.span) {
          ctx.fillRect(tx + xx, ty + yy, L.size, L.size);
        }
      }
    }
  }
}

// 銃のシルエットを原点から +x 方向へ描く（プレイヤーの構え／HUDアイコン共用）。
function drawHeldGun(ctx, id, recoil) {
  const r = recoil || 0;
  if (id === 'shotgun') {
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(5 - r, -2, 14, 4);      // 木ストック
    ctx.fillStyle = '#6b727b'; ctx.fillRect(13 - r, -1.4, 11, 2.8); // 金属バレル
    ctx.fillStyle = '#222a32'; ctx.fillRect(10 - r, 2, 5, 2);       // ポンプ
  } else if (id === 'mg') {
    ctx.fillStyle = '#2b323c'; ctx.fillRect(5 - r, -2.4, 19, 4.6);
    ctx.fillStyle = '#6b737d'; ctx.fillRect(16 - r, -1.2, 9, 2.4);
    ctx.fillStyle = '#161d27'; ctx.fillRect(8 - r, 2, 4, 5);        // マガジン
  } else if (id === 'beam') {
    ctx.fillStyle = '#26384a'; ctx.fillRect(5 - r, -2.6, 14, 5.2);
    ctx.fillStyle = '#7fe0ff'; ctx.fillRect(17 - r, -1.4, 7, 2.8);  // エミッタ
    ctx.fillStyle = '#bff2ff'; ctx.fillRect(22 - r, -0.8, 2, 1.6);
  } else if (id === 'grenade') {
    ctx.fillStyle = '#33402c'; ctx.fillRect(5 - r, -2.6, 12, 5.2);
    ctx.fillStyle = '#1c2417'; ctx.fillRect(14 - r, -3, 6, 6);      // 太い銃口
  } else { // pistol
    ctx.fillStyle = '#2b3340'; ctx.fillRect(5 - r, -2, 11, 4);
    ctx.fillStyle = '#161d27'; ctx.fillRect(14 - r, -1.4, 3, 2.8);
    ctx.fillStyle = '#384353'; ctx.fillRect(5 - r, 1, 3, 4);        // グリップ
  }
}

// 近接アイコン（拳/刀）を原点中心に描く（HUD用）。
function drawMeleeIcon(ctx, id) {
  if (id === 'katana' || id === 'blade') {
    ctx.save(); ctx.rotate(-0.5);
    ctx.fillStyle = '#cfd8e3'; ctx.fillRect(-1.5, -12, 3, 18);  // 刃
    ctx.fillStyle = '#eef3f8'; ctx.fillRect(-1.5, -12, 1, 18);  // 峰の光
    ctx.fillStyle = '#caa45a'; ctx.fillRect(-3, 5, 6, 2);       // 鍔
    ctx.fillStyle = '#7a5a32'; ctx.fillRect(-1.5, 6, 3, 5);     // 柄
    ctx.restore();
  } else { // 徒手空拳＝拳
    ctx.fillStyle = '#e7b48a'; roundedRect(ctx, -7, -5, 14, 11, 3); ctx.fill();
    ctx.fillStyle = '#c98f63'; ctx.fillRect(-7, 2, 14, 2);
    ctx.fillStyle = '#a9744b'; for (let i = 0; i < 3; i++) ctx.fillRect(-5 + i * 4, -4, 1, 4);
  }
}

// 右上の武器スロット（近接＋現在の銃）。スクリーン空間で描く。
function drawWeaponHud(ctx, W, H, state) {
  const p = state.player;
  if (!p || !p.weapons) return;
  const bw = 48, bh = 30, gap = 6, pad = 8;
  const slots = [
    { kind: 'melee', id: (p.meleeWeapons && p.meleeWeapons[p.curMelee || 0]) || 'fists' },
    { kind: 'gun', id: (p.weapons[p.curW] || {}).id || 'pistol', active: true },
  ];
  let x = W - pad - (bw * slots.length + gap * (slots.length - 1));
  const y = pad;
  for (const s of slots) {
    ctx.fillStyle = 'rgba(10,16,22,0.62)';
    roundedRect(ctx, x, y, bw, bh, 5); ctx.fill();
    ctx.strokeStyle = s.active ? 'rgba(120,220,255,0.95)' : 'rgba(150,170,190,0.35)';
    ctx.lineWidth = s.active ? 2 : 1;
    roundedRect(ctx, x, y, bw, bh, 5); ctx.stroke();
    ctx.save();
    ctx.translate(x + bw / 2, y + bh / 2);
    if (s.kind === 'melee') drawMeleeIcon(ctx, s.id);
    else { ctx.translate(-13, 0); drawHeldGun(ctx, s.id, 0); }
    ctx.restore();
    x += bw + gap;
  }
}

export function renderFrame(ctx, canvas, state) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const nowMs = performance.now();   // 1フレーム1回だけ取得して各所で使い回す
  const nowS = nowMs / 1000;

  // ===== ズーム（REQ-DISP-1：純関数 computeView を使用）=====
  const VIEW_TILES_Y = 17;   // 視点を少し遠く（縦に見えるタイル数を増やす）
  const view = computeView({
    canvasW: W, canvasH: H,
    mapW: state.dim.w, mapH: state.dim.h, tileSize: TILE, viewTilesY: VIEW_TILES_Y,
  });
  const zoom = view.zoom, viewW = view.viewW, viewH = view.viewH;
  state.viewZoom = zoom; state.viewW = viewW; state.viewH = viewH; // 入力の座標変換用

  // カメラ：スムーズ追従(state.cam)があれば使用、無ければプレイヤー中心
  const cxw = state.cam ? state.cam.x : state.player.x;
  const cyw = state.cam ? state.cam.y : state.player.y;
  const cam = clampCamera(cxw, cyw, viewW, viewH, view.camBounds);
  const baseCamX = cam.camX, baseCamY = cam.camY;
  // 画面シェイク（ワールド単位）
  let sx = 0, sy = 0;
  if (state.shake && state.shake.t > 0) {
    sx = (Math.random() * 2 - 1) * state.shake.mag;
    sy = (Math.random() * 2 - 1) * state.shake.mag;
  }
  const camX = baseCamX + sx, camY = baseCamY + sy;
  state.camX = camX; state.camY = camY; // 入力の座標変換用

  // ===== 背景パララックス（スクリーン空間・カメラに対しゆっくり逆移動）=====
  drawParallax(ctx, W, H, camX * zoom, camY * zoom);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // ===== タイル =====
  for (let y = 0; y < state.dim.h; y++) {
    for (let x = 0; x < state.dim.w; x++) {
      const c = state.map[y][x];
      const px = x * TILE, py = y * TILE;
      if (c === '#') {
        ctx.fillStyle = '#27484f'; ctx.fillRect(px, py, TILE, TILE);
        // ベベル（左上が明るく・右下が暗い金属ブロック感）
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(px, py, TILE, 2); ctx.fillRect(px, py, 2, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.40)'; ctx.fillRect(px, py + TILE - 2, TILE, 2); ctx.fillRect(px + TILE - 2, py, 2, TILE);
        // 一部のタイルに窓（決定論的＝チラつかない）
        const hw = (x * 73856093 ^ y * 19349663) >>> 0;
        if (hw % 4 === 0) {
          ctx.fillStyle = '#0b1418'; ctx.fillRect(px + 7, py + 9, TILE - 14, TILE - 17);
          ctx.fillStyle = 'rgba(130,185,195,0.30)'; ctx.fillRect(px + 7, py + 9, TILE - 14, 2);
          ctx.strokeStyle = 'rgba(150,200,210,0.30)'; ctx.lineWidth = 1;
          ctx.strokeRect(px + 6.5, py + 8.5, TILE - 13, TILE - 16);
        }
        const hp = state.tileHP[y][x], mh = state.tileMaxHP[y][x];
        if (mh !== Infinity) {
          const r = clamp(1 - hp / mh, 0, 1);
          if (r > 0) {
            ctx.strokeStyle = `rgba(200,200,220,${0.25 + 0.5 * r})`;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + 6); ctx.lineTo(px + TILE - 6, py + TILE - 8);
            ctx.moveTo(px + 6, py + TILE - 6); ctx.lineTo(px + TILE - 10, py + 10);
            ctx.stroke();
          }
        }
      } else if (c === 'D') {
        ctx.fillStyle = '#3b2a1a'; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = '#6b4c2b'; ctx.strokeRect(px + 6, py + 4, TILE - 12, TILE - 8);
      } else if (c === 'O') {
        // 床＋ドラム缶（固定の遮蔽物）
        const checker = ((x + y) & 1) === 0;
        ctx.fillStyle = checker ? '#1f3a43' : '#1b343c';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(px, py, TILE, 1); ctx.fillRect(px, py, 1, TILE);
        // 接地影
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 6, TILE * 0.36, 4, 0, 0, Math.PI * 2); ctx.fill();
        // ドラム缶本体
        const bx = px + TILE / 2, byT = py + 4, bw = 18, bh = 24;
        ctx.fillStyle = '#3f5a64'; roundedRect(ctx, bx - bw / 2, byT, bw, bh, 4); ctx.fill();
        ctx.fillStyle = '#56767f'; ctx.fillRect(bx - bw / 2, byT, 5, bh);      // 左ハイライト
        ctx.fillStyle = '#2a3d44'; ctx.fillRect(bx + bw / 2 - 5, byT, 5, bh);  // 右陰
        ctx.fillStyle = '#101a1e'; ctx.fillRect(bx - bw / 2, byT + 6, bw, 2); ctx.fillRect(bx - bw / 2, byT + bh - 8, bw, 2); // 帯
        ctx.fillStyle = '#27424b'; ctx.fillRect(bx - bw / 2, byT, bw, 2);      // 天面の縁
        ctx.fillStyle = '#cf6b3a'; ctx.fillRect(bx - 4, byT + 11, 8, 3);       // 注意ラベル
      } else {
        // 床：ティール調の金属タイル＋目地＋四隅のリベット（スクショ寄せ）
        const checker = ((x + y) & 1) === 0;
        ctx.fillStyle = checker ? '#1f3a43' : '#1b343c';
        ctx.fillRect(px, py, TILE, TILE);
        // 目地（タイル境界の陰影）
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.fillRect(px, py, TILE, 1);
        ctx.fillRect(px, py, 1, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px + 1, py + TILE - 1, TILE - 1, 1);
        // リベット（四隅）：明点＋下に影で凹凸感
        for (const rx of [8, 24]) {
          for (const ry of [8, 24]) {
            ctx.fillStyle = 'rgba(140,185,195,0.22)'; ctx.fillRect(px + rx, py + ry, 2, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(px + rx, py + ry + 2, 2, 1);
          }
        }
        // 決定論的ハッシュで薄い汚れを散らす（毎フレーム同じ＝チラつかない）
        const h = (x * 73856093 ^ y * 19349663) >>> 0;
        if (h % 11 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.fillRect(px + 4 + (h % 12), py + 4 + ((h >> 4) % 12), 3, 2);
        }
      }
    }
  }

  // ===== アイテム（CONFIG.items から色/グリフを引く）=====
  const tItem = nowS;
  for (const it of state.items) {
    const def = CONFIG.items[it.type];
    if (!def) continue;
    const phase = (it.x + it.y) * 0.05;
    const bobY = Math.sin(tItem * 2.5 + phase) * 2;            // ふわふわ上下
    const pulse = 0.5 + 0.5 * Math.sin(tItem * 3 + phase);
    // 接地影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(it.x, it.y + 8, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save(); ctx.translate(it.x, it.y + bobY);
    // グロー：原点中心の色固定グラデをキャッシュし、明滅は globalAlpha で表現
    const gc = def.color || '#ffffff';
    const grd = radialQuant(ctx, 16, [[0, hexToRgba(gc, 0.36)], [1, hexToRgba(gc, 0)]], 'itemGlow|' + gc);
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const draw = GLYPH_DRAW[def.glyph];
    if (draw) draw(ctx, def);
    ctx.restore();
  }

  // ===== 弾体 =====
  // プレイヤー弾：進行方向へ伸びるトレイル＋白コア
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tx = (b.vx / sp) * 8, ty = (b.vy / sp) * 8;
    ctx.strokeStyle = 'rgba(160,210,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x - tx, b.y - ty); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  // 敵弾：脈動する赤いグロー（mine は点滅）。グラデは原点中心でキャッシュ、明滅は globalAlpha。
  // nowMs は renderFrame 冒頭で取得済み
  for (const b of state.ebullets) {
    const pulse = b.mine ? (0.5 + 0.5 * Math.sin(nowMs / 80)) : 1;
    const r = b.mine ? 6 : 4;
    ctx.save(); ctx.translate(b.x, b.y);
    const grd = radialQuant(ctx, r + 2, [[0, 'rgba(255,170,170,0.9)'], [1, 'rgba(255,80,80,0)']], 'ebGlow');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.mine ? '#ff6b6b' : '#ffd0d0';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.lineWidth = 1;
  // グレネード：点滅する信管ランプ付き
  for (const g of state.grenades) {
    ctx.fillStyle = '#5b6b3a'; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, Math.PI * 2); ctx.fill();
    const blink = (Math.floor(nowMs / 120) % 2 === 0);
    ctx.fillStyle = blink ? '#ff5a3a' : '#7a2a1a';
    ctx.beginPath(); ctx.arc(g.x, g.y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // ===== 敵 =====
  const tEnemy = nowS;
  const A = (typeof state.alpha === 'number') ? state.alpha : 1;
  for (const m of state.mobs) {
    ctx.save(); ctx.translate(rx(m, A), ry(m, A));
    const isElite = (m.tier === 'midboss' || m.tier === 'boss');

    // 接地影（立体感）
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, m.h / 2 - 1, m.w * 0.46, m.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 基調色：被弾フラッシュ／回避点滅は白
    const blink = m.dodgeT > 0 && (Math.floor(m.dodgeT * 40) % 2 === 0);
    const base = (m.hitFlash > 0 || blink) ? '#ffffff' : (m.color || '#b24a4a');
    if (m.dodgeT > 0) ctx.globalAlpha = 0.55; // 回避中は半透明（当たり判定なしを示唆）

    // ダークアウトライン：シルエットを一回り大きく黒で描いて縁取り（ドット絵風の引き締め）
    if (!(m.hitFlash > 0 || blink) && m.dodgeT <= 0) {
      ctx.save(); ctx.scale(1.12, 1.12);
      drawEnemyBody(ctx, m, tEnemy, '#0a0d12');
      ctx.restore();
    }

    // 本体（種類別の凝ったスプライト）
    drawEnemyBody(ctx, m, tEnemy, base);
    ctx.globalAlpha = 1;

    // 溜め近接のテレグラフ（黄→赤のリングが収縮）
    if (m._charge) {
      const cm = (m.def && m.def.attacks) ? m.def.attacks.find(x => x.type === 'charge_melee') : null;
      const prog = 1 - Math.max(0, m._charge.t) / ((cm && cm.windup) || 0.7);
      ctx.strokeStyle = `rgba(255,${Math.round(180 - 120 * prog)},80,0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, m.w * (1.4 - 0.5 * prog), 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // HPバー：エリートは常時、通常はダメージ時のみ
    const mh = m.maxhp || m.hp;
    if (isElite || m.hp < mh) {
      const bw = Math.max(m.w, isElite ? 40 : m.w), r = clamp(m.hp / mh, 0, 1);
      const by = -m.h / 2 - (isElite ? 12 : 8);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, by, bw, isElite ? 4 : 3);
      ctx.fillStyle = r > 0.5 ? '#7fe08a' : (r > 0.25 ? '#e0d27f' : '#e08a7f');
      ctx.fillRect(-bw / 2, by, bw * r, isElite ? 4 : 3);
      // エリート名ラベル
      if (isElite && m.def && m.def.name) {
        ctx.fillStyle = '#e7ecf3';
        ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(m.def.name, 0, by - 2);
      }
    }
    ctx.restore();
  }

  // ===== プレイヤー =====
  {
    const pl = state.player;
    const ang = Math.atan2(pl.facing.y, pl.facing.x);
    const recoil = pl.recoil || 0;
    // 補間位置＋反動で本体を後方へわずかにずらす
    const ix = rx(pl, A), iy = ry(pl, A);
    const px = ix - Math.cos(ang) * recoil, py = iy - Math.sin(ang) * recoil;

    // 接地影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ix, iy + pl.h / 2 - 1, pl.w * 0.46, pl.h * 0.18, 0, 0, Math.PI * 2); ctx.fill();

    // ダッシュ中の残像
    if (pl.isDashing) {
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#e7c23c';
      roundedRect(ctx, px - pl.facing.x * 8 - pl.w / 2, py - pl.facing.y * 8 - pl.h / 2, pl.w, pl.h, 5); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.save(); ctx.translate(px, py);

    const flip = pl.facing.x < 0 ? -1 : 1;
    const hitFlash = pl.iTime > 0 && (Math.floor(pl.iTime * 20) % 2 === 0);
    const SKIN = '#e7b48a', SKIN_SH = '#c98f63';
    const SHIRT = hitFlash ? '#ff9aa2' : '#e7c23c';
    const SHIRT_SH = hitFlash ? '#d8707a' : '#b9991f';
    const PANTS = '#33589e', HAIR = '#2a231f';

    // --- 本体（正面向きのドット絵人物。左向き時は左右反転）---
    ctx.save();
    if (flip < 0) ctx.scale(-1, 1);
    // 脚（青ズボン）＋靴
    ctx.fillStyle = PANTS; ctx.fillRect(-5, 4, 4, 7); ctx.fillRect(1, 4, 4, 7);
    ctx.fillStyle = '#1c2c52'; ctx.fillRect(-5, 9, 4, 2); ctx.fillRect(1, 9, 4, 2);
    // 腕（肌）
    ctx.fillStyle = SKIN; ctx.fillRect(-8, -2, 3, 6); ctx.fillRect(5, -2, 3, 6);
    // 胴（黄シャツ）
    ctx.fillStyle = SHIRT; ctx.fillRect(-6, -3, 12, 8);
    ctx.fillStyle = SHIRT_SH; ctx.fillRect(-6, 3, 12, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fillRect(-6, -3, 12, 2);
    // 頭（肌）
    ctx.fillStyle = SKIN; ctx.fillRect(-5, -11, 10, 9);
    ctx.fillStyle = SKIN_SH; ctx.fillRect(-5, -3, 10, 1);
    // 髪（黒・前髪＋もみあげ）
    ctx.fillStyle = HAIR;
    ctx.fillRect(-6, -12, 12, 5);
    ctx.fillRect(-6, -12, 2, 6); ctx.fillRect(4, -12, 2, 6);
    ctx.fillRect(-6, -8, 1, 3); ctx.fillRect(5, -8, 1, 3);
    // 目
    ctx.fillStyle = '#26303c';
    ctx.fillRect(-3, -7, 2, 2); ctx.fillRect(1, -7, 2, 2);
    ctx.restore();

    // --- 武器の構え（照準方向へ前腕＋銃。発射時マズルフラッシュ）---
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = SKIN; ctx.fillRect(3, -1.6, 6 - recoil * 0.4, 3.2); // 前腕
    drawHeldGun(ctx, (pl.weapons[pl.curW] || {}).id || 'pistol', recoil);
    if (pl.muzzleT > 0) {
      ctx.fillStyle = '#fff1c0';
      ctx.beginPath();
      ctx.moveTo(26 - recoil, 0); ctx.lineTo(19 - recoil, 3.5); ctx.lineTo(21 - recoil, 0); ctx.lineTo(19 - recoil, -3.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // 近接スイング中：装備中の近接武器に応じて刀／拳／蹴りを描く（FXと同期）。
    if (pl.meleeT > 0) {
      const sp = 1 - pl.meleeT / MELEE_SWING;     // 0→1 スイング進行
      const dir = pl.meleeDir || 1;               // 振り方向（コンボで左右交互）
      if (pl.meleeKind === 'blade') {
        // 上段からの振り下ろし（前方へ踏み込みながらの袈裟斬り）
        const chop = (-1.5 + 2.2 * sp) * dir;        // 上→下
        const adv = Math.sin(sp * Math.PI) * 5;      // 前方への踏み込み
        const len = 34, bw = 5;
        ctx.save();
        ctx.rotate(ang + chop);
        ctx.translate(adv, 0);
        ctx.fillStyle = '#8a6a36'; ctx.fillRect(7, -4, 3, 8);   // 鍔
        ctx.fillStyle = '#d3deec';                              // 刃（テーパ）
        ctx.beginPath();
        ctx.moveTo(10, -bw / 2);
        ctx.lineTo(10 + len, -1.3);
        ctx.lineTo(10 + len + 6, 0);
        ctx.lineTo(10 + len, 1.3);
        ctx.lineTo(10, bw / 2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(11, -1.1); ctx.lineTo(10 + len, -0.6); ctx.stroke();
        ctx.restore();
      } else if (pl.meleeFinisher) {
        // 蹴り：前方へ大きく突き出す脚＋足（踏み込みに同期）
        const thrust = Math.sin(sp * Math.PI) * 16;
        ctx.save();
        ctx.rotate(ang);
        ctx.strokeStyle = '#6f8db0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(2, 4 * dir); ctx.lineTo(11 + thrust, 1 * dir); ctx.stroke();
        ctx.fillStyle = '#8fb0d8';
        ctx.beginPath(); ctx.arc(13 + thrust, 1 * dir, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // 殴り：腕を振り抜くフック（直突きでなく弧を描く）
        const hook = (-0.9 + 1.8 * sp) * dir;
        const ext = 6 + Math.sin(sp * Math.PI) * 7;
        ctx.save();
        ctx.rotate(ang + hook);
        ctx.strokeStyle = '#7ab0ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2 + ext, 0); ctx.stroke();
        ctx.fillStyle = '#cfe0ff';
        ctx.beginPath(); ctx.arc(4 + ext, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ===== FX（レジストリで type → 描画関数を引く）=====
  for (const f of state.fx) {
    const a = 1 - f.t / f.life;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    const draw = FX_DRAW[f.type];
    if (draw) draw(ctx, f, a);
    ctx.globalAlpha = 1; // 各FXごとに戻す
  }

  // ===== ライティング（ビネット）=====
  // プレイヤー周辺を明るく残し、周囲をうっすら暗く（雰囲気＋視線誘導）。
  // 原点中心の固定グラデをキャッシュし、プレイヤー位置へ translate して使う。
  ctx.globalCompositeOperation = 'multiply';
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.fillStyle = radialAtOrigin(ctx, 60, 420,
    [[0, 'rgba(255,255,255,1)'], [1, 'rgba(0,0,0,0.55)']], 'vignette');
  // ワールド単位の可視範囲を塗る（スケール変換中なので viewW/viewH を使う）
  ctx.fillRect(camX - state.player.x, camY - state.player.y, viewW, viewH);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();

  // ===== スクリーン空間オーバーレイ =====
  // 被弾方向インジケータ：画面中央から見たダメージ源の方向に赤い弧を出す
  if (state.dmgMarks && state.dmgMarks.length) {
    const cx = W / 2, cy = H / 2;
    const rad = Math.min(W, H) * 0.34;
    for (const dm of state.dmgMarks) {
      const a = 1 - dm.t / dm.life;
      if (a <= 0) continue;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dm.ang);
      ctx.globalAlpha = a * 0.8;
      // 弧（方向を示す扇）
      const grd = ctx.createRadialGradient(rad, 0, 0, rad, 0, 60);
      grd.addColorStop(0, 'rgba(255,60,60,0.9)');
      grd.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, rad + 18, -0.35, 0.35);
      ctx.arc(0, 0, rad - 14, 0.35, -0.35, true);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 右上の武器スロット（近接＋現在の銃）
  drawWeaponHud(ctx, W, H, state);

  // 低HP時の赤いビネット（パルス）
  const pl2 = state.player;
  const hpr = (pl2.hp) / (pl2.hpMax || 100);
  if (hpr > 0 && hpr < 0.3 && !state.gameOver) {
    const pulse = 0.25 + 0.2 * Math.sin(nowMs / 220);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(180,0,0,0)');
    vg.addColorStop(1, `rgba(180,0,0,${pulse * (1 - hpr / 0.3)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ボス撃破キルカム：レターボックス＋テキスト
  if (state.killCam) {
    const ph = state.killCam.t / state.killCam.life; // 0→1
    const ease = Math.sin(Math.min(1, ph) * Math.PI);  // 出てから引っ込む
    const bar = Math.round(H * 0.12 * ease);
    if (bar > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
    }
    if (state.killCam.boss && ease > 0.2) {
      ctx.globalAlpha = ease;
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 34px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BOSS DOWN', W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
  }

  // ステージ遷移バナー（REQ-STAGE-FX-1）：上部に "STAGE N — 名前" をフェードイン/アウト。
  if (state.stageBanner) {
    const ph = state.stageBanner.t / state.stageBanner.life; // 0→1
    const ease = Math.sin(Math.min(1, ph) * Math.PI);        // 出てから引っ込む
    if (ease > 0.02) {
      const y = H * 0.18;
      const tw = Math.min(W * 0.9, 520);
      ctx.globalAlpha = ease;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect((W - tw) / 2, y - 26, tw, 52);
      ctx.fillStyle = '#9ad0ff';
      ctx.font = 'bold 26px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(state.stageBanner.text, W / 2, y);
      ctx.globalAlpha = 1;
    }
  }
}
