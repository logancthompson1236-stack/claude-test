# Iron & Dust — Design Doc

*Working title. Living document: update it as decisions change.*

> **A cozy 16-bit gym-management sim where you turn a dusty old warehouse into a thriving fitness empire.**

You've rented a cheap, run-down warehouse and you're trying to turn it into a real gym. You walk around as the owner, buy and arrange equipment from the office computer, and watch customers come in and use it. Over hours of play the place transforms from sad and scrappy to busy and polished, and you can see it.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Engine | **Phaser 3 + TypeScript + Vite**, runs in the browser |
| Shipping | Playable from a link (GitHub Pages) during development; wrapped with **Capacitor** for Android/iOS app stores at release |
| Orientation | **Landscape** |
| Controls | **Tap/click-to-move** by default (touch and mouse). No permanent D-pad. Optional virtual joystick later. |
| Pacing | **Hybrid**: day-based sessions while playing, plus a capped "while you were away" membership payout |
| Expansion | **Outward first** (reclaim more of the warehouse), **then upward** (mezzanine/second floor, basement) |
| Art | Warm, readable top-down pixel art (Stardew / Tiny Tower feel). Charming, not grim. |

---

## 2. Design pillars

1. **Visible transformation.** Progress should show in the room itself, not just in the money counter. Someone looking at the gym after 5 hours should see how far it has come.
2. **You are physically there.** The owner walks to things and uses them. The computer is an object in the office, not a floating menu.
3. **Customers visibly use the gym.** They walk in, pick a machine, get on it, work out and then pay. Machines never just print money.
4. **Approachable depth.** Systems get deeper over time, but it's a cozy game, not accounting software.
5. **Readability over detail.** A treadmill must obviously be a treadmill. Customers must stand out from furniture.

---

## 3. Visual style and camera

- **Perspective:** top-down with a slight 3/4 tilt, Stardew style. You see the top and front face of objects, and walls show their front face.
- **Tiles:** 16×16 px, rendered at an integer scale (pixel-perfect, no blurring).
- **Camera:** follows the player smoothly. Drag to pan while in Move/Placement mode. Pinch/scroll zoom, clamped between 2 or 3 sensible levels.
- **Mood early on:** dusty concrete, cracks, stains, cobwebs in the corners, a flickering light, a boarded window, mismatched cheap furniture. The goal is *"scrappy little business I'm excited to fix up,"* not *"depressing abandoned building."*
- **Humor:** slightly exaggerated proportions, funny customer comments, and a retro computer OS ("GymOS 95").

---

## 4. Controls and interaction

- **Tap the floor** and the owner pathfinds there, avoiding walls, office walls and equipment.
- **Tap an object** and the owner walks to its interaction spot, then interacts when they arrive.
- **Proximity is strict.** Interaction only becomes available within about 1 tile of an object's interaction spot. You can never use the computer from across the room.
- **Feedback stays small:** a subtle outline on the nearest interactable, plus one context button (e.g. "Use Computer"). The screen isn't covered in permanent prompts.
- **Desktop:** the mouse does the same things. Esc closes menus. R rotates in placement mode.

---

## 5. Starting layout

The building is a rectangular warehouse, about 28 × 16 tiles, and starts out deliberately sparse.

```
############################
#~DD..F#..W.......SSS..LLL~#
#.h....#...................#
#......#....,..............#
#......#...................#
###..###...................#
#................TT........#
#................TT........#
#................TT........L
#....,.....................L
#..........................#
#....................,.....#
#...........RRRR...........#
#..........................#
#............kk............#
#############==#############
```

| Symbol | Meaning |
|---|---|
| `#` | Wall |
| `.` | Floor |
| `=` | Main entrance |
| `~` | Cobwebs |
| `,` | Cracks or stains |
| `D` | Office desk with the computer |
| `h` | Office chair |
| `F` | Filing cabinet |
| `W` | Water cooler |
| `S` | Storage shelf |
| `L` | Lockers (top wall) / padlocked roll-up door (right wall) |
| `k` | Doormat; kept clear |
| `T` | The one cheap treadmill (2×3) |
| `R` | Check-in desk (centered on the entrance) |

