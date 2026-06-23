# 設計書: プレイアブルキャラクター5種

- 日付: 2026-06-23
- ブランチ: `feat/playable-characters`
- 状態: 承認済み（設計）

## 目的

プレイヤーキャラクターを **5種**（主人公・魔法使い・女子高生・骸骨・ロボット）にする。
主人公は現状（剣＋銃）維持。他はキャラに合った武器がドロップ・使用可能。各キャラを
**表情・服がわかる精緻さ**で描画し、**被弾・弱体化・瀕死・息切れ**の4モーションを実装する。

## 決定事項（ユーザー合意）

1. 進め方: **全5体を一括実装**。
2. 武器モデル: **キャラ専用キット＋テーマ別ドロップ**（キャラロック）。弾薬プールは共有・表示のみテーマ別。
3. キャラ選択: **タイトル画面で選択**（`progress.charId` に永続化）。
4. 描画: **描画サイズを拡大して精緻化**（当たり判定 `pl.w/h=22` は据え置き＝バランス不変）。

## キャラと武器テーマ

| キャラ id | 名前 | 遠隔（id）| 近接（kind）| ドロップ解放 |
|---|---|---|---|---|
| `hero` | 主人公 | pistol/shotgun/mg/beam/grenade | fists(fist)/katana(blade) | katana（既存）|
| `mage` | 魔法使い | mbolt/fireball(AoE)/icelance(slow)/thunder(pierce) | staff(staff) | fireball/icelance/thunder |
| `jk` | 女子高生 | textbook/watergun(速弱)/firework(AoE) | bag(bag)/shinai(blade) | watergun/firework/shinai |
| `skeleton` | 骸骨 | bonethrow/curse(bleed)/skullbomb(AoE) | scythe(scythe)/bonesword(blade) | curse/skullbomb/scythe |
| `robot` | ロボット | laser(pierce)/gatling(rapid)/missile(homing)/plasma | drill(drill)/arm(arm) | missile/plasma/drill |

- 各キャラは初期に「基本遠隔1〜2＋基本近接1」を所持。残りは**そのキャラ専用の解放ドロップ**で増える
  （既存 `items.katana` の `kind:'unlock'` を一般化した `unlock` ドロップ）。
- **挙動は既存機構の再利用**（新しい魔法/弾エンジンは作らない＝YAGNI）:
  - AoE（火球/花火/頭蓋骨爆弾/ミサイル）= `explode()` 流用。
  - 鈍足（氷槍）/出血（呪い）= 既存 status（`bleedSlowMul` / `bleed`）流用、mob へ付与。
  - 貫通（雷/レーザー）= 既存の貫通弾フラグ。追尾（ミサイル）= 既存ホーミング。
  - 見た目は弾の `projType`（色/形）と近接 `kind` で差し替え。
- 弾薬は内部プール（light=ammo9 / heavy=ammo12 / energy=ammoBeam / special=ammoNade）を共有し、
  キャラごとに**表示ラベル・色のみ**テーマ別（バランス据え置き・実装軽量）。

## アーキテクチャ

### 新規ファイル
- `js/state/characters.js` — `CHARACTERS` レジストリ（データ）＋ `applyCharacter(state, id)`。
  - 各定義: `{ id, name, blurb, drawId, ranged:[defs], melee:[ids], dropPool:[unlockIds], stat:{hpMul,speedMul}, theme:{ammoLabels,colors} }`。
  - `applyCharacter`: `state.charId` 設定、`state.player.weapons`（遠隔 def を deep copy）、`meleeWeapons`、ドロップ枠、`drawId`、ステータス微調整を反映。`hero` は `CONFIG.weapons` を使う（dev-editor 互換）。
- `js/render/characters.js` — `drawCharacter(ctx, state, opts)` ディスパッチ＋ `drawHero/drawMage/drawJk/drawSkeleton/drawRobot` ＋共有ヘルパ（顔パーツ・汗・モーション線・呼吸/震えオフセット）。現主人公描画を `drawHero` に移設。
- `js/render/character-motion.js` — 純関数 `computePlayerMotion(state, nowS)` → `{ primary, hurt, weak, dying, breath, phase }`。閾値はテスト可能。

