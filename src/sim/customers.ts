import { BALANCE } from "../data/balance";
import { getDef } from "../data/equipment";
import { ENTRANCE } from "../data/layout";
import { worldInteractSpot, worldSlot } from "./geometry";
import { dirFromDelta, key, type Vec } from "./types";
import type { Actor, Person, PlacedObject, World } from "./world";

export type CustomerState =
  | "enter"
  | "toDesk"
  | "checkin"
  | "choose"
  | "toMachine"
  | "mount"
  | "using"
  | "dismount"
  | "toWait"
  | "waiting"
  | "leave"
  | "exit";

export interface Customer extends Actor {
  kind: "customer";
  /** The townsperson this visit belongs to. */
  pid: number;
  person: Person;
  name: string;
  state: CustomerState;
  /** In-game minutes left in the current timed state. */
  timer: number;
  target: { objectId: number; slot: number; access: Vec } | null;
  waited: number;
  patience: number;
  drank: boolean;
  workedOut: boolean;
  gaveUp: boolean;
  machineSatisfaction: number;
  doorX: number;
  waitSpot: Vec | null;
  /** What they're thinking right now (shown when tapped). */
  thought: string;
}

export const CUSTOMER_LOOKS = 16;

const NAMES = [
  "Dana", "Marcus", "Priya", "Tom", "Keisha", "Luis", "Mei", "Ollie", "Rosa", "Jamal", "Hannah", "Theo",
  "Ana", "Sam", "Grace", "Dev", "Nina", "Carlos", "Ivy", "Ben", "Zara", "Mo", "Lena", "Ray", "Tasha",
  "Eli", "June", "Omar", "Kat", "Will", "Sofia", "Hugo", "Bea", "Andre", "Ruby", "Kenji", "Lola", "Finn",
];

const LINES = {
  arrive: ["So this is a gym?", "Smells like... warehouse.", "Cozy. In a weird way.", "Is this place new?", "Cardio time!"],
  regular: ["Back again!", "Same time as usual.", "Missed this place.", "Hey boss!"],
  member: ["Member!", "*beep*", "Card works!"],
  newMember: ["Sign me up for a week!", "I'll take a membership!", "Worth it. Membership please!"],
  wait: ["Treadmill's taken...", "I'll wait. I guess.", "Only one machine?!", "Hurry up, buddy..."],
  giveUp: ["Forget it.", "I'm not waiting all day!", "I'll try somewhere else.", "Ugh. Next time."],
  finishTreadmill: ["Phew!", "That treadmill squeaks.", "Not bad!", "Feeling great!"],
  fewMachines: ["Needs more machines.", "One treadmill. Bold choice."],
  finishBike: ["Love this bike!", "Legs = jelly.", "Smooth ride!"],
  drink: ["Ahh, refreshing.", "Hydration!", "Water tastes... vintage."],
};

export function spawnCustomer(w: World): Customer {
  const door = w.rng.pick(ENTRANCE);
  const person = w.pickVisitor(() => ({
    name: w.rng.pick(NAMES),
    look: `c${w.rng.int(0, CUSTOMER_LOOKS - 1)}`,
    visits: 0,
    happiness: 0,
    memberUntil: 0,
    lastDay: 0,
  }));
  const c: Customer = {
    id: w.newId(),
    kind: "customer",
    pid: person.pid,
    person,
    look: person.look,
    name: person.name,
    pos: { x: door.x + 0.5, y: door.y + 1.4 },
    facing: "up",
    path: [],
    goals: [],
    speed: BALANCE.customerSpeed * w.rng.range(0.9, 1.1),
    moving: false,
    pose: "idle",
    animT: 0,
    tween: null,
    state: "enter",
    timer: 0,
    target: null,
    waited: 0,
    patience: w.rng.range(...BALANCE.patienceMinutes),
    drank: false,
    workedOut: false,
    gaveUp: false,
    machineSatisfaction: 0,
    doorX: door.x,
    waitSpot: null,
    thought: person.visits > 0 ? "Back for another workout." : "Here for a workout.",
  };
  w.tweenActor(c, { x: door.x + 0.5, y: door.y + 0.5 }, 0.7, "up");
  w.customers.push(c);
  w.stats.visitors++;
  w.lifetime.visitors++;
  return c;
}

function say(w: World, c: Customer, lines: string[], chance = 1) {
  if (w.rng.chance(chance)) w.emit({ type: "bubble", actorId: c.id, text: w.rng.pick(lines) });
}

