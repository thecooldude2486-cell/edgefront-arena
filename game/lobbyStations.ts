// These positions match the consoles in createLobby.ts.
export const LOBBY_STATIONS = [
  { id: 'armory', label: 'Armory', x: -16, y: 1, z: -112 },
  { id: 'duel', label: 'Duel deck', x: 0, y: 1, z: -97 },
] as const;
export type LobbyStationId = typeof LOBBY_STATIONS[number]['id'];
export const LOBBY_INTERACT_RADIUS = 3.8;
export function nearbyLobbyStation(position: { x: number; y: number; z: number }) {
  return LOBBY_STATIONS.find(station =>
    Math.abs(position.y - station.y) < 2.5 &&
    Math.hypot(position.x - station.x, position.z - station.z) <= LOBBY_INTERACT_RADIUS,
  ) ?? null;
}
