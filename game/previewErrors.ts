export type PreviewFailure = { kind: 'download' | 'renderer' | 'unknown'; message: string; detail: string };
export function describePreviewFailure(error: unknown): PreviewFailure {
  const detail = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed|error loading dynamically imported module|Failed to fetch|NetworkError|Load failed/i.test(detail)) {
    return { kind: 'download', message: 'Preview files could not load. Reconnect to the game server, then reload.', detail };
  }
  if (/WebGL|context|GL_|graphics|engine initialization/i.test(detail)) {
    return { kind: 'renderer', message: 'The preview renderer could not start. Try the preview again.', detail };
  }
  return { kind: 'unknown', message: 'The weapon preview could not start. Try again or check the details below.', detail };
}