export function updateCustomer(w: World, c: Customer, dt: number, dtMin: number) {
  const travelling = w.stepActor(c, dt);
  switch (c.state) {
    case "enter":
      if (!travelling) goToDesk(w, c);
      break;
    case "toDesk":
      if (!travelling) {
        c.facing = "up";
        c.state = "checkin";
        c.pose = "checkin";
        c.timer = 3;
        c.thought = "Checking in.";
        // Pay (or swipe a membership card) at the counter.
        const paid = w.checkIn(c.person, { x: c.pos.x, y: c.pos.y - 1.8 });
        if (paid === "newMember") say(w, c, LINES.newMember);
        else if (paid === "member") say(w, c, LINES.member, 0.4);
        else say(w, c, c.person.visits > 0 ? LINES.regular : LINES.arrive, 0.3);
      }
      break;
    case "checkin":
      c.timer -= dtMin;
      if (c.timer <= 0) {
        c.pose = "idle";
        c.state = "choose";
      }
      break;
    case "choose":
      if (!tryClaimMachine(w, c)) goWait(w, c);
      break;
    case "toMachine":
      if (!travelling) mount(w, c);
      break;
    case "mount":
      if (!travelling) {
        const o = targetObject(w, c);
        if (!o) return leave(w, c);
        const def = getDef(o.defId);
        o.slots[c.target!.slot].state = "inuse";
        c.facing = worldSlot(def, o.x, o.y, o.rot, c.target!.slot).facing;
        c.pose = def.slots[c.target!.slot].pose;
        c.state = "using";
        c.timer = w.rng.range(...(def.useMinutes ?? [20, 30]));
        c.thought = def.activity === "hydrate" ? "Thirsty!" : `Working out on the ${def.name.toLowerCase()}.`;
      }
      break;
    case "using":
      c.timer -= dtMin;
      if (c.timer <= 0) {
        c.pose = "idle";
        const to = c.target!.access;
        w.tweenActor(c, { x: to.x + 0.5, y: to.y + 0.5 }, 0.4);
        c.state = "dismount";
      }
      break;
    case "dismount":
      if (!travelling) finishUse(w, c);
      break;
    case "toWait":
    case "waiting":
      c.waited += dtMin;
      if (c.state === "toWait" && !travelling) {
        c.state = "waiting";
        faceNearestMachine(w, c);
      }
      if (tryClaimMachine(w, c)) break;
      if (c.waited >= c.patience) {
        c.gaveUp = true;
        w.stats.gaveUp++;
        say(w, c, LINES.giveUp);
        leave(w, c);
      }
      break;
    case "leave":
      if (!travelling) {
        c.state = "exit";
        w.tweenActor(c, { x: c.pos.x, y: c.pos.y + 1 }, 0.6, "down");
      }
      break;
    case "exit":
      if (!travelling) depart(w, c);
      break;
  }
}

function targetObject(w: World, c: Customer): PlacedObject | undefined {
  return c.target ? w.objects.get(c.target.objectId) : undefined;
}

function goToDesk(w: World, c: Customer) {
  const desks = w.objectsWith("checkin");
  const goals = desks.flatMap((o) => getDef(o.defId).slots.flatMap((_, i) => worldSlot(getDef(o.defId), o.x, o.y, o.rot, i).access));
  if (goals.length && w.walkTo(c, goals)) {
    c.state = "toDesk";
  } else {
    c.state = "choose";
  }
}

/** Find a free machine (cardio for now), reserve it and start walking. */
function tryClaimMachine(w: World, c: Customer): boolean {
  const options: { o: PlacedObject; slot: number; score: number; access: Vec[] }[] = [];
  for (const o of w.objectsWith("cardio")) {
    if (o.id === w.liftedId) continue;
    const def = getDef(o.defId);
    o.slots.forEach((s, i) => {
      if (s.state !== "free") return;
      const ws = worldSlot(def, o.x, o.y, o.rot, i);
      const d = Math.hypot(ws.stand.x - c.pos.x, ws.stand.y - c.pos.y);
      options.push({ o, slot: i, access: ws.access, score: def.satisfaction + w.rng.next() * 0.6 - d * 0.03 });
    });
  }
  options.sort((a, b) => b.score - a.score);
  for (const opt of options) {
    if (!w.walkTo(c, opt.access)) continue;
    const last = c.path[c.path.length - 1];
    const access = { x: Math.floor(last.x), y: Math.floor(last.y) };
    opt.o.slots[opt.slot] = { state: "reserved", by: c.id };
    c.target = { objectId: opt.o.id, slot: opt.slot, access };
    c.state = "toMachine";
    c.waitSpot = null;
    c.thought = `Heading to the ${getDef(opt.o.defId).name.toLowerCase()}.`;
    return true;
  }
  return false;
}

function mount(w: World, c: Customer) {
  const o = targetObject(w, c);
  if (!o) return leave(w, c);
  const def = getDef(o.defId);
  const ws = worldSlot(def, o.x, o.y, o.rot, c.target!.slot);
  w.tweenActor(c, ws.stand, def.activity === "hydrate" ? 0.2 : 0.45, ws.facing);
  c.state = "mount";
}

