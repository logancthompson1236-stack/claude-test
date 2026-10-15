/**
 * Renders sprite preview sheets to PNG so the art can be inspected (and edited) outside the game.
 *   npm run sprites            -> docs/sprites/*.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { Painter } from "../src/art/painter";
import { ANIMS, CH, CW, FACINGS, FEET_Y, OWNER_LOOK, customerLook, drawPersonSheet, frameCell, type Facing, type Look } from "../src/art/people";
import { drawObject } from "../src/art/furniture";
import { getDef } from "../src/data/equipment";
import { worldSlot } from "../src/sim/geometry";
import type { Rot } from "../src/sim/types";

const OUT = process.argv[2] ?? "docs/sprites";
mkdirSync(OUT, { recursive: true });

function save(p: Painter, file: string, scale = 1, bg?: string) {
  const png = new PNG({ width: p.w * scale, height: p.h * scale });
  const bgc = bg ? [parseInt(bg.slice(1, 3), 16), parseInt(bg.slice(3, 5), 16), parseInt(bg.slice(5, 7), 16)] : null;
  for (let y = 0; y < p.h * scale; y++)
    for (let x = 0; x < p.w * scale; x++) {
      const [r, g, b, a] = p.rgbaAt(Math.floor(x / scale), Math.floor(y / scale));
      const i = (y * p.w * scale + x) * 4;
      if (bgc) {
        const k = a / 255;
        png.data[i] = r * k + bgc[0] * (1 - k);
        png.data[i + 1] = g * k + bgc[1] * (1 - k);
        png.data[i + 2] = b * k + bgc[2] * (1 - k);
        png.data[i + 3] = 255;
      } else {
        png.data[i] = r;
        png.data[i + 1] = g;
        png.data[i + 2] = b;
        png.data[i + 3] = a;
      }
    }
  writeFileSync(`${OUT}/${file}`, PNG.sync.write(png));
}

// Full sheets (what the game uses), one per look.
const looks: [string, Look][] = [["owner", OWNER_LOOK], ...Array.from({ length: 12 }, (_, i) => [`customer-${i}`, customerLook(i)] as [string, Look])];
for (const [name, look] of looks) save(drawPersonSheet(look), `${name}.png`);

// A compact contact sheet of every animation for a few looks, scaled up for review.
const order = Object.entries(ANIMS).flatMap(([anim, n]) => Array.from({ length: n }, (_, i) => [anim, i] as const));
const pick = looks.slice(0, Number(process.env.LOOKS ?? 4));
const contact = new Painter(order.length * CW, pick.length * FACINGS.length * CH);
pick.forEach(([, look], li) => {
  const sheet = drawPersonSheet(look);
  FACINGS.forEach((facing, fi) =>
    order.forEach(([anim, i], col) => {
      const [cx, cy] = frameCell(facing, anim, i);
      const cell = new Painter(CW, CH);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) cell.set(x, y, sheet.rgbaAt(cx * CW + x, cy * CH + y));
      contact.draw(cell, col * CW, (li * FACINGS.length + fi) * CH);
    }),
  );
});
save(contact, "_contact.png", Number(process.env.SCALE ?? 3), "#8b8273");
// Machines in every rotation with someone using them, laid out exactly as the game does.
const rider = drawPersonSheet(customerLook(3));
const frameOf = (facing: Facing, anim: string, i: number) => {
  const [cx, cy] = frameCell(facing, anim, i);
  const cell = new Painter(CW, CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) cell.set(x, y, rider.rgbaAt(cx * CW + x, cy * CH + y));
  return cell;
};
const machines: [string, string, number][] = [
  ["treadmill_used", "run", 6],
  ["bike_basic", "pedal", 4],
];
const BOX = 64;
const eq = new Painter(BOX * 6, BOX * 8);
let row = 0;
for (const [id, anim, n] of machines) {
  const def = getDef(id);
  for (const rot of [0, 1, 2, 3] as Rot[]) {
    for (let i = 0; i < n; i++) {
      const cell = new Painter(BOX, BOX);
      const ox = 12;
      const oy = 22;
      const art = drawObject(id, rot, i % 4);
      cell.draw(art.painter, ox, oy - art.extra);
      const ws = worldSlot(def, 0, 0, rot, 0);
      const fr = frameOf(ws.facing as Facing, anim, i);
      cell.draw(fr, Math.round(ox + ws.stand.x * 16 - 8), Math.round(oy + ws.stand.y * 16 - (FEET_Y + 0.5)));
      if (art.overlay) cell.draw(art.overlay, ox, oy - art.extra);
      eq.draw(cell, i * BOX, row * BOX);
    }
    row++;
  }
}
save(eq, "_equipment.png", 3, "#8b8273");
console.log(`wrote ${looks.length} sheets + _contact.png + _equipment.png to ${OUT}/`);
