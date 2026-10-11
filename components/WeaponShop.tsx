'use client';

import { RarityBadge } from './RarityBadge';
import { RARITIES } from '@/game/rarity';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  WEAPON_DEFINITIONS,
  type WeaponId,
  type PrimaryWeaponId,
} from '@/game/weaponDefinitions';

import { EMPTY_COSMETICS, rewardAt, type Cosmetics } from '@/game/progression';
import { DIFFICULTY_ORB_REWARDS } from '@/game/createOrbRewards';
import { DIFFICULTIES, type Difficulty } from '@/game/difficulty';
import { LASER_ENERGY } from '@/game/createLaserEnergy';
import { WEAPON_SLOTS, weaponSlot } from '@/game/loadoutCatalog';
import { GRENADE } from '@/game/createGrenade';
import {
  UZI_PRICE,
  MOLOTOV_PRICE,
  ROCKET_PRICE,
  SNIPER_PRICE,
  ORBITER_CLICKS,
  type PurchaseResult,
} from '@/game/createOrbWallet';

function OrbsBalance({
  amount,
  onClick,
}: {
  amount: number;
  onClick: () => void;
}) {
  const [pulse, setPulse] = useState(0);
  return (
    <div className="shop-orbs-row">
      <button
        type="button"
        className="shop-orbs"
        aria-label={`${amount} Orbs. Click to unlock Orbiter.`}
        onClick={() => {
          setPulse((value) => value + 1);
          onClick();
        }}
      >
        {/* Remount only the visual so repeated clicks restart motion without losing focus. */}
        <span
          key={pulse}
          className={`shop-orbs-content ${pulse > 0 ? 'orb-bounce' : ''}`}
        >
          <span className="shop-orb-icon" aria-hidden="true" />
          <strong>{amount.toLocaleString('en-US')}</strong>
          <span className="shop-orbs-label">Orbs</span>
          {pulse > 0 && <span className="shop-orb-ripple" aria-hidden="true" />}
        </span>
      </button>
    </div>
  );
}

