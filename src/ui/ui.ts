import { objectPreview } from "../art/textures";
import type { Controller } from "../controller";
import { BALANCE } from "../data/balance";
import { EQUIPMENT, STORE_ITEMS, getDef, type EquipmentDef } from "../data/equipment";
import { rotatedSize } from "../sim/geometry";
import { clearSave } from "../sim/save";
import type { Vec } from "../sim/types";
import { clockLabel, ratingLabel, type DaySummary, type PlacedObject, type World } from "../sim/world";
import type { GameScene } from "../scenes/GameScene";

const VERSION = "v0.1 · The Empty Warehouse";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function stars(r: number): string {
  const pct = Math.max(0, Math.min(100, (r / 5) * 100));
  return `<span class="stars" aria-label="${r.toFixed(1)} out of 5 stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="width:${pct}%">★★★★★</span></span>`;
}

interface Bubble {
  node: HTMLElement;
  actorId?: number;
  at?: Vec;
  until: number;
}

export class UI {
  private scene!: GameScene;
  private root: HTMLElement;
  private hudLeft = el("div", "hud-left");
  private lastLeftInset = 0;
  private lastRightInset = 0;
  private hudRight = el("div", "hud-right");
  private cash = el("div", "pill cash");
  private clock = el("div", "pill clock");
  private rating = el("button", "pill rating");
  private speedBtn = el("button", "btn small", "▶ 1×");
  private moveBtn = el("button", "btn", "✥<span>Move</span>");
  private paused = el("div", "pill paused", "⏸ Paused");
  private context = el("button", "btn context");
  private toastBox = el("div", "toasts");
  private bubbles = el("div", "bubbles");
  private placeTop = el("div", "place-top place-info");
  private placeRail = el("div", "rail place-rail");
  private moveTop = el("div", "place-top move-info", "<b>Move Mode</b><span>Tap an item to pick it up</span>");
  private moveRail = el("div", "rail move-rail");
  private computer = el("div", "modal computer");
  private modal = el("div", "modal sheet");
  private bubbleList: Bubble[] = [];
  private contextObj: PlacedObject | null = null;
  private computerTab: "store" | "stats" | "settings" = "store";
  private lastHud = "";

  constructor(
    private readonly world: World,
    private readonly ctrl: Controller,
    mount: HTMLElement,
  ) {
    this.root = el("div", "ui");
    mount.appendChild(this.root);

    const left = this.hudLeft;
    left.append(this.cash, this.clock, this.rating, this.paused);
    const right = this.hudRight;
    right.append(this.moveBtn, this.speedBtn);
    this.root.append(left, right, this.context, this.toastBox, this.bubbles, this.placeTop, this.placeRail, this.moveTop, this.moveRail, this.computer, this.modal);

    this.speedBtn.onclick = () => {
      this.world.speed = this.world.speed === 1 ? 2 : this.world.speed === 2 ? 3 : 1;
      this.lastHud = "";
    };
    this.moveBtn.onclick = () => this.ctrl.enterMoveMode();
    this.rating.onclick = () => this.toast(`${ratingLabel(this.world.rating)}: ${this.world.rating.toFixed(2)} stars. Happy customers raise it.`);
    this.context.onclick = () => {
      if (this.contextObj) this.world.playerInteract(this.contextObj);
    };

    const rotate = el("button", "btn", "⟳<span>Rotate</span>");
    rotate.onclick = () => {
      this.ctrl.session?.rotate();
      this.ctrl.changed();
    };
    const snap = el("button", "btn toggle on", "◫<span>Snap</span>");
    snap.onclick = () => {
      const s = this.ctrl.session;
      if (!s) return;
      s.snap = !s.snap;
      s.refresh();
      this.ctrl.changed();
    };
    const cancel = el("button", "btn danger", "✕<span>Cancel</span>");
    cancel.onclick = () => this.ctrl.cancelPlacement();
    const confirm = el("button", "btn go", "✔<span>Place</span>");
    confirm.onclick = () => {
      if (!this.ctrl.confirmPlacement()) this.shake(this.placeTop);
    };
    this.placeRail.append(rotate, snap, cancel, confirm);

    const done = el("button", "btn go", "✔<span>Done</span>");
    done.onclick = () => this.ctrl.exitMoveMode();
    this.moveRail.append(done);

    this.ctrl.onChange(() => this.refreshMode());
    this.ctrl.onToast((t) => this.toast(t));
    this.refreshMode();
  }

