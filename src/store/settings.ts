import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FilterId, PageSize, SortKey } from '@/lib/types';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  theme: ThemePreference;
  /** Applied automatically to every newly captured page. */
  defaultFilter: FilterId;
  pageSize: PageSize;
  sort: SortKey;
  /** False until AsyncStorage has been read, so the UI can hold the splash. */
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setDefaultFilter: (filter: FilterId) => void;
  setPageSize: (size: PageSize) => void;
  setSort: (sort: SortKey) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      defaultFilter: 'enhance',
      pageSize: 'fit',
      sort: 'recent',
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setDefaultFilter: (defaultFilter) => set({ defaultFilter }),
      setPageSize: (pageSize) => set({ pageSize }),
      setSort: (sort) => set({ sort }),
    }),
    {
      name: 'scanly.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` is derived state, never written back to storage.
      partialize: ({ theme, defaultFilter, pageSize, sort }) => ({
        theme,
        defaultFilter,
        pageSize,
        sort,
      }),
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    }
  )
);
