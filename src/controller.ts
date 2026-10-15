import { getDef } from "./data/equipment";
import { PlacementSession } from "./sim/session";
import type { Vec } from "./sim/types";
import type { PlacedObject, World } from "./sim/world";

/**
 * What the player is doing right now. Anything other than "play" pauses the gym clock so nobody
 * has to shop or rearrange furniture under time pressure.
 */
export type Mode = "play" | "computer" | "place" | "move" | "modal";

export class Controller {
  mode: Mode = "play";
  session: PlacementSession | null = null;
  /** Move Mode stays on across several moves until the player presses Done. */
  moveMode = false;
  private listeners: (() => void)[] = [];
  private toastFn: (text: string) => void = () => {};

  constructor(readonly world: World) {}

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  onToast(fn: (text: string) => void) {
    this.toastFn = fn;
  }

  toast(text: string) {
    this.toastFn(text);
  }

  private set(mode: Mode) {
    this.mode = mode;
    this.world.paused = mode !== "play";
    for (const l of this.listeners) l();
  }

  changed() {
    for (const l of this.listeners) l();
  }

  // ----- computer -----

  openComputer() {
    if (this.mode !== "play") return;
    this.world.player.path = [];
    this.set("computer");
  }

  closeComputer() {
    if (this.mode === "computer") this.set("play");
  }

  /** Called from the store: the computer closes and the new item appears as a ghost to place. */
  buy(defId: string, around: Vec) {
    const def = getDef(defId);
    if (this.world.cash < def.price) {
      this.toast("Not enough cash for that yet.");
      return;
    }
    this.session = PlacementSession.buy(this.world, defId, around);
    this.set("place");
  }

  // ----- move mode -----

  enterMoveMode() {
    if (this.mode !== "play") return;
    this.world.player.path = [];
    this.moveMode = true;
    this.set("move");
  }

  exitMoveMode() {
    this.moveMode = false;
    if (this.session) this.cancelPlacement();
    this.set("play");
  }

  pickUp(o: PlacedObject) {
    const def = getDef(o.defId);
    if (!def.movable) {
      this.toast(`The ${def.name.toLowerCase()} is bolted down.`);
      return;
    }
    if (this.world.isBusy(o)) {
      this.toast("Someone's using that right now!");
      return;
    }
    this.session = PlacementSession.move(this.world, o.id);
    this.set("place");
  }

  // ----- placement -----

  confirmPlacement(): boolean {
    const s = this.session;
    if (!s) return false;
    if (!s.confirm()) {
      this.changed();
      return false;
    }
    this.session = null;
    if (s.mode === "buy") {
      this.toast(`${s.def.name} placed!`);
      this.world.hint("moveTip", "Tip: Move Mode (top right) lets you rearrange the gym any time.");
    }
    this.set(this.moveMode ? "move" : "play");
    return true;
  }

  cancelPlacement() {
    const s = this.session;
    if (!s) return;
    s.cancel();
    this.session = null;
    this.set(this.moveMode ? "move" : "play");
  }

  // ----- modals -----

  openModal() {
    this.set("modal");
  }

  closeModal() {
    if (this.mode === "modal") this.set("play");
  }
}
