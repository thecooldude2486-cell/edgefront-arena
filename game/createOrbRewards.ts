// Change reward amounts here. This only watches scores; it never changes them.
export const ORB_REWARDS = { roundWin: 10, matchWin: 25 };
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
    update(update: { playerScore?: number; result?: 'none' | 'victory' | 'defeat' }) {
      if (update.playerScore === 0 && update.result === 'none') {
        paidRounds = 0;
        matchFinished = false;
      }
      if (matchFinished) return 0;
      let earned = 0;
      if (update.playerScore !== undefined && Number.isInteger(update.playerScore) && update.playerScore > paidRounds && update.playerScore <= 5) {
        earned += (update.playerScore - paidRounds) * ORB_REWARDS.roundWin;
        paidRounds = update.playerScore;
      }
      if (update.result === 'victory' || update.result === 'defeat') {
        if (update.result === 'victory' && paidRounds === 5) earned += ORB_REWARDS.matchWin;
        matchFinished = true;
      }
      return earned;
    },
  };
}
