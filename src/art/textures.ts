import Phaser from "phaser";
import { EQUIPMENT } from "../data/equipment";
import { CUSTOMER_LOOKS } from "../sim/customers";
import type { Rot } from "../sim/types";
import { CHAR_FRAMES, CHAR_H, CHAR_ROWS, CHAR_W, OWNER_LOOK, customerLook, drawCharacterSheet } from "./characters";
import { drawBackdrop, drawLighting } from "./environment";
import { OBJECT_FRAMES, drawObject } from "./furniture";
import { Painter } from "./painter";

/** Pixels each object sprite extends above its footprint, keyed "defId:rot". */
export const objectExtra = new Map<string, number>();
/** Small PNG previews for the store UI. */
export const objectPreview = new Map<string, { url: string; w: number; h: number }>();

export const objKey = (defId: string, rot: Rot, frame = 0) => `obj:${defId}:${rot}:${frame}`;
export const charKey = (look: string) => `char:${look}`;

export function buildTextures(scene: Phaser.Scene) {
  const tex = scene.textures;

  const addSheet = (key: string, p: Painter) => {
    const t = tex.addCanvas(key, p.canvas)!;
    CHAR_ROWS.forEach((row, r) =>
      CHAR_FRAMES.forEach((f, c) => t.add(`${row}-${f}`, 0, c * CHAR_W, r * CHAR_H, CHAR_W, CHAR_H)),
    );
  };
  addSheet(charKey("owner"), drawCharacterSheet(OWNER_LOOK));
  for (let i = 0; i < CUSTOMER_LOOKS; i++) addSheet(charKey(`c${i}`), drawCharacterSheet(customerLook(i)));

  for (const def of Object.values(EQUIPMENT)) {
    const rots: Rot[] = def.rotatable ? [0, 1, 2, 3] : [0];
    for (const rot of rots) {
      for (let f = 0; f < (OBJECT_FRAMES[def.id] ?? 1); f++) {
        const art = drawObject(def.id, rot, f);
        tex.addCanvas(objKey(def.id, rot, f), art.painter.canvas);
        objectExtra.set(`${def.id}:${rot}`, art.extra);
        if (rot === 0 && f === 0) objectPreview.set(def.id, { url: art.painter.canvas.toDataURL(), w: art.painter.w, h: art.painter.h });
      }
    }
  }

  tex.addCanvas("backdrop", drawBackdrop().canvas);
  tex.addCanvas("lighting", drawLighting().canvas);

  // Little bobbing arrow shown over whatever the owner can use.
  const m = new Painter(9, 8);
  m.box(1, 0, 7, 2, "#ffe27a");
  m.box(2, 3, 6, 3, "#ffe27a");
  m.box(3, 4, 5, 4, "#ffe27a");
  m.px(4, 5, "#ffe27a");
  m.outline("#2a221c");
  tex.addCanvas("marker", m.canvas);

  // Warm glow under the one flickering ceiling light (added on top of the lighting).
  const g = new Painter(200, 200);
  const grad = g.ctx.createRadialGradient(100, 100, 2, 100, 100, 100);
  grad.addColorStop(0, "rgba(255,215,150,0.16)");
  grad.addColorStop(1, "rgba(255,215,150,0)");
  g.ctx.fillStyle = grad;
  g.ctx.fillRect(0, 0, 200, 200);
  tex.addCanvas("glow", g.canvas);

  // Tap ripple
  const r = new Painter(12, 8);
  r.ellipse(6, 4, 5.5, 3.5, "rgba(255,255,255,0.9)");
  const inner = new Painter(12, 8);
  inner.ellipse(6, 4, 3.5, 2, "#000");
  r.ctx.globalCompositeOperation = "destination-out";
  r.ctx.drawImage(inner.canvas, 0, 0);
  tex.addCanvas("ripple", r.canvas);
}
