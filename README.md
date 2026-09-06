# Scanly — Document & PDF Scanner

A cross-platform document scanner for Android and iOS, built with Expo (SDK 57) and React Native.
Point it at a page, and it detects the edges, straightens the perspective, cleans up the image, and
turns a stack of captures into a shareable multi-page PDF. Everything stays on the device — there is
no account, no server, and no upload.

## Features

**Scanning**
- **ID card mode** — front and back laid out on one printable page.
- Native document scanner with live edge detection and perspective correction — Google ML Kit on
  Android, VisionKit on iOS.
- Multi-page capture in a single session, plus "Add pages" to extend an existing document later.
- Import existing photos from the library and treat them as scans.
- Falls back to the plain system camera automatically when the native scanner isn't linked in
  (Expo Go), so the app is still usable while you develop.

**Editing**
- Sign a page by drawing on it with a finger — three ink colours, three pen widths, undo and clear.
- Five filters — Original, Enhance, Grayscale, B & W, Invert — applied through Skia colour matrices
  with a live preview.
- 90° rotation in either direction.
- Edits are non-destructive: every capture keeps an untouched master, and each change re-renders from
  that master, so filters never compound and quality never degrades across edits.

**Organising**
- **Search inside your documents**, not just their names — every scan is read on
  capture, so "croissant" finds the receipt you took in March. Matches show the page
  number and a snippet.
- **Folders**, with counts, an Unfiled view, and move from single or multi-select.
- **Documents are named after their own heading** rather than a timestamp, so the
  library reads like a filing cabinet instead of a camera roll.
- Sorting by last modified, oldest, or name.
- Merge several documents into one; rename; long-press to multi-select and bulk delete.
- Reorder, edit, or delete individual pages.

**Reading**
- On-device OCR (ML Kit on Android, Apple Vision on iOS) extracts the text from a document; results
  are cached per page and copy to the clipboard in one tap.

**Exporting**
- **Three quality presets** — Small, Balanced, High. Scanner apps are notorious for
  producing PDFs too large to email; Small re-encodes at 1240px to fix that. The
  resulting file size is shown after every export.
- **PDFs are text-searchable** — recognised text is embedded as a transparent layer,
  so Ctrl-F works in any reader.
- Multi-page PDF at A4, US Letter, or sized to fit the scan.
- Share to any app, print via AirPrint / Android printing, or save pages to the photo library as JPEGs.

**Privacy**
- Optional **Face ID / fingerprint / passcode lock** on launch and resume.
- No account, no cloud, no upload, no ads, no watermark, no paywall.

**Elsewhere**
- Light and dark themes that follow the system by default.
- Runs fully offline.

## Requirements

- Node 20+
- An Android or iOS device or emulator
- For iOS builds: macOS with Xcode. For Android builds: Android Studio, or EAS Build for either.

## Getting started

```bash
npm install
```

The native document scanner is a native module, so **it does not run in Expo Go**. Build a
development client once, then iterate normally:

```bash
# Android — builds and installs a dev client on a connected device or emulator
npm run android

# iOS — requires macOS
npm run ios
```

After the first build, `npm start` is enough for day-to-day work.

If you only have Expo Go available, the app still runs: scanning falls back to the system camera and
you lose automatic edge detection. Settings → *On this device* → *Edge detection* tells you which
mode you're in.

### Cloud builds (no Android Studio or Xcode needed)

EAS Build compiles the app on Expo's servers and hands you back an installable file. You need a free
Expo account; the build itself runs in the cloud.

```bash
# 1. Sign in (creates an account if you don't have one)
npx eas-cli@latest login

# 2. Link this checkout to an EAS project. This writes an `extra.eas.projectId`
#    into app.json — commit that change.
npx eas-cli@latest init

# 3. Build an installable APK
npm run build:android
```

When the build finishes, EAS gives you a URL and a QR code. Open it on your phone to install the
APK directly — no cable, no Android Studio. Signing keys are generated and stored by EAS on first
build; just accept the prompts.

`eas.json` defines three profiles:

| Profile | Output | Use it for |
| --- | --- | --- |
| `development` | APK with the dev client | Iterating with Metro over the network |
| `preview` | Standalone APK | Handing a build to yourself or a tester |
| `production` | AAB | Uploading to the Play Store |

Swap `--platform android` for `--platform ios` on any of them. iOS builds need a paid Apple Developer
account to install on a physical device.

## Project layout

