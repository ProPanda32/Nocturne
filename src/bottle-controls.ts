import './bottle-controls.css'
import { production } from './studio-config'

export type BottleControls = {
  glassTint:string; liquidTint:string; scale:number; clarity:number; reflection:number
  brightness:number; lightColor:string; rotationSpeed:number; inertia:number; glow:number
  lightColorChanged:boolean
}

const original:BottleControls={
  glassTint:production.bottle.glassTint,liquidTint:production.bottle.liquidTint,
  scale:production.bottle.scale,clarity:production.bottle.glassTransmission,reflection:1.15,
  brightness:1,lightColor:production.lighting.keyColor,rotationSpeed:1,
  inertia:production.bottle.inertia,glow:0,lightColorChanged:false,
}
const storageKey='nocturne.visitor.bottle.v1'
type NumericSetting='scale'|'clarity'|'reflection'|'brightness'|'rotationSpeed'|'inertia'|'glow'
const limits:Record<NumericSetting,[number,number]>={
  scale:[.7,1.3],clarity:[.2,1],reflection:[0,3],brightness:[.3,1.8],
  rotationSpeed:[.2,3],inertia:[0,1],glow:[0,3],
}
const validColor=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)

function loadSettings():BottleControls{
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null')
    if(saved?.version!==1||!saved.settings||typeof saved.settings!=='object')return {...original}
    const incoming=saved.settings as Record<string,unknown>,settings={...original}
    for(const key of Object.keys(limits) as NumericSetting[]){
      const value=incoming[key]
      if(typeof value==='number'&&Number.isFinite(value))settings[key]=Math.max(limits[key][0],Math.min(limits[key][1],value))
    }
    for(const key of ['glassTint','liquidTint','lightColor'] as const){
      if(validColor(incoming[key]))settings[key]=incoming[key]
    }
    settings.lightColorChanged=incoming.lightColorChanged===true&&validColor(incoming.lightColor)
    return settings
  }catch{return {...original}}
}
function saveSettings(settings:BottleControls){
  try{localStorage.setItem(storageKey,JSON.stringify({version:1,settings}))}catch{/* Settings remain usable when storage is unavailable. */}
}
function clearSettings(){try{localStorage.removeItem(storageKey)}catch{/* Keep the current session usable. */}}

const field=(label:string,key:keyof BottleControls,min?:number,max?:number,step?:number)=>
  `<label class="bottle-control"><span>${label}</span><input data-bottle-setting="${key}" type="${min===undefined?'color':'range'}" ${min===undefined?'':`min="${min}" max="${max}" step="${step}"`} value="${original[key]}"></label>`

export function createBottleControls(host:HTMLElement,onChange:(settings:BottleControls,reset:boolean)=>void){
  const controls=document.createElement('div')
  controls.className='bottle-controls'
  controls.setAttribute('aria-label','Bottle settings')
  controls.innerHTML=`
    <details class="bottle-controls-panel bottle-controls-appearance">
      <summary>Appearance <span aria-hidden="true">＋</span></summary>
      <div class="bottle-controls-fields">
        ${field('Glass color','glassTint')}
        ${field('Perfume color','liquidTint')}
        ${field('Bottle size','scale',.7,1.3,.01)}
        ${field('Glass transparency','clarity',.2,1,.01)}
        ${field('Reflection','reflection',0,3,.01)}
      </div>
    </details>
    <details class="bottle-controls-panel bottle-controls-motion">
      <summary>Light & motion <span aria-hidden="true">＋</span></summary>
      <div class="bottle-controls-fields">
        ${field('Lighting intensity','brightness',.3,1.8,.01)}
        ${field('Lighting color','lightColor')}
        ${field('Rotation speed','rotationSpeed',.2,3,.01)}
        ${field('Rotation inertia','inertia',0,1,.01)}
        ${field('Bottle glow','glow',0,3,.01)}
        <button class="bottle-controls-reset" type="button">Reset original design ↺</button>
        <small class="bottle-controls-note">Changes save on this device.</small>
      </div>
    </details>`
  host.append(controls)
  let settings=loadSettings()
  const syncInputs=()=>controls.querySelectorAll<HTMLInputElement>('input[data-bottle-setting]').forEach(input=>{
    input.value=String(settings[input.dataset.bottleSetting as keyof BottleControls])
  })
  syncInputs()
  const panels=controls.querySelectorAll<HTMLDetailsElement>('details')
  panels.forEach(panel=>panel.querySelector('summary')!.addEventListener('click',()=>{
    if(!panel.open)panels.forEach(other=>{if(other!==panel)other.open=false})
  }))
  controls.querySelectorAll<HTMLInputElement>('input[data-bottle-setting]').forEach(input=>{
    input.addEventListener('input',()=>{
      const key=input.dataset.bottleSetting as keyof BottleControls
      settings={...settings,[key]:input.type==='range'?Number(input.value):input.value}
      if(key==='lightColor')settings.lightColorChanged=true
      saveSettings(settings)
      onChange(settings,false)
    })
  })
  controls.querySelector('.bottle-controls-reset')!.addEventListener('click',()=>{
    settings={...original}
    syncInputs()
    clearSettings()
    onChange(settings,true)
  })
  return {get settings(){return settings}}
}