**Office (upper-left):** enclosed and built into the warehouse. Two of its sides are the building's outer walls. A clean 2-tile doorway faces the gym floor. There are no stray one-tile strips or odd wall offsets.

**Check-in desk:** just inside the entrance, centered on it.

**Starting equipment:** one cheap treadmill, and nothing else. No benches, dumbbells, bikes or tires; those are purchases.

**Expansion hook:** a padlocked roll-up door on the right wall leads to the back warehouse, which is the first expansion. A rusty staircase to the mezzanine comes later.

The back wall also has a hand-painted "GYM" bedsheet banner, a boarded-up window and a fuse box. The office has a calendar, and the lighting is dim and patchy, with one light that flickers. Fixing the lights is a planned v0.2 upgrade.

---

## 6. Management computer ("Computer Mode")

Walk into the office and use the computer to enter **Computer Mode**:

- A large, centered "monitor" UI, styled as a retro OS.
- Player movement is locked while it's open, with an obvious **✕ Close** button. Closing it returns you to gameplay.
- Apps, shown as tabs or desktop icons, added over time:
  - **v0.1:** Store, Stats (cash, day, visits, rating)
  - **Later:** Upgrades, Staff, Memberships & Pricing, Marketing, Expansion, Finances

This is the central management hub. New systems plug in as new "apps."

---

## 7. Placement system (buy and move share it)

There is **one reusable placement system**. Buying an item and moving an existing item both open the same kind of placement session.

**Buy flow:** Store → select item → Buy → Computer Mode closes → a ghost preview appears in the gym → drag it into place → ✔ Confirm (or ✕ Cancel, which refunds).

**The placement session:**
- The ghost follows your finger or cursor. On touch you drag the ghost itself; dragging elsewhere pans the camera.
- **Green tint** means a valid spot and **red** means invalid. You can't confirm an invalid spot.
- **Rotate ⟳** turns the item in 90° steps, and its footprint rotates with it. Rotation is defined once, generically, for all rotatable items.
- **What makes a spot invalid:**
  - Overlapping walls, the office, other objects or the entrance.
  - The item's use spot is blocked.
  - The placement would cut off the path between the entrance, the check-in desk, the office door, or any machine's use spot. The pathfinder checks this.

**Snapping:** positions snap to the tile grid under the hood. That keeps pathfinding and collision rock-solid. The grid itself stays invisible except for a faint hint while dragging, so it never feels like fighting a grid. On top of that, **smart alignment** helps:
- Edges and centers line up with nearby objects, shown with thin guide lines.
- Matching spacing is suggested: put a second treadmill next to the first and it slides into a neat row with the same gap.
- Parallel facing is suggested when you place next to the same kind of item.

**Move Mode:** a toolbar button. It stays on until you press **Done**. In Move Mode you tap an item to pick it up, which starts a placement session, then confirm (or cancel to put it back). You can then pick up the next item. Selling or storing an item comes later.

---

## 8. Data-driven equipment

Every placeable object is defined as data. Adding a machine should mean adding a definition and a sprite, not new gameplay code.

```ts
interface EquipmentDef {
  id: string;                 // "treadmill_used"
  name: string;               // "Creaky Treadmill"
  category: "cardio" | "strength" | "free_weights" | "functional"
          | "stretching" | "recovery" | "amenity" | "decor" | "office";
  price: number;
  sprite: string;
  footprint: { w: number; h: number };   // tiles, unrotated
  rotatable: boolean;
  useSlots: {                            // where a customer stands to use it
    offset: { x: number; y: number };
    facing: "up" | "down" | "left" | "right";
    animation: string;                   // "run", "lift", "row", "drink"...
  }[];
  useDuration: [min: number, max: number];  // in-game minutes
  revenue: number;            // paid when a workout here completes
  satisfaction: number;       // how much using it pleases a customer
  attractiveness: number;     // contribution to gym appeal/rating
  durability?: number;        // later: breakdowns and repairs
  unlock?: { rating?: number; day?: number };
}
```

---

## 9. Customers

**v0.1 loop:** this must be visible and satisfying.

