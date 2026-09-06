import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/AppBar';
import { BusyOverlay } from '@/components/BusyOverlay';
import { EmptyState } from '@/components/EmptyState';
import { Touchable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { useAsyncTask } from '@/hooks/useAsyncTask';
import { renderAnnotated } from '@/lib/annotate';
import { writeMaster } from '@/lib/files';
import {
  distance,
  INK_COLORS,
  MIN_POINT_DISTANCE,
  PEN_WIDTHS,
  strokeToPath,
  type Point,
  type Stroke,
} from '@/lib/strokes';
import { useDocuments } from '@/store/documents';
import { font, radius, space, useTheme } from '@/theme';

export default function SignScreen() {
  const { documentId, pageId } = useLocalSearchParams<{ documentId: string; pageId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const document = useDocuments((state) =>
    state.documents.find((entry) => entry.id === documentId)
  );
  const applySignature = useDocuments((state) => state.applySignature);
  const { busy, run } = useAsyncTask();

  const page = document?.pages.find((entry) => entry.id === pageId);
  const pageNumber = (document?.pages.findIndex((entry) => entry.id === pageId) ?? -1) + 1;

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [active, setActive] = useState<Point[]>([]);
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [width, setWidth] = useState<number>(PEN_WIDTHS[1]);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Held in a ref as well as state: the responder callbacks fire faster than
  // React re-renders, and each one needs the previous point, not a stale render's.
  const current = useRef<Point[]>([]);

  // Window position of the drawing surface, used to convert page coordinates
  // when the responder event does not carry view-relative ones.
  const surface = useRef<View | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const measure = useCallback(() => {
    surface.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }, []);

  // The page is displayed at its natural aspect, letterboxed inside the stage.
  const display = useMemo(() => {
    if (!page || box.width <= 0 || box.height <= 0) return { width: 0, height: 0 };
    const scale = Math.min(box.width / page.width, box.height / page.height);
    return { width: page.width * scale, height: page.height * scale };
  }, [page, box]);

  if (!document || !page) {
    return (
      <Screen>
        <AppBar title="Sign" onBack={() => router.back()} />
        <EmptyState icon="create-outline" title="Page not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const addPoint = (event: GestureResponderEvent) => {
    const { locationX, locationY, pageX, pageY } = event.nativeEvent;
    // `locationX`/`locationY` are view-relative and are what React Native
    // provides, but they are not populated on every platform. Falling back to
    // page coordinates minus the surface origin keeps a stroke from silently
    // landing at NaN and drawing nothing.
    const point = Number.isFinite(locationX) && Number.isFinite(locationY)
      ? { x: locationX, y: locationY }
      : { x: pageX - origin.current.x, y: pageY - origin.current.y };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const points = current.current;
    const last = points[points.length - 1];
    if (last && distance(last, point) < MIN_POINT_DISTANCE) return;
    points.push(point);
    setActive([...points]);
  };

  const endStroke = () => {
    // Read the ref out *before* queueing the update. React runs the updater
    // later, and by then the ref has already been reset — capturing it inside
    // the closure stores every stroke with an empty point list, which reads as
    // "there is ink" while drawing nothing.
    const points = current.current;
    current.current = [];
    setActive([]);
    if (points.length > 0) {
      setStrokes((previous) => [...previous, { points, color, width }]);
    }
  };

  const undo = () => setStrokes((previous) => previous.slice(0, -1));

  const apply = () =>
    run('Signing…', async () => {
      const revision = page.revision + 1;
      const rendered = await renderAnnotated(page.uri, strokes, display.width);
      const uri = writeMaster(document.id, page.id, revision, rendered.base64);
      applySignature(document.id, page.id, {
        uri,
        width: rendered.width,
        height: rendered.height,
        revision,
      });
      router.back();
    });

  const hasInk = strokes.length > 0;

  return (
    <Screen>
      <AppBar title={`Sign page ${pageNumber}`} subtitle={document.name} onBack={() => router.back()} />

      <View
        style={[styles.stage, { backgroundColor: theme.canvas }]}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setBox({ width: w - space.lg * 2, height: h - space.lg * 2 });
        }}>
        {display.width > 0 && (
          <View
            ref={surface}
            onLayout={measure}
            style={{ width: display.width, height: display.height }}>
            <Image source={{ uri: page.uri }} style={styles.fill} contentFit="contain" />

            {/*
              * Concrete numbers, not a style array: a Skia canvas needs real
              * dimensions, and passing it an array of styles breaks it on web.
              */}
            <Canvas
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: display.width,
                height: display.height,
              }}>
              {strokes.map((stroke, index) => (
                <Path
                  key={index}
                  path={strokeToPath(stroke.points)}
                  color={stroke.color}
                  style="stroke"
                  strokeWidth={stroke.width}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ))}
              {active.length > 0 && (
                <Path
                  path={strokeToPath(active)}
                  color={color}
                  style="stroke"
                  strokeWidth={width}
                  strokeCap="round"
                  strokeJoin="round"
                />
              )}
            </Canvas>

            {/* Sits above the canvas purely to receive touches. */}
            <View
              style={[styles.fill, styles.overlay]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={addPoint}
              onResponderMove={addPoint}
              onResponderRelease={endStroke}
              onResponderTerminate={endStroke}
            />
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.row}>
          {INK_COLORS.map((ink) => (
            <Touchable
              key={ink}
              accessibilityRole="button"
              accessibilityLabel={`Ink colour ${ink}`}
              accessibilityState={{ selected: ink === color }}
              onPress={() => setColor(ink)}
              style={[
                styles.swatch,
                { backgroundColor: ink, borderColor: ink === color ? theme.accent : 'transparent' },
              ]}
            />
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {PEN_WIDTHS.map((pen) => (
            <Touchable
              key={pen}
              accessibilityRole="button"
              accessibilityLabel={`Pen width ${pen}`}
              accessibilityState={{ selected: pen === width }}
              onPress={() => setWidth(pen)}
              style={[
                styles.penButton,
                { borderColor: pen === width ? theme.accent : 'transparent' },
              ]}>
              <View
                style={{
                  width: pen * 2.4,
                  height: pen * 2.4,
                  borderRadius: pen * 1.2,
                  backgroundColor: theme.text,
                }}
              />
            </Touchable>
          ))}

          <View style={styles.spacer} />

          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Undo last stroke"
            disabled={!hasInk}
            onPress={undo}
            style={styles.penButton}>
            <Ionicons
              name="arrow-undo-outline"
              size={20}
              color={hasInk ? theme.text : theme.textFaint}
            />
          </Touchable>
        </View>

        <Text style={[font.caption, styles.note, { color: theme.textFaint }]}>
          Draw anywhere on the page. Applying flattens your signature and the current look into the
          page, so it cannot be filtered off afterwards.
        </Text>
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
          accessibilityLabel="Clear all strokes"
          disabled={!hasInk}
          onPress={() => setStrokes([])}
          style={styles.footerButton}>
          <Text style={[font.label, { color: hasInk ? theme.textMuted : theme.textFaint }]}>
            Clear
          </Text>
        </Touchable>

        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Apply signature"
          disabled={!hasInk}
          onPress={apply}
          style={[
            styles.footerButton,
            styles.save,
            { backgroundColor: hasInk ? theme.accent : theme.border },
          ]}>
          <Text style={[font.label, { color: hasInk ? theme.onAccent : theme.textFaint }]}>
            Apply
          </Text>
        </Touchable>
      </View>

      <BusyOverlay visible={busy !== null} message={busy ?? ''} />
    </Screen>
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
  fill: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0 },
  controls: { gap: space.sm, paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: space.xs },
  penButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  note: { paddingHorizontal: space.lg, lineHeight: 17 },
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
