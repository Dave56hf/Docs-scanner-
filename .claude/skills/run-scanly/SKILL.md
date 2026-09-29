---
name: run-scanly
description: Build, run, drive and screenshot the Scanly document scanner app. Use when asked to run, start, launch, preview or screenshot the app, to see a UI change working, or to check a screen renders. Covers the headless web preview (the only way to see the UI in a container), the Skia/CanvasKit staging it needs, and the Playwright driver that walks every screen.
---

# Running Scanly

Scanly is an Expo (SDK 57) / React Native app for Android and iOS. **There is no
Android SDK or emulator in this container and iOS needs macOS**, so the way to
actually see the UI here is the React Native for Web build, driven headlessly by
`.claude/skills/run-scanly/drive.mjs` through Playwright.

That preview renders the real components, the real theme and the real Skia
canvas — including the page editor and the signing screen. It cannot exercise
the camera, ML Kit scanning, OCR, biometrics or the photo library: those are
native modules with no web implementation. The app degrades honestly rather
than crashing (Settings shows "Camera only" / "Unavailable").

All paths below are relative to the repo root.

## Prerequisites

Everything needed is already installed except Playwright, which is deliberately
not a project dependency:

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --no-package-lock playwright@1.63.0
```

`--no-package-lock` matters: without it npm rewrites the lockfile as a side
effect of a tooling install. Chromium is preinstalled at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — **do not run
`playwright install`**, it is blocked and unnecessary.

Demo page generation uses Pillow (`pip install Pillow` if missing).

## Build

```bash
./.claude/skills/run-scanly/build-web.sh
```

Exports the web bundle to `.preview/site` and stages the two things the bundler
does not emit: `canvaskit.wasm` and the demo scan images. Takes ~60s.

## Run (agent path)

Start the server in the background, then drive it:

```bash
python3 .claude/skills/run-scanly/serve.py .preview/site 8100    # background this
node  .claude/skills/run-scanly/drive.mjs
```

The driver seeds a library (three documents, two folders, OCR text), walks every
screen and writes PNGs to `.preview/shots/`:

| Shot | Screen |
|---|---|
| `1-library` | Library with folder chips and counts |
| `2-search` | Content search — "croissant" matches the receipt's text |
| `3-scan` | New-document sheet (camera / ID card / import) |
| `4-document` | Document with its page grid |
| `5-actions` | Document actions sheet |
| `6-editor` | Page editor, Enhance filter |
| `7-editor-bw` | Page editor, B&W filter |
| `8-signing` | Signing screen with a drawn signature |
| `9-settings` | Settings |

Both themes run by default, prefixed `light-` and `dark-`. Useful flags:

```bash
node .claude/skills/run-scanly/drive.mjs --theme dark        # one theme
node .claude/skills/run-scanly/drive.mjs --only editor       # one screen
node .claude/skills/run-scanly/drive.mjs --out /tmp/shots    # elsewhere
```

It prints a page-error count per theme and **exits non-zero if any screen
threw** — a clean exit plus screenshots you have actually looked at is the bar.
Open the PNGs. A blank frame means the run failed even though the exit code was
fine.

### Verifying a native-only change

If your change touches the scanner, OCR, biometrics or gallery export, the web
preview cannot prove anything. Check it still compiles for the real target:

```bash
npx expo export --platform android --output-dir .preview/android
```

That catches import and resolution errors the web build would miss (see the
Metro gotcha below). A device build is `npm run android`, or `npm run
build:android` for an EAS cloud APK.

## Run (human path)

```bash
npm run web          # serves with hot reload on http://localhost:8081
```

Fine for eyeballing, useless headless. `npm start` needs a device.

Two harmless surprises when running it as root in a container: it logs
`FATAL: Running as root without --no-sandbox is not supported` while failing to
auto-open a browser (the server is up regardless), and it rewrites
`tsconfig.json#include`. Check `git diff` afterwards.

## Test

There is no test suite. The checks that exist:

```bash
npm run typecheck
npm run lint
```

## Gotchas

- **`expo export` empties its output directory on every run.** Anything staged
  by hand — the wasm, the demo images — vanishes. `build-web.sh` copies them
  back *after* the export for exactly this reason. Re-running `npx expo export`
  by hand and then wondering why the editor is a spinner is the trap.
- **Skia needs `canvaskit.wasm` at the site root.** CanvasKit resolves it
  relative to the current URL by default, so a nested route like
  `/sign/<doc>/<page>` asks for `/sign/<doc>/canvaskit.wasm` and 404s. The app
  pins `locateFile` to `/` in `src/components/SkiaReady.web.tsx`; the server
  must serve the file from the root.
- **`python3 -m http.server` is not enough.** Expo Router is a SPA, so nested
  routes have no file behind them and plain http.server 404s. `serve.py` falls
  back to `index.html`.
- **The web Skia loader must stay in a `.web.tsx` file.** Branching on
  `Platform.OS` instead lets Metro follow the CanvasKit import into the *native*
  bundle, where its Node `fs` dependency cannot resolve and the Android build
  fails. Hence `SkiaReady.tsx` (native no-op) beside `SkiaReady.web.tsx`.
- **`getByText('Scan')` also matches the title "Scanly".** Drive controls by
  `aria-label`; every interactive element has one.
- **The app starts empty and cannot scan in a browser**, so the driver writes
  `scanly.documents.v1` and `scanly.settings.v1` into `localStorage` and
  reloads. Change the store shape and the seed in `drive.mjs` needs updating
  too.
- **Leave `appLock` false in seeded settings.** The browser has no biometrics,
  so an enabled lock parks every run on the unlock screen.
- **Expo pins some native deps to exact versions** (`react-native-reanimated`,
  `react-native-worklets`, `@shopify/react-native-skia`, async-storage). Adding
  a caret lets npm drift onto a build the SDK does not support — reanimated
  4.7.0 demands worklets 0.13.x and the install fails with ERESOLVE. Take
  versions from `node_modules/expo/bundledNativeModules.json` verbatim.
- **`npx expo install` does not work here.** It needs `api.expo.dev`, which the
  egress proxy blocks. Read the version out of `bundledNativeModules.json` and
  `npm install` it explicitly.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Editor/signing shows a spinner forever | `canvaskit.wasm` missing from `.preview/site/` — re-run `build-web.sh` (an `expo export` wiped it). |
| Blank white screen on `/sign/...` or `/page/...` | Served without SPA fallback. Use `serve.py`, not `python3 -m http.server`. |
| Page images missing, thumbnails empty | `.preview/site/demo/` was wiped by an export. Re-run `build-web.sh`. |
| Driver: `Cannot find package 'playwright'` | Run the install line under Prerequisites. |
| Driver times out on a locator | A control's `aria-label` changed. Grep the screen for `accessibilityLabel`. |
| `npm install` fails with ERESOLVE on worklets/reanimated | A caret crept onto an exactly-pinned dep — see the Gotchas entry. |
| Android export: `Unable to resolve module fs` | Something web-only leaked into the native bundle; move it into a `.web.tsx` file. |
