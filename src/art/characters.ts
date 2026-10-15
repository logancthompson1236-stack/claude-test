import { Painter } from "./painter";

/** Character sprites: 16x24 frames, one row per facing, columns are poses. */
export const CHAR_W = 16;
export const CHAR_H = 24;
export const CHAR_FRAMES = ["idle", "walk1", "walk2", "run1", "run2", "sit1", "sit2", "drink"] as const;
export type CharFrame = (typeof CHAR_FRAMES)[number];
export const CHAR_ROWS = ["down", "up", "left", "right"] as const;

const OUTLINE = "#2a221c";

export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: "short" | "long" | "bun" | "bald" | "curly" | "cap";
  top: string;
  topShade: string;
  tank: boolean;
  bottom: string;
  bottomShade: string;
  shorts: boolean;
  shoes: string;
  cap?: string;
  plaid?: string;
}

export const OWNER_LOOK: Look = {
  skin: "#e3b07a",
  skinShade: "#c48f5c",
  hair: "#5a3a22",
  hairStyle: "cap",
  cap: "#e07b39",
  top: "#c2412f",
  topShade: "#8e2a20",
  plaid: "#f0c9a0",
  tank: false,
  bottom: "#3f5f8a",
  bottomShade: "#2c4466",
  shorts: false,
  shoes: "#6b4226",
};

const SKINS: [string, string][] = [
  ["#f6d5b5", "#dfb48f"],
  ["#eab88e", "#cf9a6f"],
  ["#d29a6a", "#b47d50"],
  ["#a86e48", "#8a5536"],
  ["#7c4c30", "#633b24"],
  ["#5b3722", "#472a19"],
];
const HAIRS = ["#2b1d14", "#5a3a22", "#a0522d", "#e2c46f", "#151515", "#9a9a9a", "#b8432e", "#3b2a4a"];
const TOPS: [string, string][] = [
  ["#2ec4b6", "#1f9488"],
  ["#ff6b9a", "#d24c78"],
  ["#ffd23f", "#d9ab1f"],
  ["#7bd389", "#55aa63"],
  ["#9b5de5", "#7440b8"],
  ["#ff8c42", "#d46a26"],
  ["#3a86ff", "#2463c9"],
  ["#f4f1de", "#cfcbb3"],
];
const BOTTOMS: [string, string][] = [
  ["#2b2d42", "#1d1e2e"],
  ["#4a4e69", "#363a52"],
  ["#5c6b73", "#46535a"],
  ["#22223b", "#16162a"],
];
const STYLES: Look["hairStyle"][] = ["short", "long", "bun", "bald", "curly", "short", "long"];

/** A varied but deterministic look for customer #i. */
export function customerLook(i: number): Look {
  const pick = <T>(arr: T[], k: number) => arr[(i * k + Math.floor(i / arr.length)) % arr.length];
  const [skin, skinShade] = pick(SKINS, 5);
  const [top, topShade] = pick(TOPS, 3);
  const [bottom, bottomShade] = pick(BOTTOMS, 7);
  return {
    skin,
    skinShade,
    hair: pick(HAIRS, 3),
    hairStyle: pick(STYLES, 2),
    top,
    topShade,
    tank: i % 3 === 1,
    bottom,
    bottomShade,
    shorts: i % 2 === 0,
    shoes: i % 4 === 3 ? "#ff6b6b" : "#f2f2f2",
  };
}

/** Draws the full sheet for one look. */
export function drawCharacterSheet(look: Look): Painter {
  const sheet = new Painter(CHAR_W * CHAR_FRAMES.length, CHAR_H * CHAR_ROWS.length);
  CHAR_ROWS.forEach((row, r) => {
    if (row === "right") return;
    CHAR_FRAMES.forEach((frame, f) => {
      const p = new Painter(CHAR_W, CHAR_H);
      drawPerson(p, look, row, frame);
      p.outline(OUTLINE);
      p.shadow(8, 22.5, 4.5, 1.6);
      sheet.draw(p, f * CHAR_W, r * CHAR_H);
      if (row === "left") sheet.draw(p.mirrored(), f * CHAR_W, 3 * CHAR_H);
    });
  });
  return sheet;
}

