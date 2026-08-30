# Layer: Mobile

**First: does it need to be an app?** A responsive web app is cheaper to build, ships instantly
with no review, and reaches everyone. Choose native when you need push notifications, offline as a
core feature, camera or sensor access, or the app store itself is the distribution channel.

### Expo (React Native)
**Bun:** full for tooling · **Docs:** https://docs.expo.dev
**Teaches:** native-modules, ota-updates, app-store-review, deep-linking
Managed React Native: build service, over-the-air updates, and a large module library.
**Use when** — the default for a React team · iOS and Android from one codebase · OTA updates let
you ship fixes without waiting for review.
**Don't use when** — heavy graphics or deep platform integration, or nobody knows React.
**Pairs with:** NativeWind, Zustand, TanStack Query · **Adopt:** ~a day · **Remove later:** weeks
**Gotcha:** budget real time for app store review, signing certificates and provisioning profiles.
It is the part that always takes longer than the code.

### React Native (bare)
**Docs:** https://reactnative.dev · **Use when** — you need native modules Expo cannot handle.
**Don't use when** — Expo's dev-client covers it, which it now usually does.

### Flutter
**Docs:** https://docs.flutter.dev · **Teaches:** dart, widget-trees, platform-channels
**Use when** — pixel-identical UI across platforms matters, or the team knows Dart · strong on
animation-heavy interfaces.
**Don't use when** — you want to share code with a React web app.
**Adopt:** ~days (new language) · **Remove later:** weeks

### Capacitor
**Docs:** https://capacitorjs.com/docs · **Teaches:** webviews, native-bridges
Wraps a web app in a native shell with plugin access to device APIs.
**Use when** — you already have a good web app and need store presence plus a few native
capabilities.
**Don't use when** — the UI must feel truly native. A webview reads as a webview.

### Tauri
**Bun:** full · **Docs:** https://tauri.app · **Teaches:** desktop-apps, rust, ipc
Desktop apps with a web frontend and a Rust core. Far smaller and lighter than Electron.
**Use when** — a desktop app and small binaries matter.
**Don't use when** — you need the deep Node integration Electron provides.

### Native (Swift / Kotlin)
**Docs:** https://developer.apple.com/documentation · https://developer.android.com/docs
**Use when** — one platform only, best possible performance and platform feel, or heavy use of
platform-specific APIs.
**Don't use when** — you need both platforms and have one small team.

### What mobile changes about the backend
**Guidance — not an option to choose between.**
**Teaches:** api-versioning, token-storage, offline-sync
Three things, and all three are the reason mobile is a backend decision too:
1. **You cannot force an upgrade.** Old app versions call your API for months. Version it.
2. **Tokens live in secure device storage**, not `AsyncStorage`.
3. **The network is unreliable.** Retries, optimistic updates, and a real offline story.