  attach(scene: GameScene) {
    this.scene = scene;
  }

  /** How much of the screen edge the HUD columns cover (CSS px), so the camera can keep the gym clear of them. */
  insets(): { left: number; right: number } {
    const w = window.innerWidth;
    const gap = 6;
    const left = this.hudLeft.getBoundingClientRect();
    let right = 0;
    for (const n of [this.hudRight, this.placeRail, this.moveRail]) {
      const r = n.getBoundingClientRect();
      if (r.width > 0) right = Math.max(right, w - r.left + gap);
    }
    // Rails only show in some modes; reserve room for the widest seen so the view doesn't jump when switching.
    this.lastRightInset = Math.max(this.lastRightInset, right, 96);
    right = this.lastRightInset;
    // The left column hides behind modals; keep the last measured width rather than reframing.
    if (left.width > 0) this.lastLeftInset = left.right + gap;
    return { left: this.lastLeftInset, right };
  }

  // ------------------------------------------------------------------ per frame

  frame() {
    const w = this.world;
    const hud = `${Math.floor(w.cash)}|${w.day}|${Math.floor(w.minute / 10)}|${w.rating.toFixed(2)}|${w.speed}|${this.ctrl.mode}`;
    if (hud !== this.lastHud) {
      this.lastHud = hud;
      this.cash.innerHTML = `<i>💵</i>${money(w.cash)}`;
      const closing = w.minute >= BALANCE.lastEntryMinute;
      this.clock.innerHTML = `Day ${w.day} · ${clockLabel(w.minute)}${closing ? ' <em>closing</em>' : ""}`;
      this.rating.innerHTML = stars(w.rating);
      this.speedBtn.innerHTML = `${"▶".repeat(w.speed)} ${w.speed}×`;
    }
    const now = performance.now();
    this.bubbleList = this.bubbleList.filter((b) => {
      let anchor: Vec | null = null;
      if (b.actorId !== undefined) {
        const a = [w.player, ...w.customers].find((x) => x.id === b.actorId);
        if (a) anchor = { x: a.pos.x * 16, y: a.pos.y * 16 - 29 };
      } else if (b.at) anchor = b.at;
      if (!anchor || now > b.until) {
        b.node.remove();
        return false;
      }
      const p = this.scene.worldToCss(anchor.x, anchor.y);
      b.node.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      return true;
    });
  }

  setContext(o: PlacedObject | null) {
    if (o === this.contextObj) return;
    this.contextObj = o;
    if (o) {
      const def = getDef(o.defId);
      this.context.innerHTML = `${def.interact!.kind === "computer" ? "🖥️" : "💧"}<span>${def.interact!.label}</span>`;
      this.context.classList.add("show");
    } else this.context.classList.remove("show");
  }

  // ------------------------------------------------------------------ feedback

