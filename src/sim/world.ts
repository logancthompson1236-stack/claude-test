import { BALANCE } from "../data/balance";
import { getDef, type EquipmentDef, type Pose } from "../data/equipment";
import { ENTRANCE, LAYOUT, OFFICE_DOOR, PLAYER_START, START_OBJECTS } from "../data/layout";
import { spawnCustomer, updateCustomer, type Customer } from "./customers";
import { distToRect, footprintCells, rotatedSize, worldInteractSpot, worldSlot } from "./geometry";
import { findPath, smoothPath } from "./nav";
import { Rng } from "./rng";
import { dirFromDelta, type Dir, type Rot, type Vec } from "./types";

export type Tile = "wall" | "floor" | "door" | "clear" | "locked";

export interface SlotState {
  state: "free" | "reserved" | "inuse";
  by: number;
}

export interface PlacedObject {
  id: number;
  defId: string;
  x: number;
  y: number;
  rot: Rot;
  slots: SlotState[];
}

export interface Actor {
  id: number;
  kind: "player" | "customer";
  look: string;
  pos: Vec;
  facing: Dir;
  /** Waypoints in tile coordinates (tile centres). */
  path: Vec[];
  /** Goal tiles of the current walk, kept so we can re-plan when the layout changes. */
  goals: Vec[];
  speed: number;
  moving: boolean;
  pose: Pose;
  animT: number;
  tween: { from: Vec; to: Vec; t: number; dur: number } | null;
}

export interface DayStats {
  visitors: number;
  workouts: number;
  gaveUp: number;
  revenue: number;
  satisfactionSum: number;
  departures: number;
  dayPasses: number;
  newMembers: number;
  memberVisits: number;
}

/** Someone from town who has visited the gym. Regulars come back; happy ones may buy memberships. */
export interface Person {
  pid: number;
  name: string;
  look: string;
  visits: number;
  /** Running average of how much they enjoyed their visits (0-5). */
  happiness: number;
  /** Last day (inclusive) their membership covers; 0 = not a member. */
  memberUntil: number;
  lastDay: number;
}

export interface DaySummary extends DayStats {
  day: number;
  rent: number;
  net: number;
  ratingStart: number;
  ratingEnd: number;
}

export type WorldEvent =
  | { type: "cash"; amount: number; at: Vec }
  | { type: "bubble"; actorId: number; text: string }
  | { type: "toast"; text: string }
  | { type: "hint"; id: string; text: string }
  | { type: "interact"; objectId: number }
  | { type: "dayEnd"; summary: DaySummary }
  | { type: "save" };

export interface SaveData {
  v: 1;
  day: number;
  minute: number;
  cash: number;
  rating: number;
  objects: { def: string; x: number; y: number; rot: Rot }[];
  lifetime: { revenue: number; visitors: number; workouts: number };
  hints: string[];
  speed: number;
  people?: Person[];
  /** Real time of the save, for the future "while you were away" payout. */
  savedAt: number;
}

export class World {
  readonly w = LAYOUT[0].length;
  readonly h = LAYOUT.length;
  readonly tiles: Tile[] = [];
  readonly objects = new Map<number, PlacedObject>();
  /** Blocking object id per tile (0 = none). */
  readonly occ: Int32Array;
  readonly player: Actor;
  customers: Customer[] = [];

  day = 1;
  minute: number = BALANCE.openMinute;
  cash: number = BALANCE.startCash;
  rating: number = BALANCE.startRating;
  ratingAtDayStart: number = BALANCE.startRating;
  stats: DayStats = emptyStats();
  lifetime = { revenue: 0, visitors: 0, workouts: 0 };
  hintsSeen = new Set<string>();
  people = new Map<number, Person>();

  speed = 1;
  paused = false;
  dayOver = false;
  readonly rng: Rng;

  private nextId = 1;
  /** People get their own ids so saved regulars never clash with new ones. */
  private nextPid = 1;
  private listeners: ((e: WorldEvent) => void)[] = [];
  private lastHour = -1;
  /** Arrivals build up steadily and each one lands after a jittered amount, so days don't swing wildly. */
  private arrivalAcc = 0;
  private nextArrival = 1;
  /** Object currently picked up in Move Mode: hidden and ignored for collisions. */
  liftedId: number | null = null;

