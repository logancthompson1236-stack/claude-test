import type { Rot } from "../sim/types";
import { Painter, hash } from "./painter";

/**
 * Object sprites. Each sprite covers the footprint (16px per tile) plus `extra` pixels above it for
 * anything that sticks up (consoles, monitors, plants). The sprite's top-left sits at
 * (x * 16, y * 16 - extra) in world pixels.
 */
export interface ObjectArt {
  painter: Painter;
  extra: number;
  /** Parts that must be drawn in front of whoever is using the object (e.g. handlebars). */
  overlay?: Painter;
}

const OUT = "#2a221c";
const C = {
  metal: "#9aa3a8",
  metalLight: "#bfc6ca",
  metalDark: "#5d666b",
  frame: "#6b7279",
  frameLight: "#8a9198",
  frameDark: "#4f555b",
  belt: "#2a2c30",
  beltStripe: "#3c3f45",
  console: "#3a3f46",
  consoleLight: "#566069",
  lcd: "#86d993",
  lcdDark: "#2f5e37",
  rust: "#9a6a45",
  tape: "#d4d0c2",
  red: "#c94a3d",
  redDark: "#8e2f26",
  yellow: "#e8c547",
  black: "#26272b",
  woodLight: "#b5845a",
  wood: "#8c5f3b",
  woodDark: "#6b452a",
  beige: "#d8cfb8",
  beigeDark: "#b5ab92",
  white: "#efeadf",
  teal: "#5f8a86",
  tealDark: "#476b68",
  tealLight: "#77a39e",
};

function finish(p: Painter, shadow?: [number, number, number, number]): Painter {
  p.outline(OUT);
  if (shadow) p.shadow(...shadow);
  return p;
}

// ---------------------------------------------------------------- treadmill

function treadmillVertical(frame: number, consoleTop: boolean): ObjectArt {
  const extra = consoleTop ? 14 : 6;
  const p = new Painter(32, 48 + extra);
  const f = extra; // footprint top
  const phase = frame;
  if (consoleTop) {
    // Deck
    p.box(3, f + 6, 28, f + 43, C.frame);
    p.box(3, f + 6, 4, f + 43, C.frameLight);
    p.box(27, f + 6, 28, f + 43, C.frameDark);
    p.box(7, f + 8, 24, f + 41, C.belt);
    for (let y = f + 8 + ((phase + 40) % 4); y <= f + 41; y += 4) p.hline(7, 24, y, C.beltStripe);
    p.box(5, f + 41, 26, f + 43, C.frameDark);
    // Motor hood
    p.box(3, f + 1, 28, f + 8, "#59606a");
    p.hline(3, 28, f + 1, "#737b84");
    p.hline(9, 22, f + 4, "#474d55");
    p.hline(9, 22, f + 6, "#474d55");
    p.px(6, f + 3, C.rust);
    p.px(7, f + 3, C.rust);
    p.px(25, f + 6, C.rust);
    p.px(5, f + 30, C.rust);
    // Uprights + console
    p.box(5, 6, 7, f + 3, C.metalDark);
    p.box(24, 6, 26, f + 3, C.metalDark);
    p.vline(5, 6, f + 3, C.metal);
    p.vline(24, 6, f + 3, C.metal);
    p.box(1, 9, 2, f + 8, C.metal);
    p.box(29, 9, 30, f + 8, C.metal);
    p.box(2, 0, 29, 9, C.console);
    p.hline(2, 29, 0, C.consoleLight);
    p.box(10, 2, 21, 6, C.lcd);
    p.box(12, 3, 13, 5, C.lcdDark);
    p.px(15, 5, C.lcdDark);
    p.box(17, 3, 18, 5, C.lcdDark);
    p.px(5, 4, C.red);
    p.px(7, 4, C.red);
    p.px(24, 4, C.yellow);
    p.px(26, 4, C.yellow);
    // Duct tape patch
    p.box(20, 7, 27, 9, C.tape);
    p.hline(20, 27, 9, "#b4b0a2");
    return { painter: finish(p, [16, f + 45, 15, 3]), extra };
  }
  // Console at the bottom (customer faces down): we see the back of the console.
  p.box(3, f + 2, 28, f + 40, C.frame);
  p.box(3, f + 2, 4, f + 40, C.frameLight);
  p.box(27, f + 2, 28, f + 40, C.frameDark);
  p.box(7, f + 4, 24, f + 36, C.belt);
  for (let y = f + 4 + ((40 - phase) % 4); y <= f + 36; y += 4) p.hline(7, 24, y, C.beltStripe);
  p.box(5, f + 2, 26, f + 4, C.frameDark);
  p.box(3, f + 36, 28, f + 46, "#59606a");
  p.hline(3, 28, f + 36, "#737b84");
  p.box(5, f + 26, 7, f + 38, C.metalDark);
  p.box(24, f + 26, 26, f + 38, C.metalDark);
  p.box(1, f + 22, 2, f + 34, C.metal);
  p.box(29, f + 22, 30, f + 34, C.metal);
  p.box(2, f + 22, 29, f + 31, C.console);
  p.hline(2, 29, f + 22, C.consoleLight);
  p.hline(8, 23, f + 25, "#2e3238");
  p.hline(8, 23, f + 27, "#2e3238");
  p.box(4, f + 29, 11, f + 31, C.tape);
  p.px(8, f + 15, C.rust);
  return { painter: finish(p, [16, f + 47, 15, 2]), extra };
}

