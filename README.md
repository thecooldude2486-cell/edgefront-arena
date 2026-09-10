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
- Tap left click for one shot; only the AR fires continuously while held
- `1` — chosen primary (Kestrel AR or Meridian Sniper) · `2` — Vesper Pistol · `3` — Orbiter melee (after unlock)
- Press `Q` to toggle aiming, or hold right click to aim
- `R` — reload
- `Space` — jump
- Double-tap `W`, then hold the second press to sprint; release to stop
- Press `C` or `Ctrl` to toggle crouching; press again to stand
- Hold `Shift` to slide on the ground, even from a standstill. The initial boost fades over 0.65 seconds; release to stop. There is no cooldown, so you can slide again immediately. When standing still, you slide forward in the direction you face.
- `Esc` — release the cursor and pause

### Orbiter grapple (mouse or touchpad)

Equip the unlocked Orbiter with **3**, aim the crosshair at a solid wall, ledge or platform within **35 metres**, then **hold E** (touchpad-friendly) or **hold right-click**. The thrown Orbiter and purple tether show the attachment point. Keep holding to pull toward it and cling; release to detach and fall. If using both controls, release both. Left-click remains melee. No valid target or a blocked path shows a hint; release and aim again. Switching away, dying, pausing, or losing window focus detaches safely. The grapple uses existing player collisions and does not damage or move objects. Tune reach and pull speed in `game/createGrapple.ts`. Run `node tests/grapple.test.mjs` to check grappling.

## Local Orbs rewards

Win a round to earn 10 Orbs. Winning the first-to-five match adds 25 bonus Orbs (75 total for a match victory). Losing never removes earned Orbs. The shop shows your balance and reward rules. Clicking its Orbs badge plays an animation and advances the free Orbiter unlock.

**Orbiter** is an original grey, white and black orbital-blade melee with a glowing purple centre ring and dot. Click the shop's Orb badge **20 times** to unlock it with a glitch-to-clear reveal. Progress and ownership save in this browser; no Orbs are spent. Press **3** to equip, then click once per swing. It deals **35 damage**, reaches **3 metres**, has a **0.65-second** swing delay, and uses no ammo, reload or scope. Its stats live in `game/weaponDefinitions.ts`, model in `game/createOrbiterModel.ts`, and click requirement in `game/createOrbWallet.ts`. Your primary and Vesper remain equipped alongside it; only slot 4 is empty.

The **Meridian Sniper** costs **300 Orbs** and has Common (green) rarity. Buy it in the weapon shop to see the blurred-to-clear green reveal. Choose **Equip primary** on either the Kestrel or Meridian: you carry only one primary plus the Vesper secondary and unlocked Orbiter melee. Press `1` for your chosen primary and `2` for the pistol. Your choice stays through respawns and Play Again; refreshing defaults to Kestrel without removing sniper ownership. Choosing a different primary does not refill ammo. Use `Q` or right click to scope the sniper. It starts each life with **5 / 15** ammo, deals **70 body / 100 head** damage, fires once per click (at least **1.2 seconds** between shots), and reloads in **2.4 seconds**. AR and pistol stats are unchanged.

The price and browser-local purchase save are in `game/createOrbWallet.ts`. All gun stats are in `game/weaponDefinitions.ts`; the original sniper model is in `game/createSniperModel.ts`. A purchase saves ownership and subtracts Orbs together; failed saving does not charge Orbs. Existing local Orb balances are carried over. Clearing browser site data removes both Orbs and unlocks. They do not sync to another device or to the online address.

Run the targeted sniper checks with Node 24 or later: `node tests/sniper.test.mjs`.

Orbs are saved in this browser for this site address. Localhost and the online game do not share a balance; clearing browser site data removes the save. If browser storage is blocked, rewards still work for the current page and the shop shows a warning. Reward amounts are configured in `game/createOrbRewards.ts`.

## Main files, in plain language

- `app/page.tsx` puts the game on the home page.
- `app/globals.css` controls the menus, HUD, colours, and layout.
- `components/GameShell.tsx` connects the 3D game to the React menus and HUD.
- `game/createGame.ts` starts Babylon.js and joins all game systems together.
- `game/createSlide.ts` controls the slide boost, duration, cooldown, and camera tilt settings.
- `game/createArena.ts` builds the arena floor, walls, cover, ramps, and platforms.
- `game/createWeapon.ts` creates the Kestrel AR, shooting, recoil, ammo, reload, flash, and sound.
- `game/createBot.ts` creates the Rook rival and its simple movement and shooting AI.
- `game/config.ts` contains easy-to-change numbers such as health, speed, damage, and magazine size.
- `game/types.ts` describes the small pieces of information shown on the HUD.

## Beginner-friendly tuning

Open `game/config.ts` if you want to make safe first changes. For example, change `walkSpeed`, `bodyDamage`, or `fireDelayMs`, save the file, and the browser will update automatically while `pnpm dev` is running.

The project deliberately has no accounts, database, online multiplayer, real-money purchases, building, crafting, or destructible environment.
