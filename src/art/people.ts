import { Painter, parseColor, type RGBA } from "./painter";

/**
 * Hand-drawn character sprites, 16x32 per frame.
 *
 * Bodies are built from small pixel-art parts (head, torso, arms, legs, hair) drawn with colour
 * *slots* rather than real colours, so one set of drawings serves every customer: skin tone, hair,
 * outfit and shoes are filled in per person. Each animation frame poses the parts (which leg is
 * forward, how far the body has dipped), and a finishing pass adds the dark outline.
 *
 * Slot letters used in the drawings:
 *   S s   skin / skin shade          E   eyes & facial lines       R  blush
 *   T t   top / top shade            U u sleeve (top colour, or skin for tank tops)
 *   B b   bottoms / shade            L l lower leg (bottoms, or skin for shorts)
 *   F f   shoes / soles              H h i  hair / shade / highlight
 *   C c   cap / brim                 K   white (card, paper cup)
 */

export const CW = 16;
export const CH = 32;
/** Where the feet touch the ground inside a frame. */
export const FEET_Y = 29;

export type Facing = "down" | "up" | "left" | "right";
export const FACINGS: Facing[] = ["down", "up", "left", "right"];

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  tank: boolean;
  bottom: string;
  shorts: boolean;
  shoes: string;
  cap?: string;
  plaid?: string;
}

export type HairStyle = "short" | "long" | "ponytail" | "bun" | "buzz" | "curly" | "cap";

// ---------------------------------------------------------------------------------------------
// Parts. Each part is a little drawing plus where its top-left sits in the frame when standing.

interface Part {
  at: [number, number];
  rows: string[];
}

const P = (x: number, y: number, ...rows: string[]): Part => ({ at: [x, y], rows });

// ----- facing down (towards the camera) -----
const HEAD_DOWN = P(3, 4,
  "..SSSSSS..",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  "sSSESSESSs",
  "sSSESSESSs",
  ".SRSSSSRS.",
  ".sSSSSSSs.",
  "..ssssss..",
);
const HEAD_DOWN_BLINK = P(3, 4,
  "..SSSSSS..",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  "sSSSSSSSSs",
  "sSEESSEESs",
  ".SRSSSSRS.",
  ".sSSSSSSs.",
  "..ssssss..",
);
const TORSO_DOWN = P(5, 13,
  "..ss..",
  "TTssTT",
  "TTTTTt",
  "TTTTTt",
  "TTTTTt",
  "TTTTTt",
  "tttttt",
  "BBBBBb",
  "BBBbBb",
);

// Arms are drawn for the left side of the screen and mirrored for the right.
const ARM_DOWN: Record<string, Part> = {
  down: P(3, 14, "UU", "Uu", "SS", "Ss", "SS", "Ss", "SS"),
  fwd: P(3, 14, "UU", "Uu", "SS", "Ss", "SS", "Ss", "SS", ".S"),
  back: P(3, 14, "UU", "Uu", "SS", "Ss", "SS", "Ss"),
  pumpFwd: P(3, 14, "UU", "Uu", "SS", ".SS", "..S"),
  pumpBack: P(3, 13, ".U", "UU", "Uu", "SS", "Ss"),
  hold: P(3, 14, "UU", "Uu", ".SS", "..SS"),
};

// Legs: left side of the screen, mirrored for the right.
const LEG_DOWN: Record<string, Part> = {
  stand: P(5, 22, "BBB", "BBb", "LLL", "LLl", "LLl", "FFF", "FFF", "fff"),
  fwd: P(5, 22, "BBB", "BBb", "LLL", "LLl", "LLl", "LLl", "FFF", "FFF", "fff"),
  back: P(5, 22, "BBB", "BBb", "LLL", "LLl", "FFF", "FFF", "fff"),
  lift: P(5, 22, "BBB", "BBb", "LLl", "FFF", "FFF", "fff"),
  knee: P(5, 21, "BBB", "BBB", "BBb", "FFF", "fff"),
  sitUp: P(5, 22, "BBB", "BBB", "FFF", "fff"),
  sitMid: P(5, 22, "BBB", "BBb", "LLl", "FFF", "fff"),
  sitDown: P(5, 22, "BBB", "BBb", "LLL", "LLl", "FFF", "fff"),
};