function treadmillSide(frame: number): ObjectArt {
  // Console on the right, customer faces right.
  const extra = 14;
  const p = new Painter(48, 32 + extra);
  const f = extra;
  const phase = frame;
  p.box(1, f + 4, 41, f + 22, C.frame);
  p.hline(1, 41, f + 4, C.frameLight);
  p.box(3, f + 6, 36, f + 19, C.belt);
  for (let x = 3 + ((40 - phase) % 4); x <= 36; x += 4) p.vline(x, f + 6, f + 19, C.beltStripe);
  p.box(1, f + 20, 41, f + 24, C.frameDark);
  p.box(36, f + 3, 45, f + 23, "#59606a");
  p.vline(36, f + 3, f + 23, "#737b84");
  p.px(40, f + 21, C.rust);
  p.px(12, f + 21, C.rust);
  // Uprights and console
  p.box(40, f - 8, 42, f + 6, C.metalDark);
  p.box(40, f + 4, 42, f + 18, C.metalDark);
  p.box(38, 0, 47, f - 3, C.console);
  p.vline(38, 0, f - 3, C.consoleLight);
  p.box(38, 2, 39, 8, C.lcd);
  p.box(42, 2, 45, 4, C.tape);
  // Hand rails along the belt
  p.box(26, f - 5, 39, f - 4, C.metal);
  p.box(30, f + 9, 39, f + 10, C.metal);
  return { painter: finish(p, [24, f + 26, 23, 3]), extra };
}

// ---------------------------------------------------------------- bike
// Crank positions for the 4 pedalling frames, matched to the rider's leg frames
// (frame 0: near foot up, frame 2: near foot down).
const CRANK: [number, number][] = [
  [0, -2],
  [2, 0],
  [0, 2],
  [-2, 0],
];

