import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FilterId, PageSize, PdfQuality, SortKey } from '@/lib/types';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  theme: ThemePreference;
  /** Applied automatically to every newly captured page. */
  defaultFilter: FilterId;
  pageSize: PageSize;
  pdfQuality: PdfQuality;
  sort: SortKey;
  /**
   * Reads text from every new scan in the background. This is what makes the
   * library searchable by content rather than by filename, which is the single
   * most common thing people cannot do in other scanners.
   */
  autoRecognizeText: boolean;
  /** Names a new document after its own first line instead of the timestamp. */
  smartNaming: boolean;
  /** Requires Face ID / fingerprint / passcode to open the app. */
  appLock: boolean;
  /** False until AsyncStorage has been read, so the UI can hold the splash. */
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setDefaultFilter: (filter: FilterId) => void;
  setPageSize: (size: PageSize) => void;
  setPdfQuality: (quality: PdfQuality) => void;
  setSort: (sort: SortKey) => void;
  setAutoRecognizeText: (value: boolean) => void;
  setSmartNaming: (value: boolean) => void;
  setAppLock: (value: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      defaultFilter: 'enhance',
      pageSize: 'fit',
      pdfQuality: 'balanced',
      sort: 'recent',
      autoRecognizeText: true,
      smartNaming: true,
      appLock: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setDefaultFilter: (defaultFilter) => set({ defaultFilter }),
      setPageSize: (pageSize) => set({ pageSize }),
      setPdfQuality: (pdfQuality) => set({ pdfQuality }),
      setSort: (sort) => set({ sort }),
      setAutoRecognizeText: (autoRecognizeText) => set({ autoRecognizeText }),
      setSmartNaming: (smartNaming) => set({ smartNaming }),
      setAppLock: (appLock) => set({ appLock }),
    }),
    {
      name: 'scanly.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` is derived state, never written back to storage.
      partialize: ({
        theme,
        defaultFilter,
        pageSize,
        pdfQuality,
        sort,
        autoRecognizeText,
        smartNaming,
        appLock,
      }) => ({
        theme,
        defaultFilter,
        pageSize,
        pdfQuality,
        sort,
        autoRecognizeText,
        smartNaming,
        appLock,
      }),
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    }
  )
);