function drawPerson(p: Painter, L: Look, dir: "down" | "up" | "left", frame: CharFrame) {
  const seated = frame === "sit1" || frame === "sit2";
  const dy = seated ? 2 : 0; // seated bodies sit a bit lower
  // Leg phase: -1 / 0 / 1 for which leg is lifted.
  const phase = frame === "walk1" || frame === "run1" || frame === "sit1" ? 1 : frame === "walk2" || frame === "run2" || frame === "sit2" ? -1 : 0;
  const lift = frame.startsWith("run") ? 2 : 1;

  if (dir === "left") return drawSide(p, L, frame, phase, lift, dy, seated);

  // ----- legs -----
  const legTop = 16 + dy;
  const leg = (x: number, up: number) => {
    const y0 = legTop - up;
    if (seated) {
      p.box(x, y0, x + 2, y0 + 2, L.bottom);
      p.box(x, y0 + 3, x + 2, y0 + 3, L.shoes);
      return;
    }
    p.box(x, y0, x + 2, y0 + 3, L.bottom);
    if (L.shorts) p.box(x, y0 + 2, x + 2, y0 + 3, L.skin);
    p.box(x + 2, y0, x + 2, y0 + 3, L.shorts ? L.skinShade : L.bottomShade);
    if (L.shorts) p.box(x + 2, y0, x + 2, y0 + 1, L.bottomShade);
    p.box(x, y0 + 4, x + 2, y0 + 5, L.shoes);
  };
  leg(5, phase === 1 ? lift : 0);
  leg(8, phase === -1 ? lift : 0);

  // ----- torso -----
  const tTop = 10 + dy;
  p.box(4, tTop, 11, tTop + 6, L.top);
  p.box(11, tTop, 11, tTop + 6, L.topShade);
  p.box(4, tTop + 6, 11, tTop + 6, L.topShade);
  if (L.plaid) {
    for (let y = tTop; y <= tTop + 5; y++) for (let x = 4; x <= 10; x++) if ((x + y) % 3 === 0) p.px(x, y, L.topShade);
    p.box(4, tTop + 1, 10, tTop + 1, L.plaid);
    p.box(4, tTop + 4, 10, tTop + 4, L.plaid);
  }
  if (L.tank) {
    p.box(5, tTop, 5, tTop + 1, L.skin);
    p.box(10, tTop, 10, tTop + 1, L.skin);
  }

  // ----- arms (swing opposite to legs) -----
  const drinking = frame === "drink";
  const arm = (x: number, swing: number, raised: boolean) => {
    if (raised) {
      p.box(x, tTop - 3, x, tTop + 2, L.skin);
      return;
    }
    const y0 = tTop + 1 + swing;
    p.box(x, y0, x, y0 + 1, L.tank ? L.skin : L.top);
    p.box(x, y0 + 2, x, y0 + 4, L.skin);
  };
  const swing = frame.startsWith("run") ? 1 : phase !== 0 && !seated ? 1 : 0;
  arm(3, phase === -1 ? -swing : phase === 1 ? swing : 0, false);
  arm(12, phase === 1 ? -swing : phase === -1 ? swing : 0, drinking);

  // ----- head -----
  const hTop = 1 + dy;
  p.box(7, hTop + 8, 8, hTop + 8, L.skinShade); // neck
  p.box(4, hTop + 1, 11, hTop + 7, L.skin);
  p.box(5, hTop, 10, hTop, L.skin);
  p.box(5, hTop + 8, 10, hTop + 8, L.skin);
  p.clear([4, hTop + 1], [11, hTop + 1]);
  if (dir === "down") {
    p.box(6, hTop + 4, 6, hTop + 5, OUTLINE);
    p.box(9, hTop + 4, 9, hTop + 5, OUTLINE);
    p.px(5, hTop + 6, "rgba(230,120,110,0.55)");
    p.px(10, hTop + 6, "rgba(230,120,110,0.55)");
  }
  drawHair(p, L, dir, hTop);
}

function drawHair(p: Painter, L: Look, dir: "down" | "up", hTop: number) {
  const H = L.hair;
  if (dir === "up") {
    // Back of the head is mostly hair.
    if (L.hairStyle !== "bald") p.box(4, hTop, 11, hTop + 6, H);
    else p.box(4, hTop + 4, 11, hTop + 6, H);
    if (L.hairStyle === "long") p.box(4, hTop + 6, 11, hTop + 10, H);
    if (L.hairStyle === "bun") p.box(6, hTop - 2, 9, hTop, H);
    if (L.hairStyle === "curly") {
      p.box(3, hTop + 1, 12, hTop + 5, H);
    }
    if (L.hairStyle === "cap") {
      p.box(4, hTop, 11, hTop + 3, L.cap!);
      p.box(6, hTop + 3, 9, hTop + 3, "#f4f1de");
      p.box(4, hTop + 4, 11, hTop + 6, H);
    }
    return;
  }
  switch (L.hairStyle) {
    case "short":
      p.box(4, hTop, 11, hTop + 2, H);
      p.box(4, hTop + 3, 4, hTop + 4, H);
      p.box(11, hTop + 3, 11, hTop + 4, H);
      break;
    case "long":
      p.box(4, hTop, 11, hTop + 2, H);
      p.box(3, hTop + 2, 4, hTop + 10, H);
      p.box(11, hTop + 2, 12, hTop + 10, H);
      break;
    case "bun":
      p.box(4, hTop, 11, hTop + 2, H);
      p.box(6, hTop - 2, 9, hTop - 1, H);
      p.box(4, hTop + 3, 4, hTop + 3, H);
      p.box(11, hTop + 3, 11, hTop + 3, H);
      break;
    case "bald":
      p.box(4, hTop + 3, 4, hTop + 4, H);
      p.box(11, hTop + 3, 11, hTop + 4, H);
      p.px(6, hTop + 1, "rgba(255,255,255,0.35)");
      break;
    case "curly":
      p.box(3, hTop, 12, hTop + 2, H);
      p.box(3, hTop + 3, 3, hTop + 6, H);
      p.box(12, hTop + 3, 12, hTop + 6, H);
      p.px(5, hTop - 1, H);
      p.px(8, hTop - 1, H);
      p.px(10, hTop - 1, H);
      break;
    case "cap":
      p.box(4, hTop - 1, 11, hTop + 1, L.cap!);
      p.box(3, hTop + 2, 12, hTop + 2, darken(L.cap!));
      p.box(4, hTop + 3, 4, hTop + 4, H);
      p.box(11, hTop + 3, 11, hTop + 4, H);
      p.px(7, hTop, "#f4f1de");
      p.px(8, hTop, "#f4f1de");
      break;
  }
}

