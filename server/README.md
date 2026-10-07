# Private room server

Use Node.js 24 or newer. Keep this folder inside the game repository and install dependencies in both the repository root and `server/`. The server uses the existing Babylon dependency and shared arena geometry in a headless scene; it does not render a game window.

All ten weapons deal server-checked damage using the shared game definitions. The server checks equipped weapon, room identity, shot sequence, fire rate, origin/facing, weapon range and arena cover. Each weapon has its own magazine/reserve and reload deadline; switching cannot refill ammunition. Helion ticks spend 3 energy and recharge after 1.5 seconds at 12 per second. Clients cannot set health, supply damage or report trusted hits.

Guns use body/head hitboxes; melee uses a 3-metre ray and its fixed damage. Rockets travel at 45m/s and deal 67 on a direct hit or 34 within an unblocked 4-metre blast. Grenades follow gravity and detonate after two seconds, dealing 34 within an unblocked 4-metre blast. Molotovs ignite on landing, dealing 5 every half-second for five seconds within a 3-metre fire area; cover blocks burning. Projectiles and fires advance in server steps independently of incoming packets. Owner explosions/fire never harm their owner.

Browsers send movement at 20Hz (plus a current pose before weapon events); remote movement is relayed at up to 25Hz and interpolated. All attacks use `effect` events with a monotonically increasing `sequence`; legacy `shot` and `grenade` presentation packets are ignored. `combatReady` follows loadout selection. Both players receive the same health after damage; only the attacker receives a confirmed hit marker. Predicted local weapon animations and ammo remain responsive.

Eliminations from any weapon award one point and server-derived performance XP. First to five wins. After each nonfinal round, health/ammunition reset and all old projectiles/fire clear; sequence watermarks persist. Leaving a room also clears delayed attacks.

Limitations: movement is still client-reported, not server-simulated. There is no lag compensation or movement anti-cheat. Hits use the latest received poses, so latency can cause a visually apparent hit to miss. The server never trusts client-reported hit targets or damage. This is a private-room prototype, not competitive-grade anti-cheat. Restart the room server after code updates.

## Run locally

In this folder:

1. Run `npm install` once.
2. Run `npm run dev` and leave the terminal open (local port 3008). The local game uses this port too. This uses polling to restart after server/shared game code edits without native file watchers. Active rooms close during a restart. Old servers on ports 3002/3006/3007 are not used by the current client. `npm start` still runs without automatic restarts.
3. Keep the normal game running on localhost:3000.
4. In the game choose **Play menu → 1v1 Online**, choose **Private** (the default) or **Public**, then **Create Room**. Public rooms appear in the automatically updated browser, including full rooms marked 2/2. Private rooms are unlisted, not password-protected: anyone with their code can join. Lists contain only rooms on this server, not a global service. Click **Join** next to an available public room, or enter a code to join either kind.
5. Open a second tab, choose **Join Room** with the code. Both players enter opposite arena spawns after loadout selection. Click **Click to move** in each tab to capture its mouse, then use WASD. Click or hold to attack, R to reload, 1–4 to switch. Each player sees their own ammo and both server-controlled health bars. Esc releases the mouse. All equipped weapons cause damage, including melee and utility.
6. A third tab trying the same code is rejected.

Run `npm test` for automated room checks.

Closing Player 2's screen frees that slot. Closing Player 1's screen closes the room.
Lost connections are detected with a heartbeat. Server restarts clear every room.

## GitHub Pages stays the frontend

No deployment or hosting change is required for Player vs Bot. The room server must
eventually be hosted as a separate long-running Node process with secure WebSocket
support. Set `HOST=0.0.0.0`, the host-provided `PORT`, and
`ALLOWED_ORIGINS=https://thecooldude2486-cell.github.io` there.

For the Pages build, set `VITE_MULTIPLAYER_URL=wss://YOUR-SERVER-ADDRESS` in the
build environment and rebuild. This is a public address, not a secret. Without it,
the live room screen explains that online rooms are not configured; bot mode still
works. No paid host or live backend has been provisioned by this change.

Files: `index.mjs` manages connections and rooms; `rooms.test.mjs` tests three clients; `movement.test.mjs` checks two-way movement, validation and room isolation. Movement is client-reported for this prototype, not authoritative anti-cheat.
