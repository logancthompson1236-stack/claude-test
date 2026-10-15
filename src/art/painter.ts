/** Tiny pixel-art drawing helper on top of a 2D canvas. All coordinates are whole pixels. */
export class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
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
    for (const [x, y] of pts) this.ctx.clearRect(x, y, 1, 1);
  }

  /**
   * Draw a 1px dark outline around everything opaque in a region. This is what makes small sprites
   * read clearly against the floor.
   */
  outline(c: string, x = 0, y = 0, w = this.w, h = this.h) {
    const img = this.ctx.getImageData(x, y, w, h);
    const d = img.data;
    const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 160;
    const out: [number, number][] = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (d[(j * w + i) * 4 + 3] > 0) continue;
        if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) out.push([i, j]);
      }
    for (const [i, j] of out) this.px(x + i, y + j, c);
  }

  /** Soft drop shadow drawn behind what's already there. */
  shadow(cx: number, cy: number, rx: number, ry: number, alpha = 0.28) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-over";
    this.ellipse(cx, cy, rx, ry, `rgba(20,14,8,${alpha})`);
    this.ctx.restore();
  }

  /** Copy of this canvas mirrored left-to-right. */
  mirrored(): Painter {
    const p = new Painter(this.w, this.h);
    p.ctx.translate(this.w, 0);
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(this.canvas, 0, 0);
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return p;
  }

  draw(src: Painter | HTMLCanvasElement, x: number, y: number) {
    this.ctx.drawImage(src instanceof Painter ? src.canvas : src, x, y);
  }
}

/** Deterministic pseudo-random value in [0,1) for a pixel position, for repeatable texture noise. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
