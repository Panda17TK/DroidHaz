// js/render/facing.js
// 8方向→5行(row)＋左右反転(flipX) の純関数。描画モジュールから分離してテスト容易にする。
// screen座標系: +x=右, +y=下。よって atan2(y,x) は 0=E(右), +90=S(下), 180=W(左), -90=N(上)。
// 8コンパス(E/SE/S/SW/W/NW/N/NE)を各45°セクターで判定。左右対称なので W系は E系の row を flipX で流用する。
//   S=front / SE,SW=frontDiag / E,W=side / NE,NW=backDiag / N=back
//   flipX = (facing.x < 0)  ← 反転は row では区別せず必ずここだけで担う。
//   ゼロベクトル(向き無し)は正面・非反転。
//
// 検算(代表ベクトル, deg=atan2(y,x)*180/PI):
//   ( 1, 0) E   → side,      flipX=false
//   ( 1, 1) SE  → frontDiag, flipX=false
//   ( 0, 1) S   → front,     flipX=false
//   (-1, 1) SW  → frontDiag, flipX=true
//   (-1, 0) W   → side,      flipX=true
//   (-1,-1) NW  → backDiag,  flipX=true
//   ( 0,-1) N   → back,      flipX=false
//   ( 1,-1) NE  → backDiag,  flipX=false
//   ( 0, 0)     → front,     flipX=false
export function dirFromFacing(facing) {
  const fx = (facing && facing.x) || 0;
  const fy = (facing && facing.y) || 0;
  if (fx === 0 && fy === 0) return { row: 'front', flipX: false };

  const flipX = fx < 0;
  // 反転前提で右半面に畳む(|deg| <= 90 の世界)。|fx| を使うことで E系セクターだけで E/SE/NE を判定でき、
  // W/SW/NW は flipX が担う。これにより row は x の符号に不変＝対称半セット運用が成立する。
  const deg = Math.atan2(fy, Math.abs(fx)) * 180 / Math.PI; // -90..+90
  // -90=N(back), -45=NE(backDiag), 0=E(side), +45=SE(frontDiag), +90=S(front)
  let row;
  if (deg >= 67.5) row = 'front';          // [67.5, 90]    S
  else if (deg >= 22.5) row = 'frontDiag'; // [22.5, 67.5)  SE
  else if (deg > -22.5) row = 'side';      // (-22.5, 22.5) E
  else if (deg > -67.5) row = 'backDiag';  // (-67.5,-22.5] NE
  else row = 'back';                       // [-90, -67.5]  N

  return { row, flipX };
}
