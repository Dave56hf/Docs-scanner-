import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { font, radius, space, useTheme } from '@/theme';

/** Blocks interaction while a render, export or import is in flight. */
export function BusyOverlay({ visible, message }: { visible: boolean; message: string }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: theme.overlay }]}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[font.body, { color: theme.text }]}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
  },
});
