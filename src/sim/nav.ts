import type { Vec } from "./types";

export type WalkFn = (x: number, y: number) => boolean;

const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * A* over an 8-connected grid (no cutting corners past blocked tiles).
 * Accepts several goal tiles and returns the tiles from the step after `start` up to the reached goal,
 * or null when no goal is reachable. An empty array means `start` is already a goal.
 */
export function findPath(width: number, height: number, walkable: WalkFn, start: Vec, goals: Vec[]): Vec[] | null {
  const goalSet = new Set(goals.filter((g) => walkable(g.x, g.y)).map((g) => g.y * width + g.x));
  if (goalSet.size === 0) return null;
  const startIdx = start.y * width + start.x;
  if (goalSet.has(startIdx)) return [];

  const goalList = [...goalSet].map((i) => ({ x: i % width, y: Math.floor(i / width) }));
  const h = (x: number, y: number) => Math.min(...goalList.map((g) => octile(x, y, g.x, g.y)));

  const g = new Float64Array(width * height).fill(Infinity);
  const came = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  // Small grids: a simple binary heap keeps this fast enough for every customer.
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0][1];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  g[startIdx] = 0;
  push(h(start.x, start.y), startIdx);
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (goalSet.has(cur)) {
      const out: Vec[] = [];
      for (let i = cur; i !== startIdx; i = came[i]) out.push({ x: i % width, y: Math.floor(i / width) });
      return out.reverse();
    }
    const cx = cur % width;
    const cy = Math.floor(cur / width);
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ni = ny * width + nx;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        push(ng + h(nx, ny), ni);
      }
    }
  }
  return null;
}

/** Every tile reachable from `start` (8-connected, no corner cutting). */
export function reachable(width: number, height: number, walkable: WalkFn, start: Vec): Uint8Array {
  const seen = new Uint8Array(width * height);
  if (!walkable(start.x, start.y)) return seen;
  const stack = [start.y * width + start.x];
  seen[stack[0]] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % width;
    const cy = Math.floor(cur / width);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (seen[ni] || !walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

/**
 * Turn a tile path into waypoints (tile centres), skipping corners where a straight walk is clear.
 * The clearance check samples a band around the line so characters don't brush past furniture.
 */
export function smoothPath(from: Vec, tiles: Vec[], walkable: WalkFn): Vec[] {
  const pts = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  if (pts.length <= 1) return pts;
  const clear = (a: Vec, b: Vec) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len * 4);
    const nx = len ? -dy / len : 0;
    const ny = len ? dx / len : 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      for (const o of [-0.32, 0, 0.32]) {
        const x = a.x + dx * t + nx * o;
        const y = a.y + dy * t + ny * o;
        if (!walkable(Math.floor(x), Math.floor(y))) return false;
      }
    }
    return true;
  };
  const out: Vec[] = [];
  let anchor = from;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clear(anchor, pts[j])) j--;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}
