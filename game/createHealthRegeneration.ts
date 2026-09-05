export type HealthRegenerationConfig = {
  maxHealth: number;
  delaySeconds: number;
  ratePerSecond: number;
};

// This helper handles only regeneration timing and healing. The game remains
// the single owner of player health, avoiding a second health system.
export function createHealthRegeneration(config: HealthRegenerationConfig) {
  let secondsSinceDamage = 0;

  return {
    // Call this for every hit, even if regeneration has not started yet.
    registerDamage() {
      secondsSinceDamage = 0;
    },

    // Respawning or ending a round clears the old damage timer.
    reset() {
      secondsSinceDamage = 0;
    },

    update(health: number, deltaSeconds: number, canRegenerate: boolean) {
      const safeHealth = Math.min(config.maxHealth, Math.max(0, health));

      if (!canRegenerate || safeHealth <= 0 || safeHealth >= config.maxHealth) {
        return { health: safeHealth, regenerating: false };
      }

      secondsSinceDamage += deltaSeconds;
      const healingSeconds = Math.min(
        deltaSeconds,
        Math.max(0, secondsSinceDamage - config.delaySeconds),
      );
      if (healingSeconds === 0) {
        return { health: safeHealth, regenerating: false };
      }

      const healedHealth = Math.min(
        config.maxHealth,
        safeHealth + config.ratePerSecond * healingSeconds,
      );

      return {
        health: healedHealth,
        regenerating: healedHealth < config.maxHealth,
      };
    },
  };
}