1. The customer enters through the entrance and walks past the check-in desk.
2. They pick a goal (cardio for now) and look for an **Available** machine of that type.
3. They **reserve** it, so no one else takes it.
4. They pathfind to its use slot, line up, face the right way and switch to the use animation (jogging in place on the belt).
5. They stay for the workout duration.
6. When they finish, the machine is released and **cash pops up** (`+$5`).
7. They do another activity or leave through the entrance.

If nothing is free, they wait at a waiting spot with a patience timer. If it runs out, they leave annoyed, and that hurts the rating.

**Machine states:** `Available → Reserved → InUse → Available`, plus `Broken` later. Machines can have multiple use slots; v0.1 machines have one.

**Customer state machine:** `Arrive → ChooseActivity → Reserve → WalkTo → Align → Use → Release → (ChooseActivity | Leave) → Exit`, with `Wait` / `GiveUp` branches.

**Later customer features:**
- **Needs:** cardio, strength, hydration (water cooler), rest, social, cleanliness, comfort and patience.
- **Visit chains:** e.g. treadmill → water cooler → bench → chat with someone → leave.
- **Idle life:** wandering, pausing, sitting, looking at equipment and talking to each other.
- **Speech bubbles** that explain the sim with personality:
  - "Every treadmill is taken?? I'll just jog in place I guess."
  - "Ooh, new rower!"
  - "Is that a cobweb or a tiny member?"
  - "$15 for THIS place?"
- **Customer types** with different preferences, patience and spending:
  - Casual
  - Cardio regular
  - Gym bro
  - Senior
  - Athlete
  - Influencer

---

## 10. Economy

### Income

| Source | When |
|---|---|
| Per-workout / day-pass payment | From v0.1 (paid after a completed workout) |
| Monthly memberships | Recurring; also drive the hybrid offline payout |
| Premium memberships, classes, personal training, drinks, merch | Later |

### Costs

Kept light early so it doesn't feel like bookkeeping:
- **Daily rent:** small, so there's always some pressure.
- **Utilities, payroll and maintenance:** added later.

### Pacing targets
- **Starting cash:** about $150. Early income is about $40–60 a day with the single treadmill.
- **First purchase** around day 2–3, ideally a second used treadmill. That teaches the buy → place → watch-it-get-used loop.
- **After about an hour of play**, the gym looks noticeably different.
- **Day length:** about 8 real minutes (6 AM–10 PM). Each day ends with a summary screen and an auto-save.
- **Offline payout:** membership income only, at a reduced rate, capped (e.g. 8 hours max).

### Rough price list

Prices are tuned in playtesting. Unlocks are gated by star rating.

| Tier | Item | Price |
|---|---|---|
| Start | Used treadmill | $250 |
| Start | Yoga mat | $40 |
| Start | Light dumbbell set | $200 |
| Start | Flat bench | $150 |
| Start | Potted plant (decor) | $30 |
| Start | Trash can | $25 |
| ★2 | Stationary bike | $450 |
| ★2 | Dumbbell rack | $500 |
| ★2 | Pull-up station | $350 |
| ★2 | Wall mirror | $120 |
| ★3 | Rowing machine | $900 |
| ★3 | Squat rack | $1,200 |
| ★3 | Commercial treadmill | $1,800 |
| ★3 | Cable machine | $2,500 |
| ★4+ | Premium machines, recovery zone, smoothie bar | $3,000+ |

**Upgrades** are where the visible transformation happens:

| Upgrade | Price |
|---|---|
| Fix the lights | $150 |
| Sound system | $350 |
| Paint the walls | $400 |
| Rubber flooring (per section) | $600 |
| Remove the boarded windows | $300 |
| Air conditioning | $2,000 |
| Locker room | $3,000 |
| Showers | $5,000 |

**Staff:**

| Role | Wage |
|---|---|
| Receptionist | $40/day |
| Cleaner | $35/day |
| Maintenance | $45/day |
| Trainer | $60/day (earns personal-training income) |
| Manager | Later |

---

## 11. Rating / reputation (0–5 stars)

- **Factors:**
  - Equipment variety and availability
  - Cleanliness
  - Appearance (upgrades and decor)
  - Wait times
  - Recent customer satisfaction
  - Amenities and staff
  - Pricing
  - Crowding
