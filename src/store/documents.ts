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
import type { FilterId, Page, Rotation, ScanDocument, SortKey } from '@/lib/types';

/** A page whose files are already on disk but that the store hasn't adopted yet. */
export type NewPage = Omit<Page, 'revision'>;

type DocumentsState = {
  documents: ScanDocument[];
  hydrated: boolean;

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
      hydrated: false,

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
      partialize: ({ documents }) => ({ documents }),
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

export function searchDocuments(documents: ScanDocument[], query: string): ScanDocument[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return documents;
  return documents.filter((document) => document.name.toLowerCase().includes(needle));
}
