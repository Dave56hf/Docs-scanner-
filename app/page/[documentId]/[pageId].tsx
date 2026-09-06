import { Ionicons } from '@expo/vector-icons';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar, AppBarAction } from '@/components/AppBar';
import { BusyOverlay } from '@/components/BusyOverlay';
import { EmptyState } from '@/components/EmptyState';
import { Touchable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { useAsyncTask } from '@/hooks/useAsyncTask';
import { shareImage } from '@/lib/export';
import { FILTERS, FILTER_MATRICES } from '@/lib/filters';
import { writeRendered } from '@/lib/files';
import { renderFromUri } from '@/lib/render';
import type { FilterId, Rotation } from '@/lib/types';
import { useDocuments } from '@/store/documents';
import { font, radius, space, useTheme } from '@/theme';

/** Fits a source rectangle inside a box without cropping. */
function contain(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

export default function PageEditorScreen() {
  const { documentId, pageId } = useLocalSearchParams<{ documentId: string; pageId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const document = useDocuments((state) =>
    state.documents.find((entry) => entry.id === documentId)
  );
  const applyRender = useDocuments((state) => state.applyRender);
  const { busy, run } = useAsyncTask();

  const page = document?.pages.find((entry) => entry.id === pageId);
  const pageNumber = (document?.pages.findIndex((entry) => entry.id === pageId) ?? -1) + 1;

  const [filter, setFilter] = useState<FilterId>(page?.filter ?? 'original');
  const [rotation, setRotation] = useState<Rotation>(page?.rotation ?? 0);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Previewing from the master capture keeps edits non-destructive: switching
  // filters never re-filters an already-filtered image.
  const image = useImage(page?.sourceUri ?? null);

  const preview = useMemo(() => {
    if (!image) return { width: 0, height: 0 };
    const quarterTurn = rotation === 90 || rotation === 270;
    // Fit into the box as it will look *after* rotating, then let the RN
    // transform spin the canvas into place.
    return contain(
      image.width(),
      image.height(),
      quarterTurn ? box.height : box.width,
      quarterTurn ? box.width : box.height
    );
  }, [image, rotation, box]);

  if (!document || !page) {
    return (
      <Screen>
        <AppBar title="Page" onBack={() => router.back()} />
        <EmptyState icon="image-outline" title="Page not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const dirty = filter !== page.filter || rotation !== page.rotation;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width: width - space.lg * 2, height: height - space.lg * 2 });
  };

  const rotate = (delta: 90 | -90) => setRotation(((rotation + delta + 360) % 360) as Rotation);

  const save = () =>
    run('Applying changes…', async () => {
      const revision = page.revision + 1;

      // An unfiltered, unrotated page needs no derived file — point straight at
      // the master and let `applyRender` clean up the previous rendering.
      if (filter === 'original' && rotation === 0) {
        applyRender(document.id, page.id, {
          uri: page.sourceUri,
          filter,
          rotation,
          width: page.width,
          height: page.height,
          revision,
        });
        router.back();
        return;
      }

      const rendered = await renderFromUri(page.sourceUri, filter, rotation);
      const uri = writeRendered(document.id, page.id, revision, rendered.base64);
      applyRender(document.id, page.id, {
        uri,
        filter,
        rotation,
        width: rendered.width,
        height: rendered.height,
        revision,
      });
      router.back();
    });

  return (
    <Screen>
      <AppBar
        title={`Page ${pageNumber}`}
        subtitle={document.name}
        onBack={() => router.back()}
        right={
          <>
            <AppBarAction
              icon="create-outline"
              label="Sign this page"
              onPress={() => router.push(`/sign/${document.id}/${page.id}`)}
            />
            <AppBarAction
              icon="share-outline"
              label="Share this page"
              onPress={() =>
                run('Preparing…', () => shareImage(page.uri, `Share page ${pageNumber}`))
              }
            />
          </>
        }
      />

      <View style={[styles.stage, { backgroundColor: theme.canvas }]} onLayout={onLayout}>
        {image ? (
          // The rotation lives on a plain View, not on the Canvas: a Skia
          // canvas does not reliably apply a transform passed through its own
          // style, which silently leaves the preview upright while the rest of
          // the screen reports it as rotated.
          <View
            style={{
              width: preview.width,
              height: preview.height,
              transform: [{ rotate: `${rotation}deg` }],
            }}>
            <Canvas style={{ width: preview.width, height: preview.height }}>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={preview.width}
                height={preview.height}
                fit="contain">
                <ColorMatrix matrix={FILTER_MATRICES[filter]} />
              </SkiaImage>
            </Canvas>
          </View>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.rotateRow}>
          <IconChip icon="refresh-outline" label="Rotate left" flip onPress={() => rotate(-90)} />
          <Text style={[font.caption, { color: theme.textMuted }]}>{rotation}°</Text>
          <IconChip icon="refresh-outline" label="Rotate right" onPress={() => rotate(90)} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
          {FILTERS.map((entry) => {
            const active = entry.id === filter;
            return (
              <Touchable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(entry.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <Text style={[font.label, { color: active ? theme.onAccent : theme.text }]}>
                  {entry.label}
                </Text>
              </Touchable>
            );
          })}
        </ScrollView>
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingBottom: insets.bottom + space.md,
          },
        ]}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Discard changes"
          disabled={!dirty}
          onPress={() => {
            setFilter(page.filter);
            setRotation(page.rotation);
          }}
          style={styles.footerButton}>
          <Text style={[font.label, { color: dirty ? theme.textMuted : theme.textFaint }]}>
            Reset
          </Text>
        </Touchable>

        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Apply changes"
          disabled={!dirty}
          onPress={save}
          style={[
            styles.footerButton,
            styles.save,
            { backgroundColor: dirty ? theme.accent : theme.border },
          ]}>
          <Text style={[font.label, { color: dirty ? theme.onAccent : theme.textFaint }]}>
            Apply
          </Text>
        </Touchable>
      </View>

      <BusyOverlay visible={busy !== null} message={busy ?? ''} />
    </Screen>
  );
}

function IconChip({
  icon,
  label,
  onPress,
  flip,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Mirrors the glyph so one icon serves both rotation directions. */
  flip?: boolean;
}) {
  const theme = useTheme();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconChip, { backgroundColor: theme.surface }]}>
      <Ionicons name={icon} size={20} color={theme.text} style={flip ? styles.flipped : undefined} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  controls: { gap: space.md, paddingBottom: space.md },
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipped: { transform: [{ scaleX: -1 }] },
  filters: { paddingHorizontal: space.lg, gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  save: { flex: 2 },
});
