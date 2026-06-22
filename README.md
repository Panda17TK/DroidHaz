# DroidHaz — サバイバル（静的PWA）

見下ろし型のサバイバル・アクションシューター（ウェーブ制ローグライト）。
**サーバ不要の静的PWA**。Canvas + JavaScript（ES Modules・ビルドレス）で、スコア/セーブは
ブラウザの `localStorage` に保存します。GitHub Pages 等にそのまま置けます。

> 元プロジェクト（Java サーブレット + JS の `demo0902`）のゲーム本体を移植し、
> サーバ依存（スコア/セーブの fetch）を localStorage に置き換えたものです。

## 特徴

- **ウェーブ制ローグライト**: 波を殲滅 → 強化カードを3択（恒久強化）→ 次の波。中ボス/ボスも登場。
- **データ駆動の敵 & 攻撃**: `js/core/config.js` の定義から敵・攻撃を生成（近接/射撃/突進/溜め近接/
  縮地/全方位弾/召喚/ホーミング/狂乱…）。
- **開発者モード**（`` ` `` キー / DEV ボタン）: 波スケール・強化倍率・ドロップ率・敵/武器パラメータを
  GUI でライブ編集。dmg/fireRate 等は**ラン中即時反映**。
- **モバイル対応**: 画面上ツインスティック（アナログ移動・自動射撃・左右入替/透明度/サイズ設定）。
- **演出**: 補間描画・ヒットストップ・画面シェイク・ダメージ数字・被弾方向インジケータ・
  ボス撃破スロー・種類別の凝った敵スプライト・パララックス背景（グラデーションはキャッシュ）。
- **ローカル永続化**: 戦績ランキング（到達WAVE優先）とスロットセーブを `localStorage` に保存。
- **PWA**: インストール／オフライン起動対応（Service Worker・相対パス）。

## 遊ぶ（ローカル）

ES Modules は `file://` では動かないため、簡易サーバ経由で開きます。

```bash
# どれか
python3 -m http.server 8080      # → http://localhost:8080/
npx serve .                      # → 表示されたURL
```

スマホ実機で試すなら、同一LANのPCで上記サーバを起動し、スマホから `http://<PCのIP>:8080/` を開きます。

## テスト

```bash
node --test test/*.test.mjs      # physics / spatial / los / flowfield / maps / grad-cache（21件）
```

## 操作

| 操作 | キー |
|---|---|
| 移動 | WASD / 矢印 |
| 近接 | J |
| 射撃/投擲 | K |
| リロード | R |
| 武器切替 | 1–5 |
| ダッシュ | Shift |
| 壁設置 / ドア | F / E |
| セーブ / ロード | P / L |
| ポーズ | Esc |
| 開発者モード | `` ` `` |

スマホ/タブレットでは画面上のツインスティックが自動表示されます。

## GitHub Pages で公開

このリポジトリ直下が静的サイトです（`index.html` がエントリ）。

1. GitHub に空リポジトリを作成し、本ディレクトリを push。
2. リポジトリの **Settings → Pages → Source** を **「GitHub Actions」** に設定。
3. `main` への push で `.github/workflows/pages.yml` が走り、自動公開されます。
   公開URL例: `https://<user>.github.io/<repo>/`

> すべて相対パスで参照しているため、サブパス（`/<repo>/`）配信でも動作します。

## このワークスペースから新リポジトリへ push する例

```bash
cd wave-arena
git init -b main
git add -A && git commit -m "init: DroidHaz (static PWA)"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## ネイティブアプリ化（iOS / Android）

Capacitor で WebView ネイティブアプリにできます（ゲームコードは無改変）。
手順は **[CAPACITOR.md](CAPACITOR.md)** を参照。

```bash
npm install
npm run build          # 静的アセットを www/ に集約
npx cap add android    # / npx cap add ios（macOS）
npm run sync && npm run open:android
```

セーブ/スコアはネイティブ実行時に `@capacitor/preferences` へミラーされ、耐久性が上がります
（Web/PWA では localStorage のみで動作）。

## 構成

```
index.html              エントリ（DOM＋SW登録）
manifest.webmanifest    PWA マニフェスト
sw.js                   Service Worker（アプリシェルを cache-first）
capacitor.config.json   Capacitor 設定（appId/appName/webDir=www）
scripts/build-www.mjs   静的アセットを www/ に集約（Capacitor webDir 用）
CAPACITOR.md            ネイティブ化（iOS/Android）手順
css/game.css            スタイル（HUD/オーバーレイ/タッチUI）
icons/                  PWA アイコン
js/
  main.js               ループ（固定タイムステップ＋補間）/ DI
  core/                 constants, config, events, input, touch, settings
  services/             audio, storage, kv（localStorage＋Preferencesミラー）
  state/                state, maps, map, upgrades, binds, data, types
  systems/              physics, spatial, los, flowfield, ai, attacks, enemies,
                        combat(+core/melee/projectiles), spawner, items, tiles, fx,
                        save-local（ローカルセーブ）
  render/               renderer, enemy-sprites, fx-draw, grad-cache, hud,
                        overlay（ローカルランキング）, upgrades, dev-editor, glyphs
test/                   node:test の単体テスト
```

## ライセンス

MIT


---
_本リポジトリは demo0902/mobile-arena から取り出したモバイル単体版です。_