// ----- facing up (away from the camera) -----
const HEAD_UP = P(3, 4,
  "..SSSSSS..",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  "sSSSSSSSSs",
  "sSSSSSSSSs",
  ".SSSSSSSS.",
  ".sSSSSSSs.",
  "..ssssss..",
);
const TORSO_UP = P(5, 13,
  "..ss..",
  "TTTTTT",
  "TTTTTt",
  "TTtTTt",
  "TTtTTt",
  "TTTTTt",
  "tttttt",
  "BBBBBb",
  "BBbBBb",
);
const ARM_UP: Record<string, Part> = {
  ...ARM_DOWN,
  // Reaching forward/up over the counter or to the water cooler (seen from behind).
  reach: P(3, 11, ".S", ".S", "UU", "Uu"),
  raise: P(3, 12, "S.", "SS", "UU", "Uu", ".s"),
  hold: P(3, 13, ".S", "UU", "Uu", "Ss"),
  type1: P(3, 13, ".S", "UU", "Uu", "Ss"),
  type2: P(3, 14, "UU", "Uu", "Ss", ".S"),
};
const LEG_UP: Record<string, Part> = {
  stand: P(5, 22, "BBB", "BBb", "LLL", "LLl", "LLl", "FFF", "fff", "fff"),
  fwd: P(5, 22, "BBB", "BBb", "LLL", "LLl", "LLl", "LLl", "FFF", "fff", "fff"),
  back: P(5, 22, "BBB", "BBb", "LLL", "LLl", "FFF", "fff", "fff"),
  lift: P(5, 22, "BBB", "BBb", "LLl", "FFF", "fff", "fff"),
  knee: P(5, 22, "BBB", "BBb", "fff", "FFF"),
  sitUp: P(5, 22, "BBB", "BBb", "ff."),
  sitMid: P(5, 22, "BBB", "BBb", "LLl", "ff."),
  sitDown: P(5, 22, "BBB", "BBb", "LLl", "LLl", "fff"),
};

// ----- facing right (left is the mirror image) -----
const HEAD_SIDE = P(3, 4,
  "..SSSSSS..",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  ".SSSSSSSSS",
  ".SssSSSESS",
  ".SssSSSESS",
  ".SSSSSSSRS",
  ".sSSSSSSSs",
  "..sssssss.",
);
const HEAD_SIDE_BLINK = P(3, 4,
  "..SSSSSS..",
  ".SSSSSSSS.",
  ".SSSSSSSS.",
  ".SSSSSSSSS",
  ".SssSSSSSS",
  ".SssSSEESS",
  ".SSSSSSSRS",
  ".sSSSSSSSs",
  "..sssssss.",
);
const TORSO_SIDE = P(5, 13,
  "..ss..",
  "TTTTTT",
  "tTTTTT",
  "tTTTTT",
  "tTTTTT",
  "tTTTTT",
  "tttttt",
  "BBBBBB",
  "bBBBBb",
);
const ARM_SIDE: Record<string, Part> = {
  down: P(7, 14, "UU", "Uu", "SS", "Ss", "SS", "Ss", "SS"),
  fwd: P(7, 14, "UU.", "Uu.", ".SS", ".Ss", ".SS", "..S"),
  back: P(5, 14, ".UU", ".Uu", "SS.", "Ss.", "SS.", "S.."),
  pumpFwd: P(7, 14, "UU..", "Uu..", ".SSS", "...S"),
  pumpBack: P(4, 14, "..UU", ".uUu", "SS..", "S..."),
  hold: P(7, 14, "UU...", "UuSSS", "....S"),
};
const LEG_SIDE: Record<string, Part> = {
  stand: P(6, 22, "BBB..", "BBb..", "LLL..", "LLl..", "LLl..", "FFFF.", "FFFFF", "fffff"),
  fwd: P(6, 22, "BBB...", ".BBb..", "..LLl.", "..LLl.", "...LLl", "...FFFF", "...FFFFF", "...fffff"),
  back: P(2, 22, "...BBB", "..BBb.", ".LLl..", "LLl...", "Ll....", ".FFF..", "FFFF..", "fff..."),
  lift: P(4, 22, "..BBB", ".BBb.", ".LLl.", "LLl..", "FFFF.", "ffff."),
  pass: P(6, 22, "BBB..", ".BBb.", ".LLl.", "LLl..", "FFFF.", "ffff."),
  runFwd: P(6, 21, "BBBB...", ".BBBb..", "....LLl", "....LLl", "...FFFF", "...ffff"),
  runBack: P(1, 22, "....BBB", "..BBBb.", "LLLl...", "FFl....", "ff....."),
  sitUp: P(6, 21, "BBBBb..", ".....Ll", ".....Ll", "....FFF", "....fff"),
  sitMid: P(6, 21, "BBBBb..", "....LLl", ".....Ll", ".....FFF", ".....fff"),
  sitDown: P(6, 21, "BBBBb...", "....LLl.", ".....LLl", "......Ll", "......FFF", "......fff"),
};

