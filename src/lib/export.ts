import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { renderAtQuality } from './render';
import { PDF_QUALITY, type PageSize, type PdfQuality, type ScanDocument } from './types';

/** Page geometry in PostScript points (72 per inch), as expo-print expects. */
const PAGE_SIZES: Record<Exclude<PageSize, 'fit'>, { width: number; height: number }> = {
  a4: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
};

/** Width used when the PDF page is sized to match the first scan's aspect. */
const FIT_WIDTH = 612;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 80) || 'Scan';
}

function pageGeometry(document: ScanDocument, size: PageSize) {
  if (size !== 'fit') return PAGE_SIZES[size];

  const first = document.pages[0];
  const ratio = first && first.width > 0 ? first.height / first.width : Math.SQRT2;
  return { width: FIT_WIDTH, height: Math.round(FIT_WIDTH * ratio) };
}

/** Keeps recognised text out of the visible layout but inside the PDF's text. */
function textLayer(text: string | undefined): string {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div class="ocr">${escaped}</div>`;
}

async function buildHtml(
  document: ScanDocument,
  size: PageSize,
  quality: PdfQuality,
  onProgress?: (done: number, total: number) => void
): Promise<string> {
  // Each image is inlined: iOS' print WebView cannot load local file:// assets.
  const slides: string[] = [];

  for (const [index, page] of document.pages.entries()) {
    const preset = PDF_QUALITY[quality];
    // Re-encoding here rather than shipping the master is what keeps a ten-page
    // scan inside an email attachment limit.
    const base64 =
      quality === 'high'
        ? await new File(page.uri).base64()
        : (await renderAtQuality(page.uri, preset.maxEdge, preset.quality)).base64;

    slides.push(
      `<section class="page"><img src="data:image/jpeg;base64,${base64}" />${textLayer(page.text)}</section>`
    );
    onProgress?.(index + 1, document.pages.length);
  }

  const padding = size === 'fit' ? 0 : 24;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page { margin: 0; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      .page {
        box-sizing: border-box;
        width: 100%;
        height: 100vh;
        padding: ${padding}px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
      }
      .page:last-child { page-break-after: auto; break-after: auto; }
      img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
      /*
       * Recognised text, rendered transparently behind the image. The printer
       * still writes it into the PDF's text layer, so the exported file is
       * searchable in any reader. Words are not positioned over their pixels —
       * the recogniser returns strings, not boxes — so this makes a PDF
       * findable, not selectable word-by-word.
       */
      .ocr {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        color: transparent;
        font-size: 6px;
        line-height: 1.1;
        overflow: hidden;
        z-index: -1;
      }
      .page { position: relative; }
    </style>
  </head>
  <body>${slides.join('')}</body>
</html>`;
}

/**
 * Renders the document to a PDF in the cache directory and returns its URI.
 * The file is named after the document so the share sheet and the receiving
 * app show something meaningful rather than a random print id.
 */
export type ExportResult = { uri: string; bytes: number };

export async function exportPdf(
  document: ScanDocument,
  size: PageSize,
  quality: PdfQuality,
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult> {
  if (document.pages.length === 0) {
    throw new Error('This document has no pages to export.');
  }

  const html = await buildHtml(document, size, quality, onProgress);
  const geometry = pageGeometry(document, size);
  const { uri } = await Print.printToFileAsync({ html, ...geometry });

  const outDir = new Directory(Paths.cache, 'exports');
  if (!outDir.exists) outDir.create({ intermediates: true, idempotent: true });

  const destination = new File(outDir, `${sanitizeFilename(document.name)}.pdf`);
  if (destination.exists) destination.delete();
  await new File(uri).move(destination);

  return { uri: destination.uri, bytes: destination.size };
}

export async function sharePdf(
  document: ScanDocument,
  size: PageSize,
  quality: PdfQuality,
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult> {
  const result = await exportPdf(document, size, quality, onProgress);
  await share(result.uri, 'application/pdf', 'com.adobe.pdf', `Share ${document.name}`);
  return result;
}

export async function share(
  uri: string,
  mimeType: string,
  uti: string,
  dialogTitle: string
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
}

export async function shareImage(uri: string, dialogTitle: string): Promise<void> {
  await share(uri, 'image/jpeg', 'public.jpeg', dialogTitle);
}

type MediaLibraryModule = typeof import('expo-media-library');

/**
 * Resolved on demand. The module has no implementation outside Android and iOS
 * and throws the moment it is imported, which would take down every screen that
 * merely wants to share a PDF.
 */
function mediaLibrary(): MediaLibraryModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibraryModule;
  } catch {
    throw new Error('Saving to the photo library is not supported here.');
  }
}

/** Writes every page into the device gallery as a JPEG. */
export async function saveToGallery(document: ScanDocument): Promise<number> {
  const MediaLibrary = mediaLibrary();
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Scanly needs photo library access to save images.');
  }

  for (const page of document.pages) {
    await MediaLibrary.saveToLibraryAsync(page.uri);
  }
  return document.pages.length;
}

export async function printDocument(
  document: ScanDocument,
  size: PageSize,
  quality: PdfQuality
): Promise<void> {
  const { uri } = await exportPdf(document, size, quality);
  await Print.printAsync({ uri });
}
