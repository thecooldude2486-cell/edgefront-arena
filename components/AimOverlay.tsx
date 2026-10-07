// Both game modes use the same scope and crosshair, driven by weapon aim state.
export function AimOverlay({ scoped }: { scoped: boolean }) {
  return <>
    {scoped && <div className="sniper-scope" aria-hidden="true"><div className="sniper-scope-lens"><i /><b /></div></div>}
    <div className={`crosshair ${scoped ? 'scope-hidden' : ''}`} style={{ pointerEvents: 'none' }} aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  </>;
}
