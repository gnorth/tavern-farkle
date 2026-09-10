# Android APK

The APK includes a separate Vite build of the same game, textures and portraits. It runs offline using Android WebViewAssetLoader over a secure local HTTPS origin. It does not load the hosted website. Both orientations are supported; rotating preserves the running game.

## Download

GitHub → Releases → **Android APK — тестова версія** → `tavern-farkle.apk`.
Alternatively, open the successful **Android APK** Actions run and download `tavern-farkle-apk`.

Requires Android 8.0+ and an up-to-date Android System WebView. This is a debug-signed test APK, not a Play Store release. CI-generated debug signatures may differ between builds; if Android rejects an update, uninstall the earlier test build first.

## Build

With Node 22, Java 17, Android SDK 35 and Gradle 8.11.1:

```sh
npm ci
npm run build:android-web
gradle -p android assembleDebug
```

Web build output is generated under `android/app/src/main/assets/` and is not committed. The regular Sites build is unchanged.
