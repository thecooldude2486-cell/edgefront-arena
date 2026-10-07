export type EliminationPerformance = {
  damageDealt: number; healthRemaining: number; headshot: boolean;
  distance: number; airborne: boolean; shots: number; hits: number; seconds: number;
};
const bounded = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0,Math.min(max,n)) : 0;
// Only actual health removed counts: overkill cannot inflate an award.
export function eliminationXp(performance?: Partial<EliminationPerformance>) {
  if (!performance) return { amount:75, bonuses:[] as string[] };
  const damage=bounded(performance.damageDealt,100), hp=bounded(performance.healthRemaining,100);
  let amount=50+Math.round(damage*.35)+Math.round(hp*.1);
  const bonuses: string[]=[];
  const bonus=(label:string,xp:number)=>{amount+=xp;bonuses.push(`${label} +${xp}`);};
  if (performance.headshot === true) bonus('Headshot elimination',30);
  if (bounded(performance.distance,500)>=24) bonus('Longshot',25);
  if (performance.airborne === true) bonus('Airborne elimination',20);
  if (hp>0 && hp<=25) bonus('Clutch survivor',20);
  if (hp>=90) bonus('Clean elimination',15);
  const shots=bounded(performance.shots,10000),hits=bounded(performance.hits,10000);
  if (shots>=3 && hits<=shots && hits/shots>=.8) bonus('Precision',15);
  const seconds=bounded(performance.seconds,3600);
  if (seconds>0 && seconds<=6) bonus('Quick elimination',15);
  return {amount,bonuses};
}
export function createCombatPerformance(now = 0) {
  let stats: EliminationPerformance, startedAt=now;
  const reset=(time:number)=>{startedAt=time;stats={damageDealt:0,healthRemaining:100,headshot:false,distance:0,airborne:false,shots:0,hits:0,seconds:0};};
  reset(now);
  return {
    reset,
    delay(milliseconds:number){startedAt+=Math.max(0,milliseconds);},
    shot(){stats.shots++;},
    damage(before:number,after:number,headshot:boolean,distance:number,airborne=false){
      const removed=Math.max(0,before-after);if (!removed) return;
      stats.damageDealt=Math.min(100,stats.damageDealt+removed);stats.hits++;
      if (after<=0) {stats.headshot=headshot;stats.distance=distance;stats.airborne=airborne;}
    },
    read(health:number,time:number):EliminationPerformance{return {...stats,healthRemaining:health,seconds:Math.max(0,(time-startedAt)/1000)};},
  };
}