function finishUse(w: World, c: Customer) {
  const o = targetObject(w, c);
  const def = o ? getDef(o.defId) : null;
  if (o) o.slots[c.target!.slot] = { state: "free", by: 0 };
  c.target = null;
  if (def?.activity === "hydrate") {
    c.drank = true;
    say(w, c, LINES.drink, 0.35);
    return leave(w, c);
  }
  if (def) {
    c.workedOut = true;
    c.machineSatisfaction = def.satisfaction;
    w.stats.workouts++;
    w.lifetime.workouts++;
    const lines = def.id.startsWith("bike") ? LINES.finishBike : [...LINES.finishTreadmill];
    if (w.objectsWith("cardio").length <= 2) lines.push(...LINES.fewMachines);
    say(w, c, lines, 0.35);
  }
  // Maybe grab a drink on the way out.
  if (w.rng.chance(BALANCE.coolerChance) && tryClaimCooler(w, c)) return;
  leave(w, c);
}

function tryClaimCooler(w: World, c: Customer): boolean {
  for (const o of w.objectsWith("hydrate")) {
    if (o.id === w.liftedId) continue;
    const def = getDef(o.defId);
    for (let i = 0; i < o.slots.length; i++) {
      if (o.slots[i].state !== "free") continue;
      const ws = worldSlot(def, o.x, o.y, o.rot, i);
      if (!w.walkTo(c, ws.access)) continue;
      o.slots[i] = { state: "reserved", by: c.id };
      c.target = { objectId: o.id, slot: i, access: ws.access[0] };
      c.state = "toMachine";
      c.thought = "Getting some water.";
      return true;
    }
  }
  return false;
}

function goWait(w: World, c: Customer) {
  const machines = w.objectsWith("cardio");
  if (machines.length === 0) {
    say(w, c, ["No machines?!"]);
    c.gaveUp = true;
    w.stats.gaveUp++;
    return leave(w, c);
  }
  w.hint(
    "firstWait",
    "Every machine is busy! Customers wait a little, then leave unhappy. More machines = shorter waits.",
  );
  say(w, c, LINES.wait, 0.6);
  c.thought = "Waiting for a free machine...";
  const spot = pickWaitSpot(w, c);
  c.waitSpot = spot;
  if (spot && w.walkTo(c, [spot])) c.state = "toWait";
  else {
    c.state = "waiting";
    faceNearestMachine(w, c);
  }
}

/** A spot near the machines that doesn't get in anyone's way (not hugging any furniture). */
function pickWaitSpot(w: World, c: Customer): Vec | null {
  const reserved = new Set<string>();
  for (const req of w.requiredTiles(null)) for (const t of req.tiles) reserved.add(key(t.x, t.y));
  for (const o of w.customers) if (o !== c && o.waitSpot) reserved.add(key(o.waitSpot.x, o.waitSpot.y));
  for (const o of w.objects.values()) {
    const s = worldInteractSpot(getDef(o.defId), o.x, o.y, o.rot);
    if (s) reserved.add(key(s.spot.x, s.spot.y));
  }
  const open = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!w.walkable(x + dx, y + dy)) return false;
    return true;
  };
  const machines = w.objectsWith("cardio");
  for (let tries = 0; tries < 60; tries++) {
    const m = w.rng.pick(machines);
    const x = m.x + w.rng.int(-4, 5);
    const y = m.y + w.rng.int(-1, 6);
    if (w.tile(x, y) !== "floor" || !open(x, y) || reserved.has(key(x, y))) continue;
    return { x, y };
  }
  return null;
}

function faceNearestMachine(w: World, c: Customer) {
  let best: Vec | null = null;
  let bestD = Infinity;
  for (const o of w.objectsWith("cardio")) {
    const d = Math.hypot(o.x - c.pos.x, o.y - c.pos.y);
    if (d < bestD) {
      bestD = d;
      best = { x: o.x + 1, y: o.y + 1 };
    }
  }
  if (best) c.facing = dirFromDelta(best.x - c.pos.x, best.y - c.pos.y, c.facing);
}

function leave(w: World, c: Customer) {
  c.pose = "idle";
  c.waitSpot = null;
  c.thought = c.gaveUp ? "Not impressed." : "Heading home.";
  if (w.walkTo(c, ENTRANCE)) c.state = "leave";
  else depart(w, c);
}

function depart(w: World, c: Customer) {
  let s: number;
  if (c.gaveUp || !c.workedOut) {
    s = BALANCE.gaveUpSatisfaction;
  } else {
    const decor = Math.min(BALANCE.maxDecorSatisfaction, w.appeal().decor * BALANCE.decorSatisfactionPerAppeal);
    const waitPenalty = Math.min(BALANCE.maxWaitPenalty, c.waited * BALANCE.waitPenaltyPerMinute);
    const cooler = c.drank ? getDef("water_cooler").satisfaction : 0;
    s = BALANCE.baseVisitSatisfaction + c.machineSatisfaction + decor + cooler - waitPenalty;
  }
  w.recordDeparture(Math.max(0, Math.min(5, s)), c.person);
  w.customers = w.customers.filter((x) => x !== c);
}
