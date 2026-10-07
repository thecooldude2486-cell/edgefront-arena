import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({port:0});
await once(server.http,'listening');
const clients=[], wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const send=(s,m)=>s.send(JSON.stringify(m));
const latest=(s,type)=>s.messages.filter(m=>m.type===type).at(-1);
async function until(check) { for(let i=0;i<400;i++){if(check())return;await wait(10);}throw Error('Timed out'); }
async function connect() {
  const s=new WebSocket(`ws://127.0.0.1:${server.http.address().port}`,{origin:'http://localhost:3000'});
  s.messages=[];s.on('message',d=>s.messages.push(JSON.parse(d)));clients.push(s);await once(s,'open');return s;
}
try {
  const a=await connect(),b=await connect();
  send(a,{type:'create'});await until(()=>latest(a,'room'));
  send(b,{type:'join',code:latest(a,'room').code});await until(()=>latest(b,'room')?.ready);
  const poses=[{x:0,y:.9,z:-16,yaw:0,pitch:0},{x:0,y:.9,z:-12,yaw:Math.PI,pitch:0}];
  let seq=0;
  // Alternate one opponent win, then five creator wins: verify both score columns.
  const winners=[1,0,0,0,0,0], expected=[0,0];
  for(let round=1;round<=winners.length;round++) {
    if(round>1) await until(()=>latest(a,'score')?.round===round);
    for(const [index,s] of [a,b].entries()) {
      send(s,{type:'combatReady'});send(s,{type:'equip',weapon:'assaultRifle'});send(s,{type:'move',pose:poses[index]});
    }
    await wait(80);
    assert.deepEqual(latest(a,'health').players.map(p=>p.health),[100,100]);
    const winner=winners[round-1], shooter=clients[winner];
    const headshot=round%2===0,bulletCount=headshot ? 7 : 9;
    const shot=()=>({type:'effect',action:'fire',weapon:'assaultRifle',sequence:++seq,
      origin:{x:0,y:headshot ? 1.52 : 1.05,z:poses[winner].z},direction:{x:0,y:0,z:winner===0?1:-1}});
    for(let bullet=0;bullet<bulletCount;bullet++){send(shooter,shot());await wait(140);}
    expected[winner]++;
    await until(()=>latest(a,'score')?.scores[winner]===expected[winner]);
    assert.deepEqual(latest(a,'score'),latest(b,'score'));
    assert.deepEqual(latest(a,'score').scores,expected);
    const performance=latest(a,'score').performances[winner];assert.equal(performance.damageDealt,100);assert.equal(performance.healthRemaining,100);assert.equal(performance.headshot,headshot);assert.ok(performance.distance>0);assert.equal(performance.shots,bulletCount);
    send(shooter,shot());send(shooter,{type:'score',scores:[99,99]});
    await wait(80);
    assert.deepEqual(latest(a,'score').scores,expected,'extra shots/client scores cannot award points');
  }
  assert.equal(latest(a,'score').phase,'finished');assert.equal(latest(a,'score').winner,1);
  await wait(2100);
  assert.equal(latest(a,'score').round,6,'no respawn after match win');
  console.log('PASS: bidirectional points, identical scores, one point per elimination, fresh health/ammo every round, client spoof rejected, first-to-five ends without respawn.');
} finally {clients.forEach(s=>s.terminate());await server.close();}
