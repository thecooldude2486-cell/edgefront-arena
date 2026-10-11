import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';
import {
  WEAPON_SLOTS,
  weaponUnlockRequirement,
  type UnlockProgress,
} from '@/game/loadoutCatalog';
import { RarityBadge } from './RarityBadge';

export function LoadoutWeaponChoices({
  slot,
  available,
  equipped,
  ready,
  progress,
  onChoose,
}: {
  slot: number;
  available: readonly WeaponId[];
  equipped: WeaponId;
  ready: boolean;
  progress?: UnlockProgress;
  onChoose: (id: WeaponId) => void;
}) {
  return (
    <fieldset
      className="loadout-choices"
      aria-label={WEAPON_SLOTS[slot].name + ' weapons'}
    >
      {WEAPON_SLOTS[slot].weapons.map((id) => {
        const unlocked = available.includes(id);
        return (
          <button
            type="button"
            key={id}
            disabled={ready || !unlocked}
            data-locked={!unlocked}
            aria-pressed={unlocked && equipped === id}
            onClick={() => {
              if (!ready && unlocked) onChoose(id);
            }}
          >
            <strong>{WEAPON_DEFINITIONS[id].name}</strong>
            <RarityBadge rarity={WEAPON_DEFINITIONS[id].rarity} />
            <span>
              {!unlocked
                ? 'Locked · ' + weaponUnlockRequirement(id, progress)
                : equipped === id
                  ? 'Equipped'
                  : 'Select'}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
