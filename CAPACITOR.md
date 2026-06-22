# Capacitor でネイティブアプリ化（iOS / Android）

このプロジェクトは静的PWAですが、[Capacitor](https://capacitorjs.com/) で **iOS / Android
ネイティブアプリ**にできます。ゲームコードはそのまま、WebView に包んで配布します。

> ビルド（APK/IPA 生成）には各 OS の SDK が必要です。**Android = Android Studio / JDK 17、
> iOS = Xcode（macOS のみ）**。このリポジトリにはネイティブの生成物（`android/`・`ios/`・
> `www/`・`node_modules/`）は含めていません（`.gitignore` 済み・各自で生成）。

## 前提

- Node.js 18+（推奨 20/22）
- Android 向け: Android Studio（Android SDK / Platform Tools）、JDK 17
- iOS 向け: macOS + Xcode + CocoaPods

## セットアップ手順

```bash
cd mobile-arena

# 1) 依存をインストール（@capacitor/core, /preferences, /cli, /android, /ios）
npm install

# 2) 静的アセットを www/ に集約（webDir）
npm run build            # = node scripts/build-www.mjs

# 3) Capacitor を初期化（capacitor.config.json は同梱済みなので通常スキップ可）
#    appId / appName を変えたい場合のみ:
#    npx cap init "DroidHaz" tech.bantian.droidhaz --web-dir=www

# 4) プラットフォームを追加（生成物は android/ ios/ に出る）
npx cap add android
npx cap add ios          # macOS のみ

# 5) www とネイティブを同期（以降コード変更のたびに実行）
npm run sync             # = npm run build && npx cap sync
```

## ビルド・実行

### Android
```bash
npm run open:android     # Android Studio が開く
```
Android Studio で実機/エミュレータに Run、または Build → Generate Signed Bundle/APK で
配布物を作成。CLI 派は:
```bash
cd android && ./gradlew assembleDebug   # → android/app/build/outputs/apk/debug/*.apk
```

### iOS（macOS）
```bash
npm run open:ios         # Xcode が開く
```
Xcode で署名チームを設定し、実機/シミュレータへ Run、または Product → Archive で配布。

## 永続データについて

- セーブ/スコア/操作設定は `localStorage`（キー接頭辞 `arena_`）に保存します。
- **ネイティブ実行時は `@capacitor/preferences` にもミラー**されます（`js/services/kv.js`）。
  WebView の `localStorage` は OS のストレージ逼迫時に消えることがあるため、起動時に
  Preferences → localStorage を補完して耐久性を上げています。
- Web/PWA 実行時（Capacitor 不在）は自動的に localStorage のみで動作します（無改変）。

## アイコン / スプラッシュ

`@capacitor/assets` を使うと一括生成できます（任意）:
```bash
npm i -D @capacitor/assets
# resources/icon.png（1024x1024）, resources/splash.png（2732x2732）を用意して:
npx capacitor-assets generate
```
（同梱の `icons/icon-512.png` を 1024 にリサイズして使ってもOK）

## バージョン・識別子

- `capacitor.config.json` の `appId`（= Android applicationId / iOS bundle id）と `appName` を
  公開前に自分のものへ変更してください（既定: `tech.bantian.droidhaz` / `DroidHaz`）。

## 署名付きリリース（GitHub Actions）

`.github/workflows/android-apk.yml` は、**タグ `v*` を push** すると署名付き release（APK + AAB）を
ビルドして GitHub Release に添付します（鍵が未設定なら未署名 debug APK を prerelease として添付）。

1. アップロード鍵（keystore）を作成（一度だけ。**安全に保管・紛失厳禁**）:
   ```bash
   keytool -genkey -v -keystore droidhaz-release.jks \
     -alias droidhaz -keyalg RSA -keysize 2048 -validity 10000
   ```
2. keystore を base64 にする:
   ```bash
   base64 -w0 droidhaz-release.jks > keystore.b64    # macOS は `base64 -i ...`
   ```
3. リポジトリの **Settings → Secrets and variables → Actions** に登録:
   | Secret | 値 |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | `keystore.b64` の中身 |
   | `ANDROID_KEYSTORE_PASSWORD` | keystore のパスワード |
   | `ANDROID_KEY_ALIAS` | 鍵エイリアス（例 `droidhaz`） |
   | `ANDROID_KEY_PASSWORD` | 鍵パスワード |
4. リリースする:
   ```bash
   git tag v1.0.1 && git push origin v1.0.1
   ```
   → 署名付き `droidhaz-release.apk` / `.aab` が Release に添付されます。AAB は Play Console 用、
   APK はサイドロード用。`versionCode` は CI の run 番号、`versionName` は `package.json` の version。

> パスワード等は build.gradle に直書きせず、`scripts/android-release-signing.mjs` が注入する
> 署名設定が **Gradle 評価時に `System.getenv` で読む**ため、生成物にも履歴にも残りません。

## トラブルシュート

- **`@capacitor/core` が見つからない（Web実行時のコンソール警告）**: 正常です。`kv.js` は
  Capacitor を動的 import し、不在なら静かに localStorage へフォールバックします。
- **白画面**: `npm run build` を忘れて `www/` が空のまま `cap sync` した場合に起きます。
  `npm run sync` を使えば build → sync が連続実行されます。
- **Android のストレージ初期化が効かない**: `@capacitor/preferences` が未インストールの可能性。
  `npm install` を再実行してください。
