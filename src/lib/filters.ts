import type { FilterId } from './types';

/**
 * A Skia colour matrix: 4 rows of 5 values (R, G, B, A, offset), applied to
 * normalised 0-1 channels. Row `i` produces output channel `i`.
 */
export type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Rec. 601 luma weights — what "grayscale" means for a photographed page. */
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

/**
 * Contrast about mid-grey, plus a brightness lift. `out = (in - 0.5) * c + 0.5 + b`,
 * which expands to a scale of `c` and an offset of `0.5 * (1 - c) + b`.
 */
function contrast(c: number, brightness = 0): ColorMatrix {
  const t = 0.5 * (1 - c) + brightness;
  return [
    c, 0, 0, 0, t,
    0, c, 0, 0, t,
    0, 0, c, 0, t,
    0, 0, 0, 1, 0,
  ];
}

/** `s = 0` is fully desaturated, `1` leaves colour untouched, `> 1` boosts it. */
function saturation(s: number): ColorMatrix {
  const ir = (1 - s) * LUMA_R;
  const ig = (1 - s) * LUMA_G;
  const ib = (1 - s) * LUMA_B;
  return [
    ir + s, ig, ib, 0, 0,
    ir, ig + s, ib, 0, 0,
    ir, ig, ib + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Collapses every channel to luma, then applies a hard S-curve around `threshold`. */
function threshold(steepness: number, cut: number): ColorMatrix {
  const offset = 0.5 - cut * steepness;
  const r = LUMA_R * steepness;
  const g = LUMA_G * steepness;
  const b = LUMA_B * steepness;
  return [
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Multiplies two colour matrices so `b` runs after `a`, keeping the implied
 * fifth row of `[0 0 0 0 1]` that makes the offset column work.
 */
function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      let sum = col === 4 ? b[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k += 1) {
        sum += b[row * 5 + k] * a[k * 5 + col];
      }
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

export const FILTER_MATRICES: Record<FilterId, ColorMatrix> = {
  original: IDENTITY,
  // Lifts the paper towards white and deepens the ink without going monochrome.
  enhance: compose(saturation(1.15), contrast(1.45, 0.06)),
  grayscale: threshold(1, 0.5),
  // Steep enough to read as bilevel, but the ramp is deliberately not vertical:
  // a softer curve anti-aliases text edges and stops a dimly-lit page from
  // collapsing to solid black the moment its paper falls under the cut.
  blackwhite: threshold(10, 0.55),
  invert: [
    -1, 0, 0, 0, 1,
    0, -1, 0, 0, 1,
    0, 0, -1, 0, 1,
    0, 0, 0, 1, 0,
  ],
};

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'enhance', label: 'Enhance' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'blackwhite', label: 'B & W' },
  { id: 'invert', label: 'Invert' },
];

export function filterLabel(id: FilterId): string {
  return FILTERS.find((filter) => filter.id === id)?.label ?? 'Original';
}
