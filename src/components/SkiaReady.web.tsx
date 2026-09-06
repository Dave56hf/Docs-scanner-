import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * On web, Skia is a WebAssembly module that has to be fetched and instantiated
 * before anything mounts a `<Canvas>`. This gate holds the tree until CanvasKit
 * is live, so the page editor and signing screens render in a browser instead
 * of throwing.
 */
export function SkiaReady({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import('@shopify/react-native-skia/lib/module/web')
      // CanvasKit resolves its .wasm relative to the current URL by default,
      // which 404s on any nested route such as /sign/<doc>/<page>. Pin it to
      // the site root so the loader works from wherever the app is opened.
      .then(({ LoadSkiaWeb }) => LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }))
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Better a preview without the canvas screens than a blank app.
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <View style={[styles.fill, { backgroundColor: theme.background }]} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
