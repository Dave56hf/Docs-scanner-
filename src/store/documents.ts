import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  pruneOrphans,
  removeDocumentDir,
  removeFile,
  removePage,
  removeRendered,
} from '@/lib/files';
import { createId } from '@/lib/ids';
import type { FilterId, Folder, Page, Rotation, ScanDocument, SortKey } from '@/lib/types';

/** A page whose files are already on disk but that the store hasn't adopted yet. */
export type NewPage = Omit<Page, 'revision'>;

type DocumentsState = {
  documents: ScanDocument[];
  folders: Folder[];
  hydrated: boolean;

  createFolder: (name: string) => string;
  renameFolder: (folderId: string, name: string) => void;
  /** Deleting a folder keeps its documents; they fall back to the top level. */
  deleteFolder: (folderId: string) => void;
  moveToFolder: (documentIds: string[], folderId: string | undefined) => void;

  /** The id is chosen by the caller because page files are written under it first. */
  createDocument: (id: string, name: string, pages: NewPage[]) => void;
  addPages: (documentId: string, pages: NewPage[]) => void;
  renameDocument: (documentId: string, name: string) => void;
  deleteDocument: (documentId: string) => void;
  deleteDocuments: (documentIds: string[]) => void;

  deletePage: (documentId: string, pageId: string) => void;
  movePage: (documentId: string, from: number, to: number) => void;
  /**
   * Replaces a page's master with a flattened, signed version. The previous
   * master and any derived render are deleted, and the page resets to an
   * unfiltered, unrotated state because those looks are now baked in.
   */
  applySignature: (
    documentId: string,
    pageId: string,
    next: { uri: string; width: number; height: number; revision: number }
  ) => void;

  /** Caches OCR output so re-opening the text view doesn't re-run recognition. */
  setPageTexts: (documentId: string, texts: { pageId: string; text: string }[]) => void;

  /**
   * Records the result of a re-render. `uri` is the new rendered file, or the
   * page's own `sourceUri` when the edit resolved back to the untouched image.
   */
  applyRender: (
    documentId: string,
    pageId: string,
    next: {
      uri: string;
      filter: FilterId;
      rotation: Rotation;
      width: number;
      height: number;
      revision: number;
    }
  ) => void;
};

function touch(document: ScanDocument): ScanDocument {
  return { ...document, updatedAt: Date.now() };
}

/** Applies `mutate` to one document, leaving every other document untouched. */
function withDocument(
  documents: ScanDocument[],
  documentId: string,
  mutate: (document: ScanDocument) => ScanDocument
): ScanDocument[] {
  return documents.map((document) =>
    document.id === documentId ? touch(mutate(document)) : document
  );
}

function materialize(pages: NewPage[]): Page[] {
  return pages.map((page) => ({ ...page, revision: 0 }));
}

