import { getDef } from "../data/equipment";
import { ENTRANCE } from "../data/layout";
import { footprintCells, rotatedSize, worldInteractSpot, worldSlot } from "./geometry";
import { reachable } from "./nav";
import { key, type Rot, type Vec } from "./types";
import type { PlacedObject, World } from "./world";

export interface Validity {
  ok: boolean;
  reason: string;
}

/** A line segment in tile units, drawn while dragging to show alignment. */
export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Everything that makes a spot valid or not, shared by buying and moving. */
export function validatePlacement(w: World, defId: string, x: number, y: number, rot: Rot, ignoreId: number | null): Validity {
  const def = getDef(defId);
  const cells = footprintCells(def, x, y, rot);
  const cellSet = new Set(cells.map((c) => key(c.x, c.y)));

  for (const c of cells) {
    if (!w.inBounds(c.x, c.y)) return bad("Out of bounds");
    const t = w.tile(c.x, c.y);
    if (t === "wall" || t === "locked") return bad("Can't go on a wall");
    if (t === "door" || t === "clear") return bad("Keep the doorway clear");
    const occ = w.occ[c.y * w.w + c.x];
    if (occ && occ !== ignoreId) return bad(`Overlaps the ${getDef(w.objects.get(occ)!.defId).name.toLowerCase()}`);
  }
  // Walkable objects (the office chair) don't occupy tiles but still can't be stacked on.
  for (const o of w.objects.values()) {
    if (o.id === ignoreId) continue;
    const od = getDef(o.defId);
    if (!od.walkable) continue;
    if (footprintCells(od, o.x, o.y, o.rot).some((c) => cellSet.has(key(c.x, c.y))))
      return bad(`Overlaps the ${od.name.toLowerCase()}`);
  }

  for (const a of [w.player, ...w.customers]) {
    const t = w.tileOf(a);
    if (cellSet.has(key(t.x, t.y))) return bad("Someone's standing there");
  }

  // Walkability as it would be after placing: the ghost's cells block, the lifted object's old cells don't.
  const walk = (tx: number, ty: number) => {
    if (cellSet.has(key(tx, ty)) || !w.isFloor(tx, ty)) return false;
    const o = w.occ[ty * w.w + tx];
    return o === 0 || o === ignoreId;
  };

  // The new object needs its own access tiles open.
  const ownNeeds: Vec[][] = def.slots.map((_, i) => worldSlot(def, x, y, rot, i).access);
  const spot = worldInteractSpot(def, x, y, rot);
  if (spot) ownNeeds.push([spot.spot]);
  for (const need of ownNeeds) {
    if (!need.some((t) => walk(t.x, t.y))) return bad("Customers need room to get on it");
  }

  // Nothing important may be cut off from the entrance.
  const start = ENTRANCE[0];
  const seen = reachable(w.w, w.h, walk, start);
  const ok = (t: Vec) => w.inBounds(t.x, t.y) && seen[t.y * w.w + t.x] === 1;
  for (const need of ownNeeds) if (!need.some(ok)) return bad("Customers couldn't reach it there");
  for (const req of w.requiredTiles(ignoreId)) {
    if (!req.tiles.some(ok)) return bad(`That would block ${req.label}`);
  }
  for (const a of [w.player, ...w.customers]) {
    if (!ok(w.tileOf(a)) && !isOnEquipment(w, a.pos)) return bad("That would trap someone");
  }
  return { ok: true, reason: "" };
}

function bad(reason: string): Validity {
  return { ok: false, reason };
}

/** Customers mid-workout stand inside a machine's footprint; that's fine. */
function isOnEquipment(w: World, p: Vec) {
  return w.occ[Math.floor(p.y) * w.w + Math.floor(p.x)] !== 0;
}

/**
 * Gentle snapping: pull the item into a neat row next to a matching item, or line its edges up with
 * nearby furniture, but only when that spot is valid and within one tile of where the finger is.
 */
