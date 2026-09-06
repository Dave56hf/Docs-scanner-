# Scanly — Document & PDF Scanner

A cross-platform document scanner for Android and iOS, built with Expo (SDK 57) and React Native.
Point it at a page, and it detects the edges, straightens the perspective, cleans up the image, and
turns a stack of captures into a shareable multi-page PDF. Everything stays on the device — there is
no account, no server, and no upload.

## Features

**Scanning**
- Native document scanner with live edge detection and perspective correction — Google ML Kit on
  Android, VisionKit on iOS.
- Multi-page capture in a single session, plus "Add pages" to extend an existing document later.
- Import existing photos from the library and treat them as scans.
- Falls back to the plain system camera automatically when the native scanner isn't linked in
  (Expo Go), so the app is still usable while you develop.

**Editing**
- Five filters — Original, Enhance, Grayscale, B & W, Invert — applied through Skia colour matrices
  with a live preview.
- 90° rotation in either direction.
- Edits are non-destructive: every capture keeps an untouched master, and each change re-renders from
  that master, so filters never compound and quality never degrades across edits.

**Organising**
- Library with search, and sorting by last modified, oldest, or name.
- Rename documents; long-press to multi-select and bulk delete.
- Reorder, edit, or delete individual pages.

**Exporting**
- Multi-page PDF at A4, US Letter, or sized to fit the scan.
- Share to any app, print via AirPrint / Android printing, or save pages to the photo library as JPEGs.

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

### Cloud builds

`eas.json` defines three profiles:

```bash
eas build --profile development --platform android   # dev client, APK
eas build --profile preview --platform android       # installable APK for testers
eas build --profile production --platform android    # AAB for the Play Store
```

## Project layout

```
app/                                  Expo Router routes
  _layout.tsx                         Root stack, theme and gesture providers
  index.tsx                           Library: search, sort, multi-select, scan
  document/[id].tsx                   One document: page grid, export, add pages
  page/[documentId]/[pageId].tsx      Page editor: filters, rotation, preview
  settings.tsx                        Preferences and on-device storage stats

src/
  lib/
    types.ts        Document and page model
    files.ts        Ownership of files on disk, plus orphan cleanup
    ingest.ts       Capture URIs -> owned, rendered pages
    scanner.ts      Native scanner wrapper with camera/gallery fallbacks
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

## Notes and limitations

- **Filters are global, not adaptive.** B & W uses a single luma threshold across the whole page
  rather than a per-region adaptive one, so a page with strong uneven lighting can lose detail in the
  darker area. The threshold is deliberately soft-edged to make that failure gradual.
- **"Fit to scan" PDFs use the first page's aspect ratio** for every page in the document. Mixed
  orientations in one document are better served by A4 or US Letter, which letterbox each page.
- **PDF generation holds the pages in memory** as base64 while building the HTML. Very large
  documents (many dozens of high-resolution pages) will be memory-hungry.
- **No OCR.** Exported PDFs are image-only and not text-searchable.
- Rendered pages are capped at 2400px on the long edge, which keeps small print legible while
  bounding memory use.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run android` / `npm run ios` | Build and run a native dev client |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run prebuild` | Regenerate `android/` and `ios/` from the config |
