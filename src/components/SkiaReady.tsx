import type { ReactNode } from 'react';

/**
 * Native builds link Skia into the binary, so there is nothing to wait for.
 *
 * The web counterpart lives in `SkiaReady.web.tsx`. Keeping them in separate
 * platform files — rather than branching on `Platform.OS` — is what stops Metro
 * from following the CanvasKit loader into the native bundle, where its Node
 * `fs` dependency cannot resolve.
 */
export function SkiaReady({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
