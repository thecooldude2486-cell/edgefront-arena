'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { WEAPON_DEFINITIONS, type WeaponId, type PrimaryWeaponId } from '@/game/weaponDefinitions';

import { ORB_REWARDS } from '@/game/createOrbRewards';
import { SNIPER_PRICE, ORBITER_CLICKS, type PurchaseResult } from '@/game/createOrbWallet';

function OrbsBalance({ amount, onClick }: { amount: number; onClick: () => void }) {
  const [pulse, setPulse] = useState(0);
  return <div className="shop-orbs-row">
    <button type="button" className="shop-orbs" aria-label={`${amount} Orbs. Click to unlock Orbiter.`} onClick={() => { setPulse((value) => value + 1); onClick(); }}>
      {/* Remount only the visual so repeated clicks restart motion without losing focus. */}
      <span key={pulse} className={`shop-orbs-content ${pulse > 0 ? 'orb-bounce' : ''}`}>
        <span className="shop-orb-icon" aria-hidden="true" />
        <strong>{amount.toLocaleString('en-US')}</strong>
        <span className="shop-orbs-label">Orbs</span>
        {pulse > 0 && <span className="shop-orb-ripple" aria-hidden="true" />}
      </span>
    </button>
  </div>;
}

function WeaponPreview({ weaponId, reveal = false, blurred = false, glitched = false }: { weaponId: WeaponId; reveal?: boolean; blurred?: boolean; glitched?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setError(false);
    setReady(false);
    import('@/game/createShopPreview').then(({ createShopPreview }) => {
      if (!cancelled && canvas.current) {
        dispose = createShopPreview(canvas.current, weaponId);
        setReady(true);
      }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [weaponId]);
  return <div className={`shop-preview ${blurred ? 'preview-blurred' : ''} ${glitched ? 'preview-glitched' : ''} ${reveal && ready ? weaponId === 'orbiter' ? 'preview-deglitch' : 'preview-unlock' : ''}`}>
    <canvas ref={canvas} aria-label={`${WEAPON_DEFINITIONS[weaponId].name} shaded 3D preview`} />
    {error && <p className="shop-preview-error">Preview unavailable. Weapon details are still available.</p>}
    {!ready && !error && <p className="shop-preview-error">Preparing weapon…</p>}
    <span className="shop-preview-caption">EDGEFRONT / {weaponId === 'orbiter' ? 'ORBITER' : weaponId === 'sniper' ? 'COMMON' : 'STANDARD ISSUE'}</span>
  </div>;
}

export function WeaponShop({ open, onOpenChange, orbs, orbsSaved, sniperOwned, onBuySniper, primaryWeapon, onEquipPrimary, orbiterOwned, orbClicks, onOrbClick }: {
  open: boolean; onOpenChange: (open: boolean) => void; orbs: number; orbsSaved: boolean;
  sniperOwned: boolean; onBuySniper: () => PurchaseResult;
  primaryWeapon: PrimaryWeaponId; onEquipPrimary: (id: PrimaryWeaponId) => void;
  orbiterOwned: boolean; orbClicks: number; onOrbClick: () => 'progress' | 'unlocked' | 'owned' | 'unavailable';
}) {
  const [selected, setSelected] = useState<WeaponId>('assaultRifle');
  const [revealing, setRevealing] = useState<'sniper' | 'orbiter' | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  useEffect(() => { if (!open) { setRevealing(null); setPurchaseError(''); } }, [open]);
  function clickOrb() {
    const result = onOrbClick();
    if (result === 'unlocked') { setSelected('orbiter'); setRevealing('orbiter'); }
    setPurchaseError(result === 'unavailable' ? 'Could not save your click. Allow browser storage and try again.' : '');
  }
  function purchase() {
    const result = onBuySniper();
    setPurchaseError('');
    if (result === 'purchased') setRevealing('sniper');
    if (result === 'insufficient') setPurchaseError('Not enough Orbs yet. Win more rounds to earn them.');
    if (result === 'unavailable') setPurchaseError('Could not save the unlock. Your Orbs were not spent. Allow browser storage and try again.');
  }
  const stats = WEAPON_DEFINITIONS[selected];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`weapon-shop ${revealing ? 'weapon-shop-unlocking' : ''} ${revealing === 'orbiter' ? 'orbiter-unlocking' : ''}`} showCloseButton={false}>
      <header className="shop-heading">
        <div><p className="shop-kicker">EDGEFRONT ARENA</p><DialogTitle>Weapon shop</DialogTitle></div>
        <DialogClose className="shop-close">Close ×</DialogClose>
      </header>
      <OrbsBalance amount={orbs} onClick={clickOrb} />
      <p className="orbiter-progress" role="status">{orbiterOwned ? 'Orbiter unlocked · Melee slot 3' : `Click the Orb badge: ${orbClicks} / ${ORBITER_CLICKS} · Unlock Orbiter for free`}</p>
      {purchaseError && <p role="alert">{purchaseError}</p>}
      <p className="shop-orbs-rules">+{ORB_REWARDS.roundWin} per round won · +{ORB_REWARDS.matchWin} match victory bonus<br />
        {orbsSaved ? 'Orbs and unlocks are saved in this browser.' : 'Browser saving unavailable — purchases require saving.'}
      </p>
      <DialogDescription className="shop-description">Choose one primary: Kestrel AR or Meridian Sniper. Vesper Pistol is always your secondary.</DialogDescription>
      <p className="shop-loadout" role="status">Primary: <strong>{WEAPON_DEFINITIONS[primaryWeapon].name}</strong> · Secondary: <strong>Vesper Pistol</strong></p>
      {revealing ? <section className={`sniper-unlock ${revealing === 'orbiter' ? 'orbiter-reveal' : ''}`} aria-label="Weapon unlocked">
        <p className="common-badge">{revealing === 'orbiter' ? 'SIGNAL RESTORED' : 'COMMON'}</p>
        <h2>{WEAPON_DEFINITIONS[revealing].name}</h2>
        <p role="status">{revealing === 'orbiter' ? 'Unlocked · Melee slot 3' : 'Unlocked · Available as a primary'}</p>
        {open && <WeaponPreview key={revealing} weaponId={revealing} reveal />}
        <p>{revealing === 'orbiter' ? 'Press 3 to equip. Click to swing. Aim at solid cover, then hold E or right-click to grapple and cling; release to drop.' : 'Choose Equip primary in the shop, then press 1 in the arena. Q or right click to scope.'}</p>
        <button type="button" className="primary-button common-buy" onClick={() => setRevealing(null)}>Continue</button>
      </section> : <div className="shop-layout">
        <nav className="shop-list" aria-label="Shop weapons">
          {(['assaultRifle', 'sniper', 'pistol', 'orbiter'] as const).map((id) => <button key={id} type="button" className={`shop-item ${id === 'sniper' ? 'common-item' : ''} ${selected === id ? 'selected' : ''}`} aria-pressed={selected === id} onClick={() => { setSelected(id); setPurchaseError(''); }}>
            <span>{id === 'orbiter' ? 'MELEE' : id === 'pistol' ? 'SECONDARY' : 'PRIMARY'}<kbd>{id === 'orbiter' ? 3 : id === 'pistol' ? 2 : 1}</kbd></span>
            <strong>{WEAPON_DEFINITIONS[id].name}</strong><small>{id === 'orbiter' ? orbiterOwned ? 'Equipped' : `${orbClicks} / 20 clicks` : id === primaryWeapon || id === 'pistol' ? 'Equipped' : id === 'sniper' ? sniperOwned ? 'Common · Owned' : `Common · ${SNIPER_PRICE} Orbs` : 'Available'}</small>
          </button>)}
        </nav>
        <section className="shop-showcase" aria-label={stats.name}>
          <h2>{stats.name}</h2>
          {open && <WeaponPreview key={selected} weaponId={selected} blurred={selected === 'sniper' && !sniperOwned} glitched={selected === 'orbiter' && !orbiterOwned} />}
          <p>{selected === 'orbiter' ? 'Click to swing. Aim at solid cover; hold E / right-click to grapple and cling. Release to drop. Grapple reach: 35 m.' : selected === 'sniper' ? 'Scoped precision rifle · One click per shot.' : selected === 'assaultRifle' ? 'Automatic rifle · Your frontline weapon.' : 'Semi-automatic pistol · Your backup weapon.'}</p>
        </section>
        <section className="shop-overview" aria-label="Weapon stats">
          <h3>Overview</h3>
          <dl>{(selected === 'orbiter' ? [['Damage', '35 HP'], ['Reach', '3 metres'], ['Swing delay', '0.65s'], ['Ammo', 'Not needed']] : [
            ['Body damage', `${stats.bodyDamage} HP`],
            ['Head damage', `${stats.headDamage} HP`],
            ['Magazine', `${stats.magazineSize}`],
            ['Reserve', `${stats.reserveAmmo}`],
            ['Reload', `${stats.reloadMs / 1000}s`],
            ['Fire rate', `${Number((1000 / stats.fireDelayMs).toFixed(2))} / sec`],
            ['Fire mode', stats.fireMode === 'Auto' ? 'Automatic' : 'Semi-auto'],
          ]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {selected === 'orbiter' ? <span className="shop-available">{orbiterOwned ? 'Equipped · Melee slot 3' : 'Click the Orb badge 20 times. No Orbs spent.'}</span> : selected === 'sniper' && !sniperOwned ? <div className="shop-purchase">
            <span className="common-badge">Common</span>
            <button type="button" className="primary-button common-buy" disabled={orbs < SNIPER_PRICE} onClick={purchase}>Unlock · {SNIPER_PRICE} Orbs</button>
            {orbs < SNIPER_PRICE && <p>Earn {SNIPER_PRICE - orbs} more Orbs to unlock.</p>}
            {purchaseError && <p role="alert">{purchaseError}</p>}
          </div> : selected === 'pistol' ? <span className="shop-available">Equipped · Secondary slot 2</span> : <button type="button" className={`primary-button shop-equip ${selected === 'sniper' ? 'common-buy' : ''}`} disabled={primaryWeapon === selected} onClick={() => onEquipPrimary(selected)}>{primaryWeapon === selected ? 'Primary equipped' : 'Equip primary'}</button>}
        </section>
      </div>}
      {!revealing && <footer className="shop-footer"><span>1 = Chosen primary · 2 = Vesper Pistol · 3 = Orbiter (after unlock)</span><DialogClose className="primary-button">Back</DialogClose></footer>}
    </DialogContent>
  </Dialog>;
}
