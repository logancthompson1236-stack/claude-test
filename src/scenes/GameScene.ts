import Phaser from "phaser";
import { CHAR_H } from "../art/characters";
import { FLICKER_LAMP, OUTSIDE, TILE, WALL_TOP } from "../art/environment";
import { buildTextures, charKey, objKey, objectExtra } from "../art/textures";
import type { Controller } from "../controller";
import { getDef } from "../data/equipment";
import { LAYOUT } from "../data/layout";
import { rotatedSize, worldSlot, worldInteractSpot } from "../sim/geometry";
import type { Vec } from "../sim/types";
import type { Actor, PlacedObject, World } from "../sim/world";
import type { UI } from "../ui/ui";

const MAP_W = LAYOUT[0].length * TILE;
const MAP_H = LAYOUT.length * TILE;
const VIEW_TOP = -WALL_TOP;
const VIEW_BOTTOM = MAP_H + OUTSIDE;
const FEET = 22; // feet row inside a 24px character frame

type Drag = "none" | "ghost" | "pan";

export class GameScene extends Phaser.Scene {
  private objSprites = new Map<number, Phaser.GameObjects.Image>();
  private actorSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private ghost!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private ripple!: Phaser.GameObjects.Image;

  private dpr = 1;
  private zoomLevels: number[] = [1];
  private zoomIdx = 0;
  private center: Vec = { x: MAP_W / 2, y: (VIEW_TOP + VIEW_BOTTOM) / 2 };
  private follow = true;

  private down: { x: number; y: number; t: number } | null = null;
  private drag: Drag = "none";
  private grab: Vec = { x: 0, y: 0 };
  private lastPointer: Vec = { x: 0, y: 0 };
  private pinch: { d0: number; idx0: number } | null = null;
  private flickerUntil = 0;
  private nextFlicker = 4000;

  constructor(
    private readonly world: World,
    private readonly ctrl: Controller,
    private readonly ui: UI,
  ) {
    super("game");
  }

  create() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    buildTextures(this);
    this.cameras.main.setBackgroundColor("#1d1814");
    this.cameras.main.setRoundPixels(true);

