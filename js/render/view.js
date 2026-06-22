// js/render/view.js
// カメラ/ズームの算出（純関数）。DOM・canvas に依存しないので単体テスト可能。
// REQ-DISP-1: 画面サイズ/DPR に依らず可視ワールドの縦幅を一定タイル数に保つ。
//
// ルール:
//  - 通常は可視縦 viewTilesY タイルを基準（zoom = canvasH / (viewTilesY*tile)）。
//  - マップが画面に収まる場合ははみ出さない最小ズーム fitZoom を下限にする。
//  - 「縦タイル数維持」と「マップ全体表示」が衝突する場合は、黒余白防止を最優先に
//    zoom を fitZoom 以上へ clamp する（= マップ外を描かない）。
//  - 返す camBounds でカメラ原点を 0..max に clamp できる。

export function computeView({ canvasW, canvasH, mapW, mapH, tileSize, viewTilesY }) {
  const worldW = mapW * tileSize;
  const worldH = mapH * tileSize;

  // 基準ズーム（縦 viewTilesY タイルを画面高に収める）
  const baseZoom = canvasH / (viewTilesY * tileSize);
  // マップ全体を画面に収めるのに必要な最小ズーム（これ未満だと黒余白が出る）
  const fitZoom = Math.max(canvasW / worldW, canvasH / worldH);
  // 黒余白防止を最優先：fitZoom を下限にする
  const zoom = Math.max(baseZoom, fitZoom);

  const viewW = canvasW / zoom;
  const viewH = canvasH / zoom;

  // カメラ原点の可動域（ワールドpx）。viewが世界より大きいと max は 0。
  const camBounds = {
    maxX: Math.max(0, worldW - viewW),
    maxY: Math.max(0, worldH - viewH),
  };

  return { zoom, viewW, viewH, camBounds, fitZoom, baseZoom };
}

// カメラ目標(cx,cy ワールド中心)を可動域に clamp して原点を返す。
export function clampCamera(cx, cy, viewW, viewH, camBounds) {
  const camX = Math.max(0, Math.min(camBounds.maxX, cx - viewW / 2));
  const camY = Math.max(0, Math.min(camBounds.maxY, cy - viewH / 2));
  return { camX, camY };
}
