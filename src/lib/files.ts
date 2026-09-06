import { Directory, File, Paths } from 'expo-file-system';

import type { Page } from './types';

/** Everything the app owns lives under this one directory, one subfolder per document. */
const ROOT = 'scans';

function root(): Directory {
  return new Directory(Paths.document, ROOT);
}

export function documentDir(documentId: string): Directory {
  return new Directory(Paths.document, ROOT, documentId);
}

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Copies a freshly captured or picked image into the document's folder so the
 * app stops depending on a cache/`content://` URI that the OS may reclaim.
 */
export async function adoptImage(
  documentId: string,
  pageId: string,
  sourceUri: string
): Promise<string> {
  const dir = ensureDir(documentDir(documentId));
  const destination = new File(dir, `${pageId}.jpg`);
  if (destination.exists) {
    destination.delete();
  }
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

/**
 * Writes a rendered (filtered/rotated) page. The revision is part of the file
 * name so the new image never collides with a cached copy of the old one.
 */
export function writeRendered(
  documentId: string,
  pageId: string,
  revision: number,
  base64: string
): string {
  const dir = ensureDir(documentDir(documentId));
  const file = new File(dir, `${pageId}-r${revision}.jpg`);
  file.create({ overwrite: true, intermediates: true });
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/**
 * Writes a new master capture. Signing replaces the master rather than adding
 * another derived layer, because a signature is part of the document — not a
 * setting you toggle. The revision keeps the filename distinct from the old
 * master so the image cache serves the new pixels.
 */
export function writeMaster(
  documentId: string,
  pageId: string,
  revision: number,
  base64: string
): string {
  const dir = ensureDir(documentDir(documentId));
  const file = new File(dir, `${pageId}-m${revision}.jpg`);
  file.create({ overwrite: true, intermediates: true });
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Best-effort delete — a missing file is the desired end state either way. */
export function removeFile(uri: string | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or outside our sandbox. Nothing to clean up.
  }
}

/** Drops a page's rendered output, keeping the master capture. */
export function removeRendered(page: Page): void {
  if (page.uri !== page.sourceUri) removeFile(page.uri);
}

export function removePage(page: Page): void {
  removeRendered(page);
  removeFile(page.sourceUri);
}

export function removeDocumentDir(documentId: string): void {
  try {
    const dir = documentDir(documentId);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to remove.
  }
}

/**
 * Deletes document folders that no document in the store points at any more —
 * the residue of a crash between writing a file and persisting the state.
 */
export function pruneOrphans(knownIds: string[]): void {
  try {
    const dir = root();
    if (!dir.exists) return;
    const known = new Set(knownIds);
    for (const entry of dir.list()) {
      if (entry instanceof Directory && !known.has(entry.name)) entry.delete();
    }
  } catch {
    // Housekeeping only; never block startup on it.
  }
}

/** Total bytes held by scans, for the storage row in Settings. */
export function usedBytes(): number {
  try {
    const dir = root();
    return dir.exists ? (dir.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
