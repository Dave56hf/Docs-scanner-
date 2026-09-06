import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Touchable } from './Pressable';
import { font, space, useTheme } from '@/theme';

export function AppBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  /** Omit to hide the back button entirely. */
  onBack?: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      {onBack !== undefined && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onBack}
          style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Touchable>
      )}
      <View style={styles.titles}>
        <Text numberOfLines={1} style={[font.title, { color: theme.text }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} style={[font.caption, { color: theme.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/** Circular icon button sized to sit comfortably in an `AppBar`'s right slot. */
export function AppBarAction({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const theme = useTheme();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={[styles.action, { backgroundColor: theme.surface }]}>
      <Ionicons name={icon} size={20} color={tint ?? theme.text} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  back: { marginLeft: -space.sm },
  titles: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
