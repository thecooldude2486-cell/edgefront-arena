export const SWORD_BOOST = { multiplier: 1.4, duration: 5, cooldown: 5 };
export function createSwordBoost() {
  let active = 0, cooldown = 0;
  return {
    activate() {
      if (active > 0 || cooldown > 0) return false;
      active = SWORD_BOOST.duration; return true;
    },
    update(dt: number, equipped: boolean) {
      if (!equipped && active > 0) { active = 0; cooldown = SWORD_BOOST.cooldown; }
      if (active > 0) {
        const remaining = Math.max(0, dt - active);
        active = Math.max(0, active - dt);
        if (active === 0) cooldown = Math.max(0, SWORD_BOOST.cooldown - remaining);
      } else cooldown = Math.max(0, cooldown - dt);
    },
    reset() { active = 0; cooldown = 0; },
    get active() { return active > 0; },
    get seconds() { return Math.ceil(active || cooldown); },
    get state() { return active > 0 ? 'boosting' : cooldown > 0 ? 'cooldown' : 'ready'; },
  };
}