function WeaponPreview({
  weaponId,
  cosmetics,
  reveal = false,
  blurred = false,
  glitched = false,
}: {
  weaponId: WeaponId;
  cosmetics: Cosmetics;
  reveal?: boolean;
  blurred?: boolean;
  glitched?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cosmeticsRef = useRef(cosmetics);
  useEffect(() => {
    cosmeticsRef.current = cosmetics;
  }, [cosmetics]);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import('@/game/createShopPreview')
      .then(({ createShopPreview }) => {
        if (!cancelled && canvas.current) {
          dispose = createShopPreview(
            canvas.current,
            weaponId,
            () => cosmeticsRef.current,
          );
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [weaponId]);
  return (
    <div
      className={`shop-preview ${blurred ? 'preview-blurred' : ''} ${glitched ? 'preview-glitched' : ''} ${reveal && ready ? (weaponId === 'orbiter' ? 'preview-deglitch' : 'preview-unlock') : ''}`}
    >
      <canvas
        ref={canvas}
        aria-label={`${WEAPON_DEFINITIONS[weaponId].name} shaded 3D preview`}
      />
      {error && (
        <p className="shop-preview-error">
          Preview unavailable. Weapon details are still available.
        </p>
      )}
      {!ready && !error && (
        <p className="shop-preview-error">Preparing weapon…</p>
      )}
      <span className="shop-preview-caption">
        EDGEFRONT /{' '}
        {weaponId === 'orbiter'
          ? 'ORBITER'
          : weaponId === 'sniper'
            ? RARITIES[WEAPON_DEFINITIONS[weaponId].rarity].label.toUpperCase()
            : 'STANDARD ISSUE'}
      </span>
    </div>
  );
}

export function WeaponShop({
  cosmetics = EMPTY_COSMETICS,
  onOpenLevels,
  onOpenCosmetics,
  onOpenCharacterShop,
  uziOwned,
  onBuyUzi,
  secondaryWeapon,
  onEquipSecondary,
  molotovOwned,
  onBuyMolotov,
  utilityWeapon,
  onEquipUtility,
  laserOwned,
  laserPartsCount,
  difficulty,
  rocketOwned,
  onBuyRocket,
  meleeWeapon,
  onEquipMelee,
  open,
  onOpenChange,
  orbs,
  orbsSaved,
  sniperOwned,
  onBuySniper,
  primaryWeapon,
  onEquipPrimary,
  orbiterOwned,
  orbClicks,
  onOrbClick,
}: {
  cosmetics?: Cosmetics;
  onOpenLevels?: () => void;
  onOpenCosmetics?: () => void;
  onOpenCharacterShop?: () => void;
  uziOwned: boolean;
  onBuyUzi: () => PurchaseResult;
  secondaryWeapon: 'pistol' | 'uzi';
  onEquipSecondary: (id: 'pistol' | 'uzi') => void;
  molotovOwned: boolean;
  onBuyMolotov: () => PurchaseResult;
  utilityWeapon: 'grenade' | 'molotov';
  onEquipUtility: (id: 'grenade' | 'molotov') => void;
  laserOwned: boolean;
  laserPartsCount: number;
  difficulty: Difficulty;
  rocketOwned: boolean;
  onBuyRocket: () => PurchaseResult;
  meleeWeapon: 'sword' | 'orbiter';
  onEquipMelee: (id: 'sword' | 'orbiter') => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orbs: number;
  orbsSaved: boolean;
  sniperOwned: boolean;
  onBuySniper: () => PurchaseResult;
  primaryWeapon: PrimaryWeaponId;
  onEquipPrimary: (id: PrimaryWeaponId) => void;
  orbiterOwned: boolean;
  orbClicks: number;
  onOrbClick: () => 'progress' | 'unlocked' | 'owned' | 'unavailable';
}) {
  const [selected, setSelected] = useState<WeaponId>('assaultRifle');
  const [revealing, setRevealing] = useState<'sniper' | 'orbiter' | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!open) {
      queueMicrotask(() => {
        if (!cancelled) {
          setRevealing(null);
          setPurchaseError('');
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open]);
  function clickOrb() {
    const result = onOrbClick();
    if (result === 'unlocked') {
      setSelected('orbiter');
      setRevealing('orbiter');
    }
    setPurchaseError(
      result === 'unavailable'
        ? 'Could not save your click. Allow browser storage and try again.'
        : '',
    );
  }
  function purchase() {
    const result = onBuySniper();
    setPurchaseError('');
    if (result === 'purchased') setRevealing('sniper');
    if (result === 'insufficient')
      setPurchaseError('Not enough Orbs yet. Win more rounds to earn them.');
    if (result === 'unavailable')
      setPurchaseError(
        'Could not save the unlock. Your Orbs were not spent. Allow browser storage and try again.',
      );
  }
  const stats = WEAPON_DEFINITIONS[selected];
  const selectedSlot = weaponSlot(selected);
  const cosmeticNames = Object.values(cosmetics)
    .filter((id): id is number => id !== null)
    .map((id) => rewardAt(id)?.name)
    .join(' · ');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`weapon-shop ${revealing ? 'weapon-shop-unlocking' : ''} ${revealing === 'orbiter' ? 'orbiter-unlocking' : ''}`}
        showCloseButton={false}
      >
        <nav className="armory-quick-links" aria-label="Armory shortcuts">
          {onOpenLevels && <button onClick={onOpenLevels}>Levels</button>}
          {onOpenCosmetics && (
            <button onClick={onOpenCosmetics}>Cosmetics</button>
          )}
          {onOpenCharacterShop && (
            <button onClick={onOpenCharacterShop}>Character shop</button>
          )}
        </nav>
        <p className="armory-cosmetic-caption">
          {cosmeticNames || 'Standard issue cosmetics'} · Applied to weapon
          previews and matches
        </p>
        <header className="shop-heading">
          <div>
            <p className="shop-kicker">EDGEFRONT ARENA</p>
            <DialogTitle>Weapon shop</DialogTitle>
          </div>
          <DialogClose className="shop-close">Close ×</DialogClose>
        </header>
        <OrbsBalance amount={orbs} onClick={clickOrb} />
        <output className="orbiter-progress">
          {orbiterOwned
            ? 'Orbiter unlocked · Melee slot 3'
            : `Click the Orb badge: ${orbClicks} / ${ORBITER_CLICKS} · Unlock Orbiter for free`}
        </output>
        {purchaseError && <p role="alert">{purchaseError}</p>}
        <p className="shop-orbs-rules">
          {DIFFICULTIES[difficulty].label}: +
          {DIFFICULTY_ORB_REWARDS[difficulty].roundWin} per round won · +
          {DIFFICULTY_ORB_REWARDS[difficulty].matchWin} match victory bonus
          <br />
          {orbsSaved
            ? 'Orbs and unlocks are saved in this browser.'
            : 'Browser saving unavailable — purchases require saving.'}
        </p>
        <DialogDescription className="shop-description">
          Browse all ten weapons by slot. Choose one primary, secondary, melee
          and utility. Locked weapons show their price or unlock requirement.
        </DialogDescription>
        <output className="shop-loadout">
          Primary: <strong>{WEAPON_DEFINITIONS[primaryWeapon].name}</strong> ·
          Secondary: <strong>{WEAPON_DEFINITIONS[secondaryWeapon].name}</strong>{' '}
          · Melee: <strong>{WEAPON_DEFINITIONS[meleeWeapon].name}</strong> ·
          Utility: <strong>{WEAPON_DEFINITIONS[utilityWeapon].name}</strong>
        </output>
        {!revealing && (
          <nav className="shop-slot-tabs" aria-label="Weapon slots">
            {WEAPON_SLOTS.map((slot, index) => (
              <button
                type="button"
                key={slot.name}
                aria-pressed={selectedSlot === index}
                onClick={() => {
                  setSelected(slot.weapons[0]);
                  setPurchaseError('');
                }}
              >
                {slot.name} <span>{slot.weapons.length}</span>
              </button>
            ))}
          </nav>
        )}
        {revealing ? (
          <section
            className={`sniper-unlock ${revealing === 'orbiter' ? 'orbiter-reveal' : ''}`}
            aria-label="Weapon unlocked"
          >
            <p
              className={revealing === 'sniper' ? 'epic-badge' : 'common-badge'}
            >
              {revealing === 'orbiter'
                ? 'SIGNAL RESTORED'
                : RARITIES[
                    WEAPON_DEFINITIONS[revealing].rarity
                  ].label.toUpperCase()}
            </p>
            <h2>{WEAPON_DEFINITIONS[revealing].name}</h2>
            <RarityBadge rarity={WEAPON_DEFINITIONS[revealing].rarity} />
            <output>
              {revealing === 'orbiter'
                ? 'Unlocked · Melee slot 3'
                : 'Unlocked · Available as a primary'}
            </output>
            {open && (
              <WeaponPreview
                cosmetics={cosmetics}
                key={revealing}
                weaponId={revealing}
                reveal
              />
            )}
            <p>
              {revealing === 'orbiter'
                ? 'Choose Equip melee, then press 3. Click to swing. Aim at solid cover, then hold E or right-click to grapple and cling; release to drop.'
                : 'Choose Equip primary in the shop, then press 1 in the arena. Q or right click to scope.'}
            </p>
            <button
              type="button"
              className={`primary-button ${revealing === 'sniper' ? 'epic-buy' : 'common-buy'}`}
              onClick={() => setRevealing(null)}
            >
              Continue
            </button>
          </section>
        ) : (
          <div className="shop-layout">
            <nav className="shop-list" aria-label="Shop weapons">
              {WEAPON_SLOTS[selectedSlot].weapons.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`shop-item ${id === 'sniper' ? 'epic-item' : ''} ${selected === id ? 'selected' : ''}`}
                  aria-pressed={selected === id}
                  onClick={() => {
                    setSelected(id);
                    setPurchaseError('');
                  }}
                >
                  <span>
                    {id === 'grenade' || id === 'molotov'
                      ? 'UTILITY'
                      : id === 'orbiter' || id === 'sword'
                        ? 'MELEE'
                        : id === 'pistol' || id === 'uzi'
                          ? 'SECONDARY'
                          : 'PRIMARY'}
                    <kbd>
                      {id === 'grenade' || id === 'molotov'
                        ? 4
                        : id === 'orbiter' || id === 'sword'
                          ? 3
                          : id === 'pistol' || id === 'uzi'
                            ? 2
                            : 1}
                    </kbd>
                  </span>
                  <strong>{WEAPON_DEFINITIONS[id].name}</strong>
                  <RarityBadge rarity={WEAPON_DEFINITIONS[id].rarity} />
                  <small>
                    {id === 'laserCannon'
                      ? laserOwned
                        ? primaryWeapon === id
                          ? 'Equipped'
                          : 'Unlocked'
                        : `${laserPartsCount} / 5 parts`
                      : id === 'molotov'
                        ? molotovOwned
                          ? utilityWeapon === id
                            ? 'Equipped'
                            : 'Owned'
                          : `${MOLOTOV_PRICE} Orbs`
                        : id === 'grenade'
                          ? utilityWeapon === id
                            ? 'Free · Equipped'
                            : 'Free · Available'
                          : id === 'sword'
                            ? meleeWeapon === 'sword'
                              ? 'Equipped'
                              : 'Free · Available'
                            : id === 'orbiter'
                              ? orbiterOwned
                                ? meleeWeapon === 'orbiter'
                                  ? 'Equipped'
                                  : 'Owned'
                                : `${orbClicks} / 20 clicks`
                              : id === 'uzi'
                                ? uziOwned
                                  ? secondaryWeapon === id
                                    ? 'Equipped'
                                    : 'Owned'
                                  : `${UZI_PRICE} Orbs`
                                : id === 'pistol'
                                  ? secondaryWeapon === id
                                    ? 'Free · Equipped'
                                    : 'Free · Available'
                                  : id === primaryWeapon
                                    ? 'Equipped'
                                    : id === 'rocketLauncher'
                                      ? rocketOwned
                                        ? 'Owned'
                                        : `${ROCKET_PRICE} Orbs`
                                      : id === 'sniper'
                                        ? sniperOwned
                                          ? `${RARITIES[WEAPON_DEFINITIONS.sniper.rarity].label} · Owned`
                                          : `${RARITIES[WEAPON_DEFINITIONS.sniper.rarity].label} · ${SNIPER_PRICE} Orbs`
                                        : 'Available'}
                  </small>
                </button>
              ))}
            </nav>
            <section className="shop-showcase" aria-label={stats.name}>
              <h2>{stats.name}</h2>
              <RarityBadge rarity={stats.rarity} />
              {open && (
                <WeaponPreview
                  cosmetics={cosmetics}
                  key={selected}
                  weaponId={selected}
                  blurred={
                    (selected === 'uzi' && !uziOwned) ||
                    (selected === 'molotov' && !molotovOwned) ||
                    (selected === 'laserCannon' && !laserOwned) ||
                    (selected === 'sniper' && !sniperOwned) ||
                    (selected === 'rocketLauncher' && !rocketOwned)
                  }
                  glitched={selected === 'orbiter' && !orbiterOwned}
                />
              )}
              <p>
                {selected === 'uzi'
                  ? 'Compact automatic secondary. Hold fire for 12.5 shots per second. Faster sustained damage and a larger magazine than Vesper, with finite reserve ammo. Q or right-click to aim.'
                  : selected === 'molotov'
                    ? 'Throw on click. Ignites on landing: 5 damage every 0.5 seconds for 5 seconds in a 3m radius. Cover blocks fire damage. No self-damage or blast jump.'
                    : selected === 'laserCannon'
                      ? 'Collect all five lobby parts to unlock. Hold fire for a continuous beam. Taps also cost energy. Release to recharge after 1.5 seconds; no manual reload.'
                      : selected === 'grenade'
                        ? 'Press 4, then click to throw. The 2-second fuse includes airtime. Cover blocks the blast. No self-damage; explode near your feet to blast jump.'
                        : selected === 'rocketLauncher'
                          ? '67 direct hit OR 34 splash damage. 4m blast radius. Cover blocks splash. No self-damage. One click per rocket.'
                          : selected === 'sword'
                            ? '20 damage per swing. E grants +40% movement speed for 5 seconds, then a 5-second cooldown. Switching away ends the boost.'
                            : selected === 'orbiter'
                              ? 'Click to swing. Aim at solid cover; hold E / right-click to grapple and cling. Release to drop. Grapple reach: 35 m.'
                              : selected === 'sniper'
                                ? 'Scoped precision rifle · One click per shot.'
                                : selected === 'assaultRifle'
                                  ? 'Automatic rifle · Your frontline weapon.'
                                  : 'Semi-automatic pistol · Your backup weapon.'}
              </p>
            </section>
            <section className="shop-overview" aria-label="Weapon stats">
              <h3>Overview</h3>
              <dl>
                {(selected === 'molotov'
                  ? [
                      ['Damage per tick', '5 HP'],
                      ['Tick interval', '0.5 seconds'],
                      ['Burn duration', '5 seconds'],
                      ['Radius', '3 metres'],
                      ['Per life', '1'],
                      ['Self-damage', 'None'],
                    ]
                  : selected === 'laserCannon'
                    ? [
                        ['Body / head DPS', '60 / 80 HP'],
                        ['Energy', `${LASER_ENERGY.capacity}%`],
                        ['Drain', '30% / second'],
                        ['Recharge delay', `${LASER_ENERGY.rechargeDelay}s`],
                        [
                          'Recharge rate',
                          `${LASER_ENERGY.rechargeRate}% / second`,
                        ],
                        ['Range', `${stats.range} metres`],
                      ]
                    : selected === 'grenade'
                      ? [
                          ['AoE damage', `${stats.bodyDamage} HP`],
                          ['Blast radius', `${GRENADE.radius} metres`],
                          ['Fuse', `${GRENADE.fuse} seconds`],
                          ['Per life', `${stats.magazineSize}`],
                          ['Restock', 'On respawn'],
                          ['Self-damage', 'None'],
                        ]
                      : stats.fireMode === 'Melee'
                        ? [
                            ['Damage', `${stats.bodyDamage} HP`],
                            ['Reach', `${stats.range} metres`],
                            ['Swing delay', `${stats.fireDelayMs / 1000}s`],
                            ['Ammo', 'Not needed'],
                          ]
                        : [
                            [
                              selected === 'rocketLauncher'
                                ? 'Splash damage'
                                : 'Body damage',
                              `${stats.bodyDamage} HP`,
                            ],
                            [
                              selected === 'rocketLauncher'
                                ? 'Direct hit'
                                : 'Head damage',
                              `${selected === 'rocketLauncher' ? WEAPON_DEFINITIONS.rocketLauncher.directDamage : stats.headDamage} HP`,
                            ],
                            ['Magazine', `${stats.magazineSize}`],
                            ['Reserve', `${stats.reserveAmmo}`],
                            ['Reload', `${stats.reloadMs / 1000}s`],
                            [
                              'Fire rate',
                              `${Number((1000 / stats.fireDelayMs).toFixed(2))} / sec`,
                            ],
                            [
                              'Fire mode',
                              stats.fireMode === 'Auto'
                                ? 'Automatic'
                                : 'Semi-auto',
                            ],
                          ]
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {selected === 'laserCannon' ? (
                <button
                  type="button"
                  className="primary-button shop-equip"
                  disabled={!laserOwned || primaryWeapon === selected}
                  onClick={() => onEquipPrimary('laserCannon')}
                >
                  {!laserOwned
                    ? `Find all parts · ${laserPartsCount}/5`
                    : primaryWeapon === selected
                      ? 'Primary equipped'
                      : 'Equip primary'}
                </button>
              ) : selected === 'molotov' && !molotovOwned ? (
                <button
                  type="button"
                  className="primary-button common-buy"
                  disabled={orbs < MOLOTOV_PRICE}
                  onClick={() => {
                    const result = onBuyMolotov();
                    setPurchaseError(
                      result === 'unavailable'
                        ? 'Could not save. No Orbs spent.'
                        : result === 'insufficient'
                          ? 'Not enough Orbs.'
                          : '',
                    );
                  }}
                >
                  Unlock · {MOLOTOV_PRICE} Orbs
                </button>
              ) : selected === 'grenade' || selected === 'molotov' ? (
                <button
                  type="button"
                  className="primary-button shop-equip"
                  disabled={utilityWeapon === selected}
                  onClick={() => onEquipUtility(selected)}
                >
                  {utilityWeapon === selected
                    ? 'Utility equipped'
                    : 'Equip utility · Slot 4'}
                </button>
              ) : selected === 'rocketLauncher' && !rocketOwned ? (
                <button
                  type="button"
                  className="primary-button common-buy"
                  disabled={orbs < ROCKET_PRICE}
                  onClick={() => {
                    const result = onBuyRocket();
                    setPurchaseError(
                      result === 'unavailable'
                        ? 'Could not save. No Orbs spent.'
                        : result === 'insufficient'
                          ? 'Not enough Orbs.'
                          : '',
                    );
                  }}
                >
                  Unlock · {ROCKET_PRICE} Orbs
                </button>
              ) : selected === 'sword' || selected === 'orbiter' ? (
                <button
                  type="button"
                  className="primary-button shop-equip"
                  disabled={
                    meleeWeapon === selected ||
                    (selected === 'orbiter' && !orbiterOwned)
                  }
                  onClick={() => onEquipMelee(selected)}
                >
                  {selected === 'orbiter' && !orbiterOwned
                    ? 'Unlock with 20 Orb clicks'
                    : meleeWeapon === selected
                      ? 'Melee equipped'
                      : 'Equip melee'}
                </button>
              ) : selected === 'sniper' && !sniperOwned ? (
                <div className="shop-purchase">
                  <RarityBadge rarity={WEAPON_DEFINITIONS.sniper.rarity} />
                  <button
                    type="button"
                    className="primary-button epic-buy"
                    disabled={orbs < SNIPER_PRICE}
                    onClick={purchase}
                  >
                    Unlock · {SNIPER_PRICE} Orbs
                  </button>
                  {orbs < SNIPER_PRICE && (
                    <p>Earn {SNIPER_PRICE - orbs} more Orbs to unlock.</p>
                  )}
                  {purchaseError && <p role="alert">{purchaseError}</p>}
                </div>
              ) : selected === 'uzi' && !uziOwned ? (
                <button
                  type="button"
                  className="primary-button common-buy"
                  disabled={orbs < UZI_PRICE}
                  onClick={() => {
                    const result = onBuyUzi();
                    setPurchaseError(
                      result === 'unavailable'
                        ? 'Could not save. No Orbs spent.'
                        : result === 'insufficient'
                          ? 'Not enough Orbs.'
                          : '',
                    );
                  }}
                >
                  Unlock · {UZI_PRICE} Orbs
                </button>
              ) : selected === 'pistol' || selected === 'uzi' ? (
                <button
                  type="button"
                  className="primary-button shop-equip"
                  disabled={secondaryWeapon === selected}
                  onClick={() => onEquipSecondary(selected)}
                >
                  {secondaryWeapon === selected
                    ? 'Secondary equipped'
                    : 'Equip secondary · Slot 2'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`primary-button shop-equip ${selected === 'sniper' ? 'epic-buy' : ''}`}
                  disabled={primaryWeapon === selected}
                  onClick={() => {
                    if (
                      selected === 'rocketLauncher' ||
                      selected === 'sniper' ||
                      selected === 'assaultRifle'
                    )
                      onEquipPrimary(selected);
                  }}
                >
                  {primaryWeapon === selected
                    ? 'Primary equipped'
                    : 'Equip primary'}
                </button>
              )}
              {purchaseError && selected !== 'sniper' && (
                <p role="alert">{purchaseError}</p>
              )}
            </section>
          </div>
        )}
        {!revealing && (
          <footer className="shop-footer">
            <span>
              1 = Chosen primary · 2 = Chosen secondary · 3 = Chosen melee · 4 =
              Chosen utility
            </span>
            <DialogClose className="primary-button">Back</DialogClose>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
