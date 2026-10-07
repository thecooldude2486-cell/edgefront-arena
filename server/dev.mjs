// Local auto-restart without native file watchers (unavailable in this workspace).
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const directory=fileURLToPath(new URL('.',import.meta.url));
let child,stopping=false,checking=false;
async function fingerprint() {
  const rows=[];
  for(const relative of ['./','../game/']) {
    const dir=new URL(relative,import.meta.url);
    for(const name of (await readdir(dir)).sort()) {
      if(!/\.(mjs|ts)$/.test(name)||name.endsWith('.test.mjs')||name==='dev.mjs')continue;
      const info=await stat(new URL(name,dir));rows.push(`${relative}${name}:${info.mtimeMs}:${info.size}`);
    }
  }
  return rows.join('|');
}
function start() { child=spawn(process.execPath,['index.mjs'],{cwd:directory,stdio:'inherit',env:process.env}); }
async function stopChild() {
  if(!child || child.exitCode!==null || child.signalCode!==null)return;
  const exited=once(child,'exit');child.kill('SIGTERM');await exited;
}
let previous=await fingerprint();start();
const timer=setInterval(async()=>{
  if(checking||stopping)return;checking=true;
  try {
    const next=await fingerprint();
    if(next!==previous){previous=next;console.log('Server code changed; restarting local rooms.');await stopChild();if(!stopping)start();}
  }catch(error){console.error('Local server reload check failed:',error.message);}
  finally{checking=false;}
},1000);
async function shutdown(){if(stopping)return;stopping=true;clearInterval(timer);await stopChild();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
