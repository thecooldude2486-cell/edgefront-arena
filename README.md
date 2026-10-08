# Edgefront Arena

Edgefront Arena is a small, original 1v1 browser FPS prototype. You fight one simple AI rival with the Kestrel AR. The first side to 5 eliminations wins.

## Run the game

On this Mac, double-click **Start Edgefront Arena.command** in the project folder.
It starts the game on http://localhost:3000/ and online rooms on port 3008.
Keep its Terminal window open while playing. Localhost requires these servers
to be running; after closing Terminal or restarting your computer, run the
launcher again. This launcher uses Node.js 24+ or the bundled Codex runtime.

For multiplayer, run `npm start` inside `server/` (Node 24+, port 3008), then open **Play menu → 1v1 Online** in two tabs. Create a private room and share its code, or join a public room. All ten weapons deal server-validated damage, with shared health, ammo limits, reloads and first-to-five scoring. Names, character appearance and equipped weapon cosmetics are visible to both players. Use **Click to move**, left click to fire, **R** to reload, **1–4** to switch, and **Esc** to release the cursor. Use a normal desktop browser if the embedded preview rejects mouse capture.

Online reliability:

- Ping is measured by the server and displayed during matches. Hitscan shots use up to 250 ms of opponent position history, based on measured latency and movement smoothing; ammo, fire rate, aim and current cover checks still apply. Melee and projectiles use current positions.
- A dropped connection reserves your player slot for 30 seconds and pauses the match, including round and rematch countdowns. Automatic reconnect restores the same room, score, health, loadout, ammo and shot sequence. Refreshing the same tab also attempts restoration. Click **Click to move** after reconnecting to capture the mouse again.
- Shots are never queued offline. Active projectiles and reloads are cancelled when the match pauses, preventing delayed attacks after reconnecting. Reload again after resuming if needed. **Leave** ends your session immediately.
- At match end, both players can choose **Rematch**. The same room starts a new match after a three-second countdown, with fresh health and ammo and the same loadouts, names and cosmetics.

Rooms are kept in server memory; restarting the room server closes them. For hosted multiplayer, configure `VITE_MULTIPLAYER_URL` with a secure `wss://` server address. GitHub Pages alone cannot run the room server.

Run multiplayer checks with Node 24+: `node --test server/*.test.mjs`. Client reconnect and inventory restoration checks: `node --test tests/roomConnection.test.mjs tests/onlineSnapshot.test.mjs`. Set `TEST_SERVER_URL=ws://127.0.0.1:3008` to run `server/transport.test.mjs` against the running local server.

Local weapon testing: development builds on localhost automatically make paid shop weapons available. The secondary defaults to Vesper until you choose another weapon. No Orbs are spent and free ownership is never saved. Future paid weapons should use a boolean `*Owned` field in the wallet to join this preview automatically; purchase handlers should respect test mode. Production builds keep normal purchases, even when served locally. Quest/click unlocks remain unchanged.

You need Node.js 22.13 or newer. Then open Terminal in this folder and run:

```bash
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:3000` in a normal desktop web browser. Press `Control + C` in Terminal when you want to stop the local server.

## Maps, recaps and rarity

Choose a map directly in bot setup. Online rooms vote on their mode's five-map pool before loadouts; the server shares the result with everyone. Reconnects keep that match's map and rematches open fresh voting. See the full mode catalogue below.

- **Switchyard / Easy:** broad ground routes and generous cover.
- **Stadium / Normal:** the original central ring and raised side lanes.
- **Skyline / Hard:** a high skybridge, lower deck and ramped flanks.
- **Crossfire / Extreme:** exposed sightlines, small cover islands and four firing decks.
- **Prism Quarry / Normal:** staggered cuts, low cover and paired ramped overlooks.

Terrain difficulty is separate from Rook's five AI difficulties. Client collisions and server hit queries use the same map builder.

Death recaps in bot and online play show actual HP damage received, damage dealt, each incoming weapon's hit/headshot counts, finishing hit type and distance, and the killer's remaining HP. **Last death recap / Death recap** reopens the most recent recap after respawning. Online recaps are generated from validated server damage.

Weapons, full model skins, wraps, charms and character gear show text and colour rarity badges: Common, Uncommon, Rare, Epic, Legendary and Mythic. Career signature milestones at levels 25, 100 and 500 introduce Epic, Legendary and Mythic rewards and continue throughout the uncapped track. Existing ownership, reward IDs, weapon stats and prices are preserved.