// ----- hair (drawn over the head; origin is the frame) -----
type HairSet = { down: Part; up: Part; side: Part; back?: Part };
const HAIR: Record<HairStyle, HairSet> = {
  short: {
    down: P(3, 3, "...HHHH...", ".HHHHiiHH.", "HHHHHHHHHH", "HHhHHHHhHH", "Hh......hH", "h........h"),
    up: P(3, 3, "...HHHH...", ".HHHHHHHH.", "HHHHiiHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HhHHHHHHhH", ".hhHHHHhh."),
    side: P(3, 3, "..HHHHH...", ".HHHHiiHH.", "HHHHHHHHHH", "HHHHHHHh..", "HHHh......", "HHh.......", ".h........"),
  },
  long: {
    down: P(2, 3, "....HHHH....", "..HHHHiiHH..", ".HHHHHHHHHH.", ".HHhHHHHhHH.", "HHh......hHH", "HH........HH", "HH........HH", "Hh........hH", "Hh........hH", "h..........h", "h..........h"),
    up: P(3, 3, "...HHHH...", ".HHHHHHHH.", "HHHHiiHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HhHHHHHHhH", "HhhHHHHhhH", ".hhhhhhhh."),
    side: P(2, 3, "...HHHHH...", "..HHHHiiHH.", ".HHHHHHHHHH", ".HHHHHHHh..", "HHHHh......", "HHHh.......", "HHHh.......", "HHhh.......", "HHh........", "Hhh........", ".h........."),
  },
  ponytail: {
    down: P(3, 3, "...HHHH...", ".HHHHiiHH.", "HHHHHHHHHH", "HhHHHHHHhH", "Hh......hH", "h........h"),
    up: P(3, 3, "...HHHH...", ".HHHHHHHH.", "HHHHiiHHHH", "HHHHHHHHHH", "HHHHhhHHHH", "HhHHHHHHhH", ".hhHHHHhh.", "....HH....", "....Hh....", "....hh...."),
    side: P(0, 3, ".....HHHHH...", "....HHHHiiHH.", "...HHHHHHHHHH", "HHHHHHHHHh...", "HHhHHHh......", ".hh.Hh.......", "....h........"),
  },
  bun: {
    down: P(3, 0, "...HHHH...", "..HiiHHH..", "..hHHHHh..", "...HHHH...", ".HHHHiiHH.", "HHHHHHHHHH", "HHhHHHHhHH", "Hh......hH", "h........h"),
    up: P(3, 0, "...HHHH...", "..HiiHHH..", "..hHHHHh..", "...hhhh...", ".HHHHHHHH.", "HHHHiiHHHH", "HHHHHHHHHH", "HHHHHHHHHH", "HhHHHHHHhH", ".hhHHHHhh."),
    side: P(1, 0, "..HHHH......", ".HiiHHH.....", ".hHHHHh.....", "..hHHHHHH...", "..HHHHHiiHH.", ".HHHHHHHHHHH", ".HHHHHHHHh..", ".HHHh.......", ".HHh........", "..h........."),
  },
  buzz: {
    down: P(3, 4, "..hhhhhh..", ".hhhhhhhh.", ".h......h."),
    up: P(3, 4, "..hhhhhh..", ".hhhhhhhh.", ".hhhhhhhh.", ".hhhhhhhh.", ".h......h."),
    side: P(3, 4, "..hhhhhh..", ".hhhhhhhh.", ".hhhhhh...", ".hhh......"),
  },
  curly: {
    down: P(2, 2, "...H.HH.H...", "..HHHHHHHH..", ".HHHiHHiHHH.", "HHHHHHHHHHHH", "HHhHHhhHHhHH", "HHh......hHH", "Hh........hH", "h..........h"),
    up: P(2, 2, "...H.HH.H...", "..HHHHHHHH..", ".HHHiHHiHHH.", "HHHHHHHHHHHH", "HHHHHHHHHHHH", "HHHHHHHHHHHH", "HHhHHHHHHhHH", "HHHHHHHHHHHH", ".hhhHhhHhhh."),
    side: P(2, 2, "...H.HH.H...", "..HHHHHHHH..", ".HHHiHHiHHH.", "HHHHHHHHHHH.", "HHHHHHHhh...", "HHHHh.......", "HHhh........", ".hh........."),
  },
  cap: {
    down: P(2, 2, "...CCCCCC...", "..CCCCKKCC..", "..CCCCCCCC..", ".cccccccccc.", ".HH......HH.", ".h........h."),
    up: P(3, 2, "..CCCCCC..", ".CCCCCCCC.", ".CCCKKCCC.", ".CCCCCCCC.", "HHHHHHHHHH", "HHHHHHHHHH", "HhHHHHHHhH", ".hhHHHHhh."),
    side: P(2, 2, "...CCCCC....", "..CCCCKKC...", "..CCCCCCC...", "..CCCCCCcccc", ".HHHHH......", ".HHHh.......", ".HHh........", "..h........."),
  },
};