- **Effects:**
  - More customers
  - Better-paying customer types
  - Equipment tier unlocks
  - Special opportunities and events
- **v0.1:** a simple rolling average of recent visit satisfaction.

---

## 12. Cleaning and repair

The Stardew side: you personally rescue the building.
- Tap cobwebs, trash, debris and dirty floor spots to clean them. This plays a short animation.
- Repair broken fixtures and, later, worn-out machines.
- Cleanliness feeds the rating, and dirty spots slowly reappear with use.
- A hired cleaner and maintenance worker automate these chores later.

---

## 13. Expansion

1. **Back warehouse:** unlock the padlocked roll-up door, clear the junk and gain floor space.
2. **Build rooms** inside the warehouse: locker rooms, showers, a class/yoga room, a recovery area.
3. **Mezzanine / second floor**, reached by a staircase. The camera switches floors, Tiny Tower style.
4. **Basement:** e.g. a powerlifting dungeon.
5. *Long-term:* adjacent property, or a second location.

---

## 14. Technical architecture

```
src/
  data/        equipment, upgrades, customer types, comments: pure data
  sim/         game rules with NO Phaser imports (unit-tested with Vitest)
    grid.ts        tile map, occupancy, footprints and rotation
    nav.ts         A* pathfinding shared by the player and NPCs
    placement.ts   validation, snapping, connectivity checks
    customers.ts   customer state machine, reservations
    economy.ts     cash, day clock, rating
    save.ts        versioned save/load (localStorage now, Capacitor storage later)
  scenes/      Phaser scenes: rendering, input, animation, UI
  ui/          Computer Mode, toolbar, context button, dialogs
```

Keeping the rules (`sim/`) separate from the rendering (`scenes/`) makes the game easier to test and balance. It would also make a future engine port much easier.

---

## 15. Roadmap

### v0.1 — "The Empty Warehouse" (core loop) ✅ built

Notes from building it:
- **Fonts:** Jersey 10 for UI and numbers, VT323 for reading text. Pixelify Sans was dropped because its digits were ambiguous.
- **Pausing:** the gym clock pauses while the computer, a placement or Move Mode is open.
- **Check-in desk:** decorative for now. Customers stop there briefly before working out.
- **Bike:** the Stationary Bike (unlocks at 2★) is already in, alongside the treadmill.
- **Tunable numbers:** all balance numbers are in `src/data/balance.ts`.

- Project setup with landscape scaling, deployed to GitHub Pages.
- Starting warehouse per §5, with simple readable pixel art.
- Tap-to-move with A*, strict proximity interaction, highlight and context button.
- Computer Mode with **Store** (used treadmill plus a few starter items) and **Stats**.
- Placement system: ghost preview, green/red validity, rotation, confirm/cancel, tile snap and alignment guides.
- Persistent Move Mode with **Done**.
- Customers enter, reserve, walk, align, use the treadmill (animated), pay and leave. They wait or give up when nothing is free.
- Day clock, end-of-day summary, save/load.

### v0.2 — "Fixer-Upper"
- Cleaning (cobwebs, trash, stains) and repairs.
- Upgrades that visibly change the room: lights, paint, flooring, windows.
- Rating v1, speech bubbles, water cooler use.
- More equipment: bench, dumbbells, bike, mats.

### v0.3 — "Open for Business"
- Staff (receptionist, cleaner).
- Memberships and the hybrid offline payout.
- Customer types and needs, visit chains, idle and wandering behavior.

### v0.4 — "Growing Pains"
- Back warehouse expansion, buildable rooms.
- Operating costs, marketing.

### v0.5+
- Mezzanine and basement, events (powerlifting meet, health inspection, rival gym).
- Capacitor build and app store release.

---

## 16. Open questions

- The pasted original brief cut off at section 29 (Expansion). Were there more sections?
- Final name.
- Should the owner have to staff the check-in desk early on (customers queue until you're there), or is the desk decorative until a receptionist is hired? Current plan: decorative in v0.1, with manual check-in as a possible v0.2 mechanic.
- Is whole-tile snapping plus smart alignment free enough, or should we try half-tile positioning?