Run the targeted checks: `node --test tests/maps.test.mjs tests/rarityRecap.test.mjs server/mapsRecap.test.mjs`. The network test also accepts `TEST_SERVER_URL=ws://127.0.0.1:3008`.

## Controls

### Secret laser-cannon project

Five hidden components can be collected with **E** in the lobby. Collection
progress saves in this browser, separately from Orbs. Collecting all five marks
the Helion unlocked. Choose it in the Armory as your primary,
then press **1** in the arena. Existing five-part saves unlock it automatically.
Hold left click for a continuous beam; tapping also consumes energy. Release
fire for 1.5 seconds to begin recharging at 12% per second. The 100% energy bar
drains at 30% per second; R does not manually reload it. Switching preserves
energy (it may recharge while holstered), and respawning restores full energy.
Damage is 6 body / 8 head per 0.1-second tick (60 / 80 DPS), with a 90m range.
The laser can also melt the eight arena cover panels (60 durability, about one
second of beam contact). They heat up visibly before breaking and restore each
round. Lobby walls, boundary walls, floors, ramps and platforms are protected.
Other weapons do not damage cover. Tune durability in `game/createDestructibleCover.ts`.
Damage/fire rate are in `game/weaponDefinitions.ts`; energy settings are in
`game/createLaserEnergy.ts`; the model is in `game/createLaserModel.ts`.
The localhost and live websites have separate browser saves.

Spoilers (directions assume you face the Duel deck from spawn):

1. **Power cell (obvious):** pedestal beside the Armory terminal.
2. **Focus lens (obvious):** on the Recovery Lounge's round table.
3. **Magnetic coil (secret room):** walk through the left outer wall beside the rear of the Armory (world x=-27, z=-105), then go around the interior partition.
4. **Emitter assembly (secret room):** walk through the right outer wall behind the Recovery Lounge (x=27, z=-104), then go around the partition.
5. **Energy regulator (secret room):** walk through the rear wall to the right of the Duel gateway (x=14, z=-89), then go around the partition.

The three false walls look solid but allow walking both ways. The rooms have
solid floors, ceilings, and outer walls; their interiors are lit and the exits
are marked on the inside. Collecting through walls is blocked. Old discoveries
remain saved even though the components have moved.

You start in a safe 3D atrium. Click **Click to explore**, then use WASD.
Walk to the violet **Armory** terminal on the left and press **E** to shop.
Walk to the cyan **Duel deck** terminal ahead and press **E** for difficulty
and match setup. A nearby prompt appears within 3.8 metres; E works on a
keyboard with either a mouse or touchpad. Press **Esc** during a match
and choose **Return to lobby** to leave it; this ends your current match.
You can also return after a victory or defeat. The lobby has no combat or rewards.

`game/createLobby.ts` builds the lobby floor, walls, seating, plants, and signs.
`game/createGame.ts` handles moving between lobby and arena without changing
the arena map. `components/GameShell.tsx` contains the lobby buttons.

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

The **Meridian Sniper** costs **750 Orbs** (existing owners keep their unlock at no extra cost) and has Epic (purple) rarity. Buy it in the weapon shop to see the blurred-to-clear purple reveal. Choose **Equip primary** on either the Kestrel or Meridian: you carry only one primary plus the Vesper secondary and unlocked Orbiter melee. Press `1` for your chosen primary and `2` for the pistol. Your choice stays through respawns and Play Again; refreshing defaults to Kestrel without removing sniper ownership. Choosing a different primary does not refill ammo. Use `Q` or right click to scope the sniper. It starts each life with **5 / 15** ammo, deals **34 body / 100 head** damage, fires once per click (at least **1.2 seconds** between shots), and reloads in **2.4 seconds**. AR and pistol stats are unchanged.

The **Flux Uzi** is a 300-Orb automatic secondary. Choose it or the free Vesper in the Armory, then press `2`. Hold click to fire at 12.5 shots/second, dealing **9 body / 12 head damage** per bullet. It starts with **24 / 96** finite ammo, reloads in **1.8 seconds**, and reaches 90 metres. `Q` or right click aims. Its sustained body DPS is 112.5 versus Vesper's 25 (before reloads). Switching preserves ammo; respawning restores it. Ownership stays saved; refreshing defaults the selection to Vesper. Stats live in `game/weaponDefinitions.ts`; price is in `game/createOrbWallet.ts`.