function bikeUp(frame: number): ObjectArt {
  // Rider faces up (away from us). Flywheel at the front (top), seat at the back (bottom).
  const extra = 10;
  const p = new Painter(16, 32 + extra);
  const f = extra;
  // stabiliser feet
  p.box(1, f + 2, 14, f + 3, C.metalDark);
  p.box(1, f + 27, 14, f + 28, C.metalDark);
  // flywheel housing
  p.box(4, 0, 11, f + 4, "#2f3338");
  p.box(5, 1, 10, 2, "#454b52");
  p.box(4, f, 11, f, C.red);
  // frame spine
  p.box(7, f + 4, 8, f + 26, C.red);
  p.vline(7, f + 4, f + 26, "#d9685a");
  // handlebars stick out either side of the rider's head
  p.box(1, f + 4, 14, f + 5, C.black);
  p.box(1, f + 4, 2, f + 6, "#4a4b50");
  p.box(13, f + 4, 14, f + 6, "#4a4b50");
  // pedals
  const [, dy] = CRANK[frame];
  p.box(3, f + 17 + dy, 5, f + 18 + dy, C.metal);
  p.box(10, f + 17 - dy, 12, f + 18 - dy, C.metal);
  // seat
  p.box(5, f + 17, 10, f + 21, C.black);
  p.hline(6, 9, f + 17, "#4a4b50");
  return { painter: finish(p, [8, f + 28, 7, 2]), extra };
}

function bikeDown(frame: number): ObjectArt {
  // Rider faces down (towards us). Seat at the back (top), handlebars and flywheel in front (bottom).
  const extra = 6;
  const p = new Painter(16, 32 + extra);
  const ov = new Painter(16, 32 + extra);
  const f = extra;
  p.box(1, f + 1, 14, f + 2, C.metalDark);
  p.box(1, f + 28, 14, f + 29, C.metalDark);
  p.box(7, f + 2, 8, f + 22, C.red);
  p.box(5, f + 2, 10, f + 6, C.black);
  p.hline(6, 9, f + 2, "#4a4b50");
  const [, dy] = CRANK[frame];
  p.box(3, f + 12 - dy, 5, f + 13 - dy, C.metal);
  p.box(10, f + 12 + dy, 12, f + 13 + dy, C.metal);
  // flywheel in front, on the floor
  p.box(4, f + 20, 11, f + 28, "#2f3338");
  p.box(4, f + 27, 11, f + 27, C.red);
  // Handlebars and console are in front of the rider.
  ov.box(7, f + 9, 8, f + 19, C.metalDark);
  ov.box(1, f + 8, 14, f + 9, C.black);
  ov.box(1, f + 8, 2, f + 10, "#4a4b50");
  ov.box(13, f + 8, 14, f + 10, "#4a4b50");
  ov.box(5, f + 10, 10, f + 13, C.console);
  ov.box(6, f + 11, 9, f + 12, C.lcd);
  return { painter: finish(p, [8, f + 29, 7, 2]), extra, overlay: finish(ov) };
}

function bikeSide(frame: number): ObjectArt {
  // Rider faces right. Seat on the left, handlebars mid, flywheel at the front (right).
  const extra = 10;
  const p = new Painter(32, 16 + extra);
  const f = extra;
  p.box(2, f + 12, 29, f + 13, C.metalDark);
  // flywheel
  p.ellipse(23.5, f + 6.5, 6, 6, C.red);
  p.ellipse(23.5, f + 6.5, 4, 4, "#2f3338");
  p.px(23, f + 6, C.metal);
  // frame: seat post, down tube to the crank, tube to the handlebar post
  p.box(8, f + 2, 9, f + 12, C.red);
  p.line(9, f + 9, 16, f + 7, C.red);
  p.line(9, f + 10, 16, f + 8, C.red);
  p.line(16, f - 3, 18, f + 10, C.red);
  p.line(17, f - 3, 19, f + 10, C.red);
  p.line(18, f + 6, 22, f + 6, C.red);
  // seat
  p.box(5, f, 12, f + 1, C.black);
  p.hline(6, 11, f, "#4a4b50");
  // handlebars and console
  p.box(13, f - 5, 18, f - 4, C.black);
  p.box(16, f - 9, 20, f - 6, C.console);
  p.box(17, f - 8, 19, f - 7, C.lcd);
  // crank + pedal
  const [cx, cy] = CRANK[frame];
  p.box(12, f + 6, 14, f + 8, C.metalDark);
  p.line(13, f + 7, 13 + cx, f + 7 + cy, C.metal);
  p.box(12 + cx, f + 7 + cy, 14 + cx, f + 7 + cy, C.metal);
  return { painter: finish(p, [16, f + 13, 15, 2]), extra };
}

