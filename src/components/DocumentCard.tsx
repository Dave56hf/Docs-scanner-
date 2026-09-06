import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Touchable } from './Pressable';
import type { ScanDocument } from '@/lib/types';
import { font, radius, space, useTheme } from '@/theme';

function relativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DocumentCard({
  document,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onMore,
}: {
  document: ScanDocument;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMore: () => void;
}) {
  const theme = useTheme();
  const cover = document.pages[0]?.uri;
  const pageCount = document.pages.length;

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${document.name}, ${pageCount} page${pageCount === 1 ? '' : 's'}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={[
        styles.root,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.accent : 'transparent',
        },
      ]}>
      <View style={[styles.thumb, { backgroundColor: theme.canvas }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} contentFit="cover" transition={120} />
        ) : (
          <Ionicons name="document-outline" size={22} color={theme.textFaint} />
        )}
        {pageCount > 1 && (
          <View style={[styles.count, { backgroundColor: theme.overlay }]}>
            <Text style={[font.caption, { color: '#FFFFFF' }]}>{pageCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text numberOfLines={2} style={[font.heading, { color: theme.text }]}>
          {document.name}
        </Text>
        <Text style={[font.caption, { color: theme.textMuted }]}>
          {pageCount} page{pageCount === 1 ? '' : 's'} · {relativeDate(document.updatedAt)}
        </Text>
      </View>

      {selectionMode ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? theme.accent : theme.textFaint}
        />
      ) : (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${document.name}`}
          hitSlop={10}
          onPress={onMore}
          style={styles.more}>
          <Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} />
        </Touchable>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  thumb: {
    width: 54,
    height: 70,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  count: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  meta: { flex: 1, gap: 3 },
  more: { padding: space.xs },
});