```
app/                                  Expo Router routes
  _layout.tsx                         Root stack, theme and gesture providers
  index.tsx                           Library: search, sort, multi-select, scan
  document/[id].tsx                   One document: page grid, export, add pages
  page/[documentId]/[pageId].tsx      Page editor: filters, rotation, preview
  sign/[documentId]/[pageId].tsx      Draw a signature onto a page
  text/[id].tsx                       OCR results: read, copy
  settings.tsx                        Preferences and on-device storage stats

src/
  lib/
    types.ts        Document and page model
    files.ts        Ownership of files on disk, plus orphan cleanup
    ingest.ts       Capture URIs -> owned, rendered pages
    scanner.ts      Native scanner wrapper with camera/gallery fallbacks
    ocr.ts          On-device text recognition, with per-platform URI handling
    lock.ts         Biometric capability probe and unlock prompt
    idcard.ts       Lays two captures onto one printable sheet
    merge.ts        Copies pages when combining documents
    strokes.ts      Signature stroke smoothing and path building
    annotate.ts     Burns signature strokes into the page image
    filters.ts      Colour matrices and how they compose
    render.ts       Offscreen Skia render: filter + rotation -> JPEG
    export.ts       PDF generation, sharing, printing, gallery export
    ids.ts          Short ids used for filenames
  store/
    documents.ts    Persisted document library (Zustand + AsyncStorage)
    settings.ts     Persisted preferences
  components/       Shared UI
  hooks/            useAsyncTask (busy/error handling), useCapture
  theme/            Palettes and spacing/type tokens
```

## How pages are stored

Each document owns a directory under the app's document directory:

```
<documents>/scans/<documentId>/
  <pageId>.jpg          the untouched master capture
  <pageId>-r<n>.jpg     the current rendered output, if the page has been edited
```

Only metadata — names, ordering, the chosen filter and rotation — goes into AsyncStorage; the images
themselves stay on the filesystem. The revision suffix `-r<n>` exists so that a re-render lands on a
URI the image cache has never seen, which is what makes an edit show up immediately. The previous
render is deleted as soon as the new one is recorded, and any document folder with no matching entry
in the store is cleaned up on launch.

## How signing works

Signing is destructive on purpose. When you apply a signature, the current look of the page — filter,
rotation and all — is flattened together with your strokes into a **new master image**, replacing the
old one. The page then resets to unfiltered and unrotated, because those looks are now part of the
pixels.

This means a signature cannot be filtered off or undone later, which matches what people expect from
signing a document. It also keeps the rendering pipeline simple: there is no separate annotation layer
to keep in register through later rotations.

## Running in a browser

`npm run web` renders the app through React Native for Web, including the Skia-backed page editor
and signing screen — CanvasKit is loaded on demand for web only, so the whole UI is inspectable in a
browser without a device.

Two caveats:

- Scanning, OCR and saving to the photo library are native modules with no web implementation. The
  app detects this and degrades (Settings reports "Camera only" and "Unavailable") rather than
  crashing.
- If you serve a production web build yourself, it needs `canvaskit.wasm` (from
  `node_modules/canvaskit-wasm/bin/full/`) at the site root, and SPA routing that falls back to
  `index.html` — otherwise nested routes such as `/sign/<doc>/<page>` 404.

Treat the browser as a design and review tool. Anything touching the camera still needs a device build.

## Notes and limitations

- **Filters are global, not adaptive.** B & W uses a single luma threshold across the whole page
  rather than a per-region adaptive one, so a page with strong uneven lighting can lose detail in the
  darker area. The threshold is deliberately soft-edged to make that failure gradual.
- **"Fit to scan" PDFs use the first page's aspect ratio** for every page in the document. Mixed
  orientations in one document are better served by A4 or US Letter, which letterbox each page.
- **PDF generation holds the pages in memory** as base64 while building the HTML. Very large
  documents (many dozens of high-resolution pages) will be memory-hungry.
- **The searchable PDF layer is not word-positioned.** The recogniser returns strings, not bounding
  boxes, so the embedded text makes a PDF *findable* but you cannot select a word by tapping it in a
  reader. Accuracy depends heavily on scan quality.
- **OCR recognises Latin script.** Both platform engines default to Latin; other scripts would need a
  different recogniser.
- **Signatures are flattened, not undoable** — see "How signing works" above.
- Rendered pages are capped at 2400px on the long edge, which keeps small print legible while
  bounding memory use.

## Why these features

The feature set is deliberately shaped by what people complain about in the big scanner apps rather
than by what those apps ship. The recurring gripes, from app-store reviews and Android/iOS forums,
are: watermarks on free exports, basic export locked behind a paywall, aggressive ads and trial
traps, **PDFs too big to email**, forced cloud accounts, scans lost when changing device, and
**being unable to find a scan again months later**.

Scanly answers those directly — no watermark, no ads, no account, nothing paywalled, explicit file
size control, and content search. Some popular features are deliberately *not* here, because they
are the bloat that the same reviews resent: cloud sync, business-card-to-contact, barcode scanning,
and per-file cloud auto-upload rules.

Genuinely useful things still missing: password-protected PDFs (needs a PDF library that can
encrypt — `expo-print` cannot), drag-to-reorder pages, and manual crop adjustment after capture.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run android` / `npm run ios` | Build and run a native dev client |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run prebuild` | Regenerate `android/` and `ios/` from the config |
| `npm run build:android` | Cloud-build an installable APK via EAS |
| `npm run build:android:dev` | Cloud-build a development client |
| `npm run build:ios` | Cloud-build for iOS via EAS |