  constructor(opts: { seed?: number; save?: SaveData | null } = {}) {
    this.rng = new Rng(opts.seed);
    this.nextArrival = this.rng.range(0.2, 1);
    for (const row of LAYOUT) {
      for (const ch of row) {
        this.tiles.push(
          ch === "#" ? "wall" : ch === "d" ? "door" : ch === "k" ? "clear" : ch === "L" ? "locked" : "floor",
        );
      }
    }
    this.occ = new Int32Array(this.w * this.h);
    this.player = {
      id: this.newId(),
      kind: "player",
      look: "owner",
      pos: { ...PLAYER_START },
      facing: "down",
      path: [],
      goals: [],
      speed: BALANCE.playerSpeed,
      moving: false,
      pose: "idle",
      animT: 0,
      tween: null,
    };

    const save = opts.save;
    if (save) {
      this.day = save.day;
      this.minute = Math.max(BALANCE.openMinute, Math.min(save.minute, BALANCE.lastEntryMinute));
      this.cash = save.cash;
      this.rating = save.rating;
      this.ratingAtDayStart = save.rating;
      this.lifetime = { ...save.lifetime };
      this.hintsSeen = new Set(save.hints);
      for (const p of save.people ?? []) {
        this.people.set(p.pid, { ...p });
        this.nextPid = Math.max(this.nextPid, p.pid + 1);
      }
      this.speed = save.speed || 1;
      for (const o of save.objects) {
        try {
          this.addObject(o.def, o.x, o.y, o.rot);
        } catch {
          // Unknown items from a future/older version are skipped rather than breaking the save.
        }
      }
    } else {
      for (const o of START_OBJECTS) this.addObject(o.def, o.x, o.y, o.rot ?? 0);
    }
    this.lastHour = Math.floor(this.minute / 60);
  }

  // ---------- events ----------

