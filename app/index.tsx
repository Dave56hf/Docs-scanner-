import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar, AppBarAction } from '@/components/AppBar';
import { BusyOverlay } from '@/components/BusyOverlay';
import { DocumentCard } from '@/components/DocumentCard';
import { EmptyState } from '@/components/EmptyState';
import { FolderBar, type FolderFilter } from '@/components/FolderBar';
import { Touchable } from '@/components/Pressable';
import { PromptDialog } from '@/components/PromptDialog';
import { Screen } from '@/components/Screen';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import { useAsyncTask } from '@/hooks/useAsyncTask';
import { useCapture } from '@/hooks/useCapture';
import { sharePdf } from '@/lib/export';
import { formatBytes } from '@/lib/files';
import { createId } from '@/lib/ids';
import { mergePages, mergedName } from '@/lib/merge';
import { isOcrAvailable } from '@/lib/ocr';
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
  const folders = useDocuments((state) => state.folders);
  const hydrated = useDocuments((state) => state.hydrated);
  const renameDocument = useDocuments((state) => state.renameDocument);
  const deleteDocument = useDocuments((state) => state.deleteDocument);
  const deleteDocuments = useDocuments((state) => state.deleteDocuments);
  const createDocument = useDocuments((state) => state.createDocument);
  const createFolder = useDocuments((state) => state.createFolder);
  const renameFolder = useDocuments((state) => state.renameFolder);
  const deleteFolder = useDocuments((state) => state.deleteFolder);
  const moveToFolder = useDocuments((state) => state.moveToFolder);

  const sort = useSettings((state) => state.sort);
  const setSort = useSettings((state) => state.setSort);
  const pageSize = useSettings((state) => state.pageSize);
  const pdfQuality = useSettings((state) => state.pdfQuality);

  const { busy, run } = useAsyncTask();
  const capture = useCapture(run);

  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<FolderFilter>(undefined);
  const [selection, setSelection] = useState<string[]>([]);
  const [scanSheet, setScanSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const [moveSheet, setMoveSheet] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { __all: documents.length, __none: 0 };
    for (const document of documents) {
      if (document.folderId) tally[document.folderId] = (tally[document.folderId] ?? 0) + 1;
      else tally.__none += 1;
    }
    return tally;
  }, [documents]);

  const hits = useMemo(() => {
    // Search deliberately ignores the folder filter: if you are looking for
    // something, being told "not here" because of a filter you forgot is worse
    // than searching everywhere.
    const scope =
      query.trim().length > 0
        ? documents
        : documents.filter((document) =>
            folder === undefined ? true : folder === null ? !document.folderId : document.folderId === folder
          );
    const found = searchDocuments(scope, query);
    const order = new Map(sortDocuments(scope, sort).map((document, index) => [document.id, index]));
    return [...found].sort(
      (a, b) => (order.get(a.document.id) ?? 0) - (order.get(b.document.id) ?? 0)
    );
  }, [documents, query, folder, sort]);

  const selectionMode = selection.length > 0;
  const menuDocument = documents.find((document) => document.id === menuFor) ?? null;
  const renamingDocument = documents.find((document) => document.id === renaming) ?? null;
  const renamingFolderEntry = folders.find((entry) => entry.id === renamingFolder) ?? null;
  const folderMenuEntry = folders.find((entry) => entry.id === folderMenu) ?? null;
  const folderName = (id?: string) => folders.find((entry) => entry.id === id)?.name;

  const toggleSelection = (id: string) =>
    setSelection((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  const shareOne = (id: string) => {
    const document = documents.find((entry) => entry.id === id);
    if (!document) return;
    run('Building PDF…', async () => {
      const { bytes } = await sharePdf(document, pageSize, pdfQuality);
      // Size is the thing people get bitten by, so say it out loud.
      Alert.alert('PDF ready', `${document.name}.pdf · ${formatBytes(bytes)}`);
    });
  };

  const merge = () =>
    run('Merging…', async () => {
      const sources = selection
        .map((id) => documents.find((document) => document.id === id))
        .filter((document): document is NonNullable<typeof document> => document !== undefined);
      if (sources.length < 2) return;

      const id = createId();
      const pages = await mergePages(id, sources);
      createDocument(id, mergedName(sources), pages);
      if (sources[0].folderId) moveToFolder([id], sources[0].folderId);
      setSelection([]);
      router.push(`/document/${id}`);
    });

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
        onPress: () => shareOne(id),
      },
      {
        icon: 'folder-outline',
        label: 'Move to folder',
        hint: folderName(document.folderId) ?? 'Not in a folder',
        onPress: () => {
          setSelection([id]);
          setMoveSheet(true);
        },
      },
      { icon: 'create-outline', label: 'Rename', onPress: () => setRenaming(id) },
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

  const moveActions: SheetAction[] = [
    {
      icon: 'remove-circle-outline',
      label: 'No folder',
      onPress: () => {
        moveToFolder(selection, undefined);
        setSelection([]);
      },
    },
    ...folders.map((entry) => ({
      icon: 'folder-outline' as const,
      label: entry.name,
      onPress: () => {
        moveToFolder(selection, entry.id);
        setSelection([]);
      },
    })),
  ];

  const searching = query.trim().length > 0;

  return (
    <Screen>
      <AppBar
        title={selectionMode ? `${selection.length} selected` : 'Scanly'}
        subtitle={selectionMode ? undefined : 'Documents on this device'}
        onBack={selectionMode ? () => setSelection([]) : undefined}
        right={
          selectionMode ? (
            <>
              {selection.length > 1 && (
                <AppBarAction icon="git-merge-outline" label="Merge selected" onPress={merge} />
              )}
              <AppBarAction
                icon="folder-outline"
                label="Move selected"
                onPress={() => setMoveSheet(true)}
              />
              <AppBarAction
                icon="trash-outline"
                label="Delete selected"
                tint={theme.danger}
                onPress={confirmDeleteSelection}
              />
            </>
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
        <>
          <View style={[styles.search, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={17} color={theme.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={isOcrAvailable() ? 'Search names and text inside' : 'Search documents'}
              placeholderTextColor={theme.textFaint}
              style={[font.body, styles.searchInput, { color: theme.text }]}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {!searching && (
            <View style={styles.folders}>
              <FolderBar
                folders={folders}
                counts={counts}
                active={folder}
                onSelect={setFolder}
                onNewFolder={() => setNewFolder(true)}
                onLongPressFolder={(entry) => setFolderMenu(entry.id)}
              />
            </View>
          )}
        </>
      )}

      <FlatList
        data={hits}
        keyExtractor={(hit) => hit.document.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 108 },
          hits.length === 0 && styles.listEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <DocumentCard
            document={item.document}
            match={item.match}
            folderName={searching ? folderName(item.document.folderId) : undefined}
            selected={selection.includes(item.document.id)}
            selectionMode={selectionMode}
            onPress={() =>
              selectionMode
                ? toggleSelection(item.document.id)
                : router.push(`/document/${item.document.id}`)
            }
            onLongPress={() => toggleSelection(item.document.id)}
            onMore={() => setMenuFor(item.document.id)}
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
                message={
                  searching
                    ? `Nothing named or containing “${query.trim()}”.`
                    : 'This folder is empty.'
                }
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
          style={[styles.fab, { backgroundColor: theme.accent, bottom: insets.bottom + space.xl }]}>
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
            onPress: () =>
              capture('scanner', {
                kind: 'new',
                folderId: typeof folder === 'string' ? folder : undefined,
              }),
          },
          {
            icon: 'card-outline',
            label: 'Scan an ID card',
            hint: 'Front and back, laid out on one page',
            onPress: () =>
              capture('idcard', {
                kind: 'new',
                folderId: typeof folder === 'string' ? folder : undefined,
              }),
          },
          {
            icon: 'images-outline',
            label: 'Import from photos',
            hint: 'Turn existing pictures into a document',
            onPress: () =>
              capture('gallery', {
                kind: 'new',
                folderId: typeof folder === 'string' ? folder : undefined,
              }),
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
        visible={moveSheet}
        title={`Move ${selection.length} document${selection.length === 1 ? '' : 's'}`}
        onClose={() => setMoveSheet(false)}
        actions={moveActions}
      />

      <ActionSheet
        visible={folderMenuEntry !== null}
        title={folderMenuEntry?.name ?? ''}
        onClose={() => setFolderMenu(null)}
        actions={
          folderMenuEntry
            ? [
                {
                  icon: 'create-outline',
                  label: 'Rename folder',
                  onPress: () => setRenamingFolder(folderMenuEntry.id),
                },
                {
                  icon: 'trash-outline',
                  label: 'Delete folder',
                  destructive: true,
                  hint: 'Documents inside are kept, just unfiled',
                  onPress: () =>
                    Alert.alert(
                      `Delete “${folderMenuEntry.name}”?`,
                      'The documents inside are not deleted — they move out of the folder.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete folder',
                          style: 'destructive',
                          onPress: () => {
                            if (folder === folderMenuEntry.id) setFolder(undefined);
                            deleteFolder(folderMenuEntry.id);
                          },
                        },
                      ]
                    ),
                },
              ]
            : []
        }
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

      <PromptDialog
        visible={newFolder}
        title="New folder"
        initialValue=""
        placeholder="Folder name"
        confirmLabel="Create"
        onCancel={() => setNewFolder(false)}
        onSubmit={(value) => {
          setFolder(createFolder(value));
          setNewFolder(false);
        }}
      />

      <PromptDialog
        visible={renamingFolderEntry !== null}
        title="Rename folder"
        initialValue={renamingFolderEntry?.name ?? ''}
        placeholder="Folder name"
        onCancel={() => setRenamingFolder(null)}
        onSubmit={(value) => {
          if (renamingFolder) renameFolder(renamingFolder, value);
          setRenamingFolder(null);
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
  folders: { paddingBottom: space.sm },
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
