import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Touchable } from './Pressable';
import type { Folder } from '@/lib/types';
import { font, radius, space, useTheme } from '@/theme';

/** `undefined` = every document; `null` = only documents outside any folder. */
export type FolderFilter = string | null | undefined;

export function FolderBar({
  folders,
  counts,
  active,
  onSelect,
  onNewFolder,
  onLongPressFolder,
}: {
  folders: Folder[];
  /** Document count per folder id, plus `__all` and `__none`. */
  counts: Record<string, number>;
  active: FolderFilter;
  onSelect: (filter: FolderFilter) => void;
  onNewFolder: () => void;
  onLongPressFolder: (folder: Folder) => void;
}) {
  const theme = useTheme();

  const chip = (key: string, label: string, filter: FolderFilter, count: number, icon?: 'folder-outline') => {
    const selected =
      (filter === undefined && active === undefined) ||
      (filter === null && active === null) ||
      (typeof filter === 'string' && active === filter);

    return (
      <Touchable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${count} document${count === 1 ? '' : 's'}`}
        accessibilityState={{ selected }}
        onPress={() => onSelect(filter)}
        onLongPress={
          typeof filter === 'string'
            ? () => {
                const folder = folders.find((entry) => entry.id === filter);
                if (folder) onLongPressFolder(folder);
              }
            : undefined
        }
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.accent : theme.surface,
            borderColor: selected ? theme.accent : theme.border,
          },
        ]}>
        {icon && (
          <Ionicons name={icon} size={14} color={selected ? theme.onAccent : theme.textMuted} />
        )}
        <Text style={[font.label, { color: selected ? theme.onAccent : theme.text }]}>{label}</Text>
        <Text style={[font.caption, { color: selected ? theme.onAccent : theme.textFaint }]}>
          {count}
        </Text>
      </Touchable>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {chip('__all', 'All', undefined, counts.__all ?? 0)}
      {counts.__none > 0 && folders.length > 0 && chip('__none', 'Unfiled', null, counts.__none)}
      {folders.map((folder) =>
        chip(folder.id, folder.name, folder.id, counts[folder.id] ?? 0, 'folder-outline')
      )}
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="New folder"
        onPress={onNewFolder}
        style={[styles.chip, styles.add, { borderColor: theme.border }]}>
        <Ionicons name="add" size={16} color={theme.textMuted} />
        <Text style={[font.label, { color: theme.textMuted }]}>Folder</Text>
      </Touchable>
      <View style={styles.tail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  add: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  tail: { width: space.xs },
});
