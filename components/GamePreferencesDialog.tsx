'use client';
import { useEffect, useRef, useState } from 'react';
import type { GamePreferences, PreferencesState } from '@/game/gamePreferences';

const CONTROLS = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look around'],
  ['Double-tap W', 'Sprint'],
  ['Space', 'Jump'],
  ['C / Ctrl', 'Toggle crouch'],
  ['Hold Shift', 'Slide'],
  ['Left click', 'Fire or melee'],
  ['Q / right click', 'Aim guns'],
  ['R', 'Reload'],
  ['1 / 2 / 3 / 4', 'Primary / secondary / melee / utility'],
  ['E near a terminal', 'Interact in the lobby'],
  ['E with sword', 'Speed boost'],
  ['Hold E / right click with Orbiter', 'Grapple · release to detach'],
  ['Grenade / rocket at your feet', 'Blast jump · steer with WASD'],
  ['Esc', 'Release the cursor / close a dialog'],
  ['B / L / K / H', 'Armory / levels / cosmetics / character shop'],
  ['F1 / F2', 'Controls / settings'],
];
export function GamePreferencesDialog({
  preferences,
  initialSection = 'settings',
  onChange,
  onReset,
  onClose,
  online = false,
}: {
  preferences: PreferencesState;
  initialSection?: 'settings' | 'controls';
  onChange: (patch: Partial<GamePreferences>) => void;
  onReset: () => void;
  onClose: () => void;
  online?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState(initialSection);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className="game-polish-dialog"
      aria-labelledby="preferences-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">EDGEFRONT / FIELD GUIDE</p>
          <h2 id="preferences-title">
            {section === 'settings'
              ? 'Make it feel right'
              : 'Know your controls'}
          </h2>
        </div>
        <button
          type="button"
          className="polish-button"
          onClick={onClose}
          aria-label="Close controls and settings"
        >
          ✕
        </button>
      </header>
      <nav aria-label="Controls and settings">
        <button
          className="polish-button"
          aria-pressed={section === 'controls'}
          onClick={() => setSection('controls')}
        >
          Controls
        </button>
        <button
          className="polish-button"
          aria-pressed={section === 'settings'}
          onClick={() => setSection('settings')}
        >
          Settings
        </button>
      </nav>
      {section === 'settings' ? (
        <div className="preferences-fields">
          <label htmlFor="mouse-sensitivity">
            Mouse sensitivity{' '}
            <output>{preferences.sensitivity.toFixed(2)}×</output>
          </label>
          <input
            id="mouse-sensitivity"
            type="range"
            min="0.25"
            max="2.5"
            step="0.05"
            value={preferences.sensitivity}
            onChange={(event) =>
              onChange({ sensitivity: Number(event.target.value) })
            }
          />
          <small>Lower values make small aim adjustments easier.</small>
          <label htmlFor="game-volume">
            Sound volume{' '}
            <output>
              {preferences.volume === 0
                ? 'Muted'
                : `${Math.round(preferences.volume * 100)}%`}
            </output>
          </label>
          <input
            id="game-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={preferences.volume}
            onChange={(event) =>
              onChange({ volume: Number(event.target.value) })
            }
          />
          <label htmlFor="graphics-quality">Graphics</label>
          <select
            id="graphics-quality"
            value={preferences.graphics}
            onChange={(event) =>
              onChange({
                graphics: event.target.value as GamePreferences['graphics'],
              })
            }
          >
            <option value="performance">
              Performance · lower render resolution
            </option>
            <option value="balanced">Balanced · recommended</option>
            <option value="high">High · sharper on retina screens</option>
          </select>
          <small>
            Updates immediately. Your controls and match rules stay the same.
          </small>
          <label className="motion-preference">
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(event) =>
                onChange({ reducedMotion: event.target.checked })
              }
            />{' '}
            Reduce interface motion and flashes
          </label>
          <small>Your device’s reduced motion setting is also respected.</small>
          <output className="preferences-save-status">
            {preferences.saved
              ? 'Settings saved on this browser.'
              : 'Settings work for this session. Browser saving is unavailable.'}
          </output>
        </div>
      ) : (
        <>
          <dl className="controls-guide">
            {CONTROLS.map(([key, action]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
          <p className="preferences-save-status">
            One life per team round · First team to 5 rounds wins. Your grenades
            and rockets can launch you; falls and exploding barrels can
            eliminate you.
          </p>
        </>
      )}
      <footer>
        {online && <p>Online matches keep running while menus are open.</p>}
        <div>
          {section === 'settings' && (
            <button className="polish-button" onClick={onReset}>
              Reset settings
            </button>
          )}
          <button className="polish-button emphasized" onClick={onClose}>
            Back to game
          </button>
        </div>
      </footer>
    </dialog>
  );
}
