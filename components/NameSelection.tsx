'use client';
import { useEffect, useRef, useState } from 'react';
import type { OnlineGame } from '@/game/onlineMovement';
import { playerNameError } from '@/game/playerName';
import './NameSelection.css';

export function NameSelection({ game, onConfirm, onBack, busy = false, error = '' }: {
  game: OnlineGame; onConfirm: (name: string) => void;
  onBack: () => void; busy?: boolean; error?: string;
}) {
  // Each visit starts blank; the previous match name is only used by its HUD.
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const invalid = playerNameError(name);
  useEffect(() => {
    game.setPreMatchLocked(true); input.current?.focus();
    return () => game.setPreMatchLocked(false);
  }, [game]);
  return <section className="name-selection" role="dialog" aria-modal="true" aria-labelledby="name-heading"
    onKeyDown={event => {
      event.stopPropagation(); // Typing R, Q or numbers must not control the game.
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'));
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement as HTMLElement);
        event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    }}>
    <form className="name-selection-card" onSubmit={event => { event.preventDefault(); setTouched(true); if (!invalid && !busy) onConfirm(name); }}>
      <p className="eyebrow">EDGEFRONT / PLAYER ID</p>
      <h1 id="name-heading">Choose your name</h1>
      <p>Your arena name can be a username, like <strong>theopgamer</strong>. Weapons are next.</p>
      <label htmlFor="arena-player-name">Player name</label>
      <input ref={input} id="arena-player-name" value={name} disabled={busy} maxLength={16} autoComplete="off" autoCapitalize="none" spellCheck={false}
        placeholder="Type your name" aria-describedby="name-rules name-error" aria-invalid={touched && !!invalid}
        onChange={event => { setName(event.target.value); setTouched(true); }} />
      <p id="name-rules" className="name-rules">3–16 letters or numbers · At least one letter · No spaces or symbols</p>
      <p id="name-error" className="name-error" role="status">{touched && invalid ? invalid : error}</p>
      <div className="name-selection-actions">
        <button type="button" onClick={onBack}>Back</button>
        <button className="primary-button" type="submit" disabled={!!invalid || busy}>{busy ? 'Saving…' : 'Choose weapons'}</button>
      </div>
      <small>No countdown yet. Take your time choosing a name.</small>
    </form>
  </section>;
}
