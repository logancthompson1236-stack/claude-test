import { COBWEBS, CRACKS, LAYOUT, STAINS } from "../data/layout";
import { Painter, hash } from "./painter";

export const TILE = 16;
/** Extra pixels above row 0 so the back wall can be drawn taller than one tile. */
export const WALL_TOP = 18;
/** Strip of sidewalk drawn below the bottom wall. */
export const OUTSIDE = 20;

const W = LAYOUT[0].length;
const H = LAYOUT.length;

const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? "#" : LAYOUT[y][x]);
const isWall = (x: number, y: number) => at(x, y) === "#" || at(x, y) === "L";
const inOffice = (x: number, y: number) => x >= 1 && x <= 6 && y >= 0 && y <= 4;

/** The whole static backdrop (floor, walls, grime) as one image; its top-left is world (0, -WALL_TOP). */
export function drawBackdrop(): Painter {
  const p = new Painter(W * TILE, H * TILE + WALL_TOP + OUTSIDE);
  const oy = WALL_TOP;

  // Sidewalk outside the entrance
  p.box(0, oy + H * TILE, W * TILE - 1, oy + H * TILE + OUTSIDE - 1, "#a9a49a");
  for (let x = 0; x < W * TILE; x += 24) p.vline(x, oy + H * TILE, oy + H * TILE + OUTSIDE, "#96918a");
  p.hline(0, W * TILE, oy + H * TILE + 12, "#8f8a82");

  // Floor
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isWall(x, y)) continue;
      drawConcrete(p, x * TILE, oy + y * TILE, x, y, inOffice(x, y));
    }

  // Slab seams across the warehouse floor
  for (let x = 8; x < W - 1; x += 5) for (let y = 1; y < H - 1; y++) if (!isWall(x, y)) p.vline(x * TILE, oy + y * TILE, oy + y * TILE + 15, "#7b7366");
  for (let y = 5; y < H - 1; y += 5) for (let x = 1; x < W - 1; x++) if (!isWall(x, y) && !inOffice(x, y)) p.hline(x * TILE, x * TILE + 15, oy + y * TILE, "#7b7366");

  for (const s of STAINS) drawStain(p, s.x * TILE, oy + s.y * TILE, s.x + s.y);
  for (const c of CRACKS) drawCrack(p, c.x * TILE, oy + c.y * TILE, c.x * 7 + c.y);

  // Doormat inside the entrance
  p.box(13 * TILE + 1, oy + 14 * TILE + 3, 15 * TILE - 2, oy + 15 * TILE - 2, "#6b4e36");
  p.box(13 * TILE + 3, oy + 14 * TILE + 5, 15 * TILE - 4, oy + 15 * TILE - 4, "#7d5c40");
  for (let x = 13 * TILE + 6; x < 15 * TILE - 6; x += 3) p.vline(x, oy + 14 * TILE + 7, oy + 15 * TILE - 7, "#6b4e36");

  // Walls
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y)) continue;
      const faceSouth = !isWall(x, y + 1) && y + 1 < H;
      if (y === 0 && faceSouth) drawBackWall(p, x, oy, inOffice(x, 1));
      else if (faceSouth) drawLowWallFace(p, x * TILE, oy + y * TILE, y === 5 && x <= 7);
      else drawWallCap(p, x, y, oy);
    }

  // Doorways
  drawThreshold(p, 13 * TILE, oy + 15 * TILE, 32, true);
  drawThreshold(p, 3 * TILE, oy + 5 * TILE, 32, false);

  // Back wall details
  drawBanner(p, 12 * TILE + 2, oy - 14);
  drawBoardedWindow(p, 21 * TILE, oy - 14);
  drawFuseBox(p, 9 * TILE + 3, oy - 10);
  drawCalendar(p, 4 * TILE + 2, oy - 12);
  drawOfficeSign(p, 5 * TILE + 2, oy + 5 * TILE + 3);
  drawRollUpDoor(p, 27 * TILE, oy + 8 * TILE);

  for (const c of COBWEBS) drawCobweb(p, c.x * TILE, oy + c.y * TILE, c.corner);
  return p;
}

