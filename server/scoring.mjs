export const WIN_SCORE = 5;
export const ROUND_PAUSE_MS = 3000;
export function newScore() { return { scores: [0, 0], round: 1, phase: 'playing', winner: null }; }
// Called only after a server-validated lethal hit, never from client score packets.
export function awardElimination(match, shooter) {
  if (match.phase !== 'playing') return false;
  match.scores[shooter]++;
  match.winner = shooter + 1;
  match.phase = match.scores[shooter] >= WIN_SCORE ? 'finished' : 'roundOver';
  return true;
}