// ---------------------------------------------------------------------------------------------
// Animations: each frame says how the parts are posed.

interface Pose {
  /** How far the upper body (torso, arms, head) sits below standing height. */
  bob: number;
  /** Extra head offset (looking down, head tilted back to drink). */
  head?: number;
  legL: string;
  legR: string;
  armL: string;
  armR: string;
  blink?: boolean;
  /** Seated poses lower the hips too. */
  seat?: number;
  /** Small prop in a hand: a membership card or a paper cup. */
  prop?: "card" | "cup";
}

const pose = (bob: number, legL: string, legR: string, armL: string, armR: string, extra: Partial<Pose> = {}): Pose => ({
  bob,
  legL,
  legR,
  armL,
  armR,
  ...extra,
});

/** Front/back views: legs and arms swap sides on each step. */
const FRONT_ANIMS: Record<string, Pose[]> = {
  idle: [pose(0, "stand", "stand", "down", "down"), pose(1, "stand", "stand", "down", "down")],
  blink: [pose(0, "stand", "stand", "down", "down", { blink: true })],
  walk: [
    pose(0, "fwd", "back", "back", "fwd"),
    pose(1, "stand", "lift", "down", "down"),
    pose(0, "stand", "lift", "down", "down"),
    pose(0, "back", "fwd", "fwd", "back"),
    pose(1, "lift", "stand", "down", "down"),
    pose(0, "lift", "stand", "down", "down"),
  ],
  run: [
    pose(1, "fwd", "knee", "pumpBack", "pumpFwd"),
    pose(0, "stand", "knee", "pumpBack", "pumpFwd"),
    pose(-1, "back", "lift", "down", "down"),
    pose(1, "knee", "fwd", "pumpFwd", "pumpBack"),
    pose(0, "knee", "stand", "pumpFwd", "pumpBack"),
    pose(-1, "lift", "back", "down", "down"),
  ],
  pedal: [
    pose(2, "sitUp", "sitDown", "hold", "hold", { seat: 2 }),
    pose(2, "sitMid", "sitMid", "hold", "hold", { seat: 2 }),
    pose(2, "sitDown", "sitUp", "hold", "hold", { seat: 2 }),
    pose(2, "sitMid", "sitMid", "hold", "hold", { seat: 2 }),
  ],
};
const UP_ONLY: Record<string, Pose[]> = {
  type: [
    pose(2, "sitMid", "sitMid", "type1", "type2", { seat: 2 }),
    pose(2, "sitMid", "sitMid", "type2", "type1", { seat: 2 }),
  ],
  checkin: [pose(0, "stand", "stand", "down", "reach", { prop: "card" }), pose(0, "stand", "stand", "down", "reach", { prop: "card", head: 1 })],
  drink: [pose(0, "stand", "stand", "down", "raise", { prop: "cup" }), pose(0, "stand", "stand", "down", "raise", { prop: "cup", head: -1 })],
};

