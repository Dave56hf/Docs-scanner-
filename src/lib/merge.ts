import { copyPageInto, removeDocumentDir } from './files';
import { createId } from './ids';
import type { ScanDocument } from './types';
import type { NewPage } from '@/store/documents';

/**
 * Builds the page list for a document that combines `sources`, duplicating
 * every image so the new document owns its files outright and the originals
 * stay independently deletable.
 */
export async function mergePages(
  targetId: string,
  sources: ScanDocument[]
): Promise<NewPage[]> {
  const pages: NewPage[] = [];

  try {
    for (const document of sources) {
      for (const page of document.pages) {
        const id = createId();
        const copied = await copyPageInto(targetId, id, page.sourceUri, page.uri);
        pages.push({
          id,
          sourceUri: copied.sourceUri,
          uri: copied.uri,
          width: page.width,
          height: page.height,
          filter: page.filter,
          rotation: page.rotation,
          text: page.text,
        });
      }
    }
  } catch (error) {
    // A half-copied merge leaves orphan files, so clear the whole target.
    removeDocumentDir(targetId);
    throw error;
  }

  return pages;
}

export function mergedName(sources: ScanDocument[]): string {
  const first = sources[0]?.name ?? 'Merged';
  return `${first} + ${sources.length - 1} more`;
}