// ---------------------------------------------------------------- furniture

function waterCooler(): ObjectArt {
  const extra = 14;
  const p = new Painter(16, 16 + extra);
  const f = extra;
  p.box(3, f, 12, f + 13, C.white);
  p.box(11, f, 12, f + 13, "#cfc9bb");
  p.hline(3, 12, f, "#ffffff");
  p.box(5, f + 6, 10, f + 7, "#9aa3a8");
  p.px(6, f + 3, C.red);
  p.px(9, f + 3, "#3a86ff");
  p.box(5, f + 10, 10, f + 10, "#cfc9bb");
  // Jug
  p.box(3, 2, 12, f - 1, "#8ec5e8");
  p.box(4, 1, 11, 1, "#8ec5e8");
  p.clear([3, 2], [12, 2]);
  p.box(4, 3, 5, f - 3, "#c3e3f5");
  p.hline(4, 11, 5, "#6aaed6");
  p.box(6, f - 1, 9, f, "#6aaed6");
  p.px(9, 9, "#7aa9b5");
  p.px(7, 11, "#7aa9b5");
  return { painter: finish(p, [8, f + 14, 6, 2]), extra };
}

function plant(): ObjectArt {
  const extra = 10;
  const p = new Painter(16, 16 + extra);
  const f = extra;
  p.box(4, f + 6, 11, f + 14, "#c46a3c");
  p.box(9, f + 6, 11, f + 14, "#a5552d");
  p.box(3, f + 4, 12, f + 6, "#d98250");
  p.box(4, f + 4, 11, f + 4, "#4a3420");
  const leaves: [number, number, number, number, string][] = [
    [8, f - 1, 5, 4, "#3b7a3a"],
    [5, f + 1, 3, 3, "#4f9a4a"],
    [11, f + 1, 3, 3, "#4f9a4a"],
    [8, f - 4, 3, 4, "#6cbf5a"],
    [4, f - 3, 2, 3, "#6cbf5a"],
    [12, f - 3, 2, 3, "#6cbf5a"],
    [8, 2, 2, 3, "#8fd46f"],
  ];
  for (const [x, y, rx, ry, c] of leaves) p.ellipse(x, y, rx, ry, c);
  return { painter: finish(p, [8, f + 14, 6, 2]), extra };
}

function trashCan(): ObjectArt {
  const extra = 6;
  const p = new Painter(16, 16 + extra);
  const f = extra;
  p.box(4, f - 2, 11, f + 12, "#7d868c");
  p.box(10, f - 2, 11, f + 12, "#646c72");
  for (const x of [6, 8]) p.vline(x, f + 1, f + 11, "#6b7379");
  p.box(3, f - 4, 12, f - 2, "#a7afb4");
  p.box(5, f - 3, 10, f - 3, "#3a3f45");
  return { painter: finish(p, [8, f + 13, 6, 2]), extra };
}

function officeDesk(): ObjectArt {
  const extra = 16;
  const p = new Painter(32, 16 + extra);
  const f = extra;
  p.box(0, f - 4, 31, f + 4, C.woodLight);
  for (let x = 1; x < 31; x++) if (hash(x, 1) > 0.7) p.px(x, f - 2 + Math.floor(hash(x, 2) * 5), "#a67650");
  p.box(0, f + 5, 31, f + 13, C.wood);
  p.box(20, f + 6, 29, f + 12, "#9a6a45");
  p.hline(23, 26, f + 9, C.metalLight);
  p.box(0, f + 5, 31, f + 5, C.woodDark);
  // CRT monitor
  p.box(3, 0, 17, f - 4, C.beige);
  p.box(15, 0, 17, f - 4, C.beigeDark);
  p.box(5, 2, 14, f - 7, "#2f6f7a");
  p.hline(6, 11, 4, "#8fe3e0");
  p.hline(6, 13, 6, "#8fe3e0");
  p.hline(6, 9, 8, "#8fe3e0");
  p.px(12, 8, "#f4d35e");
  p.box(7, f - 4, 13, f - 3, C.beigeDark);
  p.box(5, f - 2, 16, f, "#cfc6ae");
  for (let x = 6; x <= 15; x += 2) p.px(x, f - 1, "#a99f86");
  // Mug + papers
  p.box(22, f - 7, 25, f - 2, "#f0ece4");
  p.px(26, f - 5, "#f0ece4");
  p.px(26, f - 4, "#f0ece4");
  p.hline(23, 24, f - 7, "#5a3a22");
  p.box(27, f - 4, 30, f - 1, "#f7f4ea");
  p.hline(27, 30, f - 3, "#c9c3b2");
  return { painter: finish(p, [16, f + 14, 15, 2]), extra };
}