/** Side view: "L" is the near limb, "R" the far one (drawn behind the body, in shadow). */
const SIDE_ANIMS: Record<string, Pose[]> = {
  idle: [pose(0, "stand", "stand", "down", "down"), pose(1, "stand", "stand", "down", "down")],
  blink: [pose(0, "stand", "stand", "down", "down", { blink: true })],
  walk: [
    pose(0, "fwd", "back", "back", "fwd"),
    pose(1, "stand", "lift", "down", "down"),
    pose(0, "back", "pass", "down", "down"),
    pose(0, "back", "fwd", "fwd", "back"),
    pose(1, "lift", "stand", "down", "down"),
    pose(0, "pass", "back", "down", "down"),
  ],
  run: [
    pose(1, "runFwd", "runBack", "pumpBack", "pumpFwd"),
    pose(0, "stand", "pass", "pumpBack", "pumpFwd"),
    pose(-1, "back", "runFwd", "pumpFwd", "pumpBack"),
    pose(1, "runBack", "runFwd", "pumpFwd", "pumpBack"),
    pose(0, "pass", "stand", "pumpFwd", "pumpBack"),
    pose(-1, "runFwd", "back", "pumpBack", "pumpFwd"),
  ],
  pedal: [
    pose(2, "sitUp", "sitDown", "hold", "hold", { seat: 2 }),
    pose(2, "sitMid", "sitMid", "hold", "hold", { seat: 2 }),
    pose(2, "sitDown", "sitUp", "hold", "hold", { seat: 2 }),
    pose(2, "sitMid", "sitMid", "hold", "hold", { seat: 2 }),
  ],
};

/** Every animation and its frame count. Facings without their own version reuse "idle". */
export const ANIMS: Record<string, number> = {
  idle: 2,
  blink: 1,
  walk: 6,
  run: 6,
  pedal: 4,
  type: 2,
  checkin: 2,
  drink: 2,
};
const ANIM_NAMES = Object.keys(ANIMS);
export const SHEET_COLS = Math.max(...Object.values(ANIMS));

export function frameName(facing: Facing, anim: string, i: number) {
  return `${facing}:${anim}:${i}`;
}

/** Row/column of each frame in the sheet: one row per (facing, animation). */
export function frameCell(facing: Facing, anim: string, i: number): [number, number] {
  return [i, FACINGS.indexOf(facing) * ANIM_NAMES.length + ANIM_NAMES.indexOf(anim)];
}

// ---------------------------------------------------------------------------------------------
// Colours

const OUTLINE = "#2a1d18";

function shade(hex: string, f: number): string {
  const [r, g, b] = parseColor(hex);
  const mix = (v: number) => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1));
  return `#${[mix(r), mix(g), mix(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

/** Slight hue shift towards warm for shadows reads better than plain darkening. */
function shadowOf(hex: string, f = 0.74): string {
  const [r, g, b] = parseColor(hex);
  return `#${[r * f + 10, g * f + 2, b * f + 14 * (1 - f)].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function paletteFor(look: Look, far: boolean): Record<string, RGBA> {
  const k = far ? 0.82 : 1;
  const c = (hex: string) => parseColor(far ? shadowOf(hex, k) : hex);
  const skinShade = shadowOf(look.skin, 0.8);
  const topShade = shadowOf(look.top, 0.72);
  const bottomShade = shadowOf(look.bottom, 0.7);
  return {
    S: c(look.skin),
    s: c(skinShade),
    E: parseColor(OUTLINE),
    R: parseColor("rgba(232,120,110,0.55)"),
    T: c(look.top),
    t: c(topShade),
    U: c(look.tank ? look.skin : look.top),
    u: c(look.tank ? skinShade : topShade),
    B: c(look.bottom),
    b: c(bottomShade),
    L: c(look.shorts ? look.skin : look.bottom),
    l: c(look.shorts ? skinShade : bottomShade),
    F: c(look.shoes),
    f: c(shadowOf(look.shoes, 0.66)),
    H: c(look.hair),
    h: c(shadowOf(look.hair, 0.72)),
    i: c(shade(look.hair, 1.35)),
    C: c(look.cap ?? look.hair),
    c: c(shadowOf(look.cap ?? look.hair, 0.72)),
    K: parseColor("#f4f1e8"),
  };
}

