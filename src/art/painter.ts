/**
 * Tiny pixel-art drawing surface backed by a plain RGBA buffer (no DOM), so the same art code runs in
 * the browser and in the sprite-export tool. All coordinates are whole pixels.
 */
export type RGBA = [number, number, number, number];

const colorCache = new Map<string, RGBA>();

export function parseColor(c: string): RGBA {
  let v = colorCache.get(c);
  if (v) return v;
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1, 7), 16);
    const a = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255;
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) throw new Error(`Bad color: ${c}`);
    const parts = m[1].split(",").map((x) => parseFloat(x));
    v = [parts[0], parts[1], parts[2], Math.round((parts[3] ?? 1) * 255)];
  }
  colorCache.set(c, v);
  return v;
}

export class Painter {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** Blend one pixel over what's there (source-over). */
  private put(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (a >= 255 || d[i + 3] === 0) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
      return;
    }
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  alphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rgbaAt(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    const [r, g, b, a] = parseColor(c);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) this.put(x0 + i, y0 + j, r, g, b, a);
  }

  /** Inclusive-coordinate rectangle: x1..x2, y1..y2. */
  box(x1: number, y1: number, x2: number, y2: number, c: string) {
    this.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1, c);
  }

  px(x: number, y: number, c: string) {
    this.rect(x, y, 1, 1, c);
  }

  hline(x1: number, x2: number, y: number, c: string) {
    this.box(x1, y, x2, y, c);
  }

  vline(x: number, y1: number, y2: number, c: string) {
    this.box(x, y1, x, y2, c);
  }

  /** Filled pixel ellipse. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      this.rect(Math.round(cx - half), y, Math.round(cx + half) - Math.round(cx - half), 1, c);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Clear single pixels (for rounding off corners). */
  clear(...pts: [number, number][]) {
    for (const [x, y] of pts) this.set(x, y, [0, 0, 0, 0]);
  }

  /** Erase everything under an ellipse (used to punch holes, e.g. rings). */
  eraseEllipse(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) this.set(x, y, [0, 0, 0, 0]);
    }
  }

  /**
   * Draw a 1px outline around everything opaque in a region. This is what makes small sprites read
   * clearly against the floor.
   */
  outline(c: string, x = 0, y = 0, w = this.w, h = this.h) {
    const col = parseColor(c);
    const solid = (i: number, j: number) => i >= x && j >= y && i < x + w && j < y + h && this.alphaAt(i, j) > 160;
    const out: [number, number][] = [];
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        if (this.alphaAt(i, j) > 0) continue;
        if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) out.push([i, j]);
      }
    for (const [i, j] of out) this.set(i, j, col);
  }

  /** Soft drop shadow drawn behind what's already there. */
  shadow(cx: number, cy: number, rx: number, ry: number, alpha = 0.28) {
    const s: RGBA = [20, 14, 8, Math.round(alpha * 255)];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const [r, g, b, a] = this.rgbaAt(x, y);
        if (a >= 255) continue;
        // destination-over: existing pixel stays on top of the shadow
        this.set(x, y, s);
        if (a > 0) this.put(x, y, r, g, b, a);
      }
    }
  }

  /** Copy of this surface mirrored left-to-right. */
  mirrored(): Painter {
    const p = new Painter(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.set(this.w - 1 - x, y, this.rgbaAt(x, y));
    return p;
  }

  /** Blend another surface on top at (x, y). */
  draw(src: Painter, x: number, y: number) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const [r, g, b, a] = src.rgbaAt(i, j);
        if (a) this.put(x + i, y + j, r, g, b, a);
      }
  }

  /** Browser only: copy into a canvas for use as a texture. */
  toCanvas(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext("2d")!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}

/** Deterministic pseudo-random value in [0,1) for a pixel position, for repeatable texture noise. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
