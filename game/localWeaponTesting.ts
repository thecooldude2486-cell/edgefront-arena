// Both checks are required: the published production build never grants unlocks.
export function localWeaponTesting(development: boolean, hostname: string) {
  return development && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
