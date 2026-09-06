import { adoptImage, removeFile, writeRendered } from './files';
import { createId } from './ids';
import { measureImage, renderFromUri } from './render';
import type { FilterId } from './types';
import type { NewPage } from '@/store/documents';

/**
 * Turns raw capture URIs into pages the store can own: each image is copied
 * into the document's folder, then rendered once with the default filter so
 * what the library shows is what a share or export produces.
 */
export async function ingestPages(
  documentId: string,
  uris: string[],
  filter: FilterId
): Promise<NewPage[]> {
  const pages: NewPage[] = [];

  for (const uri of uris) {
    const id = createId();
    const sourceUri = await adoptImage(documentId, id, uri);

    if (filter === 'original') {
      const { width, height } = await measureImage(sourceUri);
      pages.push({ id, sourceUri, uri: sourceUri, width, height, filter, rotation: 0 });
      continue;
    }

    try {
      const rendered = await renderFromUri(sourceUri, filter, 0);
      const renderedUri = writeRendered(documentId, id, 0, rendered.base64);
      pages.push({
        id,
        sourceUri,
        uri: renderedUri,
        width: rendered.width,
        height: rendered.height,
        filter,
        rotation: 0,
      });
    } catch {
      // A filter failing is not worth losing the capture over — keep the
      // original and let the user re-apply a filter in the editor.
      const { width, height } = await measureImage(sourceUri);
      pages.push({
        id,
        sourceUri,
        uri: sourceUri,
        width,
        height,
        filter: 'original',
        rotation: 0,
      });
    }
  }

  return pages;
}

/** Undo a partial ingest when the caller decides not to keep the result. */
export function discardPages(pages: NewPage[]): void {
  for (const page of pages) {
    if (page.uri !== page.sourceUri) removeFile(page.uri);
    removeFile(page.sourceUri);
  }
}

/** "Scan 6 Sep 2026, 14:32" — a name the user can find again without typing one. */
export function defaultDocumentName(date = new Date()): string {
  const day = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `Scan ${day}, ${time}`;
}
