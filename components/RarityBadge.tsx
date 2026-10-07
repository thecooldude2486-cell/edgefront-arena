import { RARITIES, type Rarity } from '@/game/rarity';
import './RarityBadge.css';
export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const tier = RARITIES[rarity];
  return (
    <span
      className="rarity-badge"
      style={{
        color: tier.color,
        borderColor: tier.color + '66',
        background: tier.color + '12',
      }}
    >
      <i aria-hidden="true" />
      {tier.label}
    </span>
  );
}