function drawConcrete(p: Painter, px: number, py: number, tx: number, ty: number, office: boolean) {
  const base = office ? "#9b8f7c" : "#8b8273";
  p.box(px, py, px + 15, py + 15, base);
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < 16; i++) {
      const r = hash(tx * 16 + i, ty * 16 + j, 3);
      if (r > 0.93) p.px(px + i, py + j, office ? "#a69a86" : "#958c7d");
      else if (r < 0.05) p.px(px + i, py + j, office ? "#8f8371" : "#7f7769");
    }
  if (office) {
    // Old linoleum tiles in the office
    if ((tx + ty) % 2 === 0) p.box(px, py, px + 15, py + 15, "rgba(255,240,210,0.06)");
    p.hline(px, px + 15, py + 15, "rgba(80,60,40,0.15)");
    p.vline(px + 15, py, py + 15, "rgba(80,60,40,0.15)");
  }
}

function drawStain(p: Painter, px: number, py: number, seed: number) {
  const c = "rgba(70,58,44,0.22)";
  p.ellipse(px + 8, py + 8, 7, 4, c);
  p.ellipse(px + 4 + (seed % 5), py + 10, 4, 3, c);
  p.ellipse(px + 12, py + 5, 3, 2, c);
}

function drawCrack(p: Painter, px: number, py: number, seed: number) {
  let x = px + 2;
  let y = py + 4 + (seed % 6);
  for (let i = 0; i < 14; i++) {
    p.px(x, y, "#5f584d");
    x += 1;
    y += hash(seed, i) > 0.5 ? 1 : hash(seed, i + 20) > 0.6 ? -1 : 0;
    if (i === 6) {
      p.px(x, y + 1, "#5f584d");
      p.px(x, y + 2, "#5f584d");
    }
  }
}

function drawBackWall(p: Painter, x: number, oy: number, office: boolean) {
  const px = x * TILE;
  const top = oy - WALL_TOP;
  const bottom = oy + TILE - 1;
  p.box(px, top, px + 15, top + 3, "#3f3933");
  if (office) {
    // Painted drywall inside the office
    p.box(px, top + 4, px + 15, bottom - 3, "#cbb995");
    p.box(px, bottom - 2, px + 15, bottom, "#8c7a5e");
    if (hash(x, 9) > 0.5) p.px(px + 7, top + 12, "#b8a682");
    return;
  }
  // Corrugated metal above, cinder block below
  const split = top + 18;
  for (let i = 0; i < 16; i++) {
    const c = i % 4 === 0 ? "#66737a" : i % 4 === 1 ? "#7e8b91" : i % 4 === 2 ? "#8a979c" : "#74818a";
    p.vline(px + i, top + 4, split - 1, c);
  }
  if (hash(x, 4) > 0.55) {
    p.box(px + 3, top + 8 + Math.floor(hash(x, 5) * 6), px + 5, top + 10 + Math.floor(hash(x, 5) * 6), "#9a6a45");
  }
  p.box(px, split, px + 15, bottom, "#a39a88");
  for (let yy = split + 4; yy < bottom; yy += 5) p.hline(px, px + 15, yy, "#8b8272");
  for (let yy = split; yy < bottom; yy += 5) {
    const off = ((yy - split) / 5) % 2 === 0 ? 0 : 8;
    p.vline(px + off, yy, Math.min(yy + 4, bottom), "#8b8272");
  }
  p.hline(px, px + 15, bottom, "#6e665a");
}

function drawLowWallFace(p: Painter, px: number, py: number, office: boolean) {
  p.box(px, py, px + 15, py + 3, "#3f3933");
  p.box(px, py + 4, px + 15, py + 15, office ? "#bfae8b" : "#a39a88");
  p.hline(px, px + 15, py + 4, office ? "#d3c4a3" : "#b3aa98");
  p.box(px, py + 13, px + 15, py + 15, office ? "#8c7a5e" : "#7e7666");
}

