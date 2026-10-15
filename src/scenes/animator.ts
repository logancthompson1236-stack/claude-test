import { frameName, type Facing } from "../art/people";
import type { Customer } from "../sim/customers";
import { DIRS, type Vec } from "../sim/types";
import type { Actor } from "../sim/world";

/**
 * Turns what the simulation says a character is doing into the frame to show.
 *
 * The goal is motion that feels alive rather than looped:
 *  - walking advances with the distance actually covered, so feet never slide or moonwalk;
 *  - each person has their own running/pedalling cadence;
 *  - idle people breathe, blink and (when waiting) glance around;
 *  - stepping onto a machine is a small hop instead of a snap.
 */
interface AnimState {
  last: Vec;
  wasMoving: boolean;
  walkPhase: number;
  phase: number;
  t: number;
  pose: string;
  poseT: number;
  cadence: number;
  blinkAt: number;
  blinkUntil: number;
  glanceAt: number;
  glanceUntil: number;
  glanceDir: Facing | null;
}

export interface AnimFrame {
  frame: string;
  /** Extra vertical offset in pixels (hops). */
  dy: number;
  anim: string;
  index: number;
  /** Steps per second of whatever the person is doing on a machine, for syncing belts. */
  cadence: number;
}

export class Animator {
  private states = new Map<number, AnimState>();

  private state(a: Actor): AnimState {
    let s = this.states.get(a.id);
    if (!s) {
      // A stable per-person rhythm: some people run quick and light, others slow and steady.
      const h = ((a.id * 2654435761) >>> 0) / 4294967296;
      s = {
        last: { ...a.pos },
        wasMoving: false,
        walkPhase: 0,
        phase: h * 6,
        t: h * 3,
        pose: a.pose,
        poseT: 0,
        cadence: 0.85 + h * 0.35,
        blinkAt: 1 + h * 3,
        blinkUntil: 0,
        glanceAt: 2 + h * 4,
        glanceUntil: 0,
        glanceDir: null,
      };
      this.states.set(a.id, s);
    }
    return s;
  }

  forget(id: number) {
    this.states.delete(id);
  }

  update(a: Actor, dt: number): AnimFrame {
    const s = this.state(a);
    s.t += dt;
    const moved = Math.hypot(a.pos.x - s.last.x, a.pos.y - s.last.y);
    s.last = { ...a.pos };
    if (a.pose !== s.pose) {
      s.pose = a.pose;
      s.poseT = 0;
      s.phase = 0;
    } else s.poseT += dt;

    let facing = a.facing as Facing;
    let dy = 0;

    // Hop on/off machines: a short arc while the step-on tween plays.
    const c = a.kind === "customer" ? (a as Customer) : null;
    if (a.tween && c && (c.state === "mount" || c.state === "dismount")) {
      dy = -Math.round(Math.sin(Math.PI * a.tween.t) * 3);
    }

    if (a.moving && moved > 0) {
      if (!s.wasMoving) s.walkPhase = 0; // start each walk on a heel strike
      s.wasMoving = true;
      // One full stride (two steps, six frames) covers about a tile; quicker walkers lengthen it.
      const stride = Math.min(1.7, Math.max(1, a.speed * 0.42));
      s.walkPhase += (moved / stride) * 6;
      const index = Math.floor(s.walkPhase) % 6;
      return { frame: frameName(facing, "walk", index), dy, anim: "walk", index, cadence: 0 };
    }
    s.wasMoving = false;

    switch (a.pose) {
      case "run": {
        s.phase += dt * 12 * s.cadence;
        const index = Math.floor(s.phase) % 6;
        return { frame: frameName(facing, "run", index), dy, anim: "run", index, cadence: s.cadence };
      }
      case "pedal": {
        s.phase += dt * 6.5 * s.cadence;
        const index = Math.floor(s.phase) % 4;
        return { frame: frameName(facing, "pedal", index), dy, anim: "pedal", index, cadence: s.cadence };
      }
      case "type": {
        // Bursts of typing with little pauses to read the screen.
        const typing = s.poseT % 3.4 < 2.6;
        if (typing) s.phase += dt * 7;
        const index = Math.floor(s.phase) % 2;
        return { frame: frameName("up", "type", index), dy, anim: "type", index, cadence: 0 };
      }
      case "checkin": {
        const index = s.poseT % 1.4 < 0.9 ? 0 : 1;
        return { frame: frameName("up", "checkin", index), dy, anim: "checkin", index, cadence: 0 };
      }
      case "drink": {
        const index = s.poseT < 0.3 ? 0 : (s.poseT - 0.3) % 1.8 < 1.2 ? 1 : 0;
        return { frame: frameName("up", "drink", index), dy, anim: "drink", index, cadence: 0 };
      }
    }

    // Idle: glance around while waiting, blink now and then, breathe.
    if (c && c.state === "waiting") {
      if (s.t >= s.glanceAt && !s.glanceDir) {
        const i = DIRS.indexOf(a.facing);
        s.glanceDir = DIRS[(i + (Math.random() < 0.5 ? 1 : 3)) % 4] as Facing;
        s.glanceUntil = s.t + 0.9 + Math.random() * 0.8;
      }
      if (s.glanceDir && s.t >= s.glanceUntil) {
        s.glanceDir = null;
        s.glanceAt = s.t + 2.5 + Math.random() * 4;
      }
      if (s.glanceDir) facing = s.glanceDir;
    } else s.glanceDir = null;

    if (s.t >= s.blinkAt) {
      s.blinkUntil = s.t + 0.13;
      s.blinkAt = s.t + 2.2 + Math.random() * 3.5;
    }
    if (s.t < s.blinkUntil && facing !== "up") {
      return { frame: frameName(facing, "blink", 0), dy, anim: "blink", index: 0, cadence: 0 };
    }
    const index = s.t % 2.4 < 1.5 ? 0 : 1;
    return { frame: frameName(facing, "idle", index), dy, anim: "idle", index, cadence: 0 };
  }
}
