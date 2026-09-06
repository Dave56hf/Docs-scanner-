import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

/**
 * Runs one async job at a time, exposing a busy message for `BusyOverlay` and
 * surfacing failures as an alert instead of an unhandled rejection.
 */
export function useAsyncTask() {
  const [busy, setBusy] = useState<string | null>(null);
  // A ref, not state: the guard has to be correct before the next render.
  const running = useRef(false);

  const run = useCallback(
    async (message: string, task: () => Promise<void>, errorTitle = 'Something went wrong') => {
      if (running.current) return;
      running.current = true;
      setBusy(message);
      try {
        await task();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        Alert.alert(errorTitle, detail);
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    []
  );

  return { busy, run, isBusy: busy !== null };
}
