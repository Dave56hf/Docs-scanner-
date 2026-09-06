import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { removeDocumentDir } from '@/lib/files';
import { createId } from '@/lib/ids';
import { defaultDocumentName, discardPages, ingestPages } from '@/lib/ingest';
import {
  captureWithSystemCamera,
  isNativeScannerAvailable,
  pickFromLibrary,
  scanWithCamera,
  type CaptureResult,
} from '@/lib/scanner';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

export type CaptureSource = 'scanner' | 'gallery';

/** Where the captured pages should end up. */
export type CaptureTarget = { kind: 'new' } | { kind: 'append'; documentId: string };

async function acquire(source: CaptureSource): Promise<CaptureResult> {
  if (source === 'gallery') return pickFromLibrary();

  const scanned = await scanWithCamera();
  // Expo Go (and any build without the native scanner) still gets a usable
  // capture path through the system camera.
  if (scanned.status === 'unavailable') return captureWithSystemCamera();
  return scanned;
}

export function useCapture(run: (message: string, task: () => Promise<void>) => Promise<void>) {
  const router = useRouter();
  const createDocument = useDocuments((state) => state.createDocument);
  const addPages = useDocuments((state) => state.addPages);
  const defaultFilter = useSettings((state) => state.defaultFilter);

  return useCallback(
    (source: CaptureSource, target: CaptureTarget) =>
      run('Processing pages…', async () => {
        const result = await acquire(source);

        if (result.status === 'unavailable') {
          Alert.alert(
            'Permission needed',
            source === 'gallery'
              ? 'Allow photo access in Settings to import images.'
              : 'Allow camera access in Settings to scan documents.'
          );
          return;
        }
        if (result.status === 'cancelled') return;

        const documentId = target.kind === 'append' ? target.documentId : createId();
        const pages = await ingestPages(documentId, result.uris, defaultFilter);
        if (pages.length === 0) return;

        if (target.kind === 'append') {
          addPages(documentId, pages);
          return;
        }

        try {
          createDocument(documentId, defaultDocumentName(), pages);
        } catch (error) {
          // The store never took ownership, so the files on disk are ours to clean up.
          discardPages(pages);
          removeDocumentDir(documentId);
          throw error;
        }
        router.push(`/document/${documentId}`);
      }),
    [run, createDocument, addPages, defaultFilter, router]
  );
}

export { isNativeScannerAvailable };
