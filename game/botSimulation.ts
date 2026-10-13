// Pointer lock is released for the recap and spectator buttons. Eliminated
// players still watch a live simulation; resolved rounds only allow patrols.
export function botSimulationPhase(
  captured: boolean,
  spectating: boolean,
  playerAlive: boolean,
  teamSize: number,
  intermission: boolean,
): 'paused' | 'patrol' | 'combat' {
  if (!captured && !spectating) return 'paused';
  return intermission || teamSize === 1 && !playerAlive ? 'patrol' : 'combat';
}