// ---------------------------------------------------------------------------------------------
// Composition

type Edge = "l" | "r" | "t" | "b";
const ALL_EDGES: Edge[] = ["l", "r", "t", "b"];

function stamp(p: Painter, part: Part, pal: Record<string, RGBA>, dx: number, dy: number, mirror = false, front: boolean | Edge[] = false) {
  const [ax, ay] = part.at;
  const cells: [number, number, RGBA][] = [];
  part.rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const col = pal[ch];
      if (!col) return;
      const x = mirror ? CW - 1 - (ax + i) : ax + i;
      cells.push([x + dx, ay + j + dy, col]);
    }),
  );
  if (front) {
    // A thin dark line where this part overlaps what's behind it keeps arms readable over the body.
    const edges = front === true ? ALL_EDGES : front;
    const dirs: Record<Edge, [number, number]> = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
    const own = new Set(cells.map(([x, y]) => `${x},${y}`));
    const line = parseColor(OUTLINE);
    for (const [x, y] of cells)
      for (const [ox, oy] of edges.map((e) => dirs[e])) {
        const nx = x + ox;
        const ny = y + oy;
        if (!own.has(`${nx},${ny}`) && p.alphaAt(nx, ny) > 0) p.set(nx, ny, line);
      }
  }
  for (const [x, y, col] of cells) p.set(x, y, col);
}

function drawFrame(look: Look, facing: Facing, anim: string, i: number): Painter {
  const p = new Painter(CW, CH);
  const side = facing === "left" || facing === "right";
  const viewFacing: "down" | "up" | "side" = side ? "side" : facing === "up" ? "up" : "down";
  const anims = side ? SIDE_ANIMS : { ...FRONT_ANIMS, ...(facing === "up" ? UP_ONLY : {}) };
  const frames = anims[anim] ?? anims.idle;
  const f = frames[i % frames.length];
  const pal = paletteFor(look, false);
  const farPal = paletteFor(look, true);
  const bob = f.bob;
  const seat = f.seat ?? 0;

  if (side) {
    const legs = LEG_SIDE;
    const arms = ARM_SIDE;
    // far arm and leg first, in shadow
    stamp(p, arms[f.armR] ?? arms.down, farPal, -1, bob);
    stamp(p, legs[f.legR] ?? legs.stand, farPal, -1, seat);
    stamp(p, legs[f.legL] ?? legs.stand, pal, 0, seat, false, true);
    stamp(p, TORSO_SIDE, pal, 0, bob);
    stamp(p, f.blink ? HEAD_SIDE_BLINK : HEAD_SIDE, pal, 0, bob + (f.head ?? 0));
    const hair = HAIR[look.hairStyle].side;
    stamp(p, hair, pal, 0, bob + (f.head ?? 0));
    // Only the back edge gets a line, so the arm reads without slicing the body into stripes.
    stamp(p, arms[f.armL] ?? arms.down, pal, 0, bob, false, ["l", "b"]);
  } else {
    const up = viewFacing === "up";
    const legs = up ? LEG_UP : LEG_DOWN;
    const arms = up ? ARM_UP : ARM_DOWN;
    stamp(p, legs[f.legL] ?? legs.stand, pal, 0, seat);
    stamp(p, legs[f.legR] ?? legs.stand, pal, 0, seat, true);
    stamp(p, up ? TORSO_UP : TORSO_DOWN, pal, 0, bob);
    // Seen from behind, the left of the screen is the character's left arm.
    stamp(p, arms[f.armL] ?? arms.down, pal, 0, bob, false, true);
    stamp(p, arms[f.armR] ?? arms.down, pal, 0, bob, true, true);
    const head = up ? HEAD_UP : f.blink ? HEAD_DOWN_BLINK : HEAD_DOWN;
    stamp(p, head, pal, 0, bob + (f.head ?? 0));
    stamp(p, HAIR[look.hairStyle][up ? "up" : "down"], pal, 0, bob + (f.head ?? 0));
    if (f.prop) {
      // The prop sits in the right hand, held up and forward.
      const hx = CW - 1 - 4;
      const hy = (f.prop === "card" ? 10 : 11) + bob;
      if (f.prop === "card") p.box(hx - 1, hy - 1, hx + 1, hy, "#f4f1e8");
      else {
        p.box(hx - 1, hy - 2, hx, hy, "#f4f1e8");
        p.px(hx - 1, hy - 2, "#9fd3f0");
      }
    }
  }
  if (look.plaid) plaidify(p, look);
  p.outline(OUTLINE);
  p.shadow(7.5, FEET_Y + 0.6, 5, 1.6, 0.3);
  return facing === "left" ? p.mirrored() : p;
}

