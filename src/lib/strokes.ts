import { Skia, type SkPath } from '@shopify/react-native-skia';

export type Point = { x: number; y: number };

export type Stroke = {
  points: Point[];
  color: string;
  /** Width in the coordinate space the points were captured in. */
  width: number;
};

/** Points closer together than this add nothing but work. */
export const MIN_POINT_DISTANCE = 1.5;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Builds a smoothed path through `points`.
 *
 * Joining raw samples with straight lines makes a signature look faceted, so
 * each segment is a quadratic curve anchored at the midpoint between
 * consecutive samples, with the sample itself as the control point. That is
 * the standard trick for turning finger input into a fluid line.
 */
export function strokeToPath(points: Point[], scale = 1): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  const at = (index: number) => ({
    x: points[index].x * scale,
    y: points[index].y * scale,
  });

  const first = at(0);

  // A tap with no movement still deserves a mark: a degenerate segment plus a
  // round cap renders as a dot.
  if (points.length === 1) {
    path.moveTo(first.x, first.y);
    path.lineTo(first.x, first.y);
    return path;
  }

  path.moveTo(first.x, first.y);

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = at(index);
    const next = at(index + 1);
    path.quadTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  const last = at(points.length - 1);
  path.lineTo(last.x, last.y);
  return path;
}

/** Ink colours offered in the signing screen. */
export const INK_COLORS = ['#111827', '#1D4ED8', '#B91C1C'] as const;

export const PEN_WIDTHS = [2, 4, 7] as const;
