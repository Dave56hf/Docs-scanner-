import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';

import { loadImage, MAX_EDGE, type RenderResult } from './render';
import { strokeToPath, type Stroke } from './strokes';

const JPEG_QUALITY = 92;

/**
 * Burns `strokes` into the page image and returns the result as JPEG base64.
 *
 * `displayWidth` is the on-screen width the strokes were drawn against; every
 * coordinate is scaled by `outputWidth / displayWidth` so a signature lands in
 * the same place on the full-resolution page as it appeared under the finger.
 */
export async function renderAnnotated(
  pageUri: string,
  strokes: Stroke[],
  displayWidth: number
): Promise<RenderResult> {
  if (displayWidth <= 0) {
    throw new Error('The page has not finished laying out yet.');
  }

  const image = await loadImage(pageUri);
  const sourceWidth = image.width();
  const sourceHeight = image.height();

  const fit = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const outWidth = Math.max(1, Math.round(sourceWidth * fit));
  const outHeight = Math.max(1, Math.round(sourceHeight * fit));

  const surface = Skia.Surface.MakeOffscreen(outWidth, outHeight);
  if (!surface) {
    throw new Error('Not enough memory to render this page.');
  }

  const canvas = surface.getCanvas();
  const imagePaint = Skia.Paint();
  imagePaint.setAntiAlias(true);
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, sourceWidth, sourceHeight),
    Skia.XYWHRect(0, 0, outWidth, outHeight),
    imagePaint
  );

  const scale = outWidth / displayWidth;

  for (const stroke of strokes) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setStrokeWidth(Math.max(1, stroke.width * scale));
    paint.setColor(Skia.Color(stroke.color));
    canvas.drawPath(strokeToPath(stroke.points, scale), paint);
  }

  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);

  return { base64, width: outWidth, height: outHeight };
}
