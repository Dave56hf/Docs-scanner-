import { Platform } from 'react-native';

import type { ScanDocument } from './types';

type Extractor = {
  isSupported: boolean;
  extractTextFromImage: (uri: string) => Promise<string[]>;
};

let cached: Extractor | null | undefined;

/**
 * Resolved lazily so a build without the native module falls back to "OCR
 * unavailable" instead of throwing at import time.
 */
function extractor(): Extractor | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-text-extractor') as Extractor;
  } catch {
    cached = null;
  }
  return cached;
}

export function isOcrAvailable(): boolean {
  const module = extractor();
  return module !== null && module.isSupported === true;
}

/**
 * The two platforms disagree about what a path is: the Android module builds a
 * `java.io.File` straight from the string (so `file://` makes it look for a
 * file literally named "file:"), while the iOS module parses a `URL` and needs
 * the scheme to recognise it as one.
 */
function nativePath(uri: string): string {
  if (Platform.OS === 'android') {
    return uri.startsWith('file://') ? decodeURI(uri.replace(/^file:\/\//, '')) : uri;
  }
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

/** Recognised text for one page, joined into paragraphs in reading order. */
export async function recognizePage(uri: string): Promise<string> {
  const module = extractor();
  if (!module) throw new Error('Text recognition is not available in this build.');

  const blocks = await module.extractTextFromImage(nativePath(uri));
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join('\n\n');
}

export type PageText = { pageId: string; index: number; text: string };

/**
 * Runs OCR across a document. One page failing (an unreadable image, an
 * out-of-memory blip) must not lose the text from every other page, so each
 * page is caught individually and reported as empty.
 */
export async function recognizeDocument(
  document: ScanDocument,
  onProgress?: (done: number, total: number) => void
): Promise<PageText[]> {
  const results: PageText[] = [];

  for (const [index, page] of document.pages.entries()) {
    let text = '';
    try {
      text = await recognizePage(page.uri);
    } catch {
      text = '';
    }
    results.push({ pageId: page.id, index, text });
    onProgress?.(index + 1, document.pages.length);
  }

  return results;
}

/** Flattens per-page results into one document, with page markers between them. */
export function joinPages(pages: PageText[]): string {
  const withText = pages.filter((page) => page.text.length > 0);
  if (withText.length === 0) return '';
  if (withText.length === 1) return withText[0].text;

  return withText.map((page) => `— Page ${page.index + 1} —\n\n${page.text}`).join('\n\n');
}
