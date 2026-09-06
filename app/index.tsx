import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar, AppBarAction } from '@/components/AppBar';
import { BusyOverlay } from '@/components/BusyOverlay';
import { DocumentCard } from '@/components/DocumentCard';
import { EmptyState } from '@/components/EmptyState';
import { Touchable } from '@/components/Pressable';
import { PromptDialog } from '@/components/PromptDialog';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import { Screen } from '@/components/Screen';
import { useAsyncTask } from '@/hooks/useAsyncTask';
import { useCapture } from '@/hooks/useCapture';
import { sharePdf } from '@/lib/export';
import type { SortKey } from '@/lib/types';
import { searchDocuments, sortDocuments, useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { font, radius, space, useTheme } from '@/theme';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Last modified',
  oldest: 'Oldest first',
  name: 'Name (A–Z)',
};

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const documents = useDocuments((state) => state.documents);
  const hydrated = useDocuments((state) => state.hydrated);
  const renameDocument = useDocuments((state) => state.renameDocument);
  const deleteDocument = useDocuments((state) => state.deleteDocument);
  const deleteDocuments = useDocuments((state) => state.deleteDocuments);

  const sort = useSettings((state) => state.sort);
  const setSort = useSettings((state) => state.setSort);
  const pageSize = useSettings((state) => state.pageSize);

  const { busy, run } = useAsyncTask();
  const capture = useCapture(run);

  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [scanSheet, setScanSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const visible = useMemo(
    () => sortDocuments(searchDocuments(documents, query), sort),
    [documents, query, sort]
  );

  const selectionMode = selection.length > 0;
  const menuDocument = documents.find((document) => document.id === menuFor) ?? null;
  const renamingDocument = documents.find((document) => document.id === renaming) ?? null;

  const toggleSelection = (id: string) =>
    setSelection((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  const confirmDeleteSelection = () => {
    const count = selection.length;
    Alert.alert(
      `Delete ${count} document${count === 1 ? '' : 's'}?`,
      'The scans and any pages inside will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDocuments(selection);
            setSelection([]);
          },
        },
      ]
    );
  };

  const documentActions = (id: string): SheetAction[] => {
    const document = documents.find((entry) => entry.id === id);
    if (!document) return [];
    return [
      {
        icon: 'share-outline',
        label: 'Share as PDF',
        hint: `${document.pages.length} page${document.pages.length === 1 ? '' : 's'}`,
        onPress: () => run('Building PDF…', () => sharePdf(document, pageSize)),
      },
      {
        icon: 'create-outline',
        label: 'Rename',
        onPress: () => setRenaming(id),
      },
      {
        icon: 'trash-outline',
        label: 'Delete',
        destructive: true,
        onPress: () =>
          Alert.alert(`Delete “${document.name}”?`, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(id) },
          ]),
      },
    ];
  };

  return (
    <Screen>
      <AppBar
        title={selectionMode ? `${selection.length} selected` : 'Scanly'}
        subtitle={selectionMode ? undefined : 'Documents on this device'}
        onBack={selectionMode ? () => setSelection([]) : undefined}
        right={
          selectionMode ? (
            <AppBarAction
              icon="trash-outline"
              label="Delete selected"
              tint={theme.danger}
              onPress={confirmDeleteSelection}
            />
          ) : (
            <>
              <AppBarAction icon="swap-vertical" label="Sort" onPress={() => setSortSheet(true)} />
              <AppBarAction
                icon="settings-outline"
                label="Settings"
                onPress={() => router.push('/settings')}
              />
            </>
          )
        }
      />

      {documents.length > 0 && (
        <View style={[styles.search, { backgroundColor: theme.surface }]}>
          <Ionicons name="search" size={17} color={theme.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search documents"
            placeholderTextColor={theme.textFaint}
            style={[font.body, styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(document) => document.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 108 },
          visible.length === 0 && styles.listEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            selected={selection.includes(item.id)}
            selectionMode={selectionMode}
            onPress={() =>
              selectionMode ? toggleSelection(item.id) : router.push(`/document/${item.id}`)
            }
            onLongPress={() => toggleSelection(item.id)}
            onMore={() => setMenuFor(item.id)}
          />
        )}
        ListEmptyComponent={
          hydrated ? (
            documents.length === 0 ? (
              <EmptyState
                icon="scan-outline"
                title="No scans yet"
                message="Tap Scan to capture a document. Pages are cropped automatically and stay on your device."
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title="No matches"
                message={`Nothing here is called “${query.trim()}”.`}
              />
            )
          ) : null
        }
      />

      {!selectionMode && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Scan a document"
          onPress={() => setScanSheet(true)}
          style={[
            styles.fab,
            { backgroundColor: theme.accent, bottom: insets.bottom + space.xl },
          ]}>
          <Ionicons name="scan" size={22} color={theme.onAccent} />
          <Text style={[font.heading, { color: theme.onAccent }]}>Scan</Text>
        </Touchable>
      )}

      <ActionSheet
        visible={scanSheet}
        title="New document"
        onClose={() => setScanSheet(false)}
        actions={[
          {
            icon: 'camera-outline',
            label: 'Scan with camera',
            hint: 'Detects edges and straightens the page',
            onPress: () => capture('scanner', { kind: 'new' }),
          },
          {
            icon: 'images-outline',
            label: 'Import from photos',
            hint: 'Turn existing pictures into a document',
            onPress: () => capture('gallery', { kind: 'new' }),
          },
        ]}
      />

      <ActionSheet
        visible={sortSheet}
        title="Sort by"
        onClose={() => setSortSheet(false)}
        actions={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
          icon: sort === key ? 'radio-button-on' : 'radio-button-off',
          label: SORT_LABELS[key],
          onPress: () => setSort(key),
        }))}
      />

      <ActionSheet
        visible={menuDocument !== null}
        title={menuDocument?.name ?? ''}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? documentActions(menuFor) : []}
      />

      <PromptDialog
        visible={renamingDocument !== null}
        title="Rename document"
        initialValue={renamingDocument?.name ?? ''}
        placeholder="Document name"
        onCancel={() => setRenaming(null)}
        onSubmit={(value) => {
          if (renaming) renameDocument(renaming, value);
          setRenaming(null);
        }}
      />

      <BusyOverlay visible={busy !== null} message={busy ?? ''} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, paddingVertical: space.md },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
