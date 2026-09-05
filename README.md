# Edgefront Arena

Edgefront Arena is a small, original 1v1 browser FPS prototype. You fight one simple AI rival with the Kestrel AR. The first side to 5 eliminations wins.

## Run the game

You need Node.js 22.13 or newer. Then open Terminal in this folder and run:

```bash
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:3000` in a normal desktop web browser. Press `Control + C` in Terminal when you want to stop the local server.

## Controls

- `W A S D` — move
- Move the mouse or touchpad to look around
- Tap left click for one shot, or hold it for rapid fire
- Press `Q` to toggle aiming, or hold right click to aim
- `R` — reload
- `Space` — jump
- Double-tap `W`, then hold the second press to sprint; release to stop
- Press `C` or `Ctrl` to toggle crouching; press again to stand
- `Esc` — release the cursor and pause

## Main files, in plain language

- `app/page.tsx` puts the game on the home page.
- `app/globals.css` controls the menus, HUD, colours, and layout.
- `components/GameShell.tsx` connects the 3D game to the React menus and HUD.
- `game/createGame.ts` starts Babylon.js and joins all game systems together.
- `game/createArena.ts` builds the arena floor, walls, cover, ramps, and platforms.
- `game/createWeapon.ts` creates the Kestrel AR, shooting, recoil, ammo, reload, flash, and sound.
- `game/createBot.ts` creates the Rook rival and its simple movement and shooting AI.
- `game/config.ts` contains easy-to-change numbers such as health, speed, damage, and magazine size.
- `game/types.ts` describes the small pieces of information shown on the HUD.

## Beginner-friendly tuning

Open `game/config.ts` if you want to make safe first changes. For example, change `walkSpeed`, `bodyDamage`, or `fireDelayMs`, save the file, and the browser will update automatically while `pnpm dev` is running.

The project deliberately has no accounts, database, online multiplayer, store, inventory, extra guns, building, crafting, or destructible environment.
