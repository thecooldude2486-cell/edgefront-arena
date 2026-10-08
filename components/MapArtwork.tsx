import { CUSTOM_ARENA_LAYOUTS } from '@/game/mapLayouts';
import { ARENA_MAPS, type ArenaMapId } from '@/game/maps';
export function MapArtwork({ id }: { id: ArenaMapId }) {
  const layout = CUSTOM_ARENA_LAYOUTS[id];
  const covers =
    layout?.covers ??
    (id === 'foundry' || id === 'relay' || id === 'citadel'
      ? [-14, -7, 7, 14].flatMap((x) =>
          [-9, 0, 9].map(
            (z) => [x, z + (x < 0 ? -2 : 2), 3.5, 1.2, 2] as const,
          ),
        )
      : ([
          [-9, -6, 5, 1, 2],
          [9, 6, 5, 1, 2],
          [-9, 6, 1, 5, 2],
          [9, -6, 1, 5, 2],
        ] as const));
  return (
    <svg
      className="map-artwork"
      viewBox="-29 -22 58 44"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="-28"
        y="-21"
        width="56"
        height="42"
        rx="2"
        fill="#071926"
        stroke="#315366"
        strokeWidth="0.6"
      />
      <path
        d="M-25 -14H25M-25 14H25M0-20V20"
        stroke="#315366"
        strokeWidth=".4"
        strokeDasharray="1 2"
      />
      {covers.map(([x, z, w, d, , rotation = 0], i) => (
        <rect
          key={i}
          x={x - w / 2}
          y={z - d / 2}
          width={w}
          height={d}
          rx=".3"
          fill={ARENA_MAPS[id].color}
          transform={`rotate(${(rotation * 180) / Math.PI} ${x} ${z})`}
        />
      ))}
      {layout?.decks.map(([x, z, w, d], i) => (
        <rect
          key={i}
          x={x - w / 2}
          y={z - d / 2}
          width={w}
          height={d}
          fill="#315366"
          fillOpacity=".6"
          stroke={ARENA_MAPS[id].color}
          strokeWidth=".5"
        />
      ))}
      {id === 'stadium' && (
        <circle
          r="6.5"
          fill="none"
          stroke={ARENA_MAPS[id].color}
          strokeWidth="1"
        />
      )}
      {id === 'skyline' && (
        <path d="M-16 0H16" stroke={ARENA_MAPS[id].color} strokeWidth="3" />
      )}
      <rect x="-3" y="-19" width="6" height="2" fill="#35d5ea" />
      <rect x="-3" y="17" width="6" height="2" fill="#ff6f6a" />
    </svg>
  );
}
