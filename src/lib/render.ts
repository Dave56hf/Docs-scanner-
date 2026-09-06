import { ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';

import { FILTER_MATRICES } from './filters';
import type { FilterId, Rotation } from './types';

/**
 * Long edge of a rendered page. Big enough that 10pt text stays legible in the
 * exported PDF, small enough that a 30-page document doesn't exhaust memory.
 */
export const MAX_EDGE = 2400;
const JPEG_QUALITY = 92;

export type RenderResult = { base64: string; width: number; height: number };

export async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('That file could not be read as an image.');
  }
  return image;
}

/**
 * Draws `image` through `filter` at `rotation` into an offscreen surface and
 * returns the JPEG bytes as base64.
 *
 * Rotation is baked into the pixels rather than stored as metadata so that
 * every consumer — the PDF, a shared JPEG, the gallery — agrees on which way
 * up the page is.
 */
export function renderImage(
  image: SkImage,
  filter: FilterId,
  rotation: Rotation
): RenderResult {
  const sourceWidth = image.width();
  const sourceHeight = image.height();
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));

  const quarterTurn = rotation === 90 || rotation === 270;
  const outWidth = quarterTurn ? drawHeight : drawWidth;
  const outHeight = quarterTurn ? drawWidth : drawHeight;

  const surface = Skia.Surface.MakeOffscreen(outWidth, outHeight);
  if (!surface) {
    throw new Error('Not enough memory to render this page.');
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (filter !== 'original') {
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(FILTER_MATRICES[filter]));
  }

  canvas.save();
  // Translate first, then rotate: Skia pre-concatenates, so the rotation is
  // applied to the image and the translation moves the result back on-canvas.
  switch (rotation) {
    case 90:
      canvas.translate(outWidth, 0);
      canvas.rotate(90, 0, 0);
      break;
    case 180:
      canvas.translate(outWidth, outHeight);
      canvas.rotate(180, 0, 0);
      break;
    case 270:
      canvas.translate(0, outHeight);
      canvas.rotate(270, 0, 0);
      break;
    default:
      break;
  }

  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, sourceWidth, sourceHeight),
    Skia.XYWHRect(0, 0, drawWidth, drawHeight),
    paint
  );
  canvas.restore();
  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);

  return { base64, width: outWidth, height: outHeight };
}

/** Convenience wrapper for callers that only have a URI. */
export async function renderFromUri(
  uri: string,
  filter: FilterId,
  rotation: Rotation
): Promise<RenderResult> {
  const image = await loadImage(uri);
  return renderImage(image, filter, rotation);
}

/** Reads an image's intrinsic size without keeping the decoded bitmap around. */
export async function measureImage(uri: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(uri);
  return { width: image.width(), height: image.height() };
}