export const useDocuments = create<DocumentsState>()(
  persist(
    (set, get) => ({
      documents: [],
      folders: [],
      hydrated: false,

      createFolder: (name) => {
        const folder: Folder = { id: createId(), name: name.trim(), createdAt: Date.now() };
        set((state) => ({ folders: [...state.folders, folder] }));
        return folder.id;
      },

      renameFolder: (folderId, name) =>
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === folderId ? { ...folder, name: name.trim() || folder.name } : folder
          ),
        })),

      deleteFolder: (folderId) =>
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== folderId),
          documents: state.documents.map((document) =>
            document.folderId === folderId ? { ...document, folderId: undefined } : document
          ),
        })),

      moveToFolder: (documentIds, folderId) => {
        const moving = new Set(documentIds);
        set((state) => ({
          documents: state.documents.map((document) =>
            moving.has(document.id) ? { ...document, folderId, updatedAt: Date.now() } : document
          ),
        }));
      },

      createDocument: (id, name, pages) => {
        const now = Date.now();
        const document: ScanDocument = {
          id,
          name,
          pages: materialize(pages),
          createdAt: now,
          updatedAt: now,
        };
        set({ documents: [document, ...get().documents] });
      },

      addPages: (documentId, pages) =>
        set((state) => ({
          documents: withDocument(state.documents, documentId, (document) => ({
            ...document,
            pages: [...document.pages, ...materialize(pages)],
          })),
        })),

      renameDocument: (documentId, name) =>
        set((state) => ({
          documents: withDocument(state.documents, documentId, (document) => ({
            ...document,
            name: name.trim() || document.name,
          })),
        })),

      deleteDocument: (documentId) => {
        removeDocumentDir(documentId);
        set((state) => ({
          documents: state.documents.filter((document) => document.id !== documentId),
        }));
      },

      deleteDocuments: (documentIds) => {
        const doomed = new Set(documentIds);
        documentIds.forEach(removeDocumentDir);
        set((state) => ({
          documents: state.documents.filter((document) => !doomed.has(document.id)),
        }));
      },

      deletePage: (documentId, pageId) => {
        const document = get().documents.find((entry) => entry.id === documentId);
        const page = document?.pages.find((entry) => entry.id === pageId);
        if (!document || !page) return;

        // Removing the last page removes the document itself — an empty
        // document is never something the user asked to keep.
        if (document.pages.length === 1) {
          get().deleteDocument(documentId);
          return;
        }

        removePage(page);
        set((state) => ({
          documents: withDocument(state.documents, documentId, (entry) => ({
            ...entry,
            pages: entry.pages.filter((candidate) => candidate.id !== pageId),
          })),
        }));
      },

      movePage: (documentId, from, to) =>
        set((state) => ({
          documents: withDocument(state.documents, documentId, (document) => {
            if (
              from === to ||
              from < 0 ||
              to < 0 ||
              from >= document.pages.length ||
              to >= document.pages.length
            ) {
              return document;
            }
            const pages = [...document.pages];
            const [moved] = pages.splice(from, 1);
            pages.splice(to, 0, moved);
            return { ...document, pages };
          }),
        })),

      applySignature: (documentId, pageId, next) => {
        const document = get().documents.find((entry) => entry.id === documentId);
        const previous = document?.pages.find((entry) => entry.id === pageId);
        if (previous) {
          removeRendered(previous);
          removeFile(previous.sourceUri);
        }

        set((state) => ({
          documents: withDocument(state.documents, documentId, (entry) => ({
            ...entry,
            pages: entry.pages.map((page) =>
              page.id === pageId
                ? {
                    ...page,
                    sourceUri: next.uri,
                    uri: next.uri,
                    width: next.width,
                    height: next.height,
                    revision: next.revision,
                    filter: 'original' as const,
                    rotation: 0 as const,
                    text: undefined,
                  }
                : page
            ),
          })),
        }));
      },

      setPageTexts: (documentId, texts) =>
        // Deliberately not routed through `withDocument`: reading a document's
        // text is not editing it, so `updatedAt` must not move and re-sort the
        // library under the user.
        set((state) => ({
          documents: state.documents.map((document) => {
            if (document.id !== documentId) return document;
            const byId = new Map(texts.map((entry) => [entry.pageId, entry.text]));
            return {
              ...document,
              pages: document.pages.map((page) =>
                byId.has(page.id) ? { ...page, text: byId.get(page.id) } : page
              ),
            };
          }),
        })),

      applyRender: (documentId, pageId, next) => {
        const document = get().documents.find((entry) => entry.id === documentId);
        const previous = document?.pages.find((entry) => entry.id === pageId);
        if (previous) removeRendered(previous);

        set((state) => ({
          documents: withDocument(state.documents, documentId, (entry) => ({
            ...entry,
            // The pixels changed, so any cached OCR for this page is stale.
            pages: entry.pages.map((page) =>
              page.id === pageId ? { ...page, ...next, text: undefined } : page
            ),
          })),
        }));
      },
    }),
    {
      name: 'scanly.documents.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ documents, folders }) => ({ documents, folders }),
      onRehydrateStorage: () => (state) => {
        useDocuments.setState({ hydrated: true });
        pruneOrphans((state?.documents ?? []).map((document) => document.id));
      },
    }
  )
);

/** Selector helper — kept out of the store so it stays a pure sort. */
export function sortDocuments(documents: ScanDocument[], sort: SortKey): ScanDocument[] {
  const sorted = [...documents];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'recent':
    default:
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export type SearchHit = {
  document: ScanDocument;
  /** The page whose text matched, and a snippet around the match. */
  match?: { pageNumber: number; snippet: string };
};

/** Characters of context shown either side of a match in the library list. */
const SNIPPET_PAD = 34;

function snippetAround(text: string, at: number, length: number): string {
  const start = Math.max(0, at - SNIPPET_PAD);
  const end = Math.min(text.length, at + length + SNIPPET_PAD);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

/**
 * Matches on the document's name first, then on any text recognised from its
 * pages. Searching only filenames is the reason people cannot find a scan they
 * took six months ago, so content is treated as a first-class index.
 */
export function searchDocuments(documents: ScanDocument[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return documents.map((document) => ({ document }));

  const hits: SearchHit[] = [];

  for (const document of documents) {
    if (document.name.toLowerCase().includes(needle)) {
      hits.push({ document });
      continue;
    }

    for (const [index, page] of document.pages.entries()) {
      const text = page.text;
      if (!text) continue;
      const at = text.toLowerCase().indexOf(needle);
      if (at === -1) continue;

      hits.push({
        document,
        match: { pageNumber: index + 1, snippet: snippetAround(text, at, needle.length) },
      });
      break;
    }
  }

  return hits;
}

/** True once at least one page anywhere has been read, so search can say so. */
export function hasAnyRecognizedText(documents: ScanDocument[]): boolean {
  return documents.some((document) => document.pages.some((page) => !!page.text));
}
