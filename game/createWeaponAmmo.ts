export function createWeaponAmmo(magazineSize: number, startingReserve: number) {
  let magazine = magazineSize;
  let reserve = startingReserve;

  return {
    get state() {
      return { magazine, reserve };
    },

    fire() {
      if (magazine <= 0) return false;
      magazine -= 1;
      return true;
    },

    reload() {
      if (magazine >= magazineSize || reserve <= 0) return false;

      const bulletsNeeded = magazineSize - magazine;
      const bulletsToLoad = Math.min(bulletsNeeded, reserve);
      magazine += bulletsToLoad;
      reserve -= bulletsToLoad;
      return true;
    },

    restore(nextMagazine:number,nextReserve:number) {
      if(!Number.isInteger(nextMagazine)||nextMagazine<0||nextMagazine>magazineSize || !Number.isInteger(nextReserve)||nextReserve<0||nextReserve>startingReserve)return false;
      magazine=nextMagazine;reserve=nextReserve;return true;
    },
    reset() {
      magazine = magazineSize;
      reserve = startingReserve;
    },
  };
}
