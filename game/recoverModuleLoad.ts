// An open tab can reference an old game chunk after a deployment.
// Refresh the page once with a fresh URL, never repeatedly on a real outage.
export function recoverModuleLoad(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed|error loading dynamically imported module/i.test(message)) return false;
  const url = new URL(window.location.href);
  if (url.searchParams.has('module-retry')) return false;
  url.searchParams.set('module-retry', String(Date.now()));
  window.location.replace(url.href);
  return true;
}

export function clearModuleRetry() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('module-retry')) return;
  url.searchParams.delete('module-retry');
  window.history.replaceState(window.history.state, '', url.href);
}
