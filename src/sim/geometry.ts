import type { EquipmentDef } from "../data/equipment";
import { rotateDir, type Dir, type Rot, type Vec } from "./types";

export function rotatedSize(def: EquipmentDef, rot: Rot): { w: number; h: number } {
  const { w, h } = def.footprint;
  return rot % 2 === 0 ? { w, h } : { w: h, h: w };
}

/** Rotate an integer cell inside a w x h box clockwise `rot` quarter turns. Works for cells just outside the box too. */
export function rotateCell(c: Vec, w: number, h: number, rot: Rot): Vec {
  let { x, y } = c;
  let bw = w;
  let bh = h;
  for (let i = 0; i < rot; i++) {
    [x, y] = [bh - 1 - y, x];
    [bw, bh] = [bh, bw];
  }
  return { x, y };
}

/** Rotate a continuous point inside a w x h box clockwise `rot` quarter turns. */
export function rotatePoint(p: Vec, w: number, h: number, rot: Rot): Vec {
  let { x, y } = p;
  let bw = w;
  let bh = h;
  for (let i = 0; i < rot; i++) {
    [x, y] = [bh - y, x];
    [bw, bh] = [bh, bw];
  }
  return { x, y };
}

export function footprintCells(def: EquipmentDef, x: number, y: number, rot: Rot): Vec[] {
  const { w, h } = rotatedSize(def, rot);
  const cells: Vec[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push({ x: x + i, y: y + j });
  return cells;
}

export interface WorldSlot {
  stand: Vec;
  access: Vec[];
  facing: Dir;
}

export function worldSlot(def: EquipmentDef, x: number, y: number, rot: Rot, index: number): WorldSlot {
  const s = def.slots[index];
  const { w, h } = def.footprint;
  const stand = rotatePoint(s.stand, w, h, rot);
  return {
    stand: { x: x + stand.x, y: y + stand.y },
    access: s.access.map((a) => {
      const c = rotateCell(a, w, h, rot);
      return { x: x + c.x, y: y + c.y };
    }),
    facing: rotateDir(s.facing, rot),
  };
}

export function worldInteractSpot(def: EquipmentDef, x: number, y: number, rot: Rot): { spot: Vec; facing: Dir } | null {
  if (!def.interact) return null;
  const c = rotateCell(def.interact.spot, def.footprint.w, def.footprint.h, rot);
  return { spot: { x: x + c.x, y: y + c.y }, facing: rotateDir(def.interact.facing, rot) };
}

/** Chebyshev distance from a tile to the nearest tile of a rectangle. */
export function distToRect(t: Vec, x: number, y: number, w: number, h: number): number {
  const dx = Math.max(x - t.x, 0, t.x - (x + w - 1));
  const dy = Math.max(y - t.y, 0, t.y - (y + h - 1));
  return Math.max(dx, dy);
}
