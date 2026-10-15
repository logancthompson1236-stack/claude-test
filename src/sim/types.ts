export type Dir = "up" | "right" | "down" | "left";
/** Quarter turns clockwise from the definition's authored orientation. */
export type Rot = 0 | 1 | 2 | 3;
export interface Vec {
  x: number;
  y: number;
}

export const DIRS: Dir[] = ["up", "right", "down", "left"];

export function rotateDir(d: Dir, rot: Rot): Dir {
  return DIRS[(DIRS.indexOf(d) + rot) % 4];
}

export function dirFromDelta(dx: number, dy: number, fallback: Dir): Dir {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export const key = (x: number, y: number) => `${x},${y}`;
