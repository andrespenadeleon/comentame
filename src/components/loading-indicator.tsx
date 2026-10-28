export function LoadingIndicator({dashboard=false}:{dashboard?:boolean}) {
  return <div className={dashboard?'dashboard-loading':'loading'} role="status" aria-live="polite" aria-busy="true">{dashboard?<div className="loading-progress" role="progressbar" aria-label="Cargando dashboard"><span/></div>:<span className="loading-spinner" aria-hidden="true"/>}<p className="muted">Cargando tu espacio…</p></div>;
}
