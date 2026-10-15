import { getDef } from "../data/equipment";
import { rotatedSize } from "./geometry";
import { alignmentGuides, findSpotNear, snapPlacement, validatePlacement, type Guide, type Validity } from "./placement";
import type { Rot, Vec } from "./types";
import type { World } from "./world";

/**
 * One placement session: a ghost the player drags around, rotates, then confirms or cancels.
 * Buying a new item and moving an existing one both use this.
 */
export class PlacementSession {
  x = 0;
  y = 0;
  rot: Rot = 0;
  validity: Validity = { ok: false, reason: "" };
  guides: Guide[] = [];
  snap = true;
  private readonly origin: { x: number; y: number; rot: Rot } | null;

  private constructor(
    private readonly w: World,
    readonly defId: string,
    readonly mode: "buy" | "move",
    readonly objectId: number | null,
  ) {
    const o = objectId !== null ? w.objects.get(objectId)! : null;
    this.origin = o ? { x: o.x, y: o.y, rot: o.rot } : null;
    w.liftedId = objectId;
  }

  static buy(w: World, defId: string, around: Vec): PlacementSession {
    const s = new PlacementSession(w, defId, "buy", null);
    const spot = findSpotNear(w, defId, around, 0, null);
    const { w: sw, h: sh } = rotatedSize(getDef(defId), 0);
    s.x = spot ? spot.x : Math.round(around.x - sw / 2);
    s.y = spot ? spot.y : Math.round(around.y - sh / 2);
    s.refresh();
    return s;
  }

  static move(w: World, objectId: number): PlacementSession {
    const o = w.objects.get(objectId)!;
    const s = new PlacementSession(w, o.defId, "move", objectId);
    s.x = o.x;
    s.y = o.y;
    s.rot = o.rot;
    s.refresh();
    return s;
  }

  get def() {
    return getDef(this.defId);
  }

  get size() {
    return rotatedSize(this.def, this.rot);
  }

  /** Move the ghost so its top-left lands on (rawX, rawY), snapping if enabled. */
  moveTo(rawX: number, rawY: number) {
    const p = this.snap ? snapPlacement(this.w, this.defId, rawX, rawY, this.rot, this.objectId) : { x: rawX, y: rawY };
    if (p.x === this.x && p.y === this.y) return;
    this.x = p.x;
    this.y = p.y;
    this.refresh();
  }

  rotate() {
    if (!this.def.rotatable) return;
    const before = this.size;
    const cx = this.x + before.w / 2;
    const cy = this.y + before.h / 2;
    this.rot = ((this.rot + 1) % 4) as Rot;
    const after = this.size;
    this.x = Math.round(cx - after.w / 2);
    this.y = Math.round(cy - after.h / 2);
    this.refresh();
  }

  refresh() {
    this.validity = validatePlacement(this.w, this.defId, this.x, this.y, this.rot, this.objectId);
    this.guides = this.snap ? alignmentGuides(this.w, this.defId, this.x, this.y, this.rot, this.objectId) : [];
  }

  get cost() {
    return this.mode === "buy" ? this.def.price : 0;
  }

  get unchanged() {
    return !!this.origin && this.origin.x === this.x && this.origin.y === this.y && this.origin.rot === this.rot;
  }

  /** Returns false (and changes nothing) if the spot is invalid or the item is unaffordable. */
  confirm(): boolean {
    this.refresh();
    if (!this.validity.ok) return false;
    if (this.mode === "buy") {
      if (!this.w.spend(this.def.price)) {
        this.validity = { ok: false, reason: "Not enough cash" };
        return false;
      }
      this.w.addObject(this.defId, this.x, this.y, this.rot);
    } else {
      const o = this.w.objects.get(this.objectId!)!;
      this.w.moveObject(o, this.x, this.y, this.rot);
    }
    this.w.liftedId = null;
    this.w.layoutChanged();
    this.w.emit({ type: "save" });
    return true;
  }

  cancel() {
    this.w.liftedId = null;
  }
}