The **Ember Molotov** costs **250 Orbs**. Buy it in the Armory, then choose **Equip utility**. Slot `4` carries either it or the free Pulse Grenade. Click once to throw. On impact it creates a 3-metre burning area lasting 5 seconds, dealing 5 damage every 0.5 seconds to enemies inside (50 total for the full duration). Cover blocks damage. It does not harm or launch the thrower. One per life; switching does not refill it. Fires clear between rounds. Unlocks are saved locally, while refreshing defaults utility selection to Pulse Grenade. Price is in `game/createOrbWallet.ts`, damage in `game/weaponDefinitions.ts`, and flight/burn settings in `game/createMolotov.ts`.

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

The project deliberately has no accounts, database, real-money purchases, building, crafting, or destructible environment.
### Vector Sword

The free Vector Sword shares melee slot 3 with the unlocked Orbiter. Choose **Equip melee** in the weapon shop, then press **3**. Click once per swing: 20 damage, 3-metre reach, and a 0.5-second swing delay. Press **E** with the sword equipped for +40% movement speed for 5 seconds, followed by a 5-second cooldown. Switching away ends the boost and starts its cooldown. Round/respawn resets clear the boost. Orbiter retains its own grapple controls. Melee choice lasts for this session; refreshing defaults to the sword without removing Orbiter ownership.

Sword stats: `game/weaponDefinitions.ts`. Boost tuning: `game/createSwordBoost.ts`. Timing checks: `node tests/swordBoost.test.mjs`.
### Comet Launcher

Unlock Comet Launcher for **500 Orbs** (existing owners keep it at no extra cost), choose **Equip primary**, and press **1**. Each click launches a visible missile. A direct missile hit deals **67 damage total**; other targets within **4 metres** take **34 splash damage**, with cover blocking splash. Direct hits never add splash damage to the same target. Grenades and rockets do not deal self-damage. The launcher starts with **1 / 5** rockets and reloads in **2.4 seconds**. Existing sniper and Orbiter unlocks are preserved.

Launcher damage and ammunition: `game/weaponDefinitions.ts`; projectile tuning: `game/createRockets.ts`; price: `ROCKET_PRICE` in `game/createOrbWallet.ts`. Run `node tests/rocket.test.mjs` for targeted checks.

## Career levels and cosmetics

Bot matches and online 1v1 share one career saved in this browser. There is no configured level cap. The XP cost of the next level starts at 1,000 and increases by 200 each level, four times the previous curve. Existing saves retain their level, progress percentage and unlocked cosmetics through a one-time conversion; the conversion grants no additional Orbs. Elimination XP is 50 + 35% of actual damage dealt (capped at 100) + 10% of remaining health, rounded per term. Bonuses: a headshot killing blow +30; a kill from 24m or farther +25; an airborne bot kill +20; surviving with 1–25 HP +20; keeping at least 90 HP +15; at least 80% hits across three or more attacks +15; a round win within six seconds +15. A lost round earns 25 plus 20% of damage dealt. Online damage, hit region, distance, accuracy and health come from the server. A completed match adds 150 for a victory or 75 for a defeat. Multipliers: Easy ×1, Normal ×1.5, Hard ×2, Extreme ×2.5, Nightmare ×3, online ×2 (each payout is rounded down). Leaving early keeps XP earned from finished rounds but earns no completion bonus. Duplicate score updates do not award XP twice.

Every level grants 15 Orbs. Every level from level 2 unlocks a permanent Field cosmetic; five-level milestones keep their original Signature skin → wrap → charm sequence. Editions and palettes keep generating beyond the initial reward set. Click the Career progression card to view the reward track, browse later levels, equip unlocked rewards or reset to the default appearance. Cosmetics change the actual held weapon in bot and online modes; online opponents see your equipped finish, full weapon wrap and swinging charm. Both online players’ levels are displayed beside their names. Cosmetics do not change damage, health or ammunition.

Career storage uses `edgefront-arena.progression.v1` with a versioned save format and preserves the existing weapon wallet. Progress is device/browser-local, like the existing Orbs system; it is not an authenticated account rank. The room server sanitizes and relays profile presentation data while retaining authority over combat and scores. If browser saving fails, the career screen indicates session-only progress.

