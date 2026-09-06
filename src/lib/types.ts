/** The colour treatments a page can be rendered with. */
export type FilterId = 'original' | 'enhance' | 'grayscale' | 'blackwhite' | 'invert';

export type Rotation = 0 | 90 | 180 | 270;

export type Page = {
  id: string;
  /**
   * The untouched capture, owned by the app. Every edit re-renders from this,
   * so filters and rotations never compound or degrade the image.
   */
  sourceUri: string;
  /**
   * What the app displays and exports. Equal to `sourceUri` while the page is
   * unedited; otherwise a rendered file whose name carries `revision`.
   */
  uri: string;
  width: number;
  height: number;
  filter: FilterId;
  rotation: Rotation;
  /** Bumped on every re-render so the new file gets a URI the image cache hasn't seen. */
  revision: number;
  /**
   * Cached OCR output for this page. `undefined` means "never scanned";
   * an empty string means "scanned, and there was no text".
   */
  text?: string;
};

export type ScanDocument = {
  id: string;
  name: string;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
  /** Undefined means the document sits at the top level, outside any folder. */
  folderId?: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
};

export type SortKey = 'recent' | 'oldest' | 'name';

export type PageSize = 'fit' | 'a4' | 'letter';

/**
 * Export presets. Scanned pages are photographs, so the difference between
 * these is mostly resolution and JPEG quality — which is what decides whether
 * a ten-page scan fits in an email.
 */
export type PdfQuality = 'small' | 'balanced' | 'high';

export const PDF_QUALITY: Record<
  PdfQuality,
  { label: string; hint: string; maxEdge: number; quality: number }
> = {
  small: { label: 'Small', hint: 'Best for email — lowest quality', maxEdge: 1240, quality: 55 },
  balanced: { label: 'Balanced', hint: 'Readable text at a sane size', maxEdge: 1800, quality: 75 },
  high: { label: 'High', hint: 'Full detail — largest files', maxEdge: 2400, quality: 92 },
};