function officeChair(): ObjectArt {
  const extra = 6;
  const p = new Painter(16, 16 + extra);
  const f = extra;
  p.box(3, f - 2, 12, f + 3, "#4a4f57");
  p.box(3, f + 1, 12, f + 9, "#3d424a");
  p.hline(4, 11, f + 1, "#5b616b");
  p.box(7, f + 10, 8, f + 11, C.metalDark);
  p.hline(3, 12, f + 12, C.metalDark);
  p.px(3, f + 13, C.black);
  p.px(12, f + 13, C.black);
  return { painter: finish(p, [8, f + 13, 6, 2]), extra };
}

function filingCabinet(): ObjectArt {
  const extra = 12;
  const p = new Painter(16, 16 + extra);
  const f = extra;
  p.box(2, 1, 13, f + 13, "#8d969c");
  p.box(12, 1, 13, f + 13, "#747d83");
  p.box(2, 1, 13, 3, "#a7afb4");
  for (const y of [9, 16, 23]) p.hline(2, 11, y, "#6b7379");
  for (const y of [6, 13, 20]) p.hline(6, 8, y, "#c9ced1");
  // Half-open drawer with papers poking out
  p.box(1, 16, 12, 18, "#9aa2a8");
  p.hline(3, 9, 15, "#f2eee4");
  p.px(4, 5, "#7a8389");
  return { painter: finish(p, [8, f + 14, 6, 2]), extra };
}

function storageShelf(): ObjectArt {
  const extra = 18;
  const p = new Painter(48, 16 + extra);
  const f = extra;
  for (const y of [6, 16, 26]) {
    p.box(1, y, 46, y + 2, "#8a9198");
    p.hline(1, 46, y + 2, "#6b7279");
  }
  // Items
  p.box(4, 0, 13, 5, "#b98a55");
  p.box(4, 0, 13, 0, "#d1a26c");
  p.vline(8, 0, 5, "#a07443");
  p.box(16, 2, 20, 5, "#c9ced1");
  p.box(16, 3, 20, 3, C.red);
  p.box(22, 2, 26, 5, "#c9ced1");
  p.box(22, 3, 26, 3, "#3a86ff");
  p.box(38, 2, 43, 5, "#efeadf");
  p.box(38, 4, 41, 4, C.red);
  p.box(5, 10, 18, 15, "#a07443");
  p.box(5, 10, 18, 10, "#c09060");
  p.box(24, 11, 33, 15, "#b98a55");
  p.ellipse(40, 13, 4, 2, C.black);
  p.ellipse(40, 13, 2, 1, "#4a4b50");
  p.box(6, 20, 15, 25, "#b98a55");
  p.box(30, 21, 40, 25, "#8c6a46");
  for (const x of [1, 46]) p.box(x === 1 ? 0 : 45, 0, x === 1 ? 1 : 46, f + 15, "#6d747a");
  return { painter: finish(p, [24, f + 15, 23, 2]), extra };
}

