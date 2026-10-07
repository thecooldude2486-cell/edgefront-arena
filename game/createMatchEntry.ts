// Capture on the Ready click, then activate only when the countdown finishes.
// A browser that rejects capture gets an initial Enter action, not a Resume menu.
export function createMatchEntry(isCaptured:()=>boolean, capture:()=>Promise<unknown>|void, onState:(state:{paused:boolean;awaitingFirstInput:boolean})=>void) {
  let active=false,entered=false,pending=false;
  const publish=()=>{if(active) onState({paused:entered && !isCaptured(),awaitingFirstInput:!entered});};
  function changed(){if(active && isCaptured()) entered=true;publish();}
  function request(){
    if(isCaptured()){changed();return;}
    if(pending)return;
    pending=true;
    try { Promise.resolve(capture()).catch(()=>{publish();}).finally(()=>{pending=false;}); }
    catch { pending=false;publish(); }
  }
  return {
    prepare:request,
    start(){active=true;entered=isCaptured();publish();request();},
    changed,
    reset(){active=false;entered=false;},
  };
}