  on(fn: (e: WorldEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(e: WorldEvent) {
    for (const l of this.listeners) l(e);
  }

  hint(id: string, text: string) {
    if (this.hintsSeen.has(id)) return;
    this.hintsSeen.add(id);
    this.emit({ type: "hint", id, text });
  }

  newId() {
    return this.nextId++;
  }

  // ---------- map queries ----------

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  tile(x: number, y: number): Tile {
    return this.inBounds(x, y) ? this.tiles[y * this.w + x] : "wall";
  }

  isFloor(x: number, y: number) {
    const t = this.tile(x, y);
    return t === "floor" || t === "door" || t === "clear";
  }

  /** Floor with no blocking object on it. */
  walkable = (x: number, y: number): boolean => {
    if (!this.isFloor(x, y)) return false;
    const o = this.occ[y * this.w + x];
    return o === 0 || o === this.liftedId;
  };

  objectAt(x: number, y: number): PlacedObject | undefined {
    if (!this.inBounds(x, y)) return undefined;
    const id = this.occ[y * this.w + x];
    if (id) return this.objects.get(id);
    // Walkable objects (chairs) don't occupy tiles, so check footprints directly.
    for (const o of this.objects.values()) {
      const d = getDef(o.defId);
      const { w, h } = rotatedSize(d, o.rot);
      if (x >= o.x && y >= o.y && x < o.x + w && y < o.y + h) return o;
    }
    return undefined;
  }

  def(o: PlacedObject): EquipmentDef {
    return getDef(o.defId);
  }

  // ---------- objects ----------

  addObject(defId: string, x: number, y: number, rot: Rot): PlacedObject {
    const def = getDef(defId);
    const o: PlacedObject = {
      id: this.newId(),
      defId,
      x,
      y,
      rot,
      slots: def.slots.map(() => ({ state: "free", by: 0 })),
    };
    this.objects.set(o.id, o);
    this.stamp(o, o.id);
    return o;
  }

  moveObject(o: PlacedObject, x: number, y: number, rot: Rot) {
    this.stamp(o, 0);
    o.x = x;
    o.y = y;
    o.rot = rot;
    this.stamp(o, o.id);
  }

  private stamp(o: PlacedObject, value: number) {
    const def = getDef(o.defId);
    if (def.walkable) return;
    for (const c of footprintCells(def, o.x, o.y, o.rot)) {
      if (this.inBounds(c.x, c.y)) this.occ[c.y * this.w + c.x] = value;
    }
  }

  objectsWith(activity: EquipmentDef["activity"]): PlacedObject[] {
    return [...this.objects.values()].filter((o) => getDef(o.defId).activity === activity);
  }

  countOf(defId: string) {
    let n = 0;
    for (const o of this.objects.values()) if (o.defId === defId) n++;
    return n;
  }

  isBusy(o: PlacedObject) {
    return o.slots.some((s) => s.state !== "free");
  }

  /** Gym appeal used for customer arrivals: machines count fully, decor/amenities are capped. */
  appeal(): { machines: number; decor: number; total: number } {
    let machines = 0;
    let decor = 0;
    for (const o of this.objects.values()) {
      const d = getDef(o.defId);
      if (d.category === "cardio" || d.category === "strength") machines += d.appeal;
      else decor += d.appeal;
    }
    decor = Math.min(decor, BALANCE.maxDecorAppeal);
    return { machines, decor, total: machines + decor };
  }

  /** Tiles that must stay reachable from the entrance for the gym to work. */
  requiredTiles(ignoreId: number | null): { tiles: Vec[]; label: string }[] {
    const req: { tiles: Vec[]; label: string }[] = [
      { tiles: ENTRANCE, label: "the entrance" },
      { tiles: OFFICE_DOOR, label: "the office" },
    ];
    for (const o of this.objects.values()) {
      if (o.id === ignoreId) continue;
      const d = getDef(o.defId);
      d.slots.forEach((_, i) => {
        req.push({ tiles: worldSlot(d, o.x, o.y, o.rot, i).access, label: `the ${d.name.toLowerCase()}` });
      });
      const spot = worldInteractSpot(d, o.x, o.y, o.rot);
      if (spot) req.push({ tiles: [spot.spot], label: `the ${d.name.toLowerCase()}` });
    }
    return req;
  }

  // ---------- actors & movement ----------

  tileOf(a: Actor): Vec {
    return { x: Math.floor(a.pos.x), y: Math.floor(a.pos.y) };
  }

  /** Plan a walk to any of `goals`. Returns false if none is reachable. */
  walkTo(a: Actor, goals: Vec[]): boolean {
    let start = this.tileOf(a);
    if (!this.walkable(start.x, start.y)) {
      // Standing somewhere odd (e.g. squeezed by a new placement): start from the nearest open tile.
      const near = this.nearestWalkable(start);
      if (!near) return false;
      start = near;
    }
    const tiles = findPath(this.w, this.h, this.walkable, start, goals);
    if (!tiles) return false;
    a.goals = goals;
    if (tiles.length === 0) {
      const t = start;
      a.path = [{ x: t.x + 0.5, y: t.y + 0.5 }];
    } else {
      a.path = smoothPath(a.pos, tiles, this.walkable);
    }
    return true;
  }

  nearestWalkable(t: Vec): Vec | null {
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkable(t.x + dx, t.y + dy)) return { x: t.x + dx, y: t.y + dy };
        }
    }
    return null;
  }

  /** Advance an actor along its path or tween. Returns true while still travelling. */
  stepActor(a: Actor, dt: number): boolean {
    a.animT += dt;
    if (a.tween) {
      const tw = a.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      a.pos.x = tw.from.x + (tw.to.x - tw.from.x) * tw.t;
      a.pos.y = tw.from.y + (tw.to.y - tw.from.y) * tw.t;
      a.moving = true;
      if (tw.t >= 1) {
        a.tween = null;
        a.moving = false;
        return false;
      }
      return true;
    }
    if (a.path.length === 0) {
      a.moving = false;
      return false;
    }
    let budget = a.speed * dt;
    while (budget > 0 && a.path.length) {
      const target = a.path[0];
      const dx = target.x - a.pos.x;
      const dy = target.y - a.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-4) a.facing = dirFromDelta(dx, dy, a.facing);
      if (dist <= budget) {
        a.pos.x = target.x;
        a.pos.y = target.y;
        a.path.shift();
        budget -= dist;
      } else {
        a.pos.x += (dx / dist) * budget;
        a.pos.y += (dy / dist) * budget;
        budget = 0;
      }
    }
    a.moving = a.path.length > 0;
    return a.moving;
  }

  tweenActor(a: Actor, to: Vec, dur: number, facing?: Dir) {
    a.path = [];
    a.tween = { from: { ...a.pos }, to, t: 0, dur };
    a.facing = facing ?? dirFromDelta(to.x - a.pos.x, to.y - a.pos.y, a.facing);
  }

  /** Re-plan every walking actor after furniture moved. */
  layoutChanged() {
    for (const a of [this.player, ...this.customers]) {
      if (a.path.length && a.goals.length) {
        if (!this.walkTo(a, a.goals)) a.path = [];
      }
    }
  }

  // ---------- owner ----------

  playerTarget: { objectId: number } | null = null;

  /** Tap on the floor. */
  playerWalkTo(t: Vec): boolean {
    this.playerTarget = null;
    return this.walkTo(this.player, [t]);
  }

  /** Tap on an interactive object: walk to it, then interact on arrival. */
  playerInteract(o: PlacedObject): boolean {
    const d = getDef(o.defId);
    if (!d.interact) return false;
    if (this.canInteract(o)) {
      this.player.path = [];
      this.facePlayerTo(o);
      this.emit({ type: "interact", objectId: o.id });
      return true;
    }
    const spot = worldInteractSpot(d, o.x, o.y, o.rot)!;
    const goals = this.walkable(spot.spot.x, spot.spot.y) ? [spot.spot] : this.interactRing(o);
    if (!this.walkTo(this.player, goals)) return false;
    this.playerTarget = { objectId: o.id };
    return true;
  }

  private interactRing(o: PlacedObject): Vec[] {
    const { w, h } = rotatedSize(getDef(o.defId), o.rot);
    const out: Vec[] = [];
    for (let y = o.y - 1; y <= o.y + h; y++)
      for (let x = o.x - 1; x <= o.x + w; x++) if (this.walkable(x, y)) out.push({ x, y });
    return out;
  }

  /** Deliberately strict: the owner must be standing right next to the object. */
  canInteract(o: PlacedObject): boolean {
    const d = getDef(o.defId);
    if (!d.interact || this.player.tween) return false;
    const { w, h } = rotatedSize(d, o.rot);
    return distToRect(this.tileOf(this.player), o.x, o.y, w, h) <= 1;
  }

  nearestInteractable(): PlacedObject | null {
    let best: PlacedObject | null = null;
    let bestD = Infinity;
    for (const o of this.objects.values()) {
      if (o.id === this.liftedId || !this.canInteract(o)) continue;
      const { w, h } = rotatedSize(getDef(o.defId), o.rot);
      const d = Math.hypot(o.x + w / 2 - this.player.pos.x, o.y + h / 2 - this.player.pos.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  facePlayerTo(o: PlacedObject) {
    const d = getDef(o.defId);
    const spot = worldInteractSpot(d, o.x, o.y, o.rot);
    const t = this.tileOf(this.player);
    if (spot && spot.spot.x === t.x && spot.spot.y === t.y) {
      this.player.facing = spot.facing;
      return;
    }
    const { w, h } = rotatedSize(d, o.rot);
    this.player.facing = dirFromDelta(o.x + w / 2 - this.player.pos.x, o.y + h / 2 - this.player.pos.y, "up");
  }

  // ---------- economy ----------

  earn(amount: number, at: Vec) {
    this.cash += amount;
    this.stats.revenue += amount;
    this.lifetime.revenue += amount;
    this.emit({ type: "cash", amount, at: { ...at } });
  }

  spend(amount: number): boolean {
    if (this.cash < amount) return false;
    this.cash -= amount;
    this.emit({ type: "cash", amount: -amount, at: { ...this.player.pos } });
    return true;
  }

  /** The front desk: members swipe in, regulars may sign up, everyone else buys a day pass. */
  checkIn(person: Person, at: Vec): "member" | "newMember" | "pass" {
    if (person.memberUntil >= this.day) {
      this.stats.memberVisits++;
      return "member";
    }
    const regular =
      person.visits >= BALANCE.membershipMinVisits && person.happiness >= BALANCE.membershipMinHappiness;
    if (regular && this.rng.chance(BALANCE.membershipChance)) {
      person.memberUntil = this.day + BALANCE.membershipDays - 1;
      this.stats.newMembers++;
      this.earn(BALANCE.membershipPrice, at);
      this.hint(
        "firstMember",
        `${person.name} bought a membership! Members pay ${"$" + BALANCE.membershipPrice} up front for a week of visits.`,
      );
      return "newMember";
    }
    this.stats.dayPasses++;
    this.earn(BALANCE.dayPassPrice, at);
    this.hint("firstPay", "Ka-ching! Customers pay at the front desk when they check in.");
    return "pass";
  }

  activeMembers(): number {
    let n = 0;
    for (const p of this.people.values()) if (p.memberUntil >= this.day) n++;
    return n;
  }

  /** Who walks in next: often a regular (happy ones and members more so), otherwise someone new. */
  pickVisitor(newPerson: () => Omit<Person, "pid">): Person {
    const inside = new Set(this.customers.map((c) => c.pid));
    const candidates = [...this.people.values()].filter((p) => !inside.has(p.pid) && p.lastDay !== this.day);
    const returning = Math.min(BALANCE.maxReturningChance, this.people.size / 40);
    if (candidates.length && this.rng.chance(returning)) {
      const weight = (p: Person) => Math.max(0.05, p.happiness / 5) ** 2 * (p.memberUntil >= this.day ? 3 : 1);
      const total = candidates.reduce((a, p) => a + weight(p), 0);
      let r = this.rng.next() * total;
      for (const p of candidates) {
        r -= weight(p);
        if (r <= 0) return p;
      }
      return candidates[candidates.length - 1];
    }
    const p: Person = { pid: this.nextPid++, ...newPerson() };
    this.people.set(p.pid, p);
    if (this.people.size > BALANCE.maxRegulars) {
      // Forget the least happy non-member.
      const drop = [...this.people.values()]
        .filter((x) => x.memberUntil < this.day && x !== p)
        .sort((a, b) => a.happiness - b.happiness)[0];
      if (drop) this.people.delete(drop.pid);
    }
    return p;
  }

  recordDeparture(satisfaction: number, person?: Person) {
    if (person) {
      person.visits++;
      person.lastDay = this.day;
      person.happiness = person.visits === 1 ? satisfaction : person.happiness * 0.6 + satisfaction * 0.4;
    }
    this.stats.departures++;
    this.stats.satisfactionSum += satisfaction;
    this.rating += (satisfaction - this.rating) * BALANCE.ratingWeight;
    this.rating = Math.max(0, Math.min(5, this.rating));
  }

  arrivalsPerHour(hour: number): number {
    const curve = BALANCE.hourCurve[hour] ?? 0;
    const ratingMult = 0.5 + 0.5 * this.rating;
    const appealMult = 0.4 + 0.4 * this.appeal().total;
    return BALANCE.baseArrivalsPerHour * curve * ratingMult * appealMult;
  }

  isUnlocked(def: EquipmentDef) {
    return (def.unlockRating ?? 0) <= this.rating + 1e-9;
  }

  // ---------- time ----------

  tick(realDt: number) {
    const dtReal = Math.min(realDt, 0.1);
    // The owner always moves in real time, even when the gym clock is fast-forwarded.
    if (!this.paused) this.updatePlayer(dtReal);
    if (this.paused || this.dayOver) return;

    const dt = dtReal * this.speed;
    const dtMin = dt * BALANCE.gameMinutesPerSecond;
    this.minute += dtMin;

    if (this.minute < BALANCE.lastEntryMinute) {
      this.arrivalAcc += (this.arrivalsPerHour(Math.floor(this.minute / 60)) / 60) * dtMin;
      if (this.arrivalAcc >= this.nextArrival) {
        this.arrivalAcc -= this.nextArrival;
        this.nextArrival = this.rng.range(0.4, 1.6);
        spawnCustomer(this);
      }
    }

    for (const c of [...this.customers]) updateCustomer(this, c, dt, dtMin);

    const hour = Math.floor(this.minute / 60);
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.emit({ type: "save" });
    }

    this.checkHints();

    if (this.minute >= BALANCE.closeMinute && this.customers.length === 0) this.endDay();
  }

  /** Hold a pose (drinking, typing) for a while; walking cancels it. */
  private playerPoseTimer = 0;

  setPlayerPose(pose: Pose, seconds: number) {
    this.player.pose = pose;
    this.playerPoseTimer = seconds;
  }

  private updatePlayer(dt: number) {
    const wasMoving = this.player.path.length > 0;
    this.stepActor(this.player, dt);
    if (this.player.moving) this.playerPoseTimer = 0;
    if (this.playerPoseTimer > 0) this.playerPoseTimer -= dt;
    else this.player.pose = "idle";
    if (wasMoving && this.player.path.length === 0 && this.playerTarget) {
      const o = this.objects.get(this.playerTarget.objectId);
      this.playerTarget = null;
      if (o && this.canInteract(o)) {
        this.facePlayerTo(o);
        this.emit({ type: "interact", objectId: o.id });
      }
    }
  }

  private checkHints() {
    if (this.cash >= 250 && this.countOf("treadmill_used") === 1)
      this.hint("canAfford", "You can afford a second treadmill! Use the computer in your office.");
    if (this.rating >= 2) this.hint("bike", "Your rating hit 2 stars. The Stationary Bike is now in the store!");
  }

  private endDay() {
    this.dayOver = true;
    const rent = BALANCE.dailyRent;
    this.cash -= rent;
    const summary: DaySummary = {
      ...this.stats,
      day: this.day,
      rent,
      net: this.stats.revenue - rent,
      ratingStart: this.ratingAtDayStart,
      ratingEnd: this.rating,
    };
    this.emit({ type: "dayEnd", summary });
  }

  nextDay() {
    this.day++;
    this.minute = BALANCE.openMinute;
    this.lastHour = Math.floor(this.minute / 60);
    this.stats = emptyStats();
    this.ratingAtDayStart = this.rating;
    this.dayOver = false;
    this.emit({ type: "save" });
  }

  // ---------- save ----------

  toSave(): SaveData {
    return {
      v: 1,
      // A finished day saves as the start of the next one.
      day: this.dayOver ? this.day + 1 : this.day,
      minute: this.dayOver ? BALANCE.openMinute : this.minute,
      cash: this.cash,
      rating: this.rating,
      objects: [...this.objects.values()].map((o) => ({ def: o.defId, x: o.x, y: o.y, rot: o.rot })),
      lifetime: { ...this.lifetime },
      hints: [...this.hintsSeen],
      people: [...this.people.values()],
      speed: this.speed,
      savedAt: Date.now(),
    };
  }
}

function emptyStats(): DayStats {
  return {
    visitors: 0,
    workouts: 0,
    gaveUp: 0,
    revenue: 0,
    satisfactionSum: 0,
    departures: 0,
    dayPasses: 0,
    newMembers: 0,
    memberVisits: 0,
  };
}

export function clockLabel(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${mm.toString().padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export function ratingLabel(r: number): string {
  if (r < 1.75) return "Barely a gym";
  if (r < 2.5) return "Neighborhood secret";
  if (r < 3.25) return "Solid local spot";
  if (r < 4) return "Popular gym";
  return "Fitness destination";
}