function drawWallCap(p: Painter, x: number, y: number, oy: number) {
  const px = x * TILE;
  const py = oy + y * TILE;
  p.box(px, py, px + 15, py + 15, "#3f3933");
  // Lighter lip on the sides that face the room
  if (!isWall(x + 1, y) && x + 1 < W) p.vline(px + 15, py, py + 15, "#5e564d");
  if (!isWall(x - 1, y) && x > 0) p.vline(px, py, py + 15, "#5e564d");
  if (!isWall(x, y - 1) && y > 0) p.hline(px, px + 15, py, "#5e564d");
  for (let i = 0; i < 4; i++) p.px(px + Math.floor(hash(x, y + i) * 14) + 1, py + Math.floor(hash(y, x + i) * 14) + 1, "#4a433c");
}

function drawThreshold(p: Painter, px: number, py: number, w: number, main: boolean) {
  if (main) {
    // Metal threshold strip and steel door frame on the bottom wall.
    p.box(px, py + 12, px + w - 1, py + 15, "#8f969b");
    p.hline(px, px + w - 1, py + 12, "#b2b8bc");
    p.box(px - 3, py - 2, px - 1, py + 15, "#5d666b");
    p.box(px + w, py - 2, px + w + 2, py + 15, "#5d666b");
    return;
  }
  // Office doorway: wooden trim on both sides of the opening, worn floor in between.
  p.box(px - 2, py, px - 1, py + 15, "#7a5532");
  p.box(px + w, py, px + w + 1, py + 15, "#7a5532");
  p.vline(px - 2, py, py + 15, "#946a42");
  p.vline(px + w, py, py + 15, "#946a42");
  p.hline(px, px + w - 1, py + 15, "#7b7366");
}

function drawBanner(p: Painter, x: number, y: number) {
  // Hand-painted bedsheet sign hanging from two ropes.
  p.vline(x + 4, y - 2, y + 1, "#6b5a45");
  p.vline(x + 56, y - 2, y + 1, "#6b5a45");
  p.box(x, y + 1, x + 60, y + 14, "#efe8d6");
  p.box(x, y + 13, x + 60, y + 14, "#d6cdb6");
  p.px(x + 60, y + 14, "rgba(0,0,0,0)");
  const r = "#c2412f";
  const G = [
    "01110", //
    "10000",
    "10011",
    "10001",
    "01110",
  ];
  const Y = ["10001", "01010", "00100", "00100", "00100"];
  const M = ["10001", "11011", "10101", "10001", "10001"];
  const drawGlyph = (g: string[], gx: number, gy: number) =>
    g.forEach((row, j) => [...row].forEach((ch, i) => ch === "1" && p.box(gx + i * 2, gy + j * 2, gx + i * 2 + 1, gy + j * 2 + 1, r)));
  drawGlyph(G, x + 13, y + 3);
  drawGlyph(Y, x + 26, y + 2);
  drawGlyph(M, x + 39, y + 3);
  p.px(x + 22, y + 12, r); // drip
  p.px(x + 22, y + 13, r);
}

function drawBoardedWindow(p: Painter, x: number, y: number) {
  p.box(x + 2, y, x + 29, y + 15, "#3a3632");
  p.box(x + 4, y + 2, x + 27, y + 13, "#5a6e78");
  p.box(x + 1, y + 3, x + 30, y + 6, "#9b7650");
  p.hline(x + 1, x + 30, y + 3, "#b08a60");
  p.box(x + 1, y + 9, x + 30, y + 12, "#8c6a46");
  p.hline(x + 1, x + 30, y + 9, "#a37c52");
  for (const nx of [x + 3, x + 28]) {
    p.px(nx, y + 4, "#2a221c");
    p.px(nx, y + 10, "#2a221c");
  }
}

