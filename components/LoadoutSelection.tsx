'use client';

import { LoadoutWeaponChoices } from './LoadoutWeaponChoices';
import type { UnlockProgress } from '@/game/loadoutCatalog';
import { useEffect, useRef, useState } from 'react';
import type { OnlineGame } from '@/game/onlineMovement';
import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';
import './LoadoutSelection.css';

const labels = ['Primary', 'Secondary', 'Melee', 'Utility'];
export const SELECTION_SECONDS = 10;

export type LoadoutChoices = {
  selected: WeaponId[];
  available: WeaponId[][];
  unlockProgress?: UnlockProgress;
  choose: (id: WeaponId) => void;
};
export function LoadoutSelection({
  game,
  onComplete,
  loadout,
  onReady,
  startsAt,
  readyInitially = false,
  suspended = false,
}: {
  game: OnlineGame;
  onComplete: () => void;
  loadout: LoadoutChoices;
  onReady?: () => boolean | void;
  startsAt?: number | null;
  readyInitially?: boolean;
  suspended?: boolean;
}) {
  const [seconds, setSeconds] = useState(SELECTION_SECONDS);
  const [ready, setReady] = useState(readyInitially);

  const [localStart, setLocalStart] = useState<number | null>(null);
  const deadline = onReady ? startsAt : localStart;
  const [selected, setSelected] = useState(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const firstSlot = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    game.setPreMatchLocked(true);
    firstSlot.current?.focus();
    return () => game.setPreMatchLocked(false);
  }, [game]);
  useEffect(() => {
    if (!deadline || suspended) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(left);
      if (!left) {
        clearInterval(timer);
        game.setPreMatchLocked(false);
        complete.current();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [game, deadline, suspended]);
  return (
    <section
      className="loadout-selection"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loadout-heading"
      onKeyDown={(event) => {
        if (/^[1-4]$/.test(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          setSelected(Number(event.key) - 1);
        }
        if (event.key === 'Tab') {
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          event.preventDefault();
          buttons[
            (index + (event.shiftKey ? -1 : 1) + buttons.length) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      <div className="loadout-selection-panel">
        <div
          className="loadout-start-status"
          role="timer"
          aria-label="Game start countdown"
        >
          {deadline ? (
            <>
              GAME STARTS IN <strong>{seconds}</strong>
              <span>Movement and shooting unlock at 0</span>
            </>
          ) : (
            <>
              <strong>
                {ready ? 'WAITING FOR PLAYERS' : 'TAKE YOUR TIME'}
              </strong>
              <span>
                {ready
                  ? 'Countdown starts when everyone is ready'
                  : 'Choose your weapons, then press Ready'}
              </span>
            </>
          )}
        </div>
        <div className="loadout-selection-top">
          <span>EDGEFRONT / PRE-MATCH</span>
          <span>CONTROLS LOCKED</span>
        </div>
        <h1 id="loadout-heading">Prepare your loadout</h1>
        <p className="loadout-selection-copy">
          Select a slot, then choose a weapon below · 1–4 selects a slot
        </p>
        <div
          className="loadout-selection-slots"
          role="group"
          aria-label="Loadout slots"
        >
          {labels.map((label, index) => (
            <button
              key={label}
              ref={index === 0 ? firstSlot : undefined}
              type="button"
              className="loadout-selection-slot"
              aria-pressed={selected === index}
              aria-label={label + ' slot ' + (index + 1)}
              onClick={() => setSelected(index)}
            >
              <span className="loadout-slot-number">{index + 1}</span>
              <span className="loadout-slot-weapon">
                {WEAPON_DEFINITIONS[loadout.selected[index]].name}
              </span>
              <span className="loadout-slot-label">{label}</span>
            </button>
          ))}
        </div>
        <LoadoutWeaponChoices
          slot={selected}
          available={loadout.available[selected]}
          equipped={loadout.selected[selected]}
          ready={ready}
          progress={loadout.unlockProgress}
          onChoose={loadout.choose}
        />
        <div className="loadout-selection-footer">
          <p>
            All weapons are listed. Unlock locked gear in the lobby Armory. No
            time limit until you are ready.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={ready || suspended}
            onClick={() => {
              if (onReady && onReady() === false) return;
              setReady(true);
              if (!onReady) {
                game.prepareMatch();
                setLocalStart(Date.now() + SELECTION_SECONDS * 1000);
              }
            }}
          >
            {ready ? 'READY' : 'READY — START MATCH'}
          </button>
        </div>
        {deadline && (
          <div className="loadout-countdown-track" aria-hidden="true">
            <i style={{ width: (seconds / SELECTION_SECONDS) * 100 + '%' }} />
          </div>
        )}
      </div>
    </section>
  );
}
