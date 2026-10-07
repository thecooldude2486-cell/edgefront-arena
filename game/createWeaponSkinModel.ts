import { Color3, MeshBuilder, StandardMaterial, TransformNode, type AbstractMesh } from '@babylonjs/core';
import type { LevelReward } from './progression';

import { SKIN_DESIGNS } from './skinDesigns';

// Replace the display model while keeping the existing root, muzzle and combat logic.
export function createWeaponSkinModel(root: TransformNode, reward: LevelReward, originals: AbstractMesh[]) {
  const names=originals.map(mesh=>mesh.name).join(' ');
  const kind=/kestrel/.test(names) ? 'rifle' : /vesper/.test(names) ? 'pistol' : /meridian/.test(names) ? 'sniper'
    : /Flux /.test(names) ? 'smg' : /helion/.test(names) ? 'laser' : /comet body/.test(names) ? 'launcher' : null;
  if (!kind) return null;
  const scene=root.getScene(),model=new TransformNode('career skin model / '+SKIN_DESIGNS[reward.pattern],scene);
  model.parent=root;
  const materials:StandardMaterial[]=[];
  const material=(name:string,color:string,glow=0)=>{
    const value=new StandardMaterial('career skin '+name,scene);value.diffuseColor=Color3.FromHexString(color);
    value.emissiveColor=value.diffuseColor.scale(glow);value.specularColor.set(.35,.4,.45);materials.push(value);return value;
  };
  const pearl=material('pearl shell',reward.color),dark=material('graphite','#182733'),metal=material('titanium','#91a4ad'),energy=material('energy',reward.color,.65);
  const muzzle={rifle:1,sniper:1.44,pistol:.54,smg:.605,laser:1.02,launcher:.642}[kind];
  const width=kind==='launcher' || kind==='laser' ? .34 : kind==='pistol' || kind==='smg' ? .22 : .3;
  const scale=kind==='pistol' || kind==='smg' ? .65 : 1;
  const attach=(mesh:AbstractMesh,surface:StandardMaterial)=>{mesh.parent=model;mesh.material=surface;mesh.isPickable=false;mesh.checkCollisions=false;return mesh;};
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,surface=pearl)=>{
    const mesh=attach(MeshBuilder.CreateBox('career skin '+name,{width:w,height:h,depth:d},scene),surface);mesh.position.set(x,y,z);return mesh;
  };
  const tube=(name:string,x:number,y:number,z:number,diameter:number,length:number,surface=dark,tessellation=12)=>{
    const mesh=attach(MeshBuilder.CreateCylinder('career skin '+name,{diameter,height:length,tessellation},scene),surface);
    mesh.position.set(x,y,z);mesh.rotation.x=Math.PI/2;return mesh;
  };
  const p=reward.pattern,front=muzzle-.18;
  const bodyLength=kind==='sniper' ? .72 : kind==='launcher' ? .63 : kind==='pistol' ? .38 : .57;
  const bodyZ=kind==='pistol' ? .15 : .08;
  const gripZ=p===3 && kind!=='pistol' ? .17 : -.08*scale;
  const grip=box('grip',0,-.21*scale,gripZ,.14*scale,.32*scale,.18*scale,dark);grip.rotation.x=-.23;
  const magZ=p===3 ? -.25*scale : .22*scale;
  if (p===6 && kind!=='launcher') {
    const drum=tube('drum magazine',0,-.22,magZ,.3*scale,.18*scale,dark);drum.rotation.x=0;drum.rotation.z=Math.PI/2;
    box('drum armour',0,-.23,magZ,.19*scale,.07*scale,.22*scale,pearl);
  } else if(kind!=='launcher') {
    const mag=box('magazine',0,-.23*scale,magZ,.15*scale,(p===3 ? .25 : .34)*scale,.18*scale,dark);mag.rotation.x=p===2 ? -.28 : .1;
    box('magazine heel',0,-.39*scale,magZ,.18*scale,.035,.21*scale,metal);
  }
  switch(p) {
    case 0:
      tube('rounded receiver',0,.035,bodyZ,width*.84,bodyLength,pearl,24);
      box('receiver spine',0,-.055,bodyZ,width*.64,.1,bodyLength,dark);
      tube('aero barrel sleeve',0,.01,(bodyZ+front)/2,width*.56,front-bodyZ,pearl,24);break;
    case 1:
      box('receiver frame',0,0,bodyZ,width*.62,.15,bodyLength,dark);
      for(const side of [-1,1]){box('split armour '+side,side*width*.44,.045,bodyZ,.045,.22,bodyLength*.9);box('fore-end brace '+side,side*width*.34,.025,(bodyZ+front)/2,.035,.08,front-bodyZ,metal);}break;
    case 2:
      box('swept receiver',0,.025,bodyZ,width,.18,bodyLength).rotation.x=-.065;
      for(const side of [-1,1]){const fin=box('flight fin '+side,side*width*.5,.075,bodyZ-.06,.045,.24,bodyLength*.55,metal);fin.rotation.z=side*.25;}
      box('flight fore-end',0,-.045,(bodyZ+front)/2,width*.62,.14,front-bodyZ,pearl).rotation.x=.1;break;
    case 3:
      box('bullpup receiver',0,.035,bodyZ-.09,width*1.05,.25,bodyLength*1.14);
      box('bullpup lower frame',0,-.09,bodyZ-.1,width*.76,.075,bodyLength*1.2,dark);
      for(const side of [-1,1])for(let i=0;i<4;i++)box('cage vent '+side+' '+i,side*width*.4,.045,.32+i*.085,.025,.17,.04,metal);
      box('vented handguard',0,-.05,(.32+front)/2,width*.72,.05,Math.max(.12,front-.22),dark);break;
    case 4:
      for(const y of [-.09,.12])box('circuit receiver rail',0,y,bodyZ,width,.045,bodyLength,dark);
      for(const z of [bodyZ-bodyLength*.4,bodyZ+bodyLength*.4])box('circuit receiver brace',0,.01,z,width,.23,.04,metal);
      tube('exposed core',0,.025,bodyZ,width*.48,bodyLength*.65,energy,16);
      for(const side of [-1,1])box('circuit fore-end '+side,side*width*.4,0,(bodyZ+front)/2,.045,.12,front-bodyZ);break;
    case 5:
      tube('contour receiver',0,.025,bodyZ,width*.9,bodyLength,pearl,16);
      for(let i=0;i<5;i++){
        const z=bodyZ+bodyLength*.45+i*(front-bodyZ-bodyLength*.45)/5;
        tube('contour armour rib '+i,0,.025,z,width*(.85-i*.055),.035,pearl,16);
      }
      box('contour lower spine',0,-.075,bodyZ,width*.58,.04,bodyLength,dark);break;
    case 6:
      box('heavy receiver',0,.04,bodyZ,width*1.15,.27,bodyLength);
      for(const side of [-1,1])box('titanium shoulder '+side,side*width*.53,.085,bodyZ-.07,.05,.21,bodyLength*.68,metal);
      for(let i=0;i<4;i++)tube('barrel armour segment '+i,0,.025,bodyZ+bodyLength*.46+i*(front-bodyZ-bodyLength*.46)/4,width*.55,.07,pearl,8);break;
    default:
      box('pulse receiver',0,.015,bodyZ,width*.75,.22,bodyLength,dark);
      for(const side of [-1,1]){box('pulse armour '+side,side*width*.39,.05,bodyZ,.065,.24,bodyLength*.8);box('pulse focusing rail '+side,side*width*.31,.035,(bodyZ+front)/2,.055,.08,front-bodyZ,metal);box('pulse energy rail '+side,side*width*.32,.08,(bodyZ+front)/2,.023,.025,front-bodyZ,energy);}break;
  }
  if(kind!=='pistol') {
    const rear=kind==='sniper' ? -.63 : kind==='smg' ? -.3 : -.5;
    const stockLength=Math.abs(rear-(bodyZ-bodyLength/2));
    if(p===1 || p===4 || p===7) for(const side of [-1,1])box('open stock brace '+side,side*width*.25,-.015,rear+stockLength/2,.03,.05,Math.max(.13,stockLength),metal);
    else {const stock=box('sculpted stock',0,.015,rear+.09,width*(p===6 ? .9 : .73),p===3 ? .25 : .16,.25*scale);stock.rotation.x=p===2 ? -.2 : .07;}
    box('stock pad',0,-.025,rear,width*.75,.28*scale,.055,dark);
  }
  tube('barrel',0,.02,(front+muzzle)/2,kind==='launcher' ? .22 : .065,muzzle-front,dark);
  tube('muzzle',0,.02,muzzle,kind==='launcher' ? .32 : p===6 ? .14 : .1,.09,metal,p===2 || p===6 ? 6 : 16);
  box('energy top rail',0,.15,bodyZ,.065,.025,bodyLength*.72,energy);
  if(kind==='sniper') {tube('optic',0,.25,.09,.15,.52,dark);tube('optic lens',0,.25,.35,.17,.012,energy);}
  else if(kind==='laser'){tube('laser focusing core',0,.02,front-.1,.16,.35,energy);box('power cell',0,.21,.1,.12,.09,.22,energy);}
  else if(kind==='pistol')box('optic sight',0,.15,.12,.045,.055,.045,energy);
  else {
    const optic=attach(MeshBuilder.CreateTorus('career skin halo optic',{diameter:.22,thickness:.028,tessellation:p===2 ? 6 : 20},scene),energy);
    optic.position.set(0,.22,.06);optic.rotation.x=Math.PI/2;
  }
  model.metadata={design:SKIN_DESIGNS[p],kind,charmAnchor:{x:-width*.6-.055,y:.17,z:Math.max(.23,bodyZ+bodyLength*.25)}};
  return {model,meshes:model.getChildMeshes(),dispose(){model.dispose();materials.forEach(value=>value.dispose());}};
}