function drawFuseBox(p: Painter, x: number, y: number) {
  p.box(x, y, x + 9, y + 11, "#8d969c");
  p.box(x + 1, y + 1, x + 8, y + 10, "#9fa8ad");
  p.hline(x + 2, x + 7, y + 4, "#6b7379");
  p.box(x + 3, y + 6, x + 6, y + 8, "#e8c547");
  p.px(x + 4, y + 7, "#2a221c");
  p.vline(x + 4, y + 12, y + 20, "#2b2b30");
}

function drawCalendar(p: Painter, x: number, y: number) {
  p.box(x, y, x + 11, y + 14, "#f4f1de");
  p.box(x, y, x + 11, y + 3, "#c2412f");
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) p.px(x + 2 + i * 2, y + 6 + j * 3, "#8a8274");
  p.px(x + 4, y + 9, "#c2412f");
}

function drawOfficeSign(p: Painter, x: number, y: number) {
  p.box(x, y, x + 11, y + 5, "#2f5e8a");
  p.hline(x + 2, x + 9, y + 2, "#e9eef2");
  p.hline(x + 2, x + 6, y + 3, "#e9eef2");
}

function drawRollUpDoor(p: Painter, px: number, py: number) {
  // Seen from above as a hazard-striped slab with a padlock.
  p.box(px, py, px + 15, py + 31, "#5b6166");
  for (let y = 0; y < 32; y += 2) p.hline(px + 2, px + 15, py + y, "#4e5459");
  for (let y = 0; y < 32; y++) p.px(px + 1, py + y, (Math.floor(y / 3) % 2 === 0 ? "#e8c547" : "#2b2b30"));
  p.px(px, py + 14, "#c9ced1");
  p.box(px - 1, py + 15, px + 1, py + 18, "#c9a227");
  p.px(px, py + 14, "#9a9488");
}

function drawCobweb(p: Painter, px: number, py: number, corner: "tl" | "tr") {
  const c = "rgba(240,238,230,0.6)";
  const sx = corner === "tl" ? px : px + 15;
  const dir = corner === "tl" ? 1 : -1;
  const sy = py - 6;
  for (const [dx, dy] of [
    [12, 0],
    [10, 8],
    [5, 12],
    [0, 13],
  ]) p.line(sx, sy, sx + dx * dir, sy + dy, c);
  for (const r of [4, 8, 11]) {
    p.line(sx + r * dir, sy, sx + Math.round(r * 0.8) * dir, sy + Math.round(r * 0.6), c);
    p.line(sx + Math.round(r * 0.8) * dir, sy + Math.round(r * 0.6), sx + Math.round(r * 0.4) * dir, sy + Math.round(r * 0.95), c);
    p.line(sx + Math.round(r * 0.4) * dir, sy + Math.round(r * 0.95), sx, sy + r, c);
  }
  p.px(sx + 6 * dir, sy + 6, "#2a221c");
}

/**
 * Dim, uneven warehouse lighting, multiplied over the world. Smooth gradients, so this one is a plain
 * canvas rather than pixel art. "Fix the lights" will brighten it later.
 */
export function drawLighting(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W * TILE;
  c.height = H * TILE + WALL_TOP + OUTSIDE;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(150,135,120)";
  ctx.fillRect(0, 0, c.width, c.height);
  const lamps = [
    { x: 4 * TILE, y: 3 * TILE, r: 70, c: "rgb(255,236,200)" },
    { x: 12 * TILE, y: 8 * TILE, r: 110, c: "rgb(255,244,220)" },
    { x: 21 * TILE, y: 8 * TILE, r: 100, c: "rgb(250,240,222)" },
    { x: 14 * TILE, y: 14 * TILE, r: 70, c: "rgb(255,240,210)" },
  ];
  for (const l of lamps) {
    const g = ctx.createRadialGradient(l.x, l.y + WALL_TOP, 4, l.x, l.y + WALL_TOP, l.r);
    g.addColorStop(0, l.c);
    g.addColorStop(1, "rgba(255,240,215,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

export const FLICKER_LAMP = { x: 21 * TILE, y: 8 * TILE, r: 100 };
