import type { Rot, Vec } from "../sim/types";

/**
 * The starting warehouse, 28 x 16 tiles.
 *   #  wall          .  floor
 *   d  doorway       k  floor that must stay clear (in front of doors)
 *   L  padlocked roll-up door (a wall, for now)
 */
export const LAYOUT = [
  "############################",
  "#......#...................#",
  "#......#...................#",
  "#......#...................#",
  "#..kk..#...................#",
  "###dd###...................#",
  "#..kk......................#",
  "#..........................#",
  "#..........................L",
  "#..........................L",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#..........................#",
  "#............kk............#",
  "#############dd#############",
];

/** Main entrance doorway tiles (bottom wall). Customers come and go through here. */
export const ENTRANCE: Vec[] = [
  { x: 13, y: 15 },
  { x: 14, y: 15 },
];
export const OFFICE_DOOR: Vec[] = [
  { x: 3, y: 5 },
  { x: 4, y: 5 },
];

export interface StartObject {
  def: string;
  x: number;
  y: number;
  rot?: Rot;
}

export const START_OBJECTS: StartObject[] = [
  { def: "office_desk", x: 2, y: 1 },
  { def: "office_chair", x: 2, y: 2 },
  { def: "filing_cabinet", x: 6, y: 1 },
  { def: "water_cooler", x: 10, y: 1 },
  { def: "storage_shelf", x: 18, y: 1 },
  { def: "lockers", x: 23, y: 1 },
  { def: "treadmill_used", x: 17, y: 6, rot: 0 },
  { def: "checkin_desk", x: 12, y: 12 },
];

export const PLAYER_START: Vec = { x: 4.5, y: 3.9 };

/** Purely visual grime, drawn into the floor/walls. */
export const COBWEBS: { x: number; y: number; corner: "tl" | "tr" }[] = [
  { x: 1, y: 1, corner: "tl" },
  { x: 8, y: 1, corner: "tl" },
  { x: 26, y: 1, corner: "tr" },
  { x: 22, y: 1, corner: "tr" },
];
export const CRACKS: Vec[] = [
  { x: 12, y: 3 },
  { x: 5, y: 9 },
  { x: 21, y: 11 },
  { x: 24, y: 6 },
  { x: 9, y: 13 },
];
export const STAINS: Vec[] = [
  { x: 15, y: 9 },
  { x: 3, y: 12 },
  { x: 22, y: 3 },
  { x: 10, y: 7 },
];
