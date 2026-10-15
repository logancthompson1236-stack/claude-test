import { describe, expect, it } from "vitest";
import { getDef } from "../src/data/equipment";
import { rotateCell, worldSlot } from "../src/sim/geometry";
import { findPath } from "../src/sim/nav";
import { snapPlacement, validatePlacement } from "../src/sim/placement";
import { PlacementSession } from "../src/sim/session";
import { World } from "../src/sim/world";

const treadmill = () => [...new World({ seed: 1 }).objects.values()].find((o) => o.defId === "treadmill_used")!;

describe("geometry", () => {
  it("rotates footprint cells clockwise", () => {
    // 2x3 box: bottom-left cell -> top-left after one clockwise turn (3x2 box)
    expect(rotateCell({ x: 0, y: 2 }, 2, 3, 1)).toEqual({ x: 0, y: 0 });
    expect(rotateCell({ x: 1, y: 0 }, 2, 3, 2)).toEqual({ x: 0, y: 2 });
  });

  it("puts treadmill access behind the belt for every rotation", () => {
    const def = getDef("treadmill_used");
    const facing = [0, 1, 2, 3].map((r) => worldSlot(def, 10, 10, r as 0, 0));
    expect(facing.map((f) => f.facing)).toEqual(["up", "right", "down", "left"]);
    // rot 0: access below (y = 13); rot 1: access to the left (x = 9)
    expect(facing[0].access.every((a) => a.y === 13)).toBe(true);
    expect(facing[1].access.every((a) => a.x === 9)).toBe(true);
    // rot 2: access above (y = 9); rot 3: access to the right of a 3-wide footprint (x = 13)
    expect(facing[2].access.every((a) => a.y === 9)).toBe(true);
    expect(facing[3].access.every((a) => a.x === 13)).toBe(true);
  });
});

describe("navigation", () => {
  it("walks into the office through its door", () => {
    const w = new World({ seed: 1 });
    const path = findPath(w.w, w.h, w.walkable, { x: 14, y: 14 }, [{ x: 4, y: 2 }]);
    expect(path).not.toBeNull();
    expect(path!.some((t) => t.y === 5 && (t.x === 3 || t.x === 4))).toBe(true);
  });

  it("never steps onto walls or furniture", () => {
    const w = new World({ seed: 1 });
    const path = findPath(w.w, w.h, w.walkable, { x: 16, y: 10 }, [{ x: 19, y: 5 }])!;
    for (const t of path) expect(w.walkable(t.x, t.y)).toBe(true);
  });
});

describe("placement", () => {
  it("accepts open floor and rejects overlaps, walls and doorways", () => {
    const w = new World({ seed: 1 });
    expect(validatePlacement(w, "treadmill_used", 21, 6, 0, null).ok).toBe(true);
    expect(validatePlacement(w, "treadmill_used", 17, 7, 0, null).reason).toMatch(/Overlaps/);
    expect(validatePlacement(w, "treadmill_used", 0, 6, 0, null).reason).toMatch(/wall/);
    expect(validatePlacement(w, "treadmill_used", 13, 13, 0, null).ok).toBe(false);
  });

  it("refuses to block the office door", () => {
    const w = new World({ seed: 1 });
    const v = validatePlacement(w, "treadmill_used", 2, 7, 1, null);
    // One sideways treadmill below the door is fine; boxing the doorway in completely is not.
    expect(v.ok).toBe(true);
    w.addObject("treadmill_used", 1, 7, 1);
    w.addObject("treadmill_used", 4, 7, 1);
    const block = validatePlacement(w, "bike_basic", 5, 6, 1, null);
    expect(block.ok).toBe(false);
  });

  it("snaps a second treadmill into a neat row", () => {
    const w = new World({ seed: 1 });
    const t = treadmill();
    // Existing treadmill is at (17,6). Dropping near (21,7) should line up at (20,6): same row, 1 tile gap.
    expect(snapPlacement(w, "treadmill_used", t.x + 4, t.y + 1, 0, null)).toEqual({ x: 20, y: 6 });
  });

  it("buying spends cash and adds the item; moving keeps the count", () => {
    const w = new World({ seed: 1 });
    w.cash = 1000;
    const s = PlacementSession.buy(w, "treadmill_used", { x: 21, y: 8 });
    expect(s.validity.ok).toBe(true);
    expect(s.confirm()).toBe(true);
    expect(w.cash).toBe(750);
    expect(w.countOf("treadmill_used")).toBe(2);

    const m = PlacementSession.move(w, treadmill().id);
    m.moveTo(3, 9);
    expect(m.confirm()).toBe(true);
    expect(w.countOf("treadmill_used")).toBe(2);
    expect(w.liftedId).toBeNull();
  });

  it("rotation swaps the footprint", () => {
    const w = new World({ seed: 1 });
    w.cash = 1000;
    const s = PlacementSession.buy(w, "treadmill_used", { x: 21, y: 9 });
    s.rotate();
    expect(s.size).toEqual({ w: 3, h: 2 });
  });
});

describe("customers", () => {
  it("runs a full first day: people visit, work out, pay, and nobody double-books a machine", () => {
    const w = new World({ seed: 42 });
    let summary: { revenue: number; visitors: number; workouts: number } | null = null;
    w.on((e) => {
      if (e.type === "dayEnd") summary = e.summary;
    });
    for (let i = 0; i < 20000 && !summary; i++) {
      w.tick(0.1);
      const claimed = w.customers.filter((c) => c.target).map((c) => `${c.target!.objectId}:${c.target!.slot}`);
      expect(new Set(claimed).size).toBe(claimed.length);
    }
    expect(summary).not.toBeNull();
    const s = summary!;
    expect(s.visitors).toBeGreaterThan(4);
    expect(s.visitors).toBeLessThan(25);
    expect(s.workouts).toBeGreaterThan(2);
    expect(s.revenue).toBe(s.workouts * 5);
  });

  it("keeps first-week income in the planned range", () => {
    // Day 1-3 net should let a player afford a second treadmill by about day 2-3.
    const nets: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = new World({ seed });
      w.on((e) => {
        if (e.type === "dayEnd") nets.push(e.summary.net);
      });
      for (let d = 0; d < 3; d++) {
        let ended = false;
        const off = w.on((e) => {
          if (e.type === "dayEnd") ended = true;
        });
        for (let i = 0; i < 20000 && !ended; i++) w.tick(0.1);
        off();
        w.nextDay();
      }
    }
    const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
    expect(avg).toBeGreaterThan(25);
    expect(avg).toBeLessThan(110);
  });
});

describe("save", () => {
  it("round-trips the layout and money", () => {
    const w = new World({ seed: 1 });
    w.cash = 999;
    w.addObject("potted_plant", 9, 9, 0);
    const copy = new World({ seed: 2, save: JSON.parse(JSON.stringify(w.toSave())) });
    expect(copy.cash).toBe(999);
    expect(copy.countOf("potted_plant")).toBe(1);
    expect(copy.objects.size).toBe(w.objects.size);
  });
});
