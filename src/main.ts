import "@fontsource/jersey-10/latin-400.css";
import "@fontsource/vt323/latin-400.css";
import "./style.css";
import Phaser from "phaser";
import { Controller } from "./controller";
import { getDef } from "./data/equipment";
import { GameScene } from "./scenes/GameScene";
import { worldInteractSpot } from "./sim/geometry";
import { loadSave, writeSave } from "./sim/save";
import { World } from "./sim/world";
import { UI } from "./ui/ui";

const save = loadSave();
const world = new World({ save });
const ctrl = new Controller(world);
const ui = new UI(world, ctrl, document.getElementById("ui-root")!);
const scene = new GameScene(world, ctrl, ui);

// Render at the device's real pixel density so pixel art stays crisp, then scale the canvas down in CSS.
const dpr = Math.min(window.devicePixelRatio || 1, 3);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1d1814",
  pixelArt: true,
  roundPixels: true,
  banner: false,
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(window.innerWidth * dpr),
    height: Math.round(window.innerHeight * dpr),
    zoom: 1 / dpr,
  },
  input: { activePointers: 2 },
  scene: [scene],
});

const resize = () => {
  game.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
  game.scale.setZoom(1 / dpr);
};
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);

const persist = () => writeSave(world.toSave());

world.on((e) => {
  switch (e.type) {
    case "cash":
      ui.cashFloat(e.amount, e.at);
      break;
    case "bubble":
      ui.bubble(e.actorId, e.text);
      break;
    case "toast":
      ui.toast(e.text);
      break;
    case "hint":
      ui.hint(e.text);
      break;
    case "interact": {
      const o = world.objects.get(e.objectId);
      if (!o) break;
      const def = getDef(o.defId);
      if (def.interact?.kind === "computer") {
        // Sit down at the desk, then open the management computer.
        const spot = worldInteractSpot(def, o.x, o.y, o.rot);
        if (spot && world.walkable(spot.spot.x, spot.spot.y)) {
          world.player.pos = { x: spot.spot.x + 0.5, y: spot.spot.y + 0.6 };
          world.player.facing = spot.facing;
        }
        ctrl.openComputer();
      } else if (def.interact?.kind === "drink") {
        ui.bubble(world.player.id, "Ahh. Lukewarm, but wet.");
      }
      break;
    }
    case "dayEnd":
      persist();
      ui.showDayEnd(e.summary, () => world.nextDay());
      break;
    case "save":
      persist();
      break;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) persist();
});
window.addEventListener("pagehide", persist);

if (!save) ui.showWelcome();

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { __game: { world, ctrl, scene, ui } });