function lockers(): ObjectArt {
  const extra = 18;
  const p = new Painter(48, 16 + extra);
  const f = extra;
  for (let i = 0; i < 3; i++) {
    const x = i * 16;
    p.box(x, 0, x + 15, f + 13, C.teal);
    p.box(x, 0, x + 15, 1, C.tealLight);
    p.vline(x + 15, 0, f + 13, C.tealDark);
    for (const y of [4, 6, 8]) p.hline(x + 4, x + 11, y, C.tealDark);
    p.box(x + 12, 15, x + 12, 18, "#c9ced1");
    p.box(x + 6, 11, x + 9, 12, "#e8e4da");
  }
  // Locker #2 hangs open a crack
  p.box(16, 2, 18, f + 12, "#2b3a39");
  // Rust
  p.px(36, f + 9, C.rust);
  p.px(37, f + 10, C.rust);
  p.px(35, f + 11, C.rust);
  p.px(5, f + 12, C.rust);
  return { painter: finish(p, [24, f + 15, 23, 2]), extra };
}

function checkinDesk(): ObjectArt {
  const extra = 8;
  const p = new Painter(64, 16 + extra);
  const f = extra;
  p.box(0, f - 4, 63, f + 2, C.woodLight);
  p.hline(0, 63, f - 4, "#c99a6c");
  p.box(0, f + 3, 63, f + 14, C.wood);
  p.hline(0, 63, f + 3, C.woodDark);
  for (const x of [10, 21, 42, 53]) p.vline(x, f + 4, f + 14, "#7a5232");
  // "DAY PASS $5" paper taped to the front
  p.box(26, f + 5, 38, f + 12, "#f4f1de");
  p.hline(28, 36, f + 7, "#4a4036");
  p.hline(28, 33, f + 9, "#4a4036");
  p.box(34, f + 9, 36, f + 10, "#2f7d4a");
  p.px(26, f + 5, C.tape);
  p.px(38, f + 5, C.tape);
  // Counter items: bell, clipboard, cash box, "OPEN" sign
  p.box(9, f - 4, 15, f - 3, "#9a7a2a");
  p.ellipse(12, f - 5, 3, 2, C.yellow);
  p.px(12, f - 8, C.yellow);
  p.box(22, 0, 28, f - 2, "#7a5232");
  p.box(23, 1, 27, f - 3, "#f7f4ea");
  p.hline(24, 26, 3, "#9a9488");
  p.hline(24, 26, 5, "#9a9488");
  p.box(44, f - 7, 52, f - 2, "#4d6b4a");
  p.hline(44, 52, f - 7, "#6a8a66");
  p.box(55, 0, 62, f - 3, "#c9a26e");
  p.hline(56, 61, 2, C.red);
  p.hline(56, 61, 3, C.red);
  return { painter: finish(p, [32, f + 15, 31, 2]), extra };
}

// ---------------------------------------------------------------- registry

export const OBJECT_FRAMES: Record<string, number> = { treadmill_used: 4, bike_basic: 4 };

export function drawObject(defId: string, rot: Rot, frame: number): ObjectArt {
  switch (defId) {
    case "treadmill_used":
      if (rot === 0) return treadmillVertical(frame, true);
      if (rot === 2) return treadmillVertical(frame, false);
      return mirrorIf(treadmillSide(frame), rot === 3);
    case "bike_basic":
      if (rot === 0) return bikeUp(frame);
      if (rot === 2) return bikeDown(frame);
      return mirrorIf(bikeSide(frame), rot === 3);
    case "water_cooler":
      return waterCooler();
    case "potted_plant":
      return plant();
    case "trash_can":
      return trashCan();
    case "office_desk":
      return officeDesk();
    case "office_chair":
      return officeChair();
    case "filing_cabinet":
      return filingCabinet();
    case "storage_shelf":
      return storageShelf();
    case "lockers":
      return lockers();
    case "checkin_desk":
      return checkinDesk();
  }
  throw new Error(`No art for ${defId}`);
}

function mirrorIf(a: ObjectArt, m: boolean): ObjectArt {
  return m ? { painter: a.painter.mirrored(), extra: a.extra, overlay: a.overlay?.mirrored() } : a;
}
