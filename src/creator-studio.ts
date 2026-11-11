import { production, mergeConfig, saveConfig, loadPresets, savePresets, type StudioConfig } from './studio-config'
import './creator-studio.css'

type Field={label:string;section:'bottle'|'particles'|'lighting'|'atmosphere'|'camera';key:string;min?:number;max?:number;step?:number;type?:'color'|'checkbox'}
const fields:Field[]=[
  {label:'Position X',section:'bottle',key:'x',min:-2,max:2,step:.01},
  {label:'Position Y',section:'bottle',key:'y',min:-2,max:2,step:.01},
  {label:'Position Z',section:'bottle',key:'z',min:-2,max:2,step:.01},
  {label:'Scale',section:'bottle',key:'scale',min:.2,max:2,step:.01},
  {label:'Rotation X',section:'bottle',key:'rotationX',min:-3.14,max:3.14,step:.01},
  {label:'Rotation Y',section:'bottle',key:'rotationY',min:-3.14,max:3.14,step:.01},
  {label:'Rotation Z',section:'bottle',key:'rotationZ',min:-3.14,max:3.14,step:.01},
  {label:'Glass tint',section:'bottle',key:'glassTint',type:'color'},
  {label:'Glass roughness',section:'bottle',key:'glassRoughness',min:0,max:.5,step:.001},
  {label:'Glass IOR',section:'bottle',key:'glassIor',min:1,max:2.3,step:.01},
  {label:'Glass transmission',section:'bottle',key:'glassTransmission',min:0,max:1,step:.01},
  {label:'Liquid amber',section:'bottle',key:'liquidTint',type:'color'},
  {label:'Liquid absorption distance',section:'bottle',key:'liquidAbsorption',min:.05,max:3,step:.01},
  {label:'Crystal cap tint',section:'bottle',key:'capTint',type:'color'},
  {label:'Gold tint',section:'bottle',key:'goldTint',type:'color'},
  {label:'Auto rotation',section:'bottle',key:'autoRotate',type:'checkbox'},
  {label:'Auto rotation speed',section:'bottle',key:'autoSpeed',min:-1,max:1,step:.005},
  {label:'Drag sensitivity',section:'bottle',key:'dragSensitivity',min:.1,max:4,step:.01},
  {label:'Inertia',section:'bottle',key:'inertia',min:0,max:1,step:.01},
  {label:'Damping',section:'bottle',key:'damping',min:.1,max:20,step:.1},
  {label:'Maximum spin speed',section:'bottle',key:'maxSpeed',min:.1,max:12,step:.1},
  {label:'Particle size',section:'particles',key:'size',min:.2,max:4,step:.01},
  {label:'Particle density (rebuild)',section:'particles',key:'count',min:.2,max:1.5,step:.05},
  {label:'Particle opacity',section:'particles',key:'opacity',min:0,max:1,step:.01},
  {label:'Particle brightness',section:'particles',key:'brightness',min:0,max:4,step:.01},
  {label:'Movement speed',section:'particles',key:'speed',min:0,max:4,step:.01},
  {label:'Cursor repulsion',section:'particles',key:'repulsion',min:0,max:5,step:.01},
  {label:'Green particle response',section:'particles',key:'mossStrength',min:0,max:4,step:.01},
  {label:'Cursor attraction',section:'particles',key:'attraction',min:0,max:1,step:.01},
  {label:'Velocity sensitivity',section:'particles',key:'velocitySensitivity',min:0,max:3,step:.01},
  {label:'Sphere interaction',section:'particles',key:'sphereForce',min:0,max:4,step:.01},
  {label:'Cursor radius',section:'particles',key:'radius',min:.1,max:4,step:.01},
  {label:'Return strength',section:'particles',key:'returnStrength',min:0,max:15,step:.1},
  {label:'Particle damping',section:'particles',key:'damping',min:.1,max:15,step:.1},
  {label:'Ambient motion',section:'particles',key:'ambientSpeed',min:0,max:5,step:.01},
  {label:'Ambient light',section:'lighting',key:'ambient',min:0,max:3,step:.01},
  {label:'Key light',section:'lighting',key:'key',min:0,max:8,step:.01},
  {label:'Key color',section:'lighting',key:'keyColor',type:'color'},
  {label:'Rim light',section:'lighting',key:'rim',min:0,max:8,step:.01},
  {label:'Rim color',section:'lighting',key:'rimColor',type:'color'},
  {label:'Exposure',section:'lighting',key:'exposure',min:.2,max:3,step:.01},
  {label:'Hue',section:'atmosphere',key:'hue',min:-180,max:180,step:1},
  {label:'Saturation',section:'atmosphere',key:'saturation',min:0,max:3,step:.01},
  {label:'Contrast',section:'atmosphere',key:'contrast',min:.2,max:3,step:.01},
  {label:'Brightness',section:'atmosphere',key:'brightness',min:.2,max:3,step:.01},
  {label:'Warmth',section:'atmosphere',key:'warmth',min:-2,max:2,step:.01},
  {label:'Atmospheric glow',section:'atmosphere',key:'glow',min:0,max:4,step:.01},
  {label:'Fog density',section:'atmosphere',key:'fog',min:0,max:2,step:.01},
  {label:'Fog color',section:'atmosphere',key:'fogColor',type:'color'},
  {label:'Camera X',section:'camera',key:'x',min:-3,max:3,step:.01},
  {label:'Camera Y',section:'camera',key:'y',min:-3,max:3,step:.01},
  {label:'Camera distance',section:'camera',key:'distance',min:2,max:10,step:.01},
  {label:'Field of view',section:'camera',key:'fov',min:20,max:80,step:.1},
]
const sphereFields=[['X','x',-8,8],['Y','y',-8,8],['Z','z',-8,8],['Scale','scale',.05,4],['Rotation Y','rotationY',-6.28,6.28],['Opacity','opacity',0,1],['Roughness','roughness',0,1],['Metalness','metalness',0,1],['Transmission','transmission',0,1],['IOR','ior',1,2.3],['Float speed','floatSpeed',0,5]] as const
export function createCreatorStudio(host:HTMLElement,initial:StudioConfig,apply:(config:StudioConfig)=>void){
  let config=initial,selectedSphere:string|undefined
  let sphereDefaults:Record<string,{x:number;y:number;z:number;scale:number;rotationY:number}>={}
  const history:StudioConfig[]=[],future:StudioConfig[]=[]
  const panel=document.createElement('aside');panel.className='creator-panel'
  panel.innerHTML='<div class="creator-head"><strong>NOCTURNE · CREATOR</strong><button class="creator-preview">Preview</button></div><div class="creator-actions"><button data-action="undo">Undo</button><button data-action="redo">Redo</button><button data-action="save">Save Scene</button></div><div class="creator-sections"></div>'
  document.body.append(panel)
  const returnButton=document.createElement('button');returnButton.className='creator-return';returnButton.textContent='Return to editor';returnButton.hidden=true;document.body.append(returnButton)
  const sections=panel.querySelector<HTMLElement>('.creator-sections')!
  const overlay=document.createElement('div');overlay.className='creator-brush-overlay';host.append(overlay)
  const controls=new Map<string,HTMLInputElement>()
  function snapshot(){history.push(structuredClone(config));if(history.length>50)history.shift();future.length=0}
  function changed(){saveConfig(config);apply(config);renderBrushes()}
  function set(next:StudioConfig){config=mergeConfig(next);refreshSphereList();sync();changed()}
  function section(title:string){const d=document.createElement('details');d.open=title==='Bottle';d.innerHTML='<summary>'+title+'</summary>';sections.append(d);return d}
  function control(parent:HTMLElement,label:string,value:()=>number|string|boolean,change:(value:number|string|boolean)=>void,min?:number,max?:number,step?:number,type?:string,id?:string){
    const row=document.createElement('label');row.className='creator-control'
    const text=document.createElement('span');text.textContent=label;row.append(text)
    const input=document.createElement('input');input.type=type||'range';if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);if(step!==undefined)input.step=String(step)
    if(type==='checkbox')input.checked=Boolean(value());else input.value=String(value())
    row.append(input)
    let number:HTMLInputElement|undefined
    if(!type){number=document.createElement('input');number.type='number';number.min=input.min;number.max=input.max;number.step=input.step;number.value=input.value;row.append(number)}
    const update=(source:HTMLInputElement)=>{const v=source.type==='checkbox'?source.checked:source.type==='color'?source.value:Number(source.value);change(v);if(number&&source!==number)number.value=String(v);if(source!==input){if(input.type==='checkbox')input.checked=Boolean(v);else input.value=String(v)}}
    for(const el of [input,...(number?[number]:[])]){el.addEventListener('pointerdown',snapshot,{once:false});el.addEventListener('input',()=>update(el))}
    if(id){
      const reset=document.createElement('button');reset.type='button';reset.textContent='↺';reset.title='Reset '+label
      reset.addEventListener('click',()=>{
        let baseline:unknown
        if(id.startsWith('sphere.'))baseline=selectedSphere?(sphereDefaults[selectedSphere] as unknown as Record<string,unknown>)?.[id.split('.')[1]]:undefined
        else if(id==='brushSize')baseline=production.brushSize
        else if(id==='brushStrength')baseline=production.brushStrength
        else {const [group,key]=id.split('.');baseline=(production as unknown as Record<string,Record<string,unknown>>)[group]?.[key]}
        if(baseline===undefined)return
        snapshot();change(baseline as number|string|boolean);sync()
      });row.append(reset)
    }
    parent.append(row);if(id){input.dataset.field=id;controls.set(id,input)}
  }
  for(const title of ['Bottle','Particles','Spheres','Lighting','Atmosphere','Brushes','Camera','Presets']){
    const d=section(title)
    for(const f of fields.filter(f=>f.section===title.toLowerCase())){
      const id=f.section+'.'+f.key
      control(d,f.label,()=>((config[f.section] as unknown as Record<string,unknown>)[f.key] as number|string|boolean),value=>{(config[f.section] as unknown as Record<string,unknown>)[f.key]=value;changed()},f.min,f.max,f.step,f.type,id)
    }
    if(title==='Spheres'){
      const select=document.createElement('select');select.className='creator-sphere-select';select.innerHTML='<option value="">Select sphere in scene</option>';d.append(select)
      select.addEventListener('change',()=>{selectedSphere=select.value||undefined;if(selectedSphere&&!config.spheres[selectedSphere]&&sphereDefaults[selectedSphere]){snapshot();config.spheres[selectedSphere]={...sphereDefaults[selectedSphere]};changed()}sync()})
      for(const [label,key,min,max] of sphereFields)control(d,label,()=>selectedSphere?config.spheres[selectedSphere]?.[key]??0:0,value=>{
        if(!selectedSphere||!config.spheres[selectedSphere])return
        (config.spheres[selectedSphere] as unknown as Record<string,unknown>)[key]=value;changed()
      },min,max,.01,undefined,'sphere.'+key)
      control(d,'Color',()=>selectedSphere?config.spheres[selectedSphere]?.color??'#ffffff':'#ffffff',value=>{if(selectedSphere&&config.spheres[selectedSphere]){config.spheres[selectedSphere].color=String(value);changed()}},undefined,undefined,undefined,'color','sphere.color')
      const material=document.createElement('select');material.setAttribute('aria-label','Sphere material')
      for(const kind of ['glass','pink','amber','cream','gold','moss']){const option=document.createElement('option');option.value=kind;option.textContent=kind;material.append(option)}
      material.addEventListener('change',()=>{if(selectedSphere&&config.spheres[selectedSphere]){snapshot();config.spheres[selectedSphere].material=material.value as NonNullable<typeof config.spheres[string]['material']>;changed()}});d.append(material)
      control(d,'Lock selected sphere',()=>selectedSphere?config.spheres[selectedSphere]?.locked??false:false,value=>{if(selectedSphere&&config.spheres[selectedSphere]){config.spheres[selectedSphere].locked=Boolean(value);changed()}},undefined,undefined,undefined,'checkbox','sphere.locked')
      const reset=document.createElement('button');reset.textContent='Reset selected sphere';reset.onclick=()=>{if(selectedSphere&&sphereDefaults[selectedSphere]){snapshot();config.spheres[selectedSphere]={...sphereDefaults[selectedSphere]};sync();changed()}};d.append(reset)
      for(const [label,action] of [['Add sphere','add'],['Duplicate selected','duplicate'],['Delete selected','delete']] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{
        if(action!=='add'&&!selectedSphere)return
        snapshot()
        if(action==='delete'){config.spheres[selectedSphere!].deleted=true;selectedSphere=undefined}
        else {const id='extra-'+crypto.randomUUID();const base=action==='duplicate'?config.spheres[selectedSphere!] : {x:.7,y:.2,z:0,scale:.12,rotationY:0,material:'glass' as const};config.spheres[id]={...base,x:base.x+.12};selectedSphere=id}
        refreshSphereList();sync();changed()
      };d.append(button)}
      const note=document.createElement('p');note.textContent='Click a sphere in the scene, then drag it. Edit depth and size here.';d.append(note)
    }
    if(title==='Brushes'){
      const select=document.createElement('select');select.className='creator-brush-tool'
      for(const kind of ['Off','Hue','Saturation','Warmth','Glow','Brightness','Eraser']){const o=document.createElement('option');o.value=kind;o.textContent=kind;select.append(o)}
      select.value=config.brushTool;select.addEventListener('change',()=>{snapshot();config.brushTool=select.value as StudioConfig['brushTool'];changed()});d.append(select)
      control(d,'Brush size',()=>config.brushSize,v=>{config.brushSize=Number(v);changed()},.02,.3,.01,undefined,'brushSize')
      control(d,'Brush strength',()=>config.brushStrength,v=>{config.brushStrength=Number(v);changed()},.05,1,.01,undefined,'brushStrength')
      const clear=document.createElement('button');clear.textContent='Clear brush strokes';clear.onclick=()=>{snapshot();config.brushes=[];changed()};d.append(clear)
      const note=document.createElement('p');note.textContent='Paint localized screen-space color grading. These strokes are not physical 3D lights.';d.append(note)
    }
    if(title==='Presets'){
      const name=document.createElement('input');name.placeholder='Preset name';name.className='creator-preset-name';d.append(name)
      const select=document.createElement('select');select.className='creator-preset-list';d.append(select)
      const refresh=()=>{select.innerHTML='';for(const n of Object.keys(loadPresets())){const o=document.createElement('option');o.value=n;o.textContent=n;select.append(o)}}
      refresh()
      for(const [label,fn] of [
        ['Save As preset',()=>{const n=name.value.trim();if(!n)return;const p=loadPresets();p[n]=structuredClone(config);savePresets(p);refresh();select.value=n}],
        ['Load preset',()=>{const p=loadPresets();if(p[select.value]){snapshot();set(p[select.value])}}],
        ['Duplicate preset',()=>{const p=loadPresets(),n=name.value.trim();if(n&&p[select.value]){p[n]=structuredClone(p[select.value]);savePresets(p);refresh();select.value=n}}],
        ['Reset entire scene',()=>{snapshot();set(structuredClone(production))}],
        ['Copy / Export JSON',()=>{void navigator.clipboard.writeText(JSON.stringify(config,null,2))}],
        ['Set as Default / Download JSON',()=>{const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='creator-studio.default.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}],
      ] as const){const b=document.createElement('button');b.textContent=label;b.onclick=fn;d.append(b)}
      const file=document.createElement('input');file.type='file';file.accept='application/json';file.setAttribute('aria-label','Import configuration JSON');file.onchange=async()=>{const f=file.files?.[0];if(!f)return;try{snapshot();set(mergeConfig(JSON.parse(await f.text())))}catch{alert('Could not read this configuration.')}};d.append(file)
    }
  }
  function sync(){
    for(const [id,input] of controls){
      const [section,key]=id.split('.')
      const value=section==='sphere'?selectedSphere?(config.spheres[selectedSphere] as unknown as Record<string,unknown>)?.[key]:undefined:section==='brushSize'?config.brushSize:section==='brushStrength'?config.brushStrength:(config as unknown as Record<string,Record<string,unknown>>)[section]?.[key]
      if(value===undefined)continue
      if(input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value)
      const number=input.nextElementSibling
      if(number instanceof HTMLInputElement&&number.type==='number')number.value=String(value)
    }
    const sphereSelect=panel.querySelector<HTMLSelectElement>('.creator-sphere-select')!
    sphereSelect.value=selectedSphere||''
    const material=panel.querySelector<HTMLSelectElement>('select[aria-label="Sphere material"]')!
    material.value=selectedSphere?config.spheres[selectedSphere]?.material??'glass':'glass'
    panel.querySelector<HTMLSelectElement>('.creator-brush-tool')!.value=config.brushTool
  }
  function refreshSphereList(){const select=panel.querySelector<HTMLSelectElement>('.creator-sphere-select')!;select.replaceChildren(new Option('Select sphere in scene',''))
    for(const id of new Set([...Object.keys(sphereDefaults),...Object.keys(config.spheres)]))if(!config.spheres[id]?.deleted)select.add(new Option(id.startsWith('extra-')?'Added sphere '+id.slice(-4):'Sphere '+(Number(id)+1),id))}
  function renderBrushes(){
    overlay.replaceChildren()
    for(const stroke of config.brushes.slice(-64)){
      const spot=document.createElement('div');spot.className='creator-brush-spot'
      spot.style.left=stroke.x*100+'%';spot.style.top=stroke.y*100+'%';spot.style.width=stroke.size*200+'%';spot.style.aspectRatio='1'
      spot.style.border='1px solid rgba(255,215,150,.45)';spot.style.background='transparent'
      overlay.append(spot)
    }
  }
  panel.querySelector('.creator-preview')!.addEventListener('click',()=>{panel.hidden=true;overlay.hidden=true;returnButton.hidden=false})
  returnButton.addEventListener('click',()=>{panel.hidden=false;overlay.hidden=false;returnButton.hidden=true})
  panel.querySelector('[data-action="undo"]')!.addEventListener('click',()=>{const old=history.pop();if(old){future.push(structuredClone(config));set(old)}})
  panel.querySelector('[data-action="redo"]')!.addEventListener('click',()=>{const next=future.pop();if(next){history.push(structuredClone(config));set(next)}})
  panel.querySelector('[data-action="save"]')!.addEventListener('click',()=>saveConfig(config))
  renderBrushes()
  return {
    get config(){return config},
    selectSphere(id:string){selectedSphere=id;sync();panel.querySelector('details:nth-child(3)')!.setAttribute('open','')},
    setSphereCount(defaults:{x:number;y:number;z:number;scale:number;rotationY:number}[]){sphereDefaults=Object.fromEntries(defaults.map((v,i)=>[String(i),v]));refreshSphereList()},
    isBrushActive(){return config.brushTool!=='Off'&&!panel.hidden},
    isSphereEditing(){return (panel.querySelectorAll('details')[2] as HTMLDetailsElement).open&&!panel.hidden},
    brushAt(x:number,y:number){if(config.brushTool==='Off')return;snapshot();if(config.brushTool==='Eraser'){let nearest=-1,best=Infinity;config.brushes.forEach((s,i)=>{const d=Math.hypot(s.x-x,s.y-y);if(d<best){best=d;nearest=i}});if(nearest>=0&&best<config.brushSize)config.brushes.splice(nearest,1)}else {config.brushes.push({x,y,size:config.brushSize,strength:config.brushStrength,kind:config.brushTool});config.brushes=config.brushes.slice(-64)}changed()},
    snapshot,
    save(){saveConfig(config)},
  }
}
