'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameHudState } from '@/game/types';
import type { WeaponId, PrimaryWeaponId } from '@/game/weaponDefinitions';
import { WeaponShop } from './WeaponShop';
import { createOrbRewards } from '@/game/createOrbRewards';
import { createOrbWallet, type PurchaseResult } from '@/game/createOrbWallet';

const initialHud: GameHudState = {
  scoped: false,
  weaponId: 'assaultRifle',
  weaponName: 'Kestrel AR',
  fireMode: 'Auto',
  ammo: 20,
  reserveAmmo: 100,
  reloading: false,
  hitMarker: 'none',
  hitId: 0,
  health: 100,
  maxHealth: 100,
  regenerating: false,
  botHealth: 100,
  dead: false,
  roundWon: false,
  damageId: 0,
  playerScore: 0,
  botScore: 0,
  result: 'none',
  paused: false,
};

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    dispose: () => void;
    requestPointerLock: () => void;
    selectWeapon: (weaponId: WeaponId) => void;
    playAgain: () => void;
  } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [started, setStarted] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [error, setError] = useState('');
  const [hud, setHud] = useState(initialHud);
  const [orbs, setOrbs] = useState(0);
  const [orbReward, setOrbReward] = useState(0);
  const [orbsSaved, setOrbsSaved] = useState(true);
  const [sniperOwned, setSniperOwned] = useState(false);
  const [orbiterOwned, setOrbiterOwned] = useState(false);
  const [orbClicks, setOrbClicks] = useState(0);
  const [primaryWeapon, setPrimaryWeapon] = useState<PrimaryWeaponId>('assaultRifle');
  const primaryRef = useRef<PrimaryWeaponId>('assaultRifle');
  const walletRef = useRef<ReturnType<typeof createOrbWallet> | null>(null);

  function syncWallet() {
    const state = walletRef.current?.state;
    if (!state) return;
    setOrbs(state.orbs);
    setSniperOwned(state.sniperOwned);
    setOrbiterOwned(state.orbiterOwned);
    setOrbClicks(state.orbClicks);
    setOrbsSaved(state.saved);
  }

  function buySniper(): PurchaseResult {
    const result = walletRef.current?.buySniper() ?? 'unavailable';
    syncWallet();
    return result;
  }
  function clickOrb() {
    const result = walletRef.current?.clickOrb() ?? 'unavailable';
    syncWallet();
    return result;
  }

  function equipPrimary(id: PrimaryWeaponId) {
    if (id === 'sniper' && !walletRef.current?.state.sniperOwned) return;
    primaryRef.current = id;
    setPrimaryWeapon(id);
    // Changing a loadout does not refill either weapon's ammunition.
    gameRef.current?.selectWeapon(id);
  }

  useEffect(() => {
    let cancelled = false;
    const rewards = createOrbRewards();
    let storage: Storage | undefined;
    let rewardTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingReward = 0;
    try {
      storage = window.localStorage;
    } catch { setOrbsSaved(false); }
    walletRef.current = createOrbWallet(storage);
    syncWallet();
    async function startEngine() {
      try {
        // Babylon is loaded in the browser only, keeping the server build simple.
        const { createGame } = await import('@/game/createGame');
        if (!canvasRef.current || cancelled) return;
        gameRef.current = createGame(canvasRef.current, (update) => {
          if (cancelled) return;
          const earned = rewards.update(update);
          if (earned > 0) {
            walletRef.current?.award(earned);
            syncWallet();
            // The final round and victory arrive separately; combine their popup.
            pendingReward += earned;
            setOrbReward(pendingReward);
            clearTimeout(rewardTimer);
            rewardTimer = setTimeout(() => { pendingReward = 0; setOrbReward(0); }, 3000);
          }
          setHud((current) => ({ ...current, ...update }));
        }, (id) => id === 'orbiter' ? walletRef.current?.state.orbiterOwned === true : id !== 'sniper' || walletRef.current?.state.sniperOwned === true, () => primaryRef.current);
        setStatus('ready');
      } catch (caught) {
        console.error(caught);
        setError(
          caught instanceof Error
            ? caught.message
            : 'The 3D engine could not start.',
        );
        setStatus('error');
      }
    }

    startEngine();
    return () => {
      cancelled = true;
      clearTimeout(rewardTimer);
      gameRef.current?.dispose();
    };
  }, []);

  function enterArena() {
    if (status !== 'ready') return;
    setStarted(true);
    gameRef.current?.requestPointerLock();
  }

  function playAgain() {
    gameRef.current?.playAgain();
  }

  function selectWeapon(weaponId: WeaponId) {
    if (hud.dead || hud.roundWon || hud.result !== 'none') return;
    gameRef.current?.selectWeapon(weaponId);
    if (document.pointerLockElement !== canvasRef.current) {
      gameRef.current?.requestPointerLock();
    }
  }

  return (
    <main className="game-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Edgefront Arena game"
      />
      <div className="brand-mark">Edgefront</div>

      {started && (
        <div className="combat-hud" aria-live="polite">
          {hud.scoped && <div className="sniper-scope" aria-hidden="true"><div className="sniper-scope-lens"><i /><b /></div></div>}
          <section className="scoreboard" aria-label={`Match score: Player 1 ${hud.playerScore}, Rook ${hud.botScore}. First to 5.`}>
            <div className="score-side player-side">
              <span>Player 1</span>
              <strong>{hud.playerScore}</strong>
            </div>
            <div className="score-goal"><span>First to</span><strong>5</strong></div>
            <div className="score-side bot-side">
              <span>Rook</span>
              <strong>{hud.botScore}</strong>
            </div>
          </section>
          {hud.damageId > 0 && (
            <div
              key={hud.damageId}
              className="damage-flash"
              aria-hidden="true"
            />
          )}
          <div className={`crosshair ${hud.scoped ? 'scope-hidden' : ''}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          {hud.hitMarker !== 'none' && (
            <div
              key={hud.hitId}
              className={`hit-marker ${hud.hitMarker}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {!hud.dead && !hud.roundWon && hud.result === 'none' && (
            <nav className="weapon-selector" aria-label="Weapon slots">
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === primaryWeapon ? 'active' : ''}`}
                aria-pressed={hud.weaponId === primaryWeapon}
                onClick={() => selectWeapon(primaryWeapon)}
              >
                <span className="weapon-slot-kind">Primary</span>
                <strong>{primaryWeapon === 'sniper' ? 'Meridian' : 'Kestrel AR'}</strong>
                <kbd>1</kbd>
              </button>
              <button
                type="button"
                className={`weapon-slot ${hud.weaponId === 'pistol' ? 'active' : ''}`}
                aria-pressed={hud.weaponId === 'pistol'}
                onClick={() => selectWeapon('pistol')}
              >
                <span className="weapon-slot-kind">Secondary</span>
                <strong>Vesper</strong>
                <kbd>2</kbd>
              </button>
              <button type="button" className={`weapon-slot ${hud.weaponId === 'orbiter' ? 'active' : ''} ${!orbiterOwned ? 'empty' : ''}`} disabled={!orbiterOwned} aria-pressed={hud.weaponId === 'orbiter'} onClick={() => selectWeapon('orbiter')} aria-label={orbiterOwned ? 'Equip Orbiter melee' : 'Unlock Orbiter by clicking the shop Orb badge 20 times'}>
                <span className="weapon-slot-kind">Melee</span><strong>{orbiterOwned ? 'Orbiter' : 'Locked'}</strong><kbd>3</kbd>
              </button>
              {[4].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="weapon-slot empty"
                  aria-label={`Weapon slot ${slot} is empty`}
                  disabled
                >
                  <span className="weapon-slot-kind">Slot</span>
                  <strong>Empty</strong>
                  <kbd>{slot}</kbd>
                </button>
              ))}
            </nav>
          )}
          <div className="ammo-panel">
            <div>
              <span className="weapon-name">{hud.weaponName}</span>
              <span className="fire-mode">{hud.fireMode}</span>
            </div>
            <div className="ammo-row">
              {hud.weaponId === 'orbiter' ? <strong style={{ fontSize: '24px' }}>Melee</strong> : <><strong>{hud.ammo}</strong><span>/ {hud.reserveAmmo}</span></>}
            </div>
            <div className={`reload-status ${hud.reloading ? 'visible' : ''}`}>
              Reloading
            </div>
          </div>
          <div
            className={`health-panel ${hud.regenerating ? 'regenerating' : ''}`}
          >
            <div className="health-heading">
              <span>Vital integrity</span>
              <strong>{hud.health}</strong>
            </div>
            <div className="health-track">
              <i
                style={{
                  width: `${Math.min(100, (hud.health / hud.maxHealth) * 100)}%`,
                }}
              />
            </div>
            <div className="health-caption">HP / {hud.maxHealth}</div>
          </div>
          <div className="health-panel bot-health-panel">
            <div className="health-heading">
              <span>Rook integrity</span>
              <strong>{hud.botHealth}</strong>
            </div>
            <div className="health-track">
              <i style={{ width: `${hud.botHealth}%` }} />
            </div>
            <div className="health-caption">HP / 100</div>
          </div>
          {hud.dead && (
            <div className="respawn-overlay">
              <strong>Eliminated</strong>
              <span>Respawning in 2 seconds</span>
            </div>
          )}
          {hud.roundWon && hud.result === 'none' && (
            <div className="respawn-overlay round-win-overlay">
              <strong>You win</strong>
              <span>Round secured · next round in 2 seconds</span>
            </div>
          )}
          {hud.paused && hud.result === 'none' && !hud.dead && (
            <section className="pause-screen" aria-labelledby="pause-title">
              <p>Match paused</p>
              <h2 id="pause-title">Cursor released</h2>
              <button className="primary-button shop-open-button" type="button" onClick={() => setShopOpen(true)}>Weapon shop</button>
              <button
                className="primary-button"
                type="button"
                onClick={() => gameRef.current?.requestPointerLock()}
              >
                Resume
              </button>
            </section>
          )}
          {hud.result !== 'none' && (
            <section
              className={`match-result ${hud.result}`}
              aria-labelledby="match-result-title"
            >
              <p>Match complete</p>
              <h2 id="match-result-title">
                {hud.result === 'victory' ? 'Victory' : 'Defeat'}
              </h2>
              <button
                className="primary-button"
                type="button"
                onClick={playAgain}
              >
                Play again
              </button>
            </section>
          )}
        </div>
      )}

      {!started && (
        <section className="start-screen" aria-labelledby="game-title">
          <div className="start-card">
            <p className="eyebrow">1v1 training protocol</p>
            <h1 id="game-title">
              Edgefront <span>Arena</span>
            </h1>
            <p className="intro">
              Face the Rook training rival in a compact futuristic sports arena.
              The first side to five eliminations wins the match.
            </p>
            <div className="controls-row" aria-label="Controls">
              <span className="control-chip">
                <kbd>WASD</kbd> Move
              </span>
              <span className="control-chip">
                <kbd>Mouse</kbd> Look around
              </span>
              <span className="control-chip">
                <kbd>Click</kbd> Fire · Hold for AR
              </span>
              <span className="control-chip">
                <kbd>Q Toggle / Right click</kbd> Aim
              </span>
              <span className="control-chip">
                <kbd>R</kbd> Reload
              </span>
              <span className="control-chip">
                <kbd>1 / 2 / 3</kbd> Primary / Secondary / Melee
              </span>
              <span className="control-chip">
                <kbd>Double-tap W</kbd> Sprint
              </span>
              <span className="control-chip">
                <kbd>C / Ctrl Toggle</kbd> Crouch
              </span>
              <span className="control-chip">
                <kbd>Hold Shift</kbd> Slide from standing or moving · No cooldown
              </span>
              <span className="control-chip">
                <kbd>Space</kbd> Jump
              </span>
              <span className="control-chip">
                <kbd>Esc</kbd> Release cursor
              </span>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={status === 'error' ? () => window.location.reload() : enterArena}
              disabled={status === 'loading'}
            >
              {status === 'loading'
                ? 'Preparing arena…'
                : status === 'error'
                  ? 'Reload game'
                  : 'Enter arena'}
            </button>
            {status === 'loading' && (
              <p className="loading-line">Calibrating the arena renderer…</p>
            )}
            {status === 'error' && (
              <div className="error-message" role="alert">
                <p>The game could not load. Try Reload game. If you are using localhost, the local game server must be running.</p>
                <details><summary>Technical details</summary>{error}</details>
              </div>
            )}
            <button className="primary-button shop-open-button" type="button" onClick={() => setShopOpen(true)}>Weapon shop</button>
          </div>
        </section>
      )}

      {orbReward > 0 && <div className="orb-reward-toast" role="status">+{orbReward} Orbs earned</div>}
      <WeaponShop open={shopOpen} onOpenChange={setShopOpen} orbs={orbs} orbsSaved={orbsSaved} sniperOwned={sniperOwned} onBuySniper={buySniper} primaryWeapon={primaryWeapon} onEquipPrimary={equipPrimary} orbiterOwned={orbiterOwned} orbClicks={orbClicks} onOrbClick={clickOrb} />
      {started && <div className="pause-hint">ESC releases your mouse · Weapon shop in pause menu</div>}
    </main>
  );
}