### 変更ファイル
- `js/core/config.js` — 新近接 `kind`（staff/bag/scythe/drill/arm）を `melee.weapons` に追加。テーマ別 `items`（解放ドロップ）＋ `drops` 確率。`player` に `weakDur/weakSlowMul`。
- `js/render/renderer.js` — プレイヤー描画ブロック（363-478）を `drawCharacter(...)` 呼び出しへ置換。武器構え・近接スイングは characters.js 側に移し、`kind`/`projType` で分岐。
- `js/render/title-screen.js` — キャラ選択行（5ポートレート）。選択を `progress.charId` に保存。
- `js/main.js` — `progress.charId` を読み、`beginRun/startGame/startAtStage` で `applyCharacter` を呼ぶ。
- `js/systems/items.js`・`js/systems/spawner.js`（ドロップ箇所）— 解放ドロップを `state.charId` の `dropPool` で絞り込み。
- `js/systems/progress.js` — `charId`（既定 `hero`）を正規化・永続化。
- `js/systems/projectiles.js`・`js/systems/melee.js` — `projType` 描画分岐／鈍足ステータス付与（氷槍）。挙動は再利用。
- `js/systems/status.js`／`ai.js` — 鈍足ステータスの mob 付与経路（既存 bleed と同経路）。

## モーション・システム

`computePlayerMotion(state)` が以下を導出。各 draw 関数が解釈し、**表情・姿勢・重畳キュー**を変える。

| モーション | 条件 | 表現 |
|---|---|---|
| 被弾 hurt | `iTime > iFrame - 0.18`（被弾直後の短時間）| のけぞり＋痛み顔＋既存フラッシュ |
| 弱体化 weak | `player.weakT > 0`（鈍足デバフ）| 前かがみ・脂汗・歪み顔・やや退色 |
| 瀕死 dying | `hp/hpMax <= 0.25` | 震え・低い構え・苦悶顔・荒い息 |
| 息切れ breath | `sta/staMax <= 0.20` | 胸の上下・口開け・汗 |

- 主ポーズ優先度: 瀕死 > 被弾 > 弱体化 > 息切れ > 通常。副次キュー（汗・息）は重畳可。
- アニメは時間ベース（`sin` 呼吸・微震動）。RNG 不使用で安定。
- **弱体化の発生源**: `player.weakT` を新設。被弾時に短時間（`weakDur`）セット＝移動 `weakSlowMul` 倍。
  既存 status 機構に倣う。これにより 4 モーション全てに実ゲーム上のトリガがある。

## データフロー

タイトルで charId 選択 → `progress.charId` 保存 → `startGame/startAtStage` → `beginRun` →
`applyCharacter(state, charId)`（武器/近接/ドロップ枠/描画ID/ステータス）→ プレイ。
ドロップ時は `state.charId` の `dropPool` のみ抽選。描画は `drawCharacter` が `state.charId` で分岐し、
`computePlayerMotion` の結果で表情・姿勢を変える。

## テスト

- `applyCharacter`: 各キャラで `weapons`/`meleeWeapons`/`drawId`/`dropPool` が正しく入る。hero 互換。
- `computePlayerMotion`: 閾値（hp/sta/iTime/weakT）ごとに正しい primary/flags。優先度。
- ドロップ絞り込み: charId に応じて他キャラの武器が落ちない。
- 既存テスト（168件）を壊さない。描画は構文＋リンク＋ブラウザ目視。

## スコープ・段階

1. データ基盤（characters/applyCharacter/motion/weapon・melee defs）＋テスト。
2. 選択UI＋配線（title/main/progress）。
3. 描画（characters.js：5体＋モーション）＝最重量。独立性が高いキャラ描画は並列化可。
4. 武器挙動（projType/鈍足/ドロップ絞り込み）。
5. 検証（テスト・リンク・ブラウザ目視・各キャラのプレイ確認）。

## 非目標（YAGNI）

- 新しい魔法/弾シミュレーション・エンジン（既存の弾/爆発/状態異常を再利用）。
- キャラ別の独立バランス調整（初期は hero 準拠＋微小ステータス差のみ）。
- 外部画像アセット（すべて Canvas 手続き描画）。
