'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';

function WeaponPreview({ weaponId }: { weaponId: WeaponId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setError(false);
    import('@/game/createShopPreview').then(({ createShopPreview }) => {
      if (!cancelled && canvas.current) dispose = createShopPreview(canvas.current, weaponId);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [weaponId]);
  return <div className="shop-preview">
    <canvas ref={canvas} aria-label={`${WEAPON_DEFINITIONS[weaponId].name} shaded 3D preview`} />
    {error && <p className="shop-preview-error">Preview unavailable. Weapon details are still available.</p>}
    <span className="shop-preview-caption">EDGEFRONT / STANDARD ISSUE</span>
  </div>;
}

export function WeaponShop({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState<WeaponId>('assaultRifle');
  const stats = WEAPON_DEFINITIONS[selected];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="weapon-shop" showCloseButton={false}>
      <header className="shop-heading">
        <div><p className="shop-kicker">EDGEFRONT ARENA</p><DialogTitle>Weapon shop</DialogTitle></div>
        <DialogClose className="shop-close">Close ×</DialogClose>
      </header>
      <DialogDescription className="shop-description">Your two standard-issue weapons. Both are ready to use.</DialogDescription>
      <div className="shop-layout">
        <nav className="shop-list" aria-label="Shop weapons">
          {(['assaultRifle', 'pistol'] as const).map((id, index) => <button key={id} type="button" className={`shop-item ${selected === id ? 'selected' : ''}`} aria-pressed={selected === id} onClick={() => setSelected(id)}>
            <span>{index === 0 ? 'PRIMARY' : 'SECONDARY'}<kbd>{index + 1}</kbd></span>
            <strong>{WEAPON_DEFINITIONS[id].name}</strong><small>Available</small>
          </button>)}
        </nav>
        <section className="shop-showcase" aria-label={stats.name}>
          <h2>{stats.name}</h2>
          {open && <WeaponPreview weaponId={selected} />}
          <p>{selected === 'assaultRifle' ? 'Automatic rifle · Your frontline weapon.' : 'Semi-automatic pistol · Your backup weapon.'}</p>
        </section>
        <section className="shop-overview" aria-label="Weapon stats">
          <h3>Overview</h3>
          <dl>{[
            ['Body damage', `${stats.bodyDamage} HP`],
            ['Head damage', `${stats.headDamage} HP`],
            ['Magazine', `${stats.magazineSize}`],
            ['Reserve', `${stats.reserveAmmo}`],
            ['Reload', `${stats.reloadMs / 1000}s`],
            ['Fire rate', `${1000 / stats.fireDelayMs} / sec`],
            ['Fire mode', stats.fireMode === 'Auto' ? 'Automatic' : 'Semi-auto'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <span className="shop-available">Included in your loadout</span>
        </section>
      </div>
      <footer className="shop-footer"><span>In the arena: 1 = Kestrel AR · 2 = Vesper Pistol</span><DialogClose className="primary-button">Back</DialogClose></footer>
    </DialogContent>
  </Dialog>;
}
