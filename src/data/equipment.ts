import type { Dir, Vec } from "../sim/types";

export type Category =
  | "cardio"
  | "strength"
  | "amenity"
  | "decor"
  | "office"
  | "fixture";

export type Pose = "idle" | "walk" | "run" | "pedal" | "drink";

export interface UseSlot {
  /** Where the user's feet go, in footprint-local tile units (fractional). */
  stand: Vec;
  /** Tiles (footprint-local, outside the footprint) a user walks to before stepping on. */
  access: Vec[];
  facing: Dir;
  pose: Pose;
}

export interface EquipmentDef {
  id: string;
  name: string;
  category: Category;
  /** 0 = not for sale in the store. */
  price: number;
  description: string;
  /** Shown when the owner taps the object. */
  flavor: string;
  footprint: { w: number; h: number };
  rotatable: boolean;
  movable: boolean;
  /** Characters can walk over it (chairs, mats). */
  walkable?: boolean;
  /** "low" objects are drawn under anyone standing inside their footprint. */
  layer: "low" | "tall";
  /** What customers come here to do. */
  activity?: "cardio" | "hydrate" | "checkin";
  slots: UseSlot[];
  /** In-game minutes per use. */
  useMinutes?: [number, number];
  /** Paid when a workout on this machine is completed. */
  revenue: number;
  /** Added to a customer's visit satisfaction when they use it. */
  satisfaction: number;
  /** How much it makes the gym attractive to new customers. */
  appeal: number;
  /** Minimum star rating before it shows up for purchase. */
  unlockRating?: number;
  /** What the owner can do with it. */
  interact?: { kind: "computer" | "drink"; spot: Vec; facing: Dir; label: string };
}

const defs: EquipmentDef[] = [
  {
    id: "treadmill_used",
    name: "Creaky Treadmill",
    category: "cardio",
    price: 250,
    description: "Pre-loved, held together with duct tape. It squeaks, but it runs.",
    flavor: "It squeaks. Customers call it 'character'.",
    footprint: { w: 2, h: 3 },
    rotatable: true,
    movable: true,
    layer: "low",
    activity: "cardio",
    slots: [
      {
        stand: { x: 1, y: 1.9 },
        access: [
          { x: 0, y: 3 },
          { x: 1, y: 3 },
        ],
        facing: "up",
        pose: "run",
      },
    ],
    useMinutes: [20, 40],
    revenue: 5,
    satisfaction: 0.4,
    appeal: 1,
  },
  {
    id: "bike_basic",
    name: "Stationary Bike",
    category: "cardio",
    price: 450,
    description: "A sturdy upright bike. Quieter than the treadmill, and people love it.",
    flavor: "Goes nowhere, fast.",
    footprint: { w: 1, h: 2 },
    rotatable: true,
    movable: true,
    layer: "low",
    activity: "cardio",
    slots: [
      {
        stand: { x: 0.5, y: 1.45 },
        access: [{ x: 0, y: 2 }],
        facing: "up",
        pose: "pedal",
      },
    ],
    useMinutes: [20, 35],
    revenue: 6,
    satisfaction: 0.7,
    appeal: 1.2,
    unlockRating: 2,
  },
  {
    id: "water_cooler",
    name: "Water Cooler",
    category: "amenity",
    price: 80,
    description: "Hydration station. Customers who grab a drink leave happier.",
    flavor: "Glug glug. The jug is suspiciously old.",
    footprint: { w: 1, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    activity: "hydrate",
    slots: [
      {
        stand: { x: 0.5, y: 1.5 },
        access: [{ x: 0, y: 1 }],
        facing: "up",
        pose: "drink",
      },
    ],
    useMinutes: [3, 5],
    revenue: 0,
    satisfaction: 0.3,
    appeal: 0.3,
    interact: { kind: "drink", spot: { x: 0, y: 1 }, facing: "up", label: "Grab a drink" },
  },
  {
    id: "potted_plant",
    name: "Potted Plant",
    category: "decor",
    price: 30,
    description: "A little green goes a long way. Slightly boosts appeal and happiness.",
    flavor: "You named it Gary.",
    footprint: { w: 1, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0.15,
  },
  {
    id: "trash_can",
    name: "Trash Can",
    category: "decor",
    price: 25,
    description: "A place for empty bottles. Customers notice the effort.",
    flavor: "Empty. For now.",
    footprint: { w: 1, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0.1,
  },
  {
    id: "office_desk",
    name: "Office Desk",
    category: "office",
    price: 0,
    description: "",
    flavor: "Your desk. The computer still works. Mostly.",
    footprint: { w: 2, h: 1 },
    rotatable: false,
    movable: false,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0,
    interact: { kind: "computer", spot: { x: 0, y: 1 }, facing: "up", label: "Use Computer" },
  },
  {
    id: "office_chair",
    name: "Office Chair",
    category: "office",
    price: 0,
    description: "",
    flavor: "One wheel is missing. It leans.",
    footprint: { w: 1, h: 1 },
    rotatable: false,
    movable: false,
    walkable: true,
    layer: "low",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0,
  },
  {
    id: "filing_cabinet",
    name: "Filing Cabinet",
    category: "office",
    price: 0,
    description: "",
    flavor: "Full of the previous tenant's tax returns. Yikes.",
    footprint: { w: 1, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0,
  },
  {
    id: "storage_shelf",
    name: "Storage Shelf",
    category: "fixture",
    price: 0,
    description: "",
    flavor: "Paint cans, a box of cables, and one mystery shoe.",
    footprint: { w: 3, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0,
  },
  {
    id: "lockers",
    name: "Old Lockers",
    category: "amenity",
    price: 0,
    description: "",
    flavor: "Locker #2 doesn't close. Locker #3 doesn't open.",
    footprint: { w: 3, h: 1 },
    rotatable: false,
    movable: true,
    layer: "tall",
    slots: [],
    revenue: 0,
    satisfaction: 0,
    appeal: 0.2,
  },
  {
    id: "checkin_desk",
    name: "Check-in Desk",
    category: "fixture",
    price: 0,
    description: "",
    flavor: "The front desk. Someday you'll hire someone to stand here.",
    footprint: { w: 4, h: 1 },
    rotatable: false,
    movable: false,
    layer: "tall",
    activity: "checkin",
    slots: [
      { stand: { x: 1.5, y: 1.5 }, access: [{ x: 1, y: 1 }], facing: "up", pose: "idle" },
      { stand: { x: 2.5, y: 1.5 }, access: [{ x: 2, y: 1 }], facing: "up", pose: "idle" },
    ],
    revenue: 0,
    satisfaction: 0,
    appeal: 0,
  },
];

export const EQUIPMENT: Record<string, EquipmentDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export function getDef(id: string): EquipmentDef {
  const d = EQUIPMENT[id];
  if (!d) throw new Error(`Unknown equipment: ${id}`);
  return d;
}

/** Items that appear in the computer store, in display order. */
export const STORE_ITEMS = defs.filter((d) => d.price > 0).map((d) => d.id);
