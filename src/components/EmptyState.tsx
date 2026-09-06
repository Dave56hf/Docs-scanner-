import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={34} color={theme.accent} />
      </View>
      <Text style={[font.title, styles.center, { color: theme.text }]}>{title}</Text>
      <Text style={[font.body, styles.center, { color: theme.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxl * 2,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
