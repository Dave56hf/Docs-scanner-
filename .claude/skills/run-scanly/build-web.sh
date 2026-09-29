#!/usr/bin/env bash
# Build the web bundle and stage everything it needs to actually run.
set -euo pipefail

cd "$(dirname "$0")/../../.."          # -> repo root
SKILL=.claude/skills/run-scanly
OUT=.preview/site

npx expo export --platform web --output-dir "$OUT"

# `expo export` empties its output directory on every run, so anything
# hand-staged has to be copied back AFTER the export, not before.

# Skia on web is WebAssembly that the bundler does not emit. The app's
# loader asks for it at the site root (see src/components/SkiaReady.web.tsx),
# without which the editor and signing screens never render.
cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm "$OUT/"

python3 "$SKILL/make-demo-pages.py" "$OUT/demo"

echo "built -> $OUT"