function drawSide(p: Painter, L: Look, frame: CharFrame, phase: number, lift: number, dy: number, seated: boolean) {
  // Facing left. Legs overlap, the forward one shifts left.
  const legTop = 16 + dy;
  if (seated) {
    // Thigh forward, shin down, pedalling.
    p.box(3, legTop, 8, legTop + 1, L.bottom);
    const k = phase === 1 ? 0 : 1;
    p.box(3, legTop + 2, 4, legTop + 3 + k, L.shorts ? L.skin : L.bottom);
    p.box(2, legTop + 4 + k, 4, legTop + 4 + k, L.shoes);
  } else {
    const stride = frame === "idle" || frame === "drink" ? 0 : lift;
    const legAt = (x: number, back: boolean) => {
      p.box(x, legTop, x + 2, legTop + 3, back ? L.bottomShade : L.bottom);
      if (L.shorts) p.box(x, legTop + 2, x + 2, legTop + 3, back ? L.skinShade : L.skin);
      p.box(x - 1, legTop + 4, x + 2, legTop + 5, L.shoes);
    };
    legAt(7 + stride * (phase === 0 ? 0 : phase), true);
    legAt(7 - stride * (phase === 0 ? 0 : phase), false);
  }
  // Torso
  const tTop = 10 + dy;
  p.box(5, tTop, 10, tTop + 6, L.top);
  p.box(10, tTop, 10, tTop + 6, L.topShade);
  if (L.plaid) {
    for (let y = tTop; y <= tTop + 5; y++) for (let x = 5; x <= 9; x++) if ((x + y) % 3 === 0) p.px(x, y, L.topShade);
    p.box(5, tTop + 1, 9, tTop + 1, L.plaid);
    p.box(5, tTop + 4, 9, tTop + 4, L.plaid);
  }
  // Arm
  const swing = frame === "idle" ? 0 : seated ? 0 : phase * (frame.startsWith("run") ? 2 : 1);
  if (seated) {
    p.box(4, tTop + 1, 6, tTop + 2, L.tank ? L.skin : L.top);
    p.box(1, tTop + 2, 3, tTop + 3, L.skin);
  } else if (frame === "drink") {
    p.box(5, tTop + 1, 6, tTop + 2, L.tank ? L.skin : L.top);
    p.box(3, tTop - 1, 4, tTop + 1, L.skin);
  } else {
    p.box(7 - swing, tTop + 1, 8 - swing, tTop + 2, L.tank ? L.skin : L.top);
    p.box(7 - swing, tTop + 3, 8 - swing, tTop + 5, L.skin);
  }
  // Head
  const hTop = 1 + dy;
  p.box(7, hTop + 8, 8, hTop + 8, L.skinShade);
  p.box(4, hTop + 1, 10, hTop + 7, L.skin);
  p.box(5, hTop, 9, hTop, L.skin);
  p.box(5, hTop + 8, 9, hTop + 8, L.skin);
  p.px(3, hTop + 5, L.skin); // nose
  p.box(5, hTop + 4, 5, hTop + 5, OUTLINE); // eye
  const H = L.hair;
  switch (L.hairStyle) {
    case "bald":
      p.box(8, hTop + 3, 10, hTop + 5, H);
      break;
    case "cap":
      p.box(5, hTop - 1, 10, hTop + 1, L.cap!);
      p.box(2, hTop + 2, 6, hTop + 2, darken(L.cap!));
      p.box(7, hTop + 2, 10, hTop + 5, H);
      break;
    case "long":
      p.box(5, hTop, 10, hTop + 2, H);
      p.box(8, hTop + 2, 11, hTop + 10, H);
      break;
    case "bun":
      p.box(5, hTop, 10, hTop + 2, H);
      p.box(8, hTop + 2, 10, hTop + 5, H);
      p.box(10, hTop - 1, 12, hTop + 1, H);
      break;
    case "curly":
      p.box(4, hTop - 1, 11, hTop + 2, H);
      p.box(8, hTop + 2, 11, hTop + 6, H);
      break;
    default:
      p.box(5, hTop, 10, hTop + 2, H);
      p.box(8, hTop + 2, 10, hTop + 5, H);
  }
}

function darken(hex: string, f = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