The expanded arsenal uses 24 curated pearl/graphite/energy palettes, eight patterned finish styles and eight Edgefront hardware charm silhouettes. The career collection has type filters, level pagination and an actual 3D weapon inspection view. Existing saved five-level cosmetic IDs remain compatible. Lobby currency and XP share a stacked HUD region; compact match XP and reward notices are placed above the ammo region rather than the scoreboard.

Wraps now use eight original layered texture designs: Ion Mosaic, Frostglass, Spectral Current, Flightpath, Circuit Bloom, Ember Contours, Prism Mesh and Nightwake. The artwork combines themed gradients, facets, fine fabric grain and sports-tech hems, rather than solid colour bands. One deterministic pixel generator supplies both the collection swatches and every weapon surface, including frames, barrels, magazines, stocks, optics and fitted grip sleeves. The art matches in local and remote weapon views, while charms retain their own materials. Wrap textures are released when cosmetics change or the model is disposed.

Nightmare reacts in 155ms, fires 120ms shots with up to 20ms jitter and moves at 4.8m/s. It tracks a 140ms-old position, fires seven-shot bursts with 320ms recovery and reloads after 20 shots for 1650ms. Sudden movement, cover and accurate headshots provide narrow counterplay. Health and damage remain the standard values. Held and thrown grenades share geometry and the same snapshot of equipped cosmetics.

Gun skins replace the full model across the Kestrel, Vesper, Meridian, Flux, Helion and Comet. Eight complete designs (Ceramic Aero, Split Frame, Flightline, Carbon Bullpup, Circuit Cage, Contour, Titanium Drum and Pulse Fork) change the chassis, stock, magazine, barrel and optic. Reset restores the original model. Gun roots, firing positions, ammunition and damage remain unchanged. Wraps fit the replacement model. Charms use a raised forward side mount and larger miniatures to stay within the first-person view. The career preview supports drag/arrow rotation, wheel/plus-minus zoom and a dedicated charm close-up.

Skins supply geometry and solid model materials; they have no built-in patterned wrap. Only the wrap slot applies patterned textures. Preview cameras use a 0.01m near plane so charm inspection works at close distance. Bot Ready captures the mouse during the button gesture while the countdown still locks controls. If capture is unavailable, the first match action is Enter arena; Resume appears only after play has begun and the cursor is released.


## Online weapon damage

All ten equipped weapons now deal damage in 1v1 rooms with the same values as bot mode. The server checks weapon, ammo/energy, reload time, attack rate, aim and arena cover. Sword/Orbiter attacks have a 3m reach. Comet rockets deal 67 directly or 34 splash; Pulse Grenades deal 34 after their two-second fuse; Ember Molotovs deal 5 per half-second for five seconds. Splash/fire does not harm the owner. Any weapon can eliminate an opponent, award career XP and win a round. Both players receive the same health and score; only the attacker receives confirmed hit markers. Delayed attacks clear between rounds and when a player leaves. Run `node --test server/*.test.mjs` to check all weapon combat and rooms.


## Character shop and daily gear

Press **H** or click **Character shop** to open the Outfitter. Buy suits, visors and accessories with Orbs, inspect the live character, then Equip. Suits recolour your first-person gloves; online opponents see your complete character, visor and accessory. Weapon cosmetics have a separate shop collection and can be equipped at any career level after purchase. All cosmetic gear leaves damage and health unchanged.

Daily rewards can be claimed once per local calendar day. The seven-day starter track is earned once, and missed days preserve your place: **day 1** 50 Orbs; **day 2** choose Flux Uzi, Daybreak skin, Daybreak wrap or Daybreak charm; **day 3** 100 Orbs; **day 4** Ice visor; **day 5** 150 Orbs; **day 6** Signal antenna; **day 7** Aurora suit + 200 Orbs. An already-owned day 2 selection grants 150 Orbs. Already-owned character rewards grant bonus Orbs. Claims and shop purchases save balance and ownership together in the existing browser wallet; failed saving grants nothing and spends nothing.

Sniper clicks capture current aim before recoil for both local hit detection and online attacks. Player-owned grenades and rockets launch the player in both modes without self-damage; remote explosions cannot launch you. Direct Comet hits use a red confirmed hit marker, matching headshots; splash remains white. Tests: `node --test tests/store.test.mjs tests/character.test.mjs tests/shotAim.test.mjs tests/blastOwnership.test.mjs`, plus `node --test server/*.test.mjs` for two-player combat and profile sync.

