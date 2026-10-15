# Iron & Dust

A cozy pixel-art gym-management sim: turn a dusty old warehouse into a thriving gym.
Built with Phaser 3 + TypeScript, made for phones in landscape (also plays with a mouse).

See [DESIGN.md](DESIGN.md) for the full vision and roadmap.

## Play / develop

```bash
npm install
npm run dev          # local dev server (open the printed URL; --host lets your phone on the same Wi-Fi join)
npm test             # simulation tests (pathfinding, placement, customers, economy, saves)
npm run build        # production build in dist/ (GitHub Pages, later Capacitor)
npm run build:single # everything inlined into dist-single/index.html for quick sharing
```

## How it's organised

```
src/
  data/       equipment, starting layout, balance numbers (pure data)
  sim/        game rules with no Phaser imports: grid, A* pathfinding, placement, customers, economy, saves
  art/        all pixel art, drawn in code at startup (no image files)
  scenes/     the Phaser scene: rendering, camera, touch input
  ui/         HTML overlay: HUD, GymOS 95 computer, placement controls, bubbles, dialogs
  controller.ts  play / computer / placement / move-mode state
tests/        Vitest tests for the simulation
```

Adding a machine mostly means adding an entry in `src/data/equipment.ts` and a drawing function in `src/art/furniture.ts`.
