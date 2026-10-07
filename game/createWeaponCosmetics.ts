import { Color3, RawTexture, Texture, MeshBuilder, StandardMaterial, TransformNode, Vector3, type AbstractMesh } from '@babylonjs/core';
import { createWeaponSkinModel } from './createWeaponSkinModel';
import { createWrapPixels } from './wrapDesign';
import { EMPTY_COSMETICS, rewardAt, type Cosmetics } from './progression';

// Fit accessories to actual weapon geometry; use isolated finishes for each player.
export function createWeaponCosmetics(root: TransformNode) {
  const scene = root.getScene();
  const originals = new Map<AbstractMesh, StandardMaterial>();
  const finishes = new Map<string, StandardMaterial>();
  let skinModel: ReturnType<typeof createWeaponSkinModel> = null;
  const hiddenOriginals = new Map<AbstractMesh, boolean>();
  let wrapTexture: RawTexture | null = null;
  let wrapMount: TransformNode | null = null;
  let decorations: TransformNode | null = null, charm: TransformNode | null = null;
  let decorationMaterials: StandardMaterial[] = [];
  let signature = '', age = 0;
  function clear() {
    for (const [mesh, material] of originals) if (!mesh.isDisposed()) mesh.material = material;
    originals.clear(); finishes.forEach(material => material.dispose()); finishes.clear();
    wrapMount?.dispose(); wrapMount = null;
    wrapTexture?.dispose(); wrapTexture = null;
    decorations?.dispose(); decorations = null; charm = null;
    decorationMaterials.forEach(material => material.dispose()); decorationMaterials = [];
    skinModel?.dispose();skinModel=null;
    hiddenOriginals.forEach((enabled,mesh)=>{if (!mesh.isDisposed()) mesh.setEnabled(enabled);});hiddenOriginals.clear();
  }
  function material(name: string, hex: string, glow = 0) {
    const value = new StandardMaterial(name, scene); value.diffuseColor = Color3.FromHexString(hex);
    value.emissiveColor = value.diffuseColor.scale(glow);
    value.specularColor.set(.4, .45, .5); decorationMaterials.push(value); return value;
  }
  return {
    apply(cosmetics: Cosmetics = EMPTY_COSMETICS) {
      const key = JSON.stringify(cosmetics); if (key === signature) return;
      signature = key; clear();
      let baseMeshes = root.getChildMeshes().filter(mesh=>!/muzzle flash|helion beam|shot tracer/i.test(mesh.name));
      const skin = cosmetics.skin === null ? null : rewardAt(cosmetics.skin);
      if (skin) {
        skinModel=createWeaponSkinModel(root,skin,baseMeshes);
        if (skinModel) {
          for(const mesh of baseMeshes){hiddenOriginals.set(mesh,mesh.isEnabled(false));mesh.setEnabled(false);}
          baseMeshes=skinModel.meshes;
        }
      }
      if (skin) for (const [index, mesh] of baseMeshes.entries()) {
        const source = mesh.material;
        if (!(source instanceof StandardMaterial) || source.alpha < 1 || /glow|energy|optic|lens|glass|flame|muzzle/i.test(source.name) || source.emissiveColor.r + source.emissiveColor.g + source.emissiveColor.b > .35) continue;
        originals.set(mesh, source);
        const bright = source.diffuseColor.r + source.diffuseColor.g + source.diffuseColor.b > 1.1;
        const accentPanel = bright && ((index + skin.pattern) % (3 + skin.pattern % 3) === 0);
        const finishKey = source.uniqueId + ':' + accentPanel;
        let finish = finishes.get(finishKey);
        if (!finish) {
          finish = source.clone(source.name + ' career finish')!;
          // Solid model finish. Patterned artwork belongs only to the wrap slot.
          finish.diffuseColor = bright ? Color3.FromHexString(skin.color) : Color3.Lerp(source.diffuseColor, Color3.FromHexString(skin.accent), .3);
          finish.diffuseTexture = null;
          finish.specularColor.set(skin.pattern === 6 ? .7 : .4, .48, .52);
          finishes.set(finishKey, finish);
        }
        mesh.material = finish;
      }
      if (cosmetics.wrap === null && cosmetics.charm === null) return;
      decorations = new TransformNode('career accessories', scene); decorations.parent = root;
      const attach = (mesh: AbstractMesh, surface: StandardMaterial, parent = decorations) => {
        mesh.parent = parent; mesh.material = surface; mesh.isPickable = false; mesh.checkCollisions = false;
        return mesh;
      };
      const grip = baseMeshes.find(mesh => /grip|handle|sceptre/i.test(mesh.name)) ?? baseMeshes.find(mesh => /body|receiver|bottle|shell/i.test(mesh.name)) ?? baseMeshes[0];
      const wrap = cosmetics.wrap === null ? null : rewardAt(cosmetics.wrap);
      if (wrap && grip) {
        const mount = new TransformNode('career fitted wrap', scene); wrapMount = mount; mount.parent = grip;
        const bounds = grip.getBoundingInfo().boundingBox;
        const size = bounds.extendSize.scale(2);
        mount.position.copyFrom(bounds.center);
        const fabric = material('career wrap fabric', '#ffffff');
        fabric.specularColor.set(.13,.16,.18);
        wrapTexture = RawTexture.CreateRGBATexture(createWrapPixels(wrap),256,256,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);
        wrapTexture.name = 'career patterned wrap ' + wrap.name;
        wrapTexture.wrapU = wrapTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
        fabric.diffuseTexture = wrapTexture;
        // Cover the complete weapon, including dark frames, barrels and optics.
        // Charms are built afterwards with their own unwrapped materials.
        for (const panel of baseMeshes) {
          if (!(panel.material instanceof StandardMaterial)) continue;
          const source=panel.material as StandardMaterial;
          if (!originals.has(panel)) originals.set(panel,source);
          const wrapped=source.clone(source.name+' career wrap panel')!;
          if (wrapped.diffuseTexture && wrapped.diffuseTexture!==source.diffuseTexture) wrapped.diffuseTexture.dispose();
          wrapped.diffuseColor=Color3.White();wrapped.diffuseTexture=wrapTexture;wrapped.emissiveColor=Color3.White().scale(.06);
          decorationMaterials.push(wrapped);panel.material=wrapped;
        }
        const trim = material('career wrap seam', '#ffffff'), edge = material('career wrap edge', '#ffffff');
        trim.diffuseTexture = edge.diffuseTexture = wrapTexture;
        const height = Math.min(size.y * .82, .3);
        const round = /orbiter|bottle|grenade/i.test(grip.name);
        const sleeve = round ? MeshBuilder.CreateCylinder('career wrap band', { height, diameter: Math.max(size.x,size.z)+.007,tessellation:16 },scene)
          : MeshBuilder.CreateBox('career wrap band',{width:size.x+.007,height,depth:size.z+.007},scene);
        attach(sleeve,fabric,mount);
        if (/grenade|bottle/i.test(grip.name)) sleeve.setEnabled(false);
        for(const side of [-1,1]) {
          const hem = round ? MeshBuilder.CreateCylinder('career wrap stitched hem',{height:.009,diameter:Math.max(size.x,size.z)+.009,tessellation:16},scene)
            : MeshBuilder.CreateBox('career wrap stitched hem',{width:size.x+.009,height:.009,depth:size.z+.009},scene);
          attach(hem,trim,mount);hem.position.y=side*height/2;
          if (/grenade|bottle/i.test(grip.name)) hem.setEnabled(false);
          const stitch = MeshBuilder.CreateBox('career wrap metallic seam',{width:.008,height:height*.92,depth:.004},scene);
          attach(stitch,edge,mount);if (/grenade|bottle/i.test(grip.name)) stitch.setEnabled(false);stitch.position.set(side*(size.x/2-.008),0,-size.z/2-.006);
        }
      }
      const reward = cosmetics.charm === null ? null : rewardAt(cosmetics.charm);
      if (reward) {
        const anchor = baseMeshes.find(mesh => /receiver|slide|guard|neck|body|shell/i.test(mesh.name)) ?? grip;
        charm = new TransformNode('career swinging charm', scene); charm.parent = decorations;
        const mount=skinModel?.model.metadata?.charmAnchor;
        if (mount) charm.position.set(mount.x,mount.y,mount.z);
        else if (anchor) {
          const bounds = anchor.getBoundingInfo().boundingBox;
          // Transform the mounting point into weapon-local coordinates, including rotated parts.
          const local = bounds.center.add(new Vector3(-bounds.extendSize.x - .10, Math.max(.1,bounds.extendSize.y) + .04, Math.max(.16,bounds.extendSize.z*.5)));
          anchor.computeWorldMatrix(true); root.computeWorldMatrix(true);
          const point = Vector3.TransformCoordinates(local, anchor.getWorldMatrix());
          charm.position.copyFrom(Vector3.TransformCoordinates(point, root.getWorldMatrix().clone().invert()));
        }
        const pearl = material('career charm pearl casing', '#e9f0f1'), dark = material('career charm graphite', '#182733');
        const metal = material('career chain metal', '#91a4ad'), enamel = material('career charm enamel', reward.color), energy = material('career charm energy', reward.accent, .35);
        const chain = MeshBuilder.CreateCylinder('career charm chain', { height: .08, diameter: .013, tessellation: 8 }, scene);
        attach(chain, metal, charm); chain.position.y = -.04;
        const pin=MeshBuilder.CreateTorus('career charm mounting pin',{diameter:.05,thickness:.009,tessellation:16},scene);attach(pin,metal,charm);pin.rotation.y=Math.PI/2;
        const bracket=MeshBuilder.CreateBox('career charm mounting bracket',{width:.10,height:.022,depth:.035},scene);attach(bracket,metal,charm);bracket.position.x=.045;
        const token = new TransformNode('career miniature ' + reward.pattern, scene); token.parent = charm; token.position.y = -.115;token.scaling.setAll(2.2);
        const box = (name: string, size: number[], at: number[], surface = pearl) => {
          const mesh = MeshBuilder.CreateBox('career ' + name, { width: size[0], height: size[1], depth: size[2] }, scene);
          attach(mesh, surface, token); mesh.alwaysSelectAsActiveMesh=true; mesh.position.set(at[0], at[1], at[2]); return mesh;
        };
        const sphere = (name: string, diameter: number, surface = enamel) => attach(MeshBuilder.CreateSphere('career ' + name, { diameter, segments: 12 }, scene), surface, token);
        switch (reward.pattern) {
          case 0: {
            sphere('orbiter core', .055);
            const halo = attach(MeshBuilder.CreateTorus('career orbital halo', { diameter: .1, thickness: .009, tessellation: 20 }, scene), pearl, token); halo.rotation.x = Math.PI / 2; halo.rotation.z = .35; break;
          }
          case 1: {
            attach(MeshBuilder.CreateCylinder('career helion cell', { height: .09, diameter: .038, tessellation: 8 }, scene), enamel, token);
            box('cell cap', [.055,.015,.05], [0,.05,0]); box('cell base', [.055,.015,.05], [0,-.05,0]);
            box('cell rail', [.01,.065,.01], [.023,0,-.024], energy); break;
          }
          case 2:
            box('vector blade', [.022,.08,.012], [0,.015,0], enamel); box('vector guard', [.06,.009,.023], [0,-.03,0]); box('vector hilt', [.012,.035,.016], [0,-.05,0], dark); break;
          case 3: {
            attach(MeshBuilder.CreateCylinder('career comet body', { height: .07, diameter: .03, tessellation: 8 }, scene), pearl, token);
            const nose = attach(MeshBuilder.CreateCylinder('career comet nose', { height: .03, diameterTop: 0, diameterBottom: .03, tessellation: 8 }, scene), enamel, token); nose.position.y = .05;
            box('comet fins', [.065,.028,.008], [0,-.035,0], dark); box('comet fuel', [.016,.02,.018], [0,-.05,0], energy); break;
          }
          case 4:
            box('flux chip', [.07,.075,.018], [0,0,0], dark); box('flux face', [.045,.045,.022], [0,0,-.004], enamel);
            for (const x of [-.024,0,.024]) box('flux contact', [.008,.016,.014], [x,-.043,0], metal); break;
          case 5:
            box('kestrel spine', [.024,.07,.018], [0,0,0], dark);
            for (const side of [-1,1]) { const wing=box('kestrel wing', [.055,.018,.016], [side*.03,.008,0], enamel);wing.rotation.z=side*.5; } break;
          case 6: {
            const tube = attach(MeshBuilder.CreateCylinder('career meridian optic', { height: .07, diameter: .035, tessellation: 12 }, scene), pearl, token); tube.rotation.z = Math.PI/2;
            sphere('optic lens', .028, energy).position.x = .034; box('optic mount', [.045,.018,.025], [0,-.025,0], dark); break;
          }
          default: {
            const crest = attach(MeshBuilder.CreateCylinder('career atrium crest', { height: .014, diameter: .085, tessellation: 6 }, scene), pearl, token); crest.rotation.x = Math.PI/2;
            box('crest cyan rail', [.012,.048,.016], [-.012,0,-.012], enamel).rotation.z = -.25;
            box('crest graphite rail', [.012,.035,.016], [.012,0,-.013], energy).rotation.z = -.25;
          }
        }
      }
    },
    update(seconds: number) { age += seconds; if (charm) { charm.rotation.z = Math.sin(age * 3) * .12; charm.rotation.x = Math.sin(age * 2) * .08; } },
    dispose: clear,
  };
}
