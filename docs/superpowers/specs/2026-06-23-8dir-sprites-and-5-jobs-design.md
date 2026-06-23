# DroidHaz — 8方向スプライト ＋ 新ジョブ5体（スリムなチビ統一）設計

作成: 2026-06-23 / マルチエージェント設計ワークフロー（4並列→統合）の成果を実装に落とした設計書。

## 目的
1. プレイヤー描画に **横向き・斜め向き** を追加し、正面/後ろのみ → **8方向相当**（front / frontDiag / side / backDiag / back ＋左右反転）に。
2. 新プレイアブル5体 **アコライト / アサシン / ウィッチ / ソードマスター / マーシナリー**（RO系ジョブ“風”に自作。著作権配慮で画像素材は使わずプロシージャル）を追加。
3. 全10体を **スリムなチビ調** で統一。当たり判定・基礎ステータスは不変（差別化は武器・見た目・モーションのみ）。

## 方向システム（純関数）
`js/render/facing.js` の `dirFromFacing(facing) → { row, flipX }`。
- screen座標（+x右 / +y下）。`atan2(y, |x|)` で右半面に畳み、`flipX = facing.x < 0` のみが左右を担う（row は x 符号に不変＝対称半セット）。
- 45°セクター: S=front / SE,SW=frontDiag / E,W=side / NE,NW=backDiag / N=back。ゼロベクトルは front。
- 反転は `drawCharacter` の `ctx.scale(-1,1)` だけで適用。body / drawFace は `facing.x` を参照しない（常に右向きで描く）。
- テスト `test/facing.test.mjs`（8方位＋ゼロ＋境界＋対称性）。

## 顔の向き（drawFace orient）
`opts.orient ∈ {'front'(既定),'frontDiag','side'}` を追加。
- `shift`（顔を facing 側へ）= side: hw*0.30 / frontDiag: hw*0.16 / front: 0。
- `farK`（奥目=画面左の横圧縮）= frontDiag: 0.55 / side: 0(=省略) / front: 1。
- side は片目プロフィール＋鼻先三角＋口を手前へ寄せ幅0.7。
- **front では shift=0 / farK=1 / profile=false ＝ 従来描画と完全一致**（視覚リグレッションなし）。back/backDiag は顔を描かない。

## body の向き対応
各 body fn 冒頭で `dirInfo(a)` から `{ back, sx, orient }` を導出。
- `back = (dir==='back' || dir==='backDiag')` → 後頭部のみ（顔なし）。
- `sx`（上半身を facing 側へ寄せる量）= side: 2.2 / frontDiag,backDiag: 1.1 / front: 0。`ctx.translate(ox + sx, oy)` で頭・胴・腕を寄せて“向き”を作る。
- 顔は `drawFace(..., { orient })`。遠隔武器レイヤーは既存どおり `ctx.rotate(ang)` で360°追従（変更不要）。

## 新ジョブ5体
| id | 見た目 | 遠隔(初期/projType) | 近接(kind) |
|----|--------|----------------------|------------|
| acolyte | 白い法衣＋金トリム＋胸の十字＋後光リング | 聖なる弾 `holy` | メイス `bag` |
| assassin | 黒装束＋覆面(目元のみ)＋なびくスカーフ | 投擲ダガー `dagger` | カタール `blade` |
| witch | 深紫×黒ワンピ＋大きな先折れ帽（mageと差別化） | 呪詛弾 `hex` | 箒 `staff` |
| swordmaster | 藍の着物＋袴＋編み笠＋髷 | 居合い `kiai` | 刀 `blade`(既存katana) |
| mercenary | 革ベスト＋肩当て＋鉢巻 | 弩 `bolt` | 剣 `blade`(mercsword) |

- アーキタイプ `single/spread/rapid/beam/aoe` を再利用＝バランス不変。新 projType `holy/dagger/hex/kiai/bolt/frag` を `PROJ_COLOR`/`HOLD_TYPE` に追加（持ち方は既存 wand/gun/launcher/thrown に割当＝近接描画コードの追加なし）。
- 新近接 `mace/katar/broom/mercsword` を `config.melee.weapons` に追加（kind は既存 bag/blade/staff に割当）。

## 触れたファイル
- 新規: `js/render/facing.js`, `test/facing.test.mjs`
- 改修: `js/render/character-sprites.js`（facing import / drawFace orient / drawCharacter の dir 化 / PROJ_COLOR・HOLD_TYPE / 既存5体に dir 分岐 / 新5体 body fn ＋ BODY 登録）
- `js/state/characters.js`（新5エントリ ＋ CHARACTER_IDS=10）
- `js/core/config.js`（近接4種）
- `sw.js`（ASSETS に facing.js 追加 ＋ CACHE v21→v22）
- `js/render/title-screen.js` は `CHARACTER_IDS` から自動でチップ生成（改修不要）。

## テストゲート
`node --test test/*.test.mjs` = 219 pass / 0 fail（既存206＋新規。front 経路不変＝リグレッションなし）。視覚確認は全10体×5向きをブラウザ harness で実施。

## 既知の今後の調整余地（リグレッションではない）
- アコライトの後光リングをもう少し視認しやすく。
- ウィッチ帽のつば帯（accent）の主張をやや抑える。
- side の真横プロフィールの髪・装束の更なる作り込み（現状は顔の向き＋上半身寄せで方向感を出す簡潔版）。
