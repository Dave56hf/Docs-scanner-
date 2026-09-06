import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar, AppBarAction } from '@/components/AppBar';
import { BusyOverlay } from '@/components/BusyOverlay';
import { EmptyState } from '@/components/EmptyState';
import { Touchable } from '@/components/Pressable';
import { PromptDialog } from '@/components/PromptDialog';
import { Screen } from '@/components/Screen';
import { ActionSheet } from '@/components/Sheet';
import { useAsyncTask } from '@/hooks/useAsyncTask';
import { useCapture } from '@/hooks/useCapture';
import { printDocument, saveToGallery, sharePdf } from '@/lib/export';
import { filterLabel } from '@/lib/filters';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { font, radius, space, useTheme } from '@/theme';

const COLUMNS = 2;

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const document = useDocuments((state) => state.documents.find((entry) => entry.id === id));
  const renameDocument = useDocuments((state) => state.renameDocument);
  const deleteDocument = useDocuments((state) => state.deleteDocument);
  const deletePage = useDocuments((state) => state.deletePage);
  const movePage = useDocuments((state) => state.movePage);
  const pageSize = useSettings((state) => state.pageSize);

  const { busy, run } = useAsyncTask();
  const capture = useCapture(run);

  const [addSheet, setAddSheet] = useState(false);
  const [exportSheet, setExportSheet] = useState(false);
  const [pageMenu, setPageMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  // Deleting the last page deletes the document, which unmounts this screen.
  if (!document) {
    return (
      <Screen>
        <AppBar title="Document" onBack={() => router.back()} />
        <EmptyState
          icon="document-outline"
          title="Document not found"
          message="It may have been deleted from the library."
        />
      </Screen>
    );
  }

  const gutter = space.lg;
  const tileWidth = (width - gutter * 2 - space.md * (COLUMNS - 1)) / COLUMNS;
  const pageIndex = document.pages.findIndex((page) => page.id === pageMenu);
  const menuPage = pageIndex >= 0 ? document.pages[pageIndex] : null;

  return (
    <Screen>
      <AppBar
        title={document.name}
        subtitle={`${document.pages.length} page${document.pages.length === 1 ? '' : 's'} · ${filterLabel(
          document.pages[0]?.filter ?? 'original'
        )}`}
        onBack={() => router.back()}
        right={
          <>
            <AppBarAction icon="create-outline" label="Rename" onPress={() => setRenaming(true)} />
            <AppBarAction
              icon="trash-outline"
              label="Delete document"
              tint={theme.danger}
              onPress={() =>
                Alert.alert(`Delete “${document.name}”?`, 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      router.back();
                      deleteDocument(document.id);
                    },
                  },
                ])
              }
            />
          </>
        }
      />

      <FlatList
        data={document.pages}
        keyExtractor={(page) => page.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 108 }]}
        renderItem={({ item, index }) => (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`Page ${index + 1}, edit`}
            onPress={() => router.push(`/page/${document.id}/${item.id}`)}
            onLongPress={() => setPageMenu(item.id)}
            delayLongPress={250}
            style={[styles.tile, { width: tileWidth, backgroundColor: theme.surface }]}>
            <View style={[styles.thumb, { backgroundColor: theme.canvas }]}>
              <Image
                source={{ uri: item.uri }}
                style={styles.image}
                contentFit="contain"
                transition={120}
              />
            </View>
            <View style={styles.tileFooter}>
              <Text style={[font.caption, { color: theme.textMuted }]}>Page {index + 1}</Text>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={`Actions for page ${index + 1}`}
                hitSlop={10}
                onPress={() => setPageMenu(item.id)}>
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.textFaint} />
              </Touchable>
            </View>
          </Touchable>
        )}
      />

      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingBottom: insets.bottom + space.md,
          },
        ]}>
        <BarButton icon="add" label="Add pages" onPress={() => setAddSheet(true)} />
        <BarButton
          icon="share-outline"
          label="Share PDF"
          primary
          onPress={() => run('Building PDF…', () => sharePdf(document, pageSize))}
        />
        <BarButton icon="ellipsis-horizontal" label="More" onPress={() => setExportSheet(true)} />
      </View>

      <ActionSheet
        visible={addSheet}
        title="Add pages"
        onClose={() => setAddSheet(false)}
        actions={[
          {
            icon: 'camera-outline',
            label: 'Scan with camera',
            onPress: () => capture('scanner', { kind: 'append', documentId: document.id }),
          },
          {
            icon: 'images-outline',
            label: 'Import from photos',
            onPress: () => capture('gallery', { kind: 'append', documentId: document.id }),
          },
        ]}
      />

      <ActionSheet
        visible={exportSheet}
        title="Export"
        onClose={() => setExportSheet(false)}
        actions={[
          {
            icon: 'print-outline',
            label: 'Print',
            onPress: () => run('Preparing…', () => printDocument(document, pageSize)),
          },
          {
            icon: 'download-outline',
            label: 'Save images to photos',
            hint: `${document.pages.length} JPEG${document.pages.length === 1 ? '' : 's'}`,
            onPress: () =>
              run('Saving…', async () => {
                const count = await saveToGallery(document);
                Alert.alert('Saved', `${count} image${count === 1 ? '' : 's'} added to your photos.`);
              }),
          },
        ]}
      />

      <ActionSheet
        visible={menuPage !== null}
        title={pageIndex >= 0 ? `Page ${pageIndex + 1}` : ''}
        onClose={() => setPageMenu(null)}
        actions={
          menuPage
            ? [
                {
                  icon: 'color-filter-outline',
                  label: 'Edit page',
                  hint: filterLabel(menuPage.filter),
                  onPress: () => router.push(`/page/${document.id}/${menuPage.id}`),
                },
                {
                  icon: 'arrow-up',
                  label: 'Move up',
                  onPress: () => movePage(document.id, pageIndex, pageIndex - 1),
                },
                {
                  icon: 'arrow-down',
                  label: 'Move down',
                  onPress: () => movePage(document.id, pageIndex, pageIndex + 1),
                },
                {
                  icon: 'trash-outline',
                  label: 'Delete page',
                  destructive: true,
                  hint:
                    document.pages.length === 1
                      ? 'This is the last page, so the document goes too'
                      : undefined,
                  onPress: () =>
                    Alert.alert(
                      `Delete page ${pageIndex + 1}?`,
                      document.pages.length === 1
                        ? 'This is the only page, so the whole document will be deleted.'
                        : 'This cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            if (document.pages.length === 1) router.back();
                            deletePage(document.id, menuPage.id);
                          },
                        },
                      ]
                    ),
                },
              ]
            : []
        }
      />

      <PromptDialog
        visible={renaming}
        title="Rename document"
        initialValue={document.name}
        placeholder="Document name"
        onCancel={() => setRenaming(false)}
        onSubmit={(value) => {
          renameDocument(document.id, value);
          setRenaming(false);
        }}
      />

      <BusyOverlay visible={busy !== null} message={busy ?? ''} />
    </Screen>
  );
}

function BarButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.barButton,
        primary && { backgroundColor: theme.accent, borderRadius: radius.md },
      ]}>
      <Ionicons name={icon} size={20} color={primary ? theme.onAccent : theme.text} />
      <Text style={[font.caption, { color: primary ? theme.onAccent : theme.textMuted }]}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
  column: { gap: space.md },
  tile: { borderRadius: radius.md, padding: space.sm, gap: space.sm },
  thumb: {
    aspectRatio: 0.72,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  tileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barButton: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
});
