import Phaser from "phaser";
import { EQUIPMENT } from "../data/equipment";
import { CUSTOMER_LOOKS } from "../sim/customers";
import type { Rot } from "../sim/types";
import { drawBackdrop, drawLighting } from "./environment";
import { OBJECT_FRAMES, drawObject } from "./furniture";
import { Painter } from "./painter";
import { ANIMS, CH, CW, FACINGS, OWNER_LOOK, customerLook, drawPersonSheet, frameCell, frameName } from "./people";

/** Pixels each object sprite extends above its footprint, keyed "defId:rot". */
export const objectExtra = new Map<string, number>();
/** Small PNG previews for the store UI. */
export const objectPreview = new Map<string, { url: string; w: number; h: number }>();
/** Object textures that have a front layer drawn over their user, keyed "defId:rot". */
export const objectOverlay = new Set<string>();

export const objKey = (defId: string, rot: Rot, frame = 0) => `obj:${defId}:${rot}:${frame}`;
export const objOverlayKey = (defId: string, rot: Rot, frame = 0) => `obj:${defId}:${rot}:${frame}:front`;
export const charKey = (look: string) => `char:${look}`;

export function buildTextures(scene: Phaser.Scene) {
  const tex = scene.textures;

  const addPerson = (key: string, p: Painter) => {
    const t = tex.addCanvas(key, p.toCanvas())!;
    for (const facing of FACINGS)
      for (const [anim, n] of Object.entries(ANIMS))
        for (let i = 0; i < n; i++) {
          const [cx, cy] = frameCell(facing, anim, i);
          t.add(frameName(facing, anim, i), 0, cx * CW, cy * CH, CW, CH);
        }
  };
  addPerson(charKey("owner"), drawPersonSheet(OWNER_LOOK));
  for (let i = 0; i < CUSTOMER_LOOKS; i++) addPerson(charKey(`c${i}`), drawPersonSheet(customerLook(i)));

  for (const def of Object.values(EQUIPMENT)) {
    const rots: Rot[] = def.rotatable ? [0, 1, 2, 3] : [0];
    for (const rot of rots) {
      for (let f = 0; f < (OBJECT_FRAMES[def.id] ?? 1); f++) {
        const art = drawObject(def.id, rot, f);
        const canvas = art.painter.toCanvas();
        tex.addCanvas(objKey(def.id, rot, f), canvas);
        if (art.overlay) {
          tex.addCanvas(objOverlayKey(def.id, rot, f), art.overlay.toCanvas());
          objectOverlay.add(`${def.id}:${rot}`);
        }
        objectExtra.set(`${def.id}:${rot}`, art.extra);
        if (rot === 0 && f === 0) objectPreview.set(def.id, { url: canvas.toDataURL(), w: art.painter.w, h: art.painter.h });
      }
    }
  }

  tex.addCanvas("backdrop", drawBackdrop().toCanvas());
  tex.addCanvas("lighting", drawLighting());

  // Little bobbing arrow shown over whatever the owner can use.
  const m = new Painter(9, 8);
  m.box(1, 0, 7, 2, "#ffe27a");
  m.box(2, 3, 6, 3, "#ffe27a");
  m.box(3, 4, 5, 4, "#ffe27a");
  m.px(4, 5, "#ffe27a");
  m.outline("#2a221c");
  tex.addCanvas("marker", m.toCanvas());

  // Warm glow under the one flickering ceiling light (added on top of the lighting).
  const g = document.createElement("canvas");
  g.width = g.height = 200;
  const gctx = g.getContext("2d")!;
  const grad = gctx.createRadialGradient(100, 100, 2, 100, 100, 100);
  grad.addColorStop(0, "rgba(255,215,150,0.16)");
  grad.addColorStop(1, "rgba(255,215,150,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 200, 200);
  tex.addCanvas("glow", g);

  // Tap ripple
  const r = new Painter(12, 8);
  r.ellipse(6, 4, 5.5, 3.5, "rgba(255,255,255,0.9)");
  r.eraseEllipse(6, 4, 3.5, 2);
  tex.addCanvas("ripple", r.toCanvas());
}
