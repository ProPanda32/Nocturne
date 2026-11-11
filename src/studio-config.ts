export type SphereTransform={x:number;y:number;z:number;scale:number;rotationY:number;locked?:boolean;deleted?:boolean;material?:'glass'|'pink'|'amber'|'moss'|'cream'|'gold';color?:string;opacity?:number;roughness?:number;metalness?:number;transmission?:number;ior?:number;floatSpeed?:number;interaction?:number}
export type BrushStroke={x:number;y:number;size:number;strength:number;kind:'Hue'|'Saturation'|'Warmth'|'Glow'|'Brightness'|'Eraser'}
export type StudioConfig={
  version:number
  bottle:{x:number;y:number;z:number;scale:number;rotationX:number;rotationY:number;rotationZ:number;glassTint:string;glassRoughness:number;glassIor:number;glassTransmission:number;liquidTint:string;liquidAbsorption:number;capTint:string;goldTint:string;autoRotate:boolean;autoSpeed:number;dragSensitivity:number;inertia:number;damping:number;maxSpeed:number}
  particles:{count:number;size:number;opacity:number;brightness:number;speed:number;repulsion:number;radius:number;returnStrength:number;damping:number;ambientSpeed:number;sphereForce:number;attraction:number;velocitySensitivity:number;mossStrength:number}
  spheres:Record<string,SphereTransform>
  lighting:{ambient:number;key:number;keyColor:string;rim:number;rimColor:string;exposure:number}
  atmosphere:{hue:number;saturation:number;contrast:number;brightness:number;warmth:number;fog:number;fogColor:string;glow:number}
  camera:{x:number;y:number;distance:number;fov:number}
  brushes:BrushStroke[]
  brushTool:'Off'|'Hue'|'Saturation'|'Warmth'|'Glow'|'Brightness'|'Eraser'
  brushSize:number
  brushStrength:number
}
import defaultConfig from '../Public/Assets/Config/creator-studio.default.json'
export const production:StudioConfig=defaultConfig as StudioConfig
const key='nocturne.creator.v1'
export function mergeConfig(value:unknown):StudioConfig{
  const raw=value&&typeof value==='object'?value as Record<string,unknown>:{}
  const copy=structuredClone(production)
  for(const section of ['bottle','particles','lighting','atmosphere','camera'] as const){
    const incoming=raw[section]
    if(!incoming||typeof incoming!=='object')continue
    for(const [name,value] of Object.entries(incoming)){
      const defaults=production[section] as unknown as Record<string,unknown>
      if(name in defaults&&typeof value===typeof defaults[name]&&
        (typeof value!=='number'||Number.isFinite(value)))
        (copy[section] as unknown as Record<string,unknown>)[name]=value
    }
  }
  if(raw.spheres&&typeof raw.spheres==='object'){
    for(const [id,entry] of Object.entries(raw.spheres as Record<string,unknown>)){
      if(!entry||typeof entry!=='object')continue
      const e=entry as Record<string,unknown>
      if(['x','y','z','scale','rotationY'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k]))) {
        const sphere:SphereTransform={x:e.x as number,y:e.y as number,z:e.z as number,scale:e.scale as number,rotationY:e.rotationY as number,locked:e.locked===true,deleted:e.deleted===true}
        for(const k of ['opacity','roughness','metalness','transmission','ior','floatSpeed','interaction'] as const)if(typeof e[k]==='number'&&Number.isFinite(e[k]))sphere[k]=e[k] as number
        if(typeof e.color==='string'&&/^#[0-9a-f]{6}$/i.test(e.color))sphere.color=e.color
        if(['glass','pink','amber','moss','cream','gold'].includes(String(e.material)))sphere.material=e.material as SphereTransform['material']
        copy.spheres[id]=sphere
      }
    }
  }
  if(['Off','Hue','Saturation','Warmth','Glow','Brightness','Eraser'].includes(String(raw.brushTool)))copy.brushTool=raw.brushTool as StudioConfig['brushTool']
  if(typeof raw.brushSize==='number'&&Number.isFinite(raw.brushSize))copy.brushSize=raw.brushSize
  if(typeof raw.brushStrength==='number'&&Number.isFinite(raw.brushStrength))copy.brushStrength=raw.brushStrength
  if(Array.isArray(raw.brushes))copy.brushes=raw.brushes.filter((e:unknown)=>e&&typeof e==='object').slice(0,200) as StudioConfig['brushes']
  return copy
}
function legacyConfig():StudioConfig|undefined{
  let raw:unknown
  try{raw=JSON.parse(localStorage.getItem('nocturne.scene-config')||localStorage.getItem('nocturne.scene-config.saved')||'null')}catch{return}
  if(!raw||typeof raw!=='object')return
  const source=raw as Record<string,unknown>,bottle=source.bottle as Record<string,unknown>|undefined
  if(!bottle)return
  const next=structuredClone(production)
  const number=(name:string)=>typeof bottle[name]==='number'&&Number.isFinite(bottle[name])?bottle[name] as number:undefined
  for(const [legacy,current] of [['positionX','x'],['positionY','y'],['positionZ','z'],['scale','scale']] as const){
    const n=number(legacy);if(n!==undefined)next.bottle[current]=n
  }
  for(const [legacy,current] of [['rotationX','rotationX'],['rotationY','rotationY'],['rotationZ','rotationZ']] as const){
    const n=number(legacy);if(n!==undefined)next.bottle[current]=n*Math.PI/180
  }
  const fov=number('cameraFov'),distance=number('cameraDistance'),keyLight=number('keyLightIntensity')
  if(fov!==undefined)next.camera.fov=fov
  if(distance!==undefined)next.camera.distance=distance
  if(keyLight!==undefined)next.lighting.key=keyLight
  return next
}
export function loadConfig(creator:boolean){
  if(!creator)return structuredClone(production)
  try{const saved=localStorage.getItem(key);return saved?mergeConfig(JSON.parse(saved)):legacyConfig()??structuredClone(production)}catch{return legacyConfig()??structuredClone(production)}
}
export function saveConfig(config:StudioConfig){localStorage.setItem(key,JSON.stringify(config))}
export function loadPresets():Record<string,StudioConfig>{
  try{return JSON.parse(localStorage.getItem(key+'.presets')||'{}')}catch{return {}}
}
export function savePresets(presets:Record<string,StudioConfig>){localStorage.setItem(key+'.presets',JSON.stringify(presets))}
