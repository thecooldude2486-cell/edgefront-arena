import type { Difficulty } from './difficulty';
// Each match victory adds a bonus on top of the five round-win rewards.
export const DIFFICULTY_ORB_REWARDS = {
  easy: { roundWin: 5, matchWin: 15 },
  normal: { roundWin: 10, matchWin: 25 },
  hard: { roundWin: 15, matchWin: 40 },
  extreme: { roundWin: 20, matchWin: 60 },
  nightmare: { roundWin: 30, matchWin: 75 },
} satisfies Record<Difficulty, { roundWin: number; matchWin: number }>;
export const ORB_REWARDS = DIFFICULTY_ORB_REWARDS.normal;
export const ORBS_STORAGE_KEY = 'edgefront-arena.orbs.v1';

export function readOrbBalance(value: string | null) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export function createOrbRewards() {
  let paidRounds = 0;
  let matchFinished = false;
  return {
    // Repeated HUD updates, respawns and opening the shop cannot award twice.
    update(update: { playerScore?: number; result?: 'none' | 'victory' | 'defeat' }, difficulty: Difficulty = 'normal') {
      const rewards = DIFFICULTY_ORB_REWARDS[difficulty];
      if (update.playerScore === 0 && update.result === 'none') {
        paidRounds = 0;
        matchFinished = false;
      }
      if (matchFinished) return 0;
      let earned = 0;
      if (update.playerScore !== undefined && Number.isInteger(update.playerScore) && update.playerScore > paidRounds && update.playerScore <= 5) {
        earned += (update.playerScore - paidRounds) * rewards.roundWin;
        paidRounds = update.playerScore;
      }
      if (update.result === 'victory' || update.result === 'defeat') {
        if (update.result === 'victory' && paidRounds === 5) earned += rewards.matchWin;
        matchFinished = true;
      }
      return earned;
    },
  };
}