export function snapPlacement(
  w: World,
  defId: string,
  rawX: number,
  rawY: number,
  rot: Rot,
  ignoreId: number | null,
): { x: number; y: number } {
  const def = getDef(defId);
  const { w: sw, h: sh } = rotatedSize(def, rot);
  const others = [...w.objects.values()].filter((o) => o.id !== ignoreId && !getDef(o.defId).walkable);

  // 1) Neat rows of the same machine, using the spacing already in use.
  const same = others.filter((o) => o.defId === defId && o.rot === rot);
  const gaps = new Set<number>([0, 1]);
  for (const a of same)
    for (const b of same) {
      if (a === b) continue;
      if (a.y === b.y && b.x > a.x) gaps.add(b.x - a.x - sw);
      if (a.x === b.x && b.y > a.y) gaps.add(b.y - a.y - sh);
    }
  const rowCandidates: Vec[] = [];
  for (const o of same)
    for (const g of gaps) {
      if (g < 0 || g > 3) continue;
      rowCandidates.push({ x: o.x + sw + g, y: o.y }, { x: o.x - sw - g, y: o.y }, { x: o.x, y: o.y + sh + g }, { x: o.x, y: o.y - sh - g });
    }
  let best: Vec | null = null;
  let bestD = Infinity;
  for (const c of rowCandidates) {
    const d = Math.max(Math.abs(c.x - rawX), Math.abs(c.y - rawY));
    if (d > 1 || d >= bestD) continue;
    if (!validatePlacement(w, defId, c.x, c.y, rot, ignoreId).ok) continue;
    best = c;
    bestD = d;
  }
  if (best) return best;

  // 2) Edge alignment with nearby objects, one axis at a time.
  let x = rawX;
  let y = rawY;
  const near = others.filter((o) => Math.abs(o.x - rawX) < 10 && Math.abs(o.y - rawY) < 10);
  const tryAxis = (axis: "x" | "y") => {
    if (validatePlacement(w, defId, x, y, rot, ignoreId).ok && isAligned(near, x, y, sw, sh, axis)) return;
    let pick: number | null = null;
    let pickD = Infinity;
    for (const o of near) {
      const { w: ow, h: oh } = rotatedSize(getDef(o.defId), o.rot);
      const opts = axis === "x" ? [o.x, o.x + ow - sw] : [o.y, o.y + oh - sh];
      for (const v of opts) {
        const cur = axis === "x" ? rawX : rawY;
        const d = Math.abs(v - cur);
        if (d === 0 || d > 1 || d >= pickD) continue;
        const cx = axis === "x" ? v : x;
        const cy = axis === "y" ? v : y;
        if (!validatePlacement(w, defId, cx, cy, rot, ignoreId).ok) continue;
        pick = v;
        pickD = d;
      }
    }
    if (pick !== null) {
      if (axis === "x") x = pick;
      else y = pick;
    }
  };
  tryAxis("y");
  tryAxis("x");
  return { x, y };
}

function isAligned(near: PlacedObject[], x: number, y: number, sw: number, sh: number, axis: "x" | "y") {
  return near.some((o) => {
    const { w: ow, h: oh } = rotatedSize(getDef(o.defId), o.rot);
    return axis === "x" ? o.x === x || o.x + ow === x + sw : o.y === y || o.y + oh === y + sh;
  });
}

/** Alignment guide lines between the ghost and nearby objects that share an edge or centre line. */
export function alignmentGuides(w: World, defId: string, x: number, y: number, rot: Rot, ignoreId: number | null): Guide[] {
  const { w: sw, h: sh } = rotatedSize(getDef(defId), rot);
  const guides: Guide[] = [];
  for (const o of w.objects.values()) {
    if (o.id === ignoreId || getDef(o.defId).walkable) continue;
    const { w: ow, h: oh } = rotatedSize(getDef(o.defId), o.rot);
    if (Math.abs(o.x - x) > 12 || Math.abs(o.y - y) > 12) continue;
    const minX = Math.min(x, o.x);
    const maxX = Math.max(x + sw, o.x + ow);
    const minY = Math.min(y, o.y);
    const maxY = Math.max(y + sh, o.y + oh);
    for (const [a, b] of [
      [y, o.y],
      [y + sh, o.y + oh],
    ])
      if (a === b) guides.push({ x1: minX, y1: a, x2: maxX, y2: a });
    for (const [a, b] of [
      [x, o.x],
      [x + sw, o.x + ow],
    ])
      if (a === b) guides.push({ x1: a, y1: minY, x2: a, y2: maxY });
  }
  return guides;
}

/** First valid spot near `around`, searched in growing rings. */
export function findSpotNear(w: World, defId: string, around: Vec, rot: Rot, ignoreId: number | null): Vec | null {
  const { w: sw, h: sh } = rotatedSize(getDef(defId), rot);
  const cx = Math.round(around.x - sw / 2);
  const cy = Math.round(around.y - sh / 2);
  for (let r = 0; r < Math.max(w.w, w.h); r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (validatePlacement(w, defId, cx + dx, cy + dy, rot, ignoreId).ok) return { x: cx + dx, y: cy + dy };
      }
  }
  return null;
}
