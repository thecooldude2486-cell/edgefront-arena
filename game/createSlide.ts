// Slide tuning: speeds are metres/second, times are seconds, tilt is radians.
export const SLIDE = {
  duration: 0.65,
  cooldown: 0,
  startSpeed: 12.5,
  endSpeed: 6,
  cameraTilt: 0.055,
};

// Small timer/direction controller; movement still uses the existing collisions.
export function createSlide() {
  let elapsed = 0;
  let cooldown = 0;
  let active = false;
  let direction = { x: 0, z: 0 };

  return {
    get active() { return active; },
    get direction() { return direction; },
    get progress() { return Math.min(elapsed / SLIDE.duration, 1); },
    get speed() {
      return active
        ? SLIDE.startSpeed + (SLIDE.endSpeed - SLIDE.startSpeed) * (elapsed / SLIDE.duration)
        : 0;
    },
    tryStart(x: number, z: number, grounded: boolean) {
      const length = Math.hypot(x, z);
      if (!grounded || active || cooldown > 0 || length === 0) return false;
      direction = { x: x / length, z: z / length };
      elapsed = 0;
      active = true;
      return true;
    },
    update(deltaSeconds: number, holdingSlide: boolean) {
      if (active) {
        if (!holdingSlide) {
          active = false;
          cooldown = SLIDE.cooldown;
        } else {
          // Only the initial boost fades; holding Shift sustains the slide.
          elapsed = Math.min(SLIDE.duration, elapsed + deltaSeconds);
        }
      } else {
        cooldown = Math.max(0, cooldown - deltaSeconds);
      }
    },
    cancel() {
      if (active) cooldown = SLIDE.cooldown;
      active = false;
    },
    reset() {
      active = false;
      cooldown = 0;
      elapsed = 0;
      direction = { x: 0, z: 0 };
    },
  };
}
