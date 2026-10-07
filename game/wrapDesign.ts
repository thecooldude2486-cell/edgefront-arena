import type { LevelReward } from './progression.ts';

export const WRAP_NAMES = ['Ion Mosaic', 'Frostglass', 'Spectral Current', 'Flightpath', 'Circuit Bloom', 'Ember Contours', 'Prism Mesh', 'Nightwake'];
export const WRAP_DESCRIPTIONS = [
  'Faceted cyan mosaics, pearl beacons and fine graphite seams.',
  'Layered ice-glass shards with silver flecks and cool blue depth.',
  'Flowing teal, violet and pearl ribbons with iridescent contour lines.',
  'Interlocking flight chevrons over a multitone ceramic gradient.',
  'Fine circuit paths with cyan nodes, amber contacts and pearl details.',
  'Copper, rose and gold contour waves woven into a graphite base.',
  'Angular prism facets mixing pearl, blue, violet and warm highlights.',
  'Dark carbon weave with cyan-violet wave crests and silver pinstripes.',
];
type RGB = [number, number, number];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((c,i)=>c+(b[i]-c)*Math.max(0,Math.min(1,t))) as RGB;
const fract = (n: number) => n-Math.floor(n);
const noise = (x: number, y: number, seed: number) => fract(Math.sin(x*127.1+y*311.7+seed*17.3)*43758.5453);
const cache = new Map<string, Uint8Array>();
// Shared pixel artwork: collection swatches and all weapon views show the same design.
// No canvas, image downloads or random state needed to generate the textures.
export function createWrapPixels(reward: Pick<LevelReward,'color'|'accent'|'pattern'|'edition'>, size = 256) {
  const key = `${reward.color}:${reward.accent}:${reward.pattern}:${reward.edition}:${size}`;
  const previous = cache.get(key); if (previous) return previous;
  const main = rgb(reward.color), deep = mix(rgb(reward.accent),rgb('#182733'),.3);
  const pearl = rgb('#edf7fa'), cyan = mix(main,rgb('#54e2ef'),.65);
  const violet = mix(main,rgb('#a68bea'),.65), gold = mix(main,rgb('#f1ba76'),.7);
  const palette = [deep,cyan,main,violet,pearl,gold];
  const gradient = (t: number) => { const at=Math.max(0,Math.min(.999,t))*5;return mix(palette[Math.floor(at)],palette[Math.floor(at)+1],fract(at)); };
  const pixels = new Uint8Array(size*size*4), seed = reward.edition % 97;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size, v=y/size, grain=noise(x,y,seed);
    let color: RGB = gradient(.18+.52*u+.18*Math.sin(v*4+seed*.09));
    switch(reward.pattern) {
      case 0: {
        const cx=Math.floor(u*9),cy=Math.floor(v*10), lx=fract(u*9),ly=fract(v*10);
        const tile=noise(cx,cy,seed);
        color=mix(gradient(.2+tile*.65),pearl,(lx+ly<1 ? .12 : .28));
        if(lx<.035||ly<.035)color=mix(color,deep,.8);
        const dx=lx-.5,dy=ly-.5;
        if(tile>.65 && Math.abs(dx)+Math.abs(dy)<.095)color=mix(pearl,cyan,.25);
        if(Math.abs(v-(.3+.07*Math.sin(u*9)))<.004)color=mix(color,gold,.75);
        break;
      }
      case 1: {
        const cx=Math.floor(u*7),cy=Math.floor(v*11),tile=noise(cx,cy,seed);
        const facet=fract(u*7)+fract(v*11)>.9?pearl:cyan;
        color=mix(mix(main,pearl,.35+.4*v),facet,.15+tile*.35);
        if(Math.abs(fract(u*7)+fract(v*11)-1)<.018)color=mix(color,deep,.25);
        if(grain>.988)color=pearl;
        if(fract(u*30+v*7)<.025)color=mix(color,violet,.2);
        break;
      }
      case 2: {
        const wave=fract(u*.8+v*.38+.13*Math.sin(v*9+seed*.1));
        color=gradient(.14+wave*.7);
        const contour=fract(u*9+v*3+Math.sin(v*9)*1.3);
        if(contour<.05)color=mix(color,pearl,.5);
        if(contour>.9)color=mix(color,deep,.25);
        break;
      }
      case 3: {
        const chevron=fract((u+Math.abs(fract(v*4)-.5)) * 5);
        color=mix(gradient(.2+u*.65),chevron<.42?pearl:chevron<.75?cyan:deep,.5);
        if(chevron>.8&&chevron<.86)color=gold;
        if(fract(v*32)<.025)color=mix(color,deep,.4);
        break;
      }
      case 4: {
        color=mix(deep,gradient(.2+v*.4+u*.2),.55);
        const a=fract(u*8),b=fract(v*12),cell=noise(Math.floor(u*8),Math.floor(v*12),seed);
        if(Math.abs(a-.24)<.025 || (b>.46&&b<.51&&a>.24))color=mix(cyan,pearl,.2);
        if((a-.24)**2+(b-.48)**2<.004)color=cell>.5?gold:pearl;
        if(a>.78&&b<.16)color=violet;
        break;
      }
      case 5: {
        const flow=u*4+v*3+.35*Math.sin(u*11+v*8)+.18*Math.cos(v*15);
        color=mix(deep,mix(gold,violet,.5+.4*Math.sin(flow)),.7);
        const contour=fract(flow*3);
        if(contour<.12)color=mix(pearl,gold,.5);
        if(contour>.6&&contour<.67)color=mix(cyan,gold,.5);
        break;
      }
      case 6: {
        const cx=Math.floor(u*8),cy=Math.floor(v*8),lx=fract(u*8),ly=fract(v*8);
        const tile=noise(cx,cy,seed),tri=lx+ly>1;
        color=mix(gradient(.16+tile*.74),tri?pearl:violet,tri?.28:.18);
        if(Math.abs(lx+ly-1)<.04)color=mix(color,cyan,.7);
        if(tile>.8&&lx>.8)color=mix(color,gold,.6);
        break;
      }
      default: {
        const crest=.5+.5*Math.sin(u*11+v*7+Math.sin(v*8));
        color=mix(deep,mix(cyan,violet,u),crest*.75);
        const weave=(Math.floor(u*64)+Math.floor(v*64))%2;
        color=mix(color,deep,weave?.12:0);
        if(fract(u*9+v*4+.2*Math.sin(v*10))<.035)color=mix(pearl,cyan,.4);
      }
    }
    // Fine fabric grain and an original sports-tech hem, rather than a flat colour band.
    color=mix(color,grain>.5?pearl:deep,.018);
    if(v>.91) {
      color=mix(deep,main,.12);
      if(v<.923||v>.983)color=mix(pearl,cyan,.4);
      if(u>.73&&u<.91&&fract((u+v*.32)*34)<.45)color=mix(gold,pearl,.3);
    }
    const i=(y*size+x)*4;pixels[i]=Math.round(color[0]);pixels[i+1]=Math.round(color[1]);pixels[i+2]=Math.round(color[2]);pixels[i+3]=255;
  }
  if(cache.size>=24)cache.delete(cache.keys().next().value!);
  cache.set(key,pixels);return pixels;
}
