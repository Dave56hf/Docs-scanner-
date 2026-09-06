import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { loadImage, type RenderResult } from './render';

/** A4 at 150dpi — the sheet an ID card is normally photocopied onto. */
const SHEET_WIDTH = 1240;
const SHEET_HEIGHT = 1754;
const MARGIN = 90;
const GAP = 70;
const JPEG_QUALITY = 92;

/**
 * Lays the front and back of an ID onto one portrait page, the way a
 * photocopier would. Every office that asks for "a copy of your ID" wants both
 * sides on one sheet, and doing it by hand afterwards is the tedious part.
 *
 * A single image is centred on its own; two are stacked with a gap.
 */
export async function composeIdCard(uris: string[]): Promise<RenderResult> {
  if (uris.length === 0) throw new Error('No captures to lay out.');

  const images = [];
  for (const uri of uris.slice(0, 2)) {
    images.push(await loadImage(uri));
  }

  const surface = Skia.Surface.MakeOffscreen(SHEET_WIDTH, SHEET_HEIGHT);
  if (!surface) throw new Error('Not enough memory to build the page.');

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));

  const paint = Skia.Paint();
  paint.setAntiAlias(true);

  const usableWidth = SHEET_WIDTH - MARGIN * 2;
  const slots = images.length;
  const slotHeight = (SHEET_HEIGHT - MARGIN * 2 - GAP * (slots - 1)) / slots;

  images.forEach((image, index) => {
    const sourceWidth = image.width();
    const sourceHeight = image.height();
    // Contain within the slot so the card keeps its proportions.
    const scale = Math.min(usableWidth / sourceWidth, slotHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (SHEET_WIDTH - width) / 2;
    const y = MARGIN + index * (slotHeight + GAP) + (slotHeight - height) / 2;

    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, sourceWidth, sourceHeight),
      Skia.XYWHRect(x, y, width, height),
      paint
    );
  });

  surface.flush();
  return {
    base64: surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY),
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
  };
}