    this.add.image(0, -WALL_TOP, "backdrop").setOrigin(0, 0).setDepth(-10000);
    this.add.image(0, -WALL_TOP, "lighting").setOrigin(0, 0).setDepth(9000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = this.add
      .image(FLICKER_LAMP.x, FLICKER_LAMP.y, "glow")
      .setDepth(9001)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.overlay = this.add.graphics().setDepth(20000);
    this.ghost = this.add.image(0, 0, "marker").setOrigin(0, 0).setDepth(20001).setVisible(false);
    this.marker = this.add.image(0, 0, "marker").setOrigin(0.5, 1).setDepth(19000).setVisible(false);
    this.ripple = this.add.image(0, 0, "ripple").setDepth(-5000).setVisible(false);

    this.input.addPointer(1);
    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup", this.onUp, this);
    this.input.on("pointerupoutside", this.onUp, this);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomStep(dy > 0 ? -1 : 1));
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.onKey(e));

    this.scale.on("resize", () => this.layoutCamera());
    this.layoutCamera();
    this.ui.attach(this);
  }

  // ------------------------------------------------------------------ camera

  /** Pick zoom levels: by default the whole gym fits on screen, but tiles never get too small to tap. */
  layoutCamera() {
    const vw = this.scale.width;
    const vh = this.scale.height;
    const fit = Math.min(vw / (MAP_W + 8), vh / (VIEW_BOTTOM - VIEW_TOP + 4));
    const minTouch = (20 * this.dpr) / TILE;
    let base = Math.max(fit, minTouch);
    if (this.dpr < 1.5) base = Math.max(1, Math.floor(base + 0.001));
    this.zoomLevels = [base, base * 1.5, base * 2.25];
    this.zoomIdx = Math.min(this.zoomIdx, this.zoomLevels.length - 1);
    this.cameras.main.setZoom(this.zoomLevels[this.zoomIdx]);
  }

  private zoomStep(d: number) {
    const next = Phaser.Math.Clamp(this.zoomIdx + d, 0, this.zoomLevels.length - 1);
    if (next === this.zoomIdx) return;
    this.zoomIdx = next;
    this.cameras.main.setZoom(this.zoomLevels[next]);
    this.follow = true;
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const halfW = cam.width / cam.zoom / 2;
    const halfH = cam.height / cam.zoom / 2;
    if (this.follow && this.ctrl.mode === "play") {
      const p = this.world.player.pos;
      const k = 1 - Math.exp(-dt * 6);
      this.center.x += (p.x * TILE - this.center.x) * k;
      this.center.y += (p.y * TILE - 8 - this.center.y) * k;
    }
    const clampAxis = (c: number, lo: number, hi: number, half: number) =>
      hi - lo <= half * 2 ? (lo + hi) / 2 : Phaser.Math.Clamp(c, lo + half, hi - half);
    this.center.x = clampAxis(this.center.x, -8, MAP_W + 8, halfW);
    this.center.y = clampAxis(this.center.y, VIEW_TOP - 4, VIEW_BOTTOM + 4, halfH);
    cam.centerOn(Math.round(this.center.x * cam.zoom) / cam.zoom, Math.round(this.center.y * cam.zoom) / cam.zoom);
  }

  worldToCss(wx: number, wy: number): Vec {
    const cam = this.cameras.main;
    const v = cam.worldView;
    return { x: ((wx - v.x) * cam.zoom) / this.dpr, y: ((wy - v.y) * cam.zoom) / this.dpr };
  }

  /** Centre of the current view in tiles (where newly bought items appear). */
  viewCenterTile(): Vec {
    const v = this.cameras.main.worldView;
    return { x: (v.x + v.width / 2) / TILE, y: (v.y + v.height / 2) / TILE };
  }

  // ------------------------------------------------------------------ input

  private worldPoint(p: Phaser.Input.Pointer): Vec {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private activePointers(): Phaser.Input.Pointer[] {
    return [this.input.pointer1, this.input.pointer2].filter((p) => p && p.isDown);
  }

  private onDown(p: Phaser.Input.Pointer) {
    const ptrs = this.activePointers();
    if (ptrs.length >= 2) {
      const [a, b] = ptrs;
      this.pinch = { d0: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), idx0: this.zoomIdx };
      this.down = null;
      this.drag = "none";
      return;
    }
    this.down = { x: p.x, y: p.y, t: p.downTime };
    this.lastPointer = { x: p.x, y: p.y };
    this.drag = "none";
    const s = this.ctrl.session;
    if (this.ctrl.mode === "place" && s) {
      const w = this.worldPoint(p);
      const { w: sw, h: sh } = s.size;
      const tx = w.x / TILE;
      const ty = w.y / TILE;
      if (tx >= s.x - 0.6 && tx <= s.x + sw + 0.6 && ty >= s.y - 1.2 && ty <= s.y + sh + 0.6) {
        this.drag = "ghost";
        this.grab = { x: tx - s.x, y: ty - s.y };
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      const ptrs = this.activePointers();
      if (ptrs.length < 2) return;
      const d = Phaser.Math.Distance.Between(ptrs[0].x, ptrs[0].y, ptrs[1].x, ptrs[1].y);
      const ratio = d / Math.max(1, this.pinch.d0);
      const target = this.pinch.idx0 + (ratio > 1.3 ? 1 : 0) + (ratio > 1.9 ? 1 : 0) - (ratio < 0.77 ? 1 : 0) - (ratio < 0.5 ? 1 : 0);
      this.zoomStep(Phaser.Math.Clamp(target, 0, this.zoomLevels.length - 1) - this.zoomIdx);
      return;
    }
    if (!this.down || !p.isDown) return;
    const moved = Math.hypot(p.x - this.down.x, p.y - this.down.y) > 10 * this.dpr;
    if (this.drag === "ghost") {
      const s = this.ctrl.session;
      if (!s) return;
      const w = this.worldPoint(p);
      s.moveTo(Math.round(w.x / TILE - this.grab.x), Math.round(w.y / TILE - this.grab.y));
      this.ctrl.changed();
      return;
    }
    if (this.drag === "none" && moved) this.drag = "pan";
    if (this.drag === "pan") {
      const cam = this.cameras.main;
      this.center.x -= (p.x - this.lastPointer.x) / cam.zoom;
      this.center.y -= (p.y - this.lastPointer.y) / cam.zoom;
      this.follow = false;
    }
    this.lastPointer = { x: p.x, y: p.y };
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      if (this.activePointers().length === 0) this.pinch = null;
      return;
    }
    const d = this.down;
    this.down = null;
    const wasDrag = this.drag;
    this.drag = "none";
    if (!d || wasDrag === "pan") return;
    if (wasDrag === "ghost") {
      // A short tap on the ghost itself does nothing; dragging already moved it.
      return;
    }
    if (p.upTime - d.t > 600) return;
    this.onTap(this.worldPoint(p));
  }

  private onTap(w: Vec) {
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    const mode = this.ctrl.mode;

    if (mode === "place") {
      const s = this.ctrl.session!;
      const { w: sw, h: sh } = s.size;
      s.moveTo(Math.round(w.x / TILE - sw / 2), Math.round(w.y / TILE - sh / 2));
      this.ctrl.changed();
      return;
    }
    if (mode === "move") {
      const o = this.hitObject(w);
      if (o) this.ctrl.pickUp(o);
      return;
    }
    if (mode !== "play") return;

    const c = this.hitActor(w);
    if (c && c !== this.world.player) {
      const cu = this.world.customers.find((x) => x.id === c.id);
      if (cu) this.ui.bubble(cu.id, `${cu.name}: ${cu.thought}`);
      return;
    }
    const o = this.hitObject(w);
    if (o) {
      const def = getDef(o.defId);
      if (def.interact) {
        if (!this.world.playerInteract(o)) this.ctrl.toast("Can't get over there.");
        else this.follow = true;
      } else {
        this.ui.objectBubble(o, def.flavor);
      }
      return;
    }
    if (this.world.tile(tx, ty) === "locked") {
      this.ctrl.toast("Padlocked. The back warehouse is full of junk... for now.");
      return;
    }
    if (this.world.walkable(tx, ty)) {
      if (this.world.playerWalkTo({ x: tx, y: ty })) {
        this.follow = true;
        this.ripple.setPosition(tx * TILE + 8, ty * TILE + 12).setVisible(true).setAlpha(1).setScale(1);
        this.tweens.add({ targets: this.ripple, alpha: 0, scale: 1.6, duration: 380 });
      }
    }
  }

  private onKey(e: KeyboardEvent) {
    const s = this.ctrl.session;
    if (e.key === "r" || e.key === "R") {
      if (s) {
        s.rotate();
        this.ctrl.changed();
      }
    } else if (e.key === "Escape") {
      if (s) this.ctrl.cancelPlacement();
      else if (this.ctrl.mode === "move") this.ctrl.exitMoveMode();
      else if (this.ctrl.mode === "computer") this.ctrl.closeComputer();
    } else if (e.key === "Enter" && s) {
      this.ctrl.confirmPlacement();
    }
  }

  private hitActor(w: Vec): Actor | null {
    let best: Actor | null = null;
    let bestDepth = -Infinity;
    for (const a of [this.world.player, ...this.world.customers]) {
      const s = this.actorSprites.get(a.id);
      if (!s || !s.visible || !s.getBounds().contains(w.x, w.y)) continue;
      if (s.depth > bestDepth) {
        best = a;
        bestDepth = s.depth;
      }
    }
    return best;
  }

  private hitObject(w: Vec): PlacedObject | null {
    let best: PlacedObject | null = null;
    let bestDepth = -Infinity;
    for (const o of this.world.objects.values()) {
      const img = this.objSprites.get(o.id);
      if (!img || !img.visible) continue;
      const { w: ow, h: oh } = rotatedSize(getDef(o.defId), o.rot);
      const inFoot = w.x >= o.x * TILE && w.x < (o.x + ow) * TILE && w.y >= o.y * TILE && w.y < (o.y + oh) * TILE;
      let inSprite = false;
      if (img.getBounds().contains(w.x, w.y)) {
        const lx = Math.floor(w.x - img.x);
        const ly = Math.floor(w.y - img.y);
        inSprite = this.textures.getPixelAlpha(lx, ly, img.texture.key) > 0;
      }
      if (!inFoot && !inSprite) continue;
      const depth = img.depth + (inSprite ? 1000 : 0);
      if (depth > bestDepth) {
        best = o;
        bestDepth = depth;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ frame

  update(time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.world.tick(dt);
    this.syncObjects(time);
    this.syncActors();
    this.syncOverlay(time);
    this.syncMarker(time);
    this.flicker(time);
    this.updateCamera(dt);
    this.ui.frame();
  }

  private syncObjects(time: number) {
    for (const [id, img] of this.objSprites) {
      if (!this.world.objects.has(id)) {
        img.destroy();
        this.objSprites.delete(id);
      }
    }
    for (const o of this.world.objects.values()) {
      const def = getDef(o.defId);
      let img = this.objSprites.get(o.id);
      const running = def.slots.length > 0 && o.slots.some((s) => s.state === "inuse") && def.category === "cardio";
      const frame = running ? Math.floor(time / (o.defId.startsWith("bike") ? 200 : 90)) % 2 : 0;
      const key = objKey(o.defId, o.rot, frame);
      if (!img) {
        img = this.add.image(0, 0, key).setOrigin(0, 0);
        this.objSprites.set(o.id, img);
      } else if (img.texture.key !== key) img.setTexture(key);
      const extra = objectExtra.get(`${o.defId}:${o.rot}`) ?? 0;
      const { h } = rotatedSize(def, o.rot);
      img.setPosition(o.x * TILE, o.y * TILE - extra);
      img.setDepth(def.layer === "low" ? o.y * TILE + 2 : (o.y + h) * TILE - 1);
      img.setVisible(o.id !== this.world.liftedId);
    }
  }

  private syncActors() {
    const live = new Set<number>([this.world.player.id, ...this.world.customers.map((c) => c.id)]);
    for (const [id, s] of this.actorSprites) {
      if (!live.has(id)) {
        s.destroy();
        this.actorSprites.delete(id);
      }
    }
    for (const a of [this.world.player, ...this.world.customers]) {
      let s = this.actorSprites.get(a.id);
      const frame = `${a.facing}-${pickFrame(a)}`;
      if (!s) {
        s = this.add.sprite(0, 0, charKey(a.look), frame).setOrigin(0.5, FEET / CHAR_H);
        this.actorSprites.set(a.id, s);
      } else s.setFrame(frame);
      s.setPosition(Math.round(a.pos.x * TILE), Math.round(a.pos.y * TILE));
      s.setDepth(a.pos.y * TILE + (a.kind === "player" ? 0.6 : 0.5));
      const outside = a.pos.y - (LAYOUT.length - 0.5);
      s.setAlpha(outside > 0 ? Phaser.Math.Clamp(1 - outside * 1.1, 0, 1) : 1);
    }
  }

  private syncOverlay(time: number) {
    const g = this.overlay;
    g.clear();
    const s = this.ctrl.session;
    if (this.ctrl.mode === "move" && !s) {
      // Show what can be picked up.
      const pulse = 0.55 + 0.25 * Math.sin(time / 250);
      for (const o of this.world.objects.values()) {
        const def = getDef(o.defId);
        if (def.walkable) continue;
        const { w, h } = rotatedSize(def, o.rot);
        const busy = this.world.isBusy(o);
        const color = !def.movable ? 0x8a8174 : busy ? 0xffa94d : 0xfff3b0;
        g.lineStyle(1, color, def.movable ? pulse : 0.35);
        g.strokeRect(o.x * TILE + 0.5, o.y * TILE + 0.5, w * TILE - 1, h * TILE - 1);
      }
    }
    if (!s) {
      this.ghost.setVisible(false);
      return;
    }
    const { w, h } = s.size;
    const ok = s.validity.ok;
    // Faint grid hint around the ghost
    g.fillStyle(0xffffff, 0.18);
    for (let y = s.y - 3; y <= s.y + h + 3; y++)
      for (let x = s.x - 3; x <= s.x + w + 3; x++) if (this.world.isFloor(x, y)) g.fillRect(x * TILE - 0.5, y * TILE - 0.5, 1, 1);
    // Footprint
    g.fillStyle(ok ? 0x5ee08a : 0xff5c5c, 0.28);
    g.fillRect(s.x * TILE, s.y * TILE, w * TILE, h * TILE);
    g.lineStyle(1, ok ? 0x7dffa8 : 0xff7b7b, 0.95);
    g.strokeRect(s.x * TILE + 0.5, s.y * TILE + 0.5, w * TILE - 1, h * TILE - 1);
    // Where customers step on / where the owner stands
    const def = s.def;
    const access = def.slots.flatMap((_, i) => worldSlot(def, s.x, s.y, s.rot, i).access);
    const spot = worldInteractSpot(def, s.x, s.y, s.rot);
    if (spot) access.push(spot.spot);
    for (const t of access) {
      const free = this.world.walkable(t.x, t.y);
      g.lineStyle(1, free ? 0xfff3b0 : 0xff7b7b, 0.9);
      for (let i = 0; i < 16; i += 4) {
        g.lineBetween(t.x * TILE + i, t.y * TILE + 0.5, t.x * TILE + i + 2, t.y * TILE + 0.5);
        g.lineBetween(t.x * TILE + i, t.y * TILE + 15.5, t.x * TILE + i + 2, t.y * TILE + 15.5);
        g.lineBetween(t.x * TILE + 0.5, t.y * TILE + i, t.x * TILE + 0.5, t.y * TILE + i + 2);
        g.lineBetween(t.x * TILE + 15.5, t.y * TILE + i, t.x * TILE + 15.5, t.y * TILE + i + 2);
      }
      g.fillStyle(free ? 0xfff3b0 : 0xff7b7b, 0.8);
      g.fillCircle(t.x * TILE + 8, t.y * TILE + 8, 1.5);
    }
    // Alignment guides
    g.lineStyle(1, 0x6fd6ff, 0.85);
    for (const gd of s.guides) g.lineBetween(gd.x1 * TILE, gd.y1 * TILE, gd.x2 * TILE, gd.y2 * TILE);

    const extra = objectExtra.get(`${s.defId}:${s.rot}`) ?? 0;
    this.ghost
      .setTexture(objKey(s.defId, s.rot, 0))
      .setPosition(s.x * TILE, s.y * TILE - extra)
      .setVisible(true)
      .setAlpha(0.9)
      .setTint(ok ? 0xb8ffc8 : 0xff9a9a);
  }

  private syncMarker(time: number) {
    const o = this.ctrl.mode === "play" && !this.world.player.moving ? this.world.nearestInteractable() : null;
    this.ui.setContext(o);
    if (!o) {
      this.marker.setVisible(false);
      return;
    }
    const img = this.objSprites.get(o.id);
    if (!img) return;
    const bob = Math.round(Math.sin(time / 180) * 1.5);
    this.marker.setPosition(Math.round(img.x + img.width / 2), img.y - 2 + bob).setVisible(true);
  }

  private flicker(time: number) {
    if (time > this.nextFlicker) {
      this.flickerUntil = time + 450;
      this.nextFlicker = time + 5000 + Math.random() * 9000;
    }
    if (time < this.flickerUntil) {
      this.glow.setAlpha(Math.random() < 0.5 ? 0.15 : 0.9);
    } else this.glow.setAlpha(1);
  }
}

function pickFrame(a: Actor): string {
  const t = a.animT;
  if (a.moving) {
    const step = Math.floor(t / 0.13) % 4;
    return step === 0 ? "walk1" : step === 2 ? "walk2" : "idle";
  }
  switch (a.pose) {
    case "run":
      return Math.floor(t / 0.11) % 2 === 0 ? "run1" : "run2";
    case "pedal":
      return Math.floor(t / 0.2) % 2 === 0 ? "sit1" : "sit2";
    case "drink":
      return "drink";
    default:
      return "idle";
  }
}