After the seven starter claims, every new day offers one **100-Orb daily supply**. The starter track never restarts, including for existing saves with more than seven claims. Before claiming, spend **25 / 40 / 60 Orbs** to reroll a Standard / Enhanced / Elite supply into a different reward at the same tier, or **75 / 125 Orbs** to upgrade Standard → Enhanced → Elite. Enhanced rewards include 200 Orbs or cosmetics; Elite rewards include 350 Orbs, weapons or character/weapon cosmetics. Owned gear converts to that tier’s Orbs payout. Today's selection and spending save together; it can be claimed once, and the next calendar day resets to the free Standard supply.


## Team arenas and map voting

Bot training and online rooms offer **1v1, 2v2, 3v3, 4v4 and 5v5**. In bot teams, you play on Cyan alongside allied bots against Coral Rooks. Online rooms use real players and wait for the selected capacity. A team wins a round when the opposing team is fully eliminated; first to five rounds wins. Eliminated players wait while surviving teammates keep fighting. The recorded killcam plays for **three seconds**, and every round intermission lasts **three seconds**.

After elimination, **Close / Spectate** dismisses the recap immediately; a completed three-second killcam also dismisses it. The last recap remains available from the recap shortcut. A live shoulder camera follows surviving teammates in bot and online matches. Movement, jumps and aim use frame-rate independent easing; cover pulls the camera inward immediately and releases it gently. Use **Previous / Next** or click an eligible individual roster row to switch; eliminated or disconnected targets are skipped automatically. During the round break, surviving opponents can also be watched (including 1v1). Starting the next round or returning to the lobby restores the player camera. Each participant has a named roster row with HP and elimination status; online rows also show level and individual kills/deaths.

Online **2v2–5v5** rooms let you choose **Auto assign, Cyan or Coral** before creating or joining a room. A full preferred team automatically places you on the other side; the server counts disconnected reservations as occupied. You can switch to an open side in the waiting lobby, with your name, cosmetics, stats and reconnect token preserved. Teams lock when map voting starts. 1v1 still assigns opposing sides automatically, and bot training keeps its existing teams.

Setup screens keep quick actions in a separate header above the scrolling panel. Match quick actions are available through the compact **Menu** dropdown and the existing B/L/K/H shortcuts.

Each mode has five distinct maps (25 total), sized for its player count:

| Mode | Maps |
| --- | --- |
| 1v1 | Switchyard, Stadium, Skyline, Crossfire, Prism Quarry |
| 2v2 | Foundry, Relay Station, Conduit, Freight Depot, Causeway |
| 3v3 | Junction, Atrium, Reactor, Terraces, Switchback |
| 4v4 | District, Drydock, Bastion, Reservoir, Gauntlet |
| 5v5 | Sky Harbor, Citadel, Terminal, Refinery, Nexus |

Bot training always uses the map you select; bots do not vote. Online players get
one vote each and ten seconds to choose from their mode's five-map pool before
loadouts. Votes can change while voting remains open. Voting ends when everyone
votes or time expires. Most votes wins; ties and no-vote rounds choose randomly
within that pool. The server validates the mode, retains votes during reconnect
pauses, and starts a fresh vote for a rematch. Moving ferries, item-only perches,
fall hazards and explosive barrels remain available. New maps use distinct cover
placements and accessible ramped overlooks with the existing game's visual style.

Online team combat validates every weapon on the server, tests all enemy hitboxes against cover, and applies explosions to nearby enemies. Friendly weapon damage is disabled; oil barrels can hurt anyone. Levels, gear, health and K/D are visible on the team roster. A disconnected seat is held for 30 seconds while the room freezes its round, projectiles and platforms. Rejoining restores position, health and ammunition. Online career awards use each player’s confirmed eliminations and deaths, with the existing ×2 online multiplier and 300/150 XP victory/defeat completion bonuses.

Checks: `node --test server/teams.test.mjs tests/botTeams.test.mjs tests/maps.test.mjs tests/arenaEnvironment.test.mjs`. The team server test connects ten real WebSocket clients and verifies voting, room capacity, nearest-enemy damage, killcam statistics, reconnects and three-second round timing.

Team bot matches use independent assault, flank and anchor roles. Teammates spread
across separate lanes, navigate around solid cover and voids, and use different
strafe/reaction timings. Bots prefer visible enemies, share pressure, remember a
last-seen position briefly, and hold fire when an ally crosses their shot. Wounded
bots briefly withdraw behind reachable cover before re-peeking. Health and weapon
damage still follow the existing difficulty rules.
