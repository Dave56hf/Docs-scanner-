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
};

export type SortKey = 'recent' | 'oldest' | 'name';

export type PageSize = 'fit' | 'a4' | 'letter';
