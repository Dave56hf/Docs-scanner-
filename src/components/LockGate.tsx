import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

import { Touchable } from './Pressable';
import { authenticate } from '@/lib/lock';
import { useSettings } from '@/store/settings';
import { font, radius, space, useTheme } from '@/theme';

/** Backgrounding for less than this is treated as a glance, not a departure. */
const RELOCK_AFTER_MS = 15_000;

/**
 * Covers the app until the device authenticates. The cover renders instead of
 * the children rather than over them, so scans never appear behind the prompt —
 * including in the OS task switcher.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const enabled = useSettings((state) => state.appLock);
  const hydrated = useSettings((state) => state.hydrated);

  const [unlocked, setUnlocked] = useState(false);
  // A ref, not state: the re-entrancy guard must be correct before the next
  // render, and flipping state here would be a synchronous set inside an effect.
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setUnlocked(true);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) setUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  // Prompt as soon as the setting is known and the app is covered. The only
  // state this writes happens after `authenticate` resolves, so nothing is set
  // synchronously during the effect.
  useEffect(() => {
    if (hydrated && enabled && !unlocked) void unlock();
  }, [hydrated, enabled, unlocked, unlock]);

  if (!hydrated) return <View style={[styles.fill, { backgroundColor: theme.background }]} />;
  if (!enabled || unlocked) return <>{children}</>;

  return (
    <View style={[styles.fill, styles.centre, { backgroundColor: theme.background }]}>
      <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name="lock-closed" size={32} color={theme.accent} />
      </View>
      <Text style={[font.title, { color: theme.text }]}>Scanly is locked</Text>
      <Text style={[font.body, styles.hint, { color: theme.textMuted }]}>
        Your scans stay on this device and behind your screen lock.
      </Text>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="Unlock"
        onPress={unlock}
        style={[styles.button, { backgroundColor: theme.accent }]}>
        <Text style={[font.label, { color: theme.onAccent }]}>Unlock</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  hint: { textAlign: 'center', maxWidth: 300 },
  button: {
    marginTop: space.md,
    paddingHorizontal: space.xxl,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
  },
});
