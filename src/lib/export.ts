import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { PageSize, ScanDocument } from './types';

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

async function buildHtml(document: ScanDocument, size: PageSize): Promise<string> {
  // Each image is inlined: iOS' print WebView cannot load local file:// assets.
  const slides: string[] = [];
  for (const page of document.pages) {
    const base64 = await new File(page.uri).base64();
    slides.push(`<section class="page"><img src="data:image/jpeg;base64,${base64}" /></section>`);
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
export async function exportPdf(document: ScanDocument, size: PageSize): Promise<string> {
  if (document.pages.length === 0) {
    throw new Error('This document has no pages to export.');
  }

  const html = await buildHtml(document, size);
  const geometry = pageGeometry(document, size);
  const { uri } = await Print.printToFileAsync({ html, ...geometry });

  const outDir = new Directory(Paths.cache, 'exports');
  if (!outDir.exists) outDir.create({ intermediates: true, idempotent: true });

  const destination = new File(outDir, `${sanitizeFilename(document.name)}.pdf`);
  if (destination.exists) destination.delete();
  await new File(uri).move(destination);

  return destination.uri;
}

export async function sharePdf(document: ScanDocument, size: PageSize): Promise<void> {
  const uri = await exportPdf(document, size);
  await share(uri, 'application/pdf', 'com.adobe.pdf', `Share ${document.name}`);
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

export async function printDocument(document: ScanDocument, size: PageSize): Promise<void> {
  const uri = await exportPdf(document, size);
  await Print.printAsync({ uri });
}
