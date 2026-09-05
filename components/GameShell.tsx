'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameHudState } from '@/game/types';
import type { WeaponId } from '@/game/weaponDefinitions';

const initialHud: GameHudState = {
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
  const [error, setError] = useState('');
  const [hud, setHud] = useState(initialHud);

  useEffect(() => {
    let cancelled = false;
    async function startEngine() {
      try {
        // Babylon is loaded in the browser only, keeping the server build simple.
        const { createGame } = await import('@/game/createGame');
        if (!canvasRef.current || cancelled) return;
        gameRef.current = createGame(canvasRef.current, (update) => {
          setHud((current) => ({ ...current, ...update }));
        });
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
      <div className="stage-label">First to 5</div>

      {started && (
        <div className="combat-hud" aria-live="polite">
          {hud.damageId > 0 && (
            <div
              key={hud.damageId}
              className="damage-flash"
              aria-hidden="true"
            />
          )}
          <div className="scoreboard">
            <div
              key={`player-score-${hud.playerScore}`}
              className={`score-side player-side ${hud.playerScore > 0 ? 'score-won-round' : ''}`}
            >
              <span>You</span>
              <strong
                className={hud.playerScore > 0 ? 'score-number-earned' : ''}
              >
                {hud.playerScore}
              </strong>
            </div>
            <div className="score-goal">
              <span>First to</span>
              <strong>5</strong>
            </div>
            <div
              key={`bot-score-${hud.botScore}`}
              className={`score-side bot-side ${hud.botScore > 0 ? 'score-won-round' : ''}`}
            >
              <strong
                className={hud.botScore > 0 ? 'score-number-earned' : ''}
              >
                {hud.botScore}
              </strong>
              <span>Rook</span>
            </div>
          </div>
          <div className="crosshair" aria-hidden="true">
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
                className={`weapon-slot ${hud.weaponId === 'assaultRifle' ? 'active' : ''}`}
                aria-pressed={hud.weaponId === 'assaultRifle'}
                onClick={() => selectWeapon('assaultRifle')}
              >
                <span className="weapon-slot-kind">Primary</span>
                <strong>Kestrel AR</strong>
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
              {[3, 4].map((slot) => (
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
              <strong>{hud.ammo}</strong>
              <span>/ {hud.reserveAmmo}</span>
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
              <div className="final-score">
                <span>You {hud.playerScore}</span>
                <i /> <span>{hud.botScore} Rook</span>
              </div>
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
                <kbd>Hold Click</kbd> Rapid fire
              </span>
              <span className="control-chip">
                <kbd>Q Toggle / Right click</kbd> Aim
              </span>
              <span className="control-chip">
                <kbd>R</kbd> Reload
              </span>
              <span className="control-chip">
                <kbd>1 / 2</kbd> Switch weapon
              </span>
              <span className="control-chip">
                <kbd>Double-tap W</kbd> Sprint
              </span>
              <span className="control-chip">
                <kbd>C / Ctrl Toggle</kbd> Crouch
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
              onClick={enterArena}
              disabled={status !== 'ready'}
            >
              {status === 'loading'
                ? 'Preparing arena…'
                : status === 'error'
                  ? 'Engine error'
                  : 'Enter arena'}
            </button>
            {status === 'loading' && (
              <p className="loading-line">Calibrating the arena renderer…</p>
            )}
            {status === 'error' && <p className="error-message">{error}</p>}
          </div>
        </section>
      )}

      {started && <div className="pause-hint">ESC releases your mouse</div>}
    </main>
  );
}
