import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { removeDocumentDir, writeMaster } from '@/lib/files';
import { composeIdCard } from '@/lib/idcard';
import { createId } from '@/lib/ids';
import {
  defaultDocumentName,
  discardPages,
  ingestPages,
  titleFromText,
} from '@/lib/ingest';
import { isOcrAvailable, recognizePage } from '@/lib/ocr';
import {
  captureWithSystemCamera,
  isNativeScannerAvailable,
  pickFromLibrary,
  scanWithCamera,
  type CaptureResult,
} from '@/lib/scanner';
import { measureImage } from '@/lib/render';
import { useDocuments, type NewPage } from '@/store/documents';
import { useSettings } from '@/store/settings';

export type CaptureSource = 'scanner' | 'gallery' | 'idcard';

export type CaptureTarget = { kind: 'new'; folderId?: string } | { kind: 'append'; documentId: string };

async function acquire(source: CaptureSource): Promise<CaptureResult> {
  if (source === 'gallery') return pickFromLibrary();

  // ID mode wants exactly two shots; the scanner's own multi-capture handles it.
  const scanned = await scanWithCamera(source === 'idcard' ? 2 : undefined);
  if (scanned.status === 'unavailable') return captureWithSystemCamera();
  return scanned;
}

/** Reads each page in the background so search and smart naming have something to work with. */
async function recognize(pages: NewPage[]): Promise<NewPage[]> {
  if (!isOcrAvailable()) return pages;

  const read: NewPage[] = [];
  for (const page of pages) {
    try {
      read.push({ ...page, text: await recognizePage(page.uri) });
    } catch {
      // Text is a convenience; never fail a scan because the reader tripped.
      read.push(page);
    }
  }
  return read;
}

export function useCapture(run: (message: string, task: () => Promise<void>) => Promise<void>) {
  const router = useRouter();
  const createDocument = useDocuments((state) => state.createDocument);
  const addPages = useDocuments((state) => state.addPages);
  const moveToFolder = useDocuments((state) => state.moveToFolder);
  const defaultFilter = useSettings((state) => state.defaultFilter);
  const autoRecognizeText = useSettings((state) => state.autoRecognizeText);
  const smartNaming = useSettings((state) => state.smartNaming);

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

        let pages: NewPage[];
        if (source === 'idcard') {
          // Both sides are flattened onto one sheet before the page is created,
          // so the document holds a single ready-to-print page.
          const sheet = await composeIdCard(result.uris);
          const pageId = createId();
          const uri = writeMaster(documentId, pageId, 0, sheet.base64);
          pages = [
            {
              id: pageId,
              sourceUri: uri,
              uri,
              width: sheet.width,
              height: sheet.height,
              filter: 'original',
              rotation: 0,
            },
          ];
          // Keep the recorded size honest if the composer ever changes shape.
          const measured = await measureImage(uri).catch(() => null);
          if (measured) pages[0] = { ...pages[0], ...measured };
        } else {
          pages = await ingestPages(documentId, result.uris, defaultFilter);
        }

        if (pages.length === 0) return;
        if (autoRecognizeText) pages = await recognize(pages);

        if (target.kind === 'append') {
          addPages(documentId, pages);
          return;
        }

        const recognized = pages.find((page) => page.text)?.text;
        const name =
          (smartNaming && recognized ? titleFromText(recognized) : undefined) ??
          (source === 'idcard' ? `ID card ${defaultDocumentName().replace('Scan ', '')}` : defaultDocumentName());

        try {
          createDocument(documentId, name, pages);
          if (target.folderId) moveToFolder([documentId], target.folderId);
        } catch (error) {
          discardPages(pages);
          removeDocumentDir(documentId);
          throw error;
        }
        router.push(`/document/${documentId}`);
      }),
    [
      run,
      createDocument,
      addPages,
      moveToFolder,
      defaultFilter,
      autoRecognizeText,
      smartNaming,
      router,
    ]
  );
}

export { isNativeScannerAvailable };
