// Energy replaces bullets for the cannon only. Each damage tick costs energy,
// including quick taps. Holding an empty trigger never starts a recharge loop.
export const LASER_ENERGY = { capacity: 100, perTick: 3, rechargeDelay: 1.5, rechargeRate: 12 };
export function createLaserEnergy() {
  let energy = LASER_ENERGY.capacity;
  let idle = 0;
  let charging = false;
  return {
    get state() { return { magazine: energy, reserve: 0, charging }; },
    fire() {
      if (energy < LASER_ENERGY.perTick) return false;
      energy -= LASER_ENERGY.perTick; idle = 0; charging = false;
      return true;
    },
    update(seconds: number, holding: boolean) {
      charging = false;
      if (holding) { idle = 0; return; }
      const before = idle;
      idle += Math.max(0, seconds);
      const healingTime = Math.max(0, idle - Math.max(before, LASER_ENERGY.rechargeDelay));
      if (energy < LASER_ENERGY.capacity && healingTime > 0) {
        energy = Math.min(LASER_ENERGY.capacity, energy + healingTime * LASER_ENERGY.rechargeRate);
        charging = energy < LASER_ENERGY.capacity;
      }
    },
    reload() { return false; }, // R cannot instantly refill energy.
    reset() { energy = LASER_ENERGY.capacity; idle = 0; charging = false; },
  };
}