/** Flannel pattern for the owner's shirt. */
function plaidify(p: Painter, look: Look) {
  const top = parseColor(look.top);
  const topShade = parseColor(shadowOf(look.top, 0.72));
  const stripe = parseColor(look.plaid!);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const c = p.rgbaAt(x, y);
      const isTop = c[0] === top[0] && c[1] === top[1] && c[2] === top[2] && c[3] === 255;
      if (!isTop) continue;
      if (y % 4 === 1) p.set(x, y, stripe);
      else if ((x + y) % 3 === 0) p.set(x, y, topShade);
    }
}

/** The full sheet for one look: rows of (facing, animation), columns of frames. */
export function drawPersonSheet(look: Look): Painter {
  const sheet = new Painter(CW * SHEET_COLS, CH * FACINGS.length * ANIM_NAMES.length);
  for (const facing of FACINGS)
    for (const anim of ANIM_NAMES)
      for (let i = 0; i < ANIMS[anim]; i++) {
        const [cx, cy] = frameCell(facing, anim, i);
        sheet.draw(drawFrame(look, facing, anim, i), cx * CW, cy * CH);
      }
  return sheet;
}

// ---------------------------------------------------------------------------------------------
// Looks

export const OWNER_LOOK: Look = {
  skin: "#e3b07a",
  hair: "#5a3a22",
  hairStyle: "cap",
  cap: "#e07b39",
  top: "#c2412f",
  plaid: "#efc8a0",
  tank: false,
  bottom: "#3f5f8a",
  shorts: false,
  shoes: "#6b4226",
};

const SKINS = ["#f6d5b5", "#eab88e", "#d29a6a", "#a86e48", "#7c4c30", "#5b3722"];
const HAIRS = ["#2b1d14", "#5a3a22", "#a0522d", "#e2c46f", "#1c1c1c", "#a8a8a8", "#b8432e", "#3b2a4a"];
const TOPS = ["#2ec4b6", "#ff6b9a", "#ffd23f", "#7bd389", "#9b5de5", "#ff8c42", "#3a86ff", "#f4f1de", "#e63946", "#4cc9f0"];
const BOTTOMS = ["#2b2d42", "#4a4e69", "#5c6b73", "#22223b", "#6d597a"];
const STYLES: HairStyle[] = ["short", "long", "ponytail", "bun", "buzz", "curly", "short", "ponytail"];
const SHOES = ["#f2f2f2", "#f2f2f2", "#ff6b6b", "#2b2d42", "#4cc9f0"];

/** A varied but deterministic look for customer #i. */
export function customerLook(i: number): Look {
  const pick = <T>(arr: T[], k: number) => arr[(i * k + Math.floor(i / arr.length)) % arr.length];
  return {
    skin: pick(SKINS, 5),
    hair: pick(HAIRS, 3),
    hairStyle: pick(STYLES, 3),
    top: pick(TOPS, 7),
    tank: i % 3 === 1,
    bottom: pick(BOTTOMS, 3),
    shorts: i % 2 === 0,
    shoes: pick(SHOES, 7),
  };
}
