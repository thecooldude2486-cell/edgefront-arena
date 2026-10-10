'use client';

import {RarityBadge} from './RarityBadge';
import { useEffect, useRef, useState } from 'react';
import { rewardAt, type CosmeticKind, type Cosmetics, type createProgression } from '@/game/progression';
import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';
import { describePreviewFailure, type PreviewFailure } from '@/game/previewErrors';
import { createWrapPixels } from '@/game/wrapDesign';
import './Progression.css';
export type ProgressionState = ReturnType<typeof createProgression>['state'];
export function LevelBadge({ level }: { level: number }) { return <span className="level-badge">LV {level.toLocaleString()}</span>; }
export function ProgressionBar({ state, onOpen, compact = false }: { state: ProgressionState; onOpen: () => void; compact?: boolean }) {
  return <button className={`progression-summary ${compact ? 'compact' : ''}`} onClick={onOpen} aria-label={`Level ${state.level}, ${state.earned} of ${state.required} XP. Open level rewards`}>
    <div><LevelBadge level={state.level} /><strong>{compact ? 'Career' : 'Career progression'}</strong><span>{state.earned.toLocaleString()} / {state.required.toLocaleString()} XP</span></div>
    <progress value={state.earned} max={state.required} />
    {!compact && <small>Next unlock · LV {state.nextReward.level}<b>{state.nextReward.name} ↗</b></small>}
  </button>;
}
export function WrapSwatch({ reward }: { reward: NonNullable<ReturnType<typeof rewardAt>> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) context.putImageData(new ImageData(new Uint8ClampedArray(createWrapPixels(reward)),256,256),0,0);
  },[reward]);
  return <canvas ref={canvas} width={256} height={256} className="wrap-swatch" aria-label={reward.name + ' patterned wrap'} />;
}
export function CosmeticPreview({ weapon, cosmetics }: { weapon: WeaponId; cosmetics: Cosmetics }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(cosmetics);
  const [focus,setFocus]=useState<'weapon'|'charm'>('weapon');
  const focusRef=useRef(focus);
  useEffect(()=>{focusRef.current=focus;},[focus]);
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: PreviewFailure } | null>(null);
  const key = `${weapon}:${attempt}`;
  const error = failure?.key === key ? failure.error : null;
  useEffect(() => { latest.current = cosmetics; }, [cosmetics]);
  useEffect(() => {
    let cancelled = false, dispose: (() => void) | undefined;
    void import('@/game/createShopPreview').then(({ createShopPreview }) => {
      if (!cancelled && canvas.current) {
        dispose = createShopPreview(canvas.current, weapon, () => latest.current, () => focusRef.current==='charm');
        setFailure(null); setLoadedKey(key);
      }
    }).catch(caught => {
      if (!cancelled) {
        console.error('Edgefront weapon preview failed:', caught);
        setFailure({ key, error: describePreviewFailure(caught) });
      }
    });
    return () => { cancelled = true; dispose?.(); };
  }, [weapon, key]);
  return <div className="career-model"><canvas ref={canvas} tabIndex={0} aria-label={`${WEAPON_DEFINITIONS[weapon].name} cosmetic preview. Drag or use arrow keys to rotate, scroll or use plus and minus to zoom.`} />
    <div className="career-preview-controls"><button aria-pressed={focus==='weapon'} onClick={()=>setFocus('weapon')}>Whole weapon</button><button disabled={cosmetics.charm===null} aria-pressed={focus==='charm'} onClick={()=>setFocus('charm')}>Charm close-up</button></div>
    {error ? <div className="career-preview-status"><output>{error.message}</output>
      <button onClick={() => { if (error.kind === 'download') window.location.reload(); else setAttempt(value => value + 1); }}>{error.kind === 'download' ? 'Reload game' : 'Retry preview'}</button>
      <details><summary>Technical details</summary>{error.detail}</details>
    </div> : loadedKey !== key && <output className="career-preview-status">Preparing weapon preview…</output>}
    <span>{focus==='charm' && cosmetics.charm!==null ? 'CHARM INSPECTION' : WEAPON_DEFINITIONS[weapon].name} / DRAG TO ROTATE · SCROLL TO ZOOM</span></div>;
}
export function ProgressionPanel({ state, onEquip, onClose, initialSection = 'cosmetics', onOpenArmory }: { state: ProgressionState; onEquip: (kind: CosmeticKind, level: number | null) => void; onClose: () => void; initialSection?: 'levels' | 'cosmetics'; onOpenArmory?: () => void }) {
  const [section, setSection] = useState(initialSection);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const [page, setPage] = useState(Math.floor(Math.max(0, state.level - 1) / 12));
  const [filter, setFilter] = useState<'all' | CosmeticKind>('all');
  const [preview, setPreview] = useState<number | null>(null);
  const [weapon, setWeapon] = useState<WeaponId>('assaultRifle');
  const hovered = preview === null ? null : rewardAt(preview);
  const previewCosmetics = hovered ? { ...state.cosmetics, [hovered.kind]: hovered.level } : state.cosmetics;
  const rewards = Array.from({ length: 12 }, (_, i) => rewardAt(page * 12 + i + 1)).filter(reward => reward && (filter === 'all' || reward.kind === filter));
  return <dialog ref={dialogRef} tabIndex={-1} className="progression-overlay" aria-modal="true" aria-labelledby="career-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
    <div className="progression-card"><div className="career-heading"><div><p>EDGEFRONT / ARMORY COLLECTION</p><h2 id="career-title">{section === 'levels' ? 'Career levels' : 'Career arsenal'}</h2></div><button onClick={onClose} aria-label="Close level rewards">✕</button></div>
    <nav className="career-section-nav" aria-label="Career shortcuts"><button aria-pressed={section === 'levels'} onClick={() => setSection('levels')}>Levels</button><button aria-pressed={section === 'cosmetics'} onClick={() => { setPreview(null); setSection('cosmetics'); }}>Cosmetics</button>{onOpenArmory && <button onClick={onOpenArmory}>Open Armory ↗</button>}</nav>
    {section === 'levels' && <div className="career-level-overview"><div><small>CURRENT RANK</small><strong>Level {state.level.toLocaleString()}</strong><p>{(state.required - state.earned).toLocaleString()} XP to your next level</p></div><div><small>EVERY LEVEL</small><strong>15 Orbs + new gear</strong><p>Cosmetics unlock from level 2. Signature rewards every fifth level.</p></div><div><small>ONE CAREER / BOTH MODES</small><strong>Keep climbing</strong><p>Bot and online matches earn permanent XP. The reward track keeps going.</p></div></div>}
    <ProgressionBar state={state} onOpen={() => setPage(Math.floor(Math.max(0, state.level - 1) / 12))} />
    {section === 'cosmetics' && <div className="career-workbench">
      <div><label className="career-weapon-label" htmlFor="career-preview-weapon">Inspect weapon</label><select id="career-preview-weapon" value={weapon} onChange={event => setWeapon(event.target.value as WeaponId)}>{(Object.keys(WEAPON_DEFINITIONS) as WeaponId[]).map(id => <option key={id} value={id}>{WEAPON_DEFINITIONS[id].name}</option>)}</select><CosmeticPreview weapon={weapon} cosmetics={previewCosmetics} />
        <p className="career-inspection">{hovered ? hovered.name + ' · Preview only until equipped' : 'Your equipped finish, wrap and charm'}</p></div>
      <div className="career-equipped">{(['skin','wrap','charm'] as const).map(kind => <div key={kind}><small>{kind.toUpperCase()} / EQUIPPED</small><strong>{state.cosmetics[kind] === null ? 'Standard issue' : rewardAt(state.cosmetics[kind]!)?.name}</strong>{state.cosmetics[kind]!==null && <RarityBadge rarity={rewardAt(state.cosmetics[kind]!)!.rarity} />}<button disabled={state.cosmetics[kind] === null} onClick={() => { onEquip(kind, null); setPreview(null); }}>Reset {kind}</button></div>)}</div>
    </div>}
    <p className="career-xp-guide">Elimination XP rewards damage dealt and remaining health. Earn extra XP for headshot finishes, kills from 24m+, precision, quick kills, clutch survival and airborne bot kills. Harder bot modes multiply XP.</p>
    <p>15 Orbs every level. A new cosmetic every level from LV 2, with signature gear every fifth level. Levels and rewards keep going in bot and online matches.</p>
    <div className="career-toolbar"><nav aria-label="Cosmetic types">{(['all','skin','wrap','charm'] as const).map(kind => <button key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? 'All gear' : kind + 's'}</button>)}</nav><div className="career-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous reward levels">←</button><span>LV {page * 12 + 1}–{(page + 1) * 12}</span><button onClick={() => setPage(page + 1)} aria-label="Next reward levels">→</button></div></div>
    <div className="career-rewards">{rewards.map(reward => {
      if (!reward) return null;
      const unlocked = state.level >= reward.level, equipped = state.cosmetics[reward.kind] === reward.level;
      return <article key={reward.level} className={`${unlocked ? 'unlocked' : 'locked'} ${preview === reward.level ? 'inspecting' : ''}`} style={{ '--reward-color': reward.color, '--reward-accent': reward.accent } as React.CSSProperties}>
        <div className={`reward-preview ${reward.kind} pattern-${reward.pattern}`} aria-hidden="true">{reward.kind === 'wrap' ? <WrapSwatch reward={reward} /> : <><i /><i /><i /><i /></>}<span>{reward.signature ? 'SIGNATURE' : 'FIELD ISSUE'}</span></div>
        <small>LV {reward.level} / {reward.kind.toUpperCase()}</small><h3>{reward.name}</h3><RarityBadge rarity={reward.rarity} /><p>{reward.description}</p>
        <div className="reward-actions"><button aria-pressed={preview === reward.level} onClick={() => { setPreview(reward.level); setSection('cosmetics'); }}>Inspect</button><button disabled={!unlocked || equipped} onClick={() => { onEquip(reward.kind, reward.level); setPreview(null); }}>{equipped ? 'Equipped' : unlocked ? 'Equip' : `LV ${reward.level}`}</button></div>
      </article>;
    })}</div>
    <p className="career-note">Skins rebuild the whole gun with a new chassis, stock, magazine, barrel and optic. Wraps cover every weapon surface; charms hang from a visible side mount. Preview any reward on any weapon; equip it when unlocked. Rarity describes collection tier. Damage, health and ammo stay the same.</p>
    {!state.saved && <output>Browser saving is unavailable. Progress lasts for this session.</output>}
    <button className="primary-button" onClick={onClose}>Back to game</button></div>
  </dialog>;
}
