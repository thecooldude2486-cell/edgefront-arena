'use client';

import { useRef, useEffect } from 'react';
import { damageSourceName, type DeathRecap as Recap } from '@/game/deathRecap';
import { WEAPON_DEFINITIONS } from '@/game/weaponDefinitions';
import { Killcam } from './Killcam';
import { RarityBadge } from './RarityBadge';
import './DeathRecap.css';
export function DeathRecap({
  recap,
  onClose,
  onPlaybackComplete,
  closeLabel = 'Close / Spectate ×',
}: {
  recap: Recap;
  onClose?: () => void;
  onPlaybackComplete?: () => void;
  closeLabel?: string;
}) {
  return (
    <section className="death-recap" aria-label="Death recap">
      <header>
        {onClose && (
          <button
            className="recap-close"
            onClick={onClose}
            aria-label="Close death recap"
          >
            {closeLabel}
          </button>
        )}
        <small>DEATH RECAP</small>
        <h3>Eliminated by {recap.killer}</h3>
      </header>
      {recap.replay && (
        <Killcam
          replay={recap.replay}
          profiles={recap.replayProfiles}
          onComplete={onPlaybackComplete}
        />
      )}
      <div className="recap-numbers">
        <span>
          Damage received<b>{Math.round(recap.totalDamage)}</b>
        </span>
        <span>
          Damage dealt<b>{Math.round(recap.damageDealt)}</b>
        </span>
        <span>
          Killer’s health<b>{Math.round(recap.killerHealth)} HP</b>
        </span>
      </div>
      {recap.finalHit && (
        <p className="recap-final">
          {damageSourceName(recap.finalHit.weapon)}
          {recap.finalHit.weapon !== 'fall' &&
            recap.finalHit.weapon !== 'oilBarrel' && (
              <RarityBadge
                rarity={WEAPON_DEFINITIONS[recap.finalHit.weapon].rarity}
              />
            )}
          <br />
          {recap.finalHit.weapon === 'fall'
            ? 'Missed the landing'
            : recap.finalHit.zone === 'head'
              ? 'Headshot finish'
              : recap.finalHit.zone === 'direct'
                ? 'Direct hit'
                : recap.finalHit.zone === 'splash'
                  ? 'Blast damage'
                  : 'Body hit'}{' '}
          · {recap.finalHit.distance.toFixed(1)}m
        </p>
      )}
      {recap.killerStats && recap.finalHit?.weapon !== 'fall' && (
        <div className="recap-killer-stats">
          <span>
            Killer shots <b>{recap.killerStats.shots}</b>
          </span>
          <span>
            Hits <b>{recap.killerStats.hits}</b>
          </span>
          <span>
            Accuracy{' '}
            <b>
              {recap.killerStats.shots
                ? Math.min(
                    100,
                    Math.round(
                      (recap.killerStats.hits / recap.killerStats.shots) * 100,
                    ),
                  )
                : 0}
              %
            </b>
          </span>
          <span>
            Round time <b>{recap.killerStats.seconds.toFixed(1)}s</b>
          </span>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Weapon</th>
            <th>Hits</th>
            <th>Damage</th>
          </tr>
        </thead>
        <tbody>
          {recap.hits.map((hit) => (
            <tr key={hit.weapon}>
              <td>
                {damageSourceName(hit.weapon)}
                {hit.headshots > 0 && <small> · {hit.headshots} head</small>}
              </td>
              <td>{hit.count}</td>
              <td>{Math.round(hit.damage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
export function DeathRecapDialog({
  recap,
  onClose,
}: {
  recap: Recap;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="death-recap-dialog" ref={ref} onCancel={onClose}>
      <DeathRecap recap={recap} onClose={onClose} closeLabel="Close ×" />
      <button autoFocus className="primary-button" onClick={onClose}>
        Back to game
      </button>
    </dialog>
  );
}
