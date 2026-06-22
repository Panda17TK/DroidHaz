// scripts/android-release-signing.mjs
// `npx cap add android` で生成される android/app/build.gradle に、release 署名設定を注入する。
//  - 値は build.gradle に直書きせず、Gradle 評価時に System.getenv(...) で読む
//    （パスワード等をファイルに残さない）。CI 側で以下の env を渡すこと:
//      ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD
//  - 冪等（既に signingConfigs があれば何もしない）。マーカーが無ければ非0で失敗（CI で気付ける）。
//
// 使い方: node scripts/android-release-signing.mjs [android/app/build.gradle]

import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] || 'android/app/build.gradle';

let src;
try {
  src = readFileSync(path, 'utf8');
} catch (e) {
  console.error('[signing] cannot read', path, '-', e.message);
  process.exit(1);
}

if (src.includes('signingConfigs')) {
  console.log('[signing] signingConfigs already present, skipping');
  process.exit(0);
}

const SIGNING_BLOCK = `    signingConfigs {
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksPath != null && !ksPath.isEmpty()) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;

// 1) buildTypes の直前に signingConfigs ブロックを挿入（インデント保持のため行頭に揃える）。
const btIdx = src.indexOf('buildTypes');
if (btIdx === -1) {
  console.error('[signing] "buildTypes" block not found in', path);
  process.exit(1);
}
const lineStart = src.lastIndexOf('\n', btIdx) + 1;
src = src.slice(0, lineStart) + SIGNING_BLOCK + src.slice(lineStart);

// 2) buildTypes { release { ... } } の release 直後に signingConfig を 1 行追加。
//    （signingConfigs.release は buildTypes より前にあるので、buildTypes 以降から探す）
const afterBuildTypes = src.indexOf('buildTypes');
const relIdx = src.indexOf('release {', afterBuildTypes);
if (relIdx === -1) {
  console.error('[signing] release buildType not found after buildTypes in', path);
  process.exit(1);
}
const insertAt = relIdx + 'release {'.length;
src = src.slice(0, insertAt) + '\n            signingConfig signingConfigs.release' + src.slice(insertAt);

writeFileSync(path, src);
console.log('[signing] injected release signingConfig into', path);
