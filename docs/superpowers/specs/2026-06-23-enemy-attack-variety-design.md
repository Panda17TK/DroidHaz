# 設計書: 敵攻撃バリエーション（電撃・毒 ＋ 専用ダメージモーション）

- 日付: 2026-06-23
- 状態: 承認済み（設計）。**実装は次セッションで行う**（コスト都合で本セッションは設計のみ）。
- 前提: `feat/playable-characters` は main にマージ済み。プレイヤー状態（`weakT`）とモーション基盤
  （`js/render/character-motion.js` の `computePlayerMotion`）、敵 status 機構（`js/systems/status.js` の bleed）は実装済み。

## 目的

敵の攻撃に **電撃(shock)** と **毒(poison)** を追加し、それぞれ被弾時に**専用のダメージモーション**を出す。
ユーザー合意スコープ: **電撃・毒＋おまかせ**（裁量で追加1種。本設計では **炎上(burn)** を任意拡張として記す）。

## 設計方針

「プレイヤー状態異常フレームワーク」を1つ用意し、`weakT`/敵bleed の前例に倣って拡張する。
当たり判定・基礎ステータスは不変。差別化は状態異常の効果・モーション・敵・FXに閉じる。

## 実装タスク（次セッションの手順）

### 1. プレイヤー状態（state + config + combat）
- `js/state/state.js` の player 初期値に `shockT: 0, poisonT: 0` を追加（`weakT` の隣）。
- `js/core/config.js` の `player` に: `shockDur: 0.45`（感電スタン秒）, `poisonDur: 4.0`, `poisonDps: 6`（毒の毎秒ダメージ）, `burnDur: 3.0`, `burnDps: 10`（任意）。
- `js/systems/combat.js` `updateCombat`:
  - 各タイマを減衰（`shockT`/`poisonT`/`burnT`）。
  - **感電**: `shockT > 0` の間は入力を無効化（移動 dir=0・射撃/近接トリガを抑制）＝スタン。
  - **毒/炎上**: 毎フレーム `p.hp -= poisonDps * dt`（gameOver チェックは既存の HP<=0 経路に任せる）。
    ※ HP 減少で `weakT` を立てる既存ロジックと二重発火しないよう、毒DoTは weakT トリガ対象外にする
    （`_hpPrev` 更新前に毒減算を除外、または毒中は weakT を立てない）。

### 2. モーション導出（character-motion.js）
- `MOTION` に `SHOCK: 'shock'`, `POISON: 'poison'`（任意 `BURN: 'burn'`）を追加。
- `computePlayerMotion`:
  - `shock = (p.shockT||0) > 0`, `poison = (p.poisonT||0) > 0`（任意 burn）。
  - 優先度: `dead/dying > shock > poison(/burn) > hurt > weak > breath > normal`。
  - 返り値に `shock`/`poison` フラグ、感電用の高速明滅位相（例 `zap: Math.sin(t*60)`）を追加。
  - `sweat` 等の副次キューは従来通り。

### 3. 描画（character-sprites.js）
- `drawFace`: shock=目が「＞＜」＋口開け＋白フラッシュ、poison=半目＋舌出し/吐き気の口＋頬緑。
- `drawCharacter`: 主モーションが shock のとき本体周囲に**電撃アーク**（ジグザグ線・白/水色）＋強い tremble、
  poison のとき**緑のオーバーレイ乗算**＋上方に**毒の泡**を数個。`computePlayerMotion` の位相でアニメ。

### 4. 敵攻撃タイプ（attacks.js）＋ 敵弾（projectiles.js）
- `js/systems/attacks.js` の `ATTACK_TYPES` と実行ロジックに `shock` と `poison` を追加（既存 `shot` を雛形に）。
  - `shock`: 速い電撃弾を発射。`ebullet` に `shock: true` を付与。
  - `poison`: 緑の毒弾（やや遅い・大きめ当たり）。`ebullet` に `poison: true`。任意で着弾時に短命の毒霧を残す。
- `js/systems/projectiles.js` `updateEnemyBullets`: プレイヤー被弾時（`p.iTime<=0`）に
  `if (b.shock) p.shockT = CONFIG.player.shockDur; if (b.poison) p.poisonT = CONFIG.player.poisonDur;` を追加。
  ※ ダッシュ回避（既存の弾き返し分岐）中は付与しない。

### 5. 敵アーキタイプ（config.enemies）＋ 出現（stages）
- `CONFIG.enemies` に2体追加:
  - `tesla`（電気型）: `tier:'normal'`, attacks に `{type:'shock', cd, dmg, speed}` ＋接近近接。
  - `spore`（毒型）: `tier:'normal'`, attacks に `{type:'poison', cd, dmg, speed}`。
- `js/state/stages.js` の各ステージ `enemyPool` に新敵を追加（`stageEnemyKeys`）。`normalKeys()` が拾えるよう
  `enemies.js` の分類（normal/midboss/boss）に含める（tier で自動分類されるはず。要確認）。

### 6. FX（fx.js + fx-draw.js）
- 電撃アークFX（ジグザグ線、短命）と毒霧FX（緑の半透明パフ、ゆっくり上昇）を `FX_DRAW` レジストリに追加。
- 被弾時に対応FXを spawn（`recordPlayerHit` 付近、または updateEnemyBullets の付与時）。

### 7. テスト
- `test/` に: `computePlayerMotion` の shock/poison 優先度、`updateEnemyBullets` で shock/poison 弾が
  プレイヤーに `shockT`/`poisonT` を付与すること（i-frame 中は付与しないこと）。
- 既存 188 テストを壊さない。

### 8. SW / 検証
- 新規モジュールを作る場合は `sw.js` ASSETS に追加＋ CACHE bump（`test/sw-precache.test.mjs` が検知）。
  ※ 本機能は既存ファイルの拡張中心で、新規モジュールは原則不要の見込み。
- 検証: 構文＋リンク＋ `node --test`、ブラウザで tesla/spore に被弾して感電/毒モーションを目視。

## 非目標（YAGNI）
- 状態異常の付与/解除UI、耐性、装備による軽減などのシステムは作らない。
- 炎上(burn)は任意拡張（電撃・毒が完成し余力がある場合のみ）。

## 受け入れ基準
- 電撃を受けると短時間スタン＋電撃モーション、毒を受けると継続ダメージ＋毒モーションが出る。
- 5キャラいずれでも専用モーションが重畳表示される（共通の drawCharacter 経由）。
- テスト緑・実ゲームで目視確認。