  toast(text: string, ms = 3200) {
    const t = el("div", "toast", text);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 3) this.toastBox.firstChild!.remove();
    setTimeout(() => t.classList.add("out"), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  hint(text: string) {
    this.toast(`<b>Tip</b> ${text}`, 6500);
  }

  bubble(actorId: number, text: string) {
    for (const b of this.bubbleList) if (b.actorId === actorId) b.until = 0;
    const node = el("div", "bubble");
    node.textContent = text;
    this.bubbles.appendChild(node);
    this.bubbleList.push({ node, actorId, until: performance.now() + 2800 });
  }

  objectBubble(o: PlacedObject, text: string) {
    for (const b of this.bubbleList) if (b.at) b.until = 0;
    const def = getDef(o.defId);
    const { w } = rotatedSize(def, o.rot);
    const node = el("div", "bubble note");
    node.innerHTML = `<b>${def.name}</b>${text}`;
    this.bubbles.appendChild(node);
    this.bubbleList.push({ node, at: { x: (o.x + w / 2) * 16, y: o.y * 16 - 10 }, until: performance.now() + 3200 });
  }

  cashFloat(amount: number, at: Vec) {
    if (!this.scene) return;
    const p = this.scene.worldToCss(at.x * 16, at.y * 16);
    const node = el("div", `cash-float ${amount < 0 ? "neg" : ""}`, `${amount < 0 ? "−" : "+"}${money(Math.abs(amount))}`);
    node.style.left = `${Math.round(p.x)}px`;
    node.style.top = `${Math.round(p.y)}px`;
    this.bubbles.appendChild(node);
    setTimeout(() => node.remove(), 1300);
    this.cash.classList.remove("bump");
    void this.cash.offsetWidth;
    this.cash.classList.add("bump");
  }

  private shake(node: HTMLElement) {
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
  }

  // ------------------------------------------------------------------ modes

  private refreshMode() {
    const mode = this.ctrl.mode;
    this.root.dataset.mode = mode;
    this.paused.style.display = mode === "play" ? "none" : "";
    const s = this.ctrl.session;
    if (s) {
      const status = s.validity.ok ? `<span class="ok">✔ Looks good</span>` : `<span class="bad">✖ ${s.validity.reason}</span>`;
      const price = s.mode === "buy" ? ` · ${money(s.def.price)}` : "";
      this.placeTop.innerHTML = `<b>${s.mode === "buy" ? "Place" : "Move"}: ${s.def.name}${price}</b>${status}<small>Drag it, or tap where it should go</small>`;
      const [rotate, snap, , confirm] = [...this.placeRail.children] as HTMLButtonElement[];
      rotate.disabled = !s.def.rotatable;
      snap.classList.toggle("on", s.snap);
      confirm.disabled = !s.validity.ok;
      confirm.innerHTML = s.mode === "buy" ? `✔<span>Buy ${money(s.def.price)}</span>` : "✔<span>Place</span>";
    }
    if (mode === "computer") this.renderComputer();
    else this.computer.classList.remove("open");
  }

  // ------------------------------------------------------------------ computer

  private renderComputer() {
    const w = this.world;
    this.computer.classList.add("open");
    const tabs: [typeof this.computerTab, string, string][] = [
      ["store", "🛒", "Store"],
      ["stats", "📊", "Stats"],
      ["settings", "⚙️", "Settings"],
    ];
    this.computer.innerHTML = `
      <div class="crt">
        <div class="os-bar">
          <span class="os-logo">GymOS 95</span>
          <span class="os-info">${money(w.cash)} · Day ${w.day} · ${clockLabel(w.minute)}</span>
          <button class="os-close" aria-label="Close computer">✕ Close</button>
        </div>
        <div class="os-body">
          <nav class="os-nav">${tabs
            .map(([id, icon, label]) => `<button data-tab="${id}" class="${this.computerTab === id ? "active" : ""}"><i>${icon}</i>${label}</button>`)
            .join("")}</nav>
          <section class="os-app">${this.computerTab === "store" ? this.storeHtml() : this.computerTab === "stats" ? this.statsHtml() : this.settingsHtml()}</section>
        </div>
      </div>`;
    this.computer.querySelector<HTMLButtonElement>(".os-close")!.onclick = () => this.ctrl.closeComputer();
    this.computer.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
      b.onclick = () => {
        this.computerTab = b.dataset.tab as typeof this.computerTab;
        this.renderComputer();
      };
    });
    this.computer.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => {
      b.onclick = () => this.ctrl.buy(b.dataset.buy!, this.scene.viewCenterTile());
    });
    const reset = this.computer.querySelector<HTMLButtonElement>("[data-reset]");
    if (reset)
      reset.onclick = () => {
        if (reset.dataset.armed) {
          clearSave();
          location.reload();
        } else {
          reset.dataset.armed = "1";
          reset.textContent = "Really? Tap again to wipe your gym";
        }
      };
    const fs = this.computer.querySelector<HTMLButtonElement>("[data-fullscreen]");
    if (fs)
      fs.onclick = () => {
        const d = document.documentElement;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void d.requestFullscreen?.().catch(() => this.toast("Fullscreen isn't available here."));
      };
  }

  private storeHtml(): string {
    const w = this.world;
    const groups: [string, (d: EquipmentDef) => boolean][] = [
      ["Cardio", (d) => d.category === "cardio"],
      ["Amenities", (d) => d.category === "amenity"],
      ["Decor", (d) => d.category === "decor"],
    ];
    const card = (d: EquipmentDef) => {
      const locked = !w.isUnlocked(d);
      const short = d.price - w.cash;
      const owned = w.countOf(d.id);
      const chips = [
        d.satisfaction ? `<span class="chip">Happiness +${d.satisfaction}</span>` : "",
        d.appeal ? `<span class="chip">Appeal +${d.appeal}</span>` : "",
        owned ? `<span class="chip dim">Owned: ${owned}</span>` : "",
      ].join("");
      const btn = locked
        ? `<button class="buy" disabled>🔒 Unlocks at ${d.unlockRating}★</button>`
        : short > 0
          ? `<button class="buy" disabled>Need ${money(short)} more</button>`
          : `<button class="buy" data-buy="${d.id}">Buy ${money(d.price)}</button>`;
      // Whole-number scaling keeps the pixel art crisp.
      const pv = objectPreview.get(d.id);
      const k = pv ? Math.max(1, Math.floor(Math.min(64 / pv.w, 58 / pv.h))) : 1;
      const img = pv ? `<img src="${pv.url}" width="${pv.w * k}" height="${pv.h * k}" alt="">` : "";
      return `<article class="item ${locked ? "locked" : ""}">
        <div class="thumb">${img}</div>
        <div class="info"><h3>${d.name}</h3><p>${d.description}</p><div class="chips">${chips}</div></div>
        ${btn}</article>`;
    };
    return `<h2>Equipment Store</h2><p class="lede">Bought items appear in your gym, ready to place.</p>${groups
      .map(([label, f]) => {
        const items = STORE_ITEMS.map((id) => EQUIPMENT[id]).filter(f);
        return items.length ? `<h4>${label}</h4><div class="items">${items.map(card).join("")}</div>` : "";
      })
      .join("")}`;
  }

  private statsHtml(): string {
    const w = this.world;
    const s = w.stats;
    const avg = s.departures ? (s.satisfactionSum / s.departures).toFixed(1) : "–";
    const appeal = w.appeal();
    const machines = [...w.objects.values()].filter((o) => getDef(o.defId).category === "cardio").length;
    return `<h2>Gym Stats</h2>
      <div class="stat-hero">${stars(w.rating)}<div><b>${ratingLabel(w.rating)}</b><span>${w.rating.toFixed(2)} / 5 stars</span></div></div>
      <div class="stat-grid">
        <div><span>Visitors today</span><b>${s.visitors}</b></div>
        <div><span>Workouts today</span><b>${s.workouts}</b></div>
        <div><span>Gave up waiting</span><b>${s.gaveUp}</b></div>
        <div><span>Earned today</span><b>${money(s.revenue)}</b></div>
        <div><span>Day passes today</span><b>${s.dayPasses}</b></div>
        <div><span>Active members</span><b>${w.activeMembers()}</b></div>
        <div><span>Regulars known</span><b>${w.people.size}</b></div>
        <div><span>Avg. happiness</span><b>${avg}</b></div>
        <div><span>Machines</span><b>${machines}</b></div>
        <div><span>Gym appeal</span><b>${appeal.total.toFixed(1)}</b></div>
        <div><span>Daily rent</span><b>${money(BALANCE.dailyRent)}</b></div>
        <div><span>Lifetime earnings</span><b>${money(w.lifetime.revenue)}</b></div>
        <div><span>Lifetime visitors</span><b>${w.lifetime.visitors}</b></div>
      </div>
      <p class="lede">Visitors pay ${money(BALANCE.dayPassPrice)} at the front desk. Happy regulars may buy a ${BALANCE.membershipDays}-day membership for ${money(BALANCE.membershipPrice)}. More machines mean shorter waits; decor and water make people happier.</p>`;
  }

  private settingsHtml(): string {
    return `<h2>Settings</h2>
      <div class="settings">
        <button class="buy" data-fullscreen>⛶ Toggle fullscreen</button>
        <button class="buy danger" data-reset>Start a new gym (wipe save)</button>
        <p class="lede">Your gym saves automatically on this device.</p>
        <p class="lede dim">Iron &amp; Dust ${VERSION}</p>
      </div>`;
  }

  // ------------------------------------------------------------------ sheets

  private openSheet(html: string, button: string, onClose: () => void) {
    this.ctrl.openModal();
    this.modal.innerHTML = `<div class="card">${html}<button class="buy big">${button}</button></div>`;
    this.modal.classList.add("open");
    this.modal.querySelector<HTMLButtonElement>("button.big")!.onclick = () => {
      this.modal.classList.remove("open");
      this.ctrl.closeModal();
      onClose();
    };
  }

  showWelcome() {
    this.openSheet(
      `<h2>Welcome to your gym!</h2>
       <p>You just signed the lease on a dusty old warehouse. It has one creaky treadmill, a front desk and a tiny office. It's... a start.</p>
       <ul>
         <li><b>Tap the floor</b> to walk. Tap things to look at or use them.</li>
         <li>Customers <b>pay at the front desk</b> when they check in. Happy regulars buy memberships.</li>
         <li>Walk to the <b>office computer</b> to buy equipment.</li>
         <li><b>Move Mode</b> (top right) rearranges your gym.</li>
       </ul>`,
      "Let's get to work",
      () => {},
    );
  }

  showDayEnd(s: DaySummary, onNext: () => void) {
    const delta = s.ratingEnd - s.ratingStart;
    const trend = Math.abs(delta) < 0.01 ? "steady" : delta > 0 ? `▲ ${delta.toFixed(2)}` : `▼ ${Math.abs(delta).toFixed(2)}`;
    this.openSheet(
      `<h2>Day ${s.day} wrap-up</h2>
       <div class="stat-grid tight">
         <div><span>Visitors</span><b>${s.visitors}</b></div>
         <div><span>Day passes</span><b>${s.dayPasses}</b></div>
         <div><span>New members</span><b>${s.newMembers}</b></div>
         <div><span>Workouts</span><b>${s.workouts}</b></div>
         <div><span>Gave up</span><b>${s.gaveUp}</b></div>
         <div><span>Member visits</span><b>${s.memberVisits}</b></div>
         <div><span>Earned</span><b>${money(s.revenue)}</b></div>
         <div><span>Rent</span><b>−${money(s.rent)}</b></div>
         <div><span>Net</span><b class="${s.net >= 0 ? "ok" : "bad"}">${s.net >= 0 ? "" : "−"}${money(Math.abs(s.net))}</b></div>
       </div>
       <div class="stat-hero">${stars(s.ratingEnd)}<div><b>${ratingLabel(s.ratingEnd)}</b><span>Rating ${trend}</span></div></div>`,
      `Start Day ${s.day + 1} ▶`,
      onNext,
    );
  }
}
