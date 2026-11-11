import * as THREE from 'three'
import { approvedConfig, defaultSpheres, parseConfig, saveDraft } from './studio-config'
import type { BrushKind, SphereConfig, SphereKind, StudioConfig } from './studio-config'
import './creator-studio.css'

type Spec=[string,string,number,number,number]|[string,string,'color'|'toggle']|[string,string,'select',string[]]
type Hooks={change:(path:string)=>void;select:(id:string|undefined)=>void;selected:()=>string|undefined;preview:(on:boolean)=>void;viewport:(w:number,h:number)=>void;spherePosition:(id:string)=>THREE.Vector3|undefined;camera:THREE.PerspectiveCamera;canvas:HTMLCanvasElement}
const sections:Record<string,Spec[]>={
  Bottle:[['x','Position X',-2,2,.01],['y','Position Y',-2,2,.01],['z','Position Z',-2,2,.01],['scale','Scale',.3,2,.01],['rotationX','Pitch',-45,45,1],['rotationY','Yaw',-180,180,1],['rotationZ','Roll',-45,45,1],['glassColor','Glass tint','color'],['glassTransmission','Glass transmission',0,1,.01],['glassIor','Glass IOR',1,2,.01],['glassRoughness','Glass roughness',0,.5,.005],['glassReflection','Glass reflection',0,3,.01],['liquidColor','Liquid amber','color'],['liquidAbsorption','Liquid absorption distance',.03,2,.01],['liquidOpacity','Liquid opacity',0,1,.01],['liquidTransmission','Liquid transmission',0,1,.01],['capColor','Crystal tint','color'],['capIor','Crystal IOR',1,2,.01],['capRoughness','Crystal roughness',0,.5,.005],['goldColor','Collar gold','color'],['goldRoughness','Collar roughness',0,1,.01],['highlight','Bottle highlight',0,3,.01],['rotationSensitivity','Horizontal sensitivity',.0005,.02,.0005],['verticalSensitivity','Vertical sensitivity',0,.01,.0005],['verticalLimit','Pitch limit',0,80,1],['rotationSpeed','Drag rotation speed',.1,3,.01],['momentumSensitivity','Flick momentum',0,3,.01],['inertia','Inertia',.1,5,.05],['damping','Rotation damping',.1,20,.1],['friction','Rotation friction',0,10,.1],['maxRotationSpeed','Maximum spin',.1,12,.1],['autoRotate','Auto rotation','toggle'],['autoSpeed','Auto speed',-.5,.5,.01]],
  Particles:[['count','Particle count',1024,25600,256],['density','Density',.05,1,.01],['size','Size',.2,4,.01],['sizeVariation','Size variation',0,2,.01],['color','Champagne color','color'],['secondaryColor','Rose color','color'],['hue','Hue',-180,180,1],['saturation','Saturation',0,2,.01],['brightness','Brightness',0,3,.01],['opacity','Opacity',0,1,.01],['glow','Specular glow',0,4,.01],['speed','Physics speed',0,3,.01],['turbulence','Turbulence',0,6,.01],['spread','Spread',.3,2,.01],['depth','Depth',.3,2,.01],['cluster','Clustering',.2,3,.01],['radius','Cursor radius',.1,3,.01],['repulsion','Repulsion',0,3,.01],['attraction','Attraction',0,3,.01],['velocitySensitivity','Velocity sensitivity',0,4,.01],['momentum','Momentum',.1,5,.01],['damping','Friction',.1,12,.01],['returnStrength','Return strength',0,10,.01],['sphereStrength','Sphere influence',0,4,.01],['ambientSpeed','Ambient animation',0,4,.01]],
  Spheres:[['x','Position X',-1.6,1.6,.01],['y','Position Y',-1.2,1.3,.01],['z','Depth Z',-6,3,.01],['size','Size',.01,.5,.005],['rotation','Rotation',-180,180,1],['kind','Material','select',['glass','pink','amber','moss','pearl','gold']],['color','Color','color'],['hue','Hue',-180,180,1],['saturation','Saturation',0,2,.01],['opacity','Opacity',0,1,.01],['ior','Glass IOR',1,2,.01],['roughness','Roughness',0,1,.01],['metalness','Metalness',0,1,.01],['reflection','Reflection',0,3,.01],['glow','Glow',0,2,.01],['float','Floating',0,.06,.001],['interaction','Particle influence',0,4,.01],['speed','Movement speed',0,5,.01],['damping','Drag damping',.1,12,.1],['locked','Lock position','toggle']],
  Lighting:[['ambient','Ambient',0,3,.01],['key','Key intensity',0,8,.01],['keyColor','Key color','color'],['keyX','Key X',-10,10,.1],['keyY','Key Y',-10,10,.1],['keyZ','Key Z',-10,10,.1],['fill','Fill intensity',0,8,.01],['fillColor','Fill color','color'],['fillX','Fill X',-10,10,.1],['fillY','Fill Y',-10,10,.1],['fillZ','Fill Z',-10,10,.1],['rim','Rim intensity',0,8,.01],['rimColor','Rim color','color'],['rimX','Rim X',-10,10,.1],['rimY','Rim Y',-10,10,.1],['rimZ','Rim Z',-10,10,.1],['warm','Warm point intensity',0,8,.01],['warmColor','Warm point color','color'],['warmX','Warm X',-10,10,.1],['warmY','Warm Y',-10,10,.1],['warmZ','Warm Z',-10,10,.1],['temperature','Light temperature',-1,1,.01],['exposure','Exposure',.3,2.5,.01],['reflection','Environment reflection',0,3,.01],['bloom','Bloom',0,.5,.005],['bloomThreshold','Bloom threshold',0,3,.01],['highlight','Highlight intensity',0,3,.01],['shadow','Floor shadow',0,2,.01]],
  Atmosphere:[['hue','Global hue',-180,180,1],['saturation','Saturation',0,2,.01],['contrast','Contrast',.2,2,.01],['brightness','Brightness',.2,2,.01],['temperature','Temperature',-1,1,.01],['warmth','Warmth',0,2,.01],['fogColor','Mist color','color'],['fogDensity','Mist density',0,3,.01],['glow','Atmospheric glow',0,3,.01],['background','Background tint','color'],['depth','Foreground softness',0,2,.01]],
  Brushes:[['size','Size',.01,.4,.005],['strength','Strength',0,2,.01],['softness','Softness',.01,1,.01],['opacity','Opacity',0,1,.01]],
  Camera:[['x','Position X',-3,3,.01],['y','Position Y',-3,3,.01],['z','Distance',2,10,.01],['pitch','Pitch',-40,40,1],['yaw','Yaw',-40,40,1],['roll','Roll',-30,30,1],['fov','Field of view',20,80,1],['zoom','Zoom',.5,2,.01],['framing','Desktop framing',-.3,.3,.005],['mobileScale','Mobile bottle scale',.5,1.6,.01],['mobileFraming','Mobile framing',-.3,.3,.005],['sceneDepth','Environment depth',.3,2,.01]],
}
const groups:Record<string,keyof StudioConfig>={Bottle:'bottle',Particles:'particles',Spheres:'spheres',Lighting:'lighting',Atmosphere:'atmosphere',Brushes:'brush',Camera:'camera'}
const brushKinds:BrushKind[]=['hue','saturation','brightness','warmth','glow','eraser']
const presetKey='nocturne.creator-presets.v2'
const clone=(c:StudioConfig)=>structuredClone(c)
const valueAt=(config:StudioConfig,path:string):unknown=>path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,config)
const setAt=(config:StudioConfig,path:string,value:unknown)=>{const keys=path.split('.');let object:Record<string,unknown>=config as unknown as Record<string,unknown>;for(const key of keys.slice(0,-1))object=object[key] as Record<string,unknown>;object[keys.at(-1)!]=value}
const button=(label:string,action:()=>void)=>{const el=document.createElement('button');el.type='button';el.textContent=label;el.addEventListener('click',action);return el}
export function mountStudio(config:StudioConfig,hooks:Hooks){
  let preview=false,sphereMode=false,brushMode=false,brushKind:BrushKind='warmth',selected:string|undefined,history:StudioConfig[]=[],future:StudioConfig[]=[],before:StudioConfig|undefined,painting=false
  const panel=document.createElement('aside');panel.className='creator-panel';panel.setAttribute('aria-label','Creator Studio')
  panel.innerHTML=`<header class="creator-head"><div><small>NOCTURNE / CREATOR</small><h2>Creator Studio</h2></div><button class="creator-collapse" aria-label="Collapse creator panel">−</button></header><div class="creator-toolbar"></div><div class="creator-scroll"></div><footer class="creator-foot"><span class="creator-status" role="status">Local draft ready</span><small>Local studio · export to publish</small></footer>`
  document.body.append(panel)
  const toolbar=panel.querySelector<HTMLElement>('.creator-toolbar')!,scroll=panel.querySelector<HTMLElement>('.creator-scroll')!,status=panel.querySelector<HTMLElement>('.creator-status')!
  const opener=button('Open Creator Studio',()=>{preview=false;panel.classList.remove('is-collapsed');hooks.preview(false);opener.hidden=true});opener.className='creator-opener';opener.hidden=true;document.body.append(opener)
  panel.querySelector('.creator-collapse')!.addEventListener('click',()=>{panel.classList.add('is-collapsed');opener.hidden=false})
  const gizmo=document.createElement('div');gizmo.className='sphere-gizmo';gizmo.hidden=true;gizmo.innerHTML='<span class="sphere-gizmo-ring"></span><button aria-label="Resize selected sphere" title="Drag to resize sphere">↗</button>';document.body.append(gizmo)
  const draft=()=>{saveDraft(config);status.textContent='Saved in this browser'}
  const record=(snapshot:StudioConfig)=>{if(JSON.stringify(snapshot)===JSON.stringify(config))return;history.push(snapshot);if(history.length>80)history.shift();future=[];draft()}
  const replace=(next:StudioConfig)=>{
    const old=clone(config),loaded=parseConfig(next)
    const rebuild=old.spheres.length!==loaded.spheres.length||old.spheres.some((sphere,i)=>sphere.id!==loaded.spheres[i].id)
      ||old.particles.spread!==loaded.particles.spread||old.particles.depth!==loaded.particles.depth||old.particles.cluster!==loaded.particles.cluster||old.camera.sceneDepth!==loaded.camera.sceneDepth
    Object.assign(config,loaded);hooks.change(rebuild?'all':'snapshot');refresh()
  }
  const undo=()=>{const prev=history.pop();if(!prev)return;future.push(clone(config));replace(prev);draft()}
  const redo=()=>{const next=future.pop();if(!next)return;history.push(clone(config));replace(next);draft()}
  const doChange=(path:string,value:unknown)=>{setAt(config,path,value);hooks.change(path);refreshSelection();draft()}
  const addTool=(label:string,fn:()=>void)=>toolbar.append(button(label,fn))
  addTool('Undo',undo);addTool('Redo',redo)
  addTool('Save',()=>{draft();status.textContent='Scene saved locally'})
  addTool('Preview',()=>{preview=!preview;if(preview){sphereMode=false;brushMode=false;panel.dataset.mode='none'}hooks.preview(preview);opener.hidden=!preview;gizmo.hidden=preview||!selected;status.textContent=preview?'Preview mode':'Creator mode'})
  addTool('Sphere select',()=>{sphereMode=!sphereMode;brushMode=false;panel.dataset.mode=sphereMode?'sphere':'none';status.textContent=sphereMode?'Click and drag a sphere in the scene':'Sphere editing off'})
  addTool('Paint',()=>{brushMode=!brushMode;sphereMode=false;panel.dataset.mode=brushMode?'brush':'none';status.textContent=brushMode?'Paint on the hero to add local color grading':'Brush off'})

  const viewport=document.createElement('div');viewport.className='creator-viewport';viewport.innerHTML='<label>Preview size <select aria-label="Preview viewport"><option value="full">Actual window</option><option value="1440x900">Desktop</option><option value="1366x768">Laptop</option><option value="768x1024">Tablet</option><option value="390x844">Phone</option></select></label>'
  viewport.querySelector('select')!.addEventListener('change',e=>{const value=(e.target as HTMLSelectElement).value;if(value==='full')hooks.viewport(0,0);else {const [w,h]=value.split('x').map(Number);hooks.viewport(w,h)}})
  toolbar.append(viewport)
  const sphereTools=document.createElement('div');sphereTools.className='sphere-tools';sphereTools.innerHTML='<label>Selected sphere <select class="sphere-list" aria-label="Selected sphere"></select></label><div class="sphere-actions"></div>'
  const sphereList=sphereTools.querySelector<HTMLSelectElement>('select')!
  sphereList.addEventListener('change',()=>selectSphere(sphereList.value||undefined))
  const actions=sphereTools.querySelector<HTMLElement>('.sphere-actions')!
  actions.append(button('Add',()=>{const snapshot=clone(config);const template=defaultSpheres()[4];const sphere={...template,id:`orb-${Date.now()}`,x:.55,y:.1,z:-.5,size:.08};config.spheres.push(sphere);hooks.change('spheres');selectSphere(sphere.id);record(snapshot)}))
  actions.append(button('Duplicate',()=>{const source=config.spheres.find(s=>s.id===selected);if(!source)return;const snapshot=clone(config);const sphere={...structuredClone(source),id:`orb-${Date.now()}`,x:source.x+.08};config.spheres.push(sphere);hooks.change('spheres');selectSphere(sphere.id);record(snapshot)}))
  actions.append(button('Delete',()=>{if(!selected)return;const snapshot=clone(config);config.spheres=config.spheres.filter(s=>s.id!==selected);selected=undefined;hooks.change('spheres');refresh();record(snapshot)}))
  actions.append(button('Reset sphere',()=>{const sphere=config.spheres.find(s=>s.id===selected);if(!sphere)return;const snapshot=clone(config);const original=defaultSpheres().find(s=>s.id===sphere.id);Object.assign(sphere,original||{x:0,y:0,z:0,size:.08,rotation:0});hooks.change('spheres');refresh();record(snapshot)}))

  const brushTools=document.createElement('div');brushTools.className='brush-tools';brushTools.innerHTML='<label>Brush type <select aria-label="Brush type"></select></label><p>These strokes grade pixels in the finished image. They do not move a 3D light.</p>'
  const brushSelect=brushTools.querySelector('select')!;brushKinds.forEach(kind=>brushSelect.add(new Option(kind[0].toUpperCase()+kind.slice(1),kind)));brushSelect.value=brushKind;brushSelect.addEventListener('change',()=>brushKind=brushSelect.value as BrushKind)
  brushTools.append(button('Clear strokes',()=>{const snapshot=clone(config);config.brush.strokes=[];hooks.change('brush.strokes');record(snapshot)}))

  const presets=document.createElement('div');presets.className='preset-tools';presets.innerHTML='<label>Saved presets <select aria-label="Saved presets"></select></label><div class="preset-actions"></div><p>Export the approved JSON and commit it as <code>src/visitor-scene.json</code> to change the public site.</p>'
  const presetList=presets.querySelector<HTMLSelectElement>('select')!,presetActions=presets.querySelector<HTMLElement>('.preset-actions')!
  const getPresets=():Record<string,StudioConfig>=>{try{return JSON.parse(localStorage.getItem(presetKey)||'{}')}catch{return {}}}
  const updatePresetList=()=>{const chosen=presetList.value;presetList.replaceChildren(new Option('Choose a preset',''));Object.keys(getPresets()).forEach(name=>presetList.add(new Option(name,name)));presetList.value=chosen}
  const putPreset=(name:string,scene:StudioConfig)=>{const all=getPresets();all[name]=clone(scene);localStorage.setItem(presetKey,JSON.stringify(all));updatePresetList();presetList.value=name;status.textContent=`Preset “${name}” saved`}
  presetActions.append(button('Save As',()=>{const name=prompt('Preset name?')?.trim();if(name)putPreset(name,config)}))
  presetActions.append(button('Load',()=>{const saved=getPresets()[presetList.value];if(!saved)return;const snapshot=clone(config);replace(saved);record(snapshot)}))
  presetActions.append(button('Duplicate',()=>{const saved=getPresets()[presetList.value];if(!saved)return;const name=prompt('Name for duplicate preset?')?.trim();if(name)putPreset(name,saved)}))
  presetActions.append(button('Reset scene',()=>{const snapshot=clone(config);replace(approvedConfig());record(snapshot)}))
  presetActions.append(button('Export JSON',()=>{const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='visitor-scene.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Exported visitor-scene.json'}))
  const file=document.createElement('input');file.type='file';file.accept='application/json,.json';file.hidden=true;file.addEventListener('change',async()=>{const chosen=file.files?.[0];if(!chosen)return;try{const raw=JSON.parse(await chosen.text());if(raw?.version!==2)throw Error('Expected a version 2 Nocturne scene');const snapshot=clone(config);replace(parseConfig(raw));record(snapshot);status.textContent='Imported scene configuration'}catch(error){status.textContent=`Import failed: ${String(error)}`}file.value=''})
  presetActions.append(button('Import JSON',()=>file.click()));presets.append(file);updatePresetList()

  function renderFields(category:string,target:HTMLElement){
    const key=groups[category],sphere=config.spheres.find(s=>s.id===selected)
    for(const spec of sections[category]){
      const [field,label]=spec,path=category==='Spheres'?`spheres.${config.spheres.indexOf(sphere!)}.${field}`:`${key}.${field}`
      const value=category==='Spheres'?sphere?.[field as keyof SphereConfig]:valueAt(config,path)
      const row=document.createElement('div');row.className='studio-field';row.dataset.path=path
      const heading=document.createElement('label');heading.textContent=label;row.append(heading)
      const reset=button('↺',()=>{const snapshot=clone(config);const original=category==='Spheres'?(defaultSpheres().find(s=>s.id===selected)||defaultSpheres()[4])[field as keyof SphereConfig]:valueAt(approvedConfig(),path);if(original!==undefined){doChange(path,original);record(snapshot);refresh()}});reset.title=`Reset ${label}`;reset.setAttribute('aria-label',`Reset ${label}`)
      if(typeof spec[2]==='number'){
        const range=document.createElement('input'),number=document.createElement('input');range.type='range';number.type='number';range.min=number.min=String(spec[2]);range.max=number.max=String(spec[3]);range.step=number.step=String(spec[4]);range.value=number.value=String(value??0)
        for(const input of [range,number]){input.setAttribute('aria-label',label);input.addEventListener('focus',()=>before=clone(config));input.addEventListener('pointerdown',()=>before=clone(config));input.addEventListener('input',()=>{const next=Math.max(spec[2] as number,Math.min(spec[3] as number,Number(input.value)));if(!Number.isFinite(next))return;range.value=number.value=String(next);doChange(path,next)});input.addEventListener('change',()=>{if(before)record(before);before=undefined})}
        row.append(range,number)
      }else if(spec[2]==='color'){
        const input=document.createElement('input');input.type='color';input.value=String(value||'#ffffff');input.setAttribute('aria-label',label);input.addEventListener('focus',()=>before=clone(config));input.addEventListener('input',()=>doChange(path,input.value));input.addEventListener('change',()=>{if(before)record(before);before=undefined});row.append(input)
      }else if(spec[2]==='toggle'){
        const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(value);input.setAttribute('aria-label',label);input.addEventListener('change',()=>{const snapshot=clone(config);doChange(path,input.checked);record(snapshot)});row.append(input)
      }else{
        const input=document.createElement('select');for(const option of spec[3] as string[])input.add(new Option(option,option));input.value=String(value);input.setAttribute('aria-label',label);input.addEventListener('change',()=>{const snapshot=clone(config);doChange(path,input.value as SphereKind);record(snapshot)});row.append(input)
      }
      row.append(reset);target.append(row)
    }
  }
  function refresh(){
    const open=Array.from(scroll.querySelectorAll<HTMLDetailsElement>('details[open]')).map(d=>d.dataset.category)
    scroll.replaceChildren()
    for(const category of [...Object.keys(sections),'Presets']){
      const details=document.createElement('details');details.dataset.category=category;details.open=open.length?open.includes(category):category==='Spheres'
      const summary=document.createElement('summary');summary.textContent=category;details.append(summary)
      const body=document.createElement('div');body.className='creator-section'
      if(category==='Spheres'){body.append(sphereTools);if(selected)renderFields(category,body);else {const p=document.createElement('p');p.textContent='Choose a sphere here or use Sphere select and click one in the scene.';body.append(p)}}
      else if(category==='Brushes'){body.append(brushTools);renderFields(category,body)}
      else if(category==='Presets')body.append(presets)
      else renderFields(category,body)
      details.append(body);scroll.append(details)
    }
    sphereList.replaceChildren(new Option('Select a sphere',''));config.spheres.forEach((s,i)=>sphereList.add(new Option(`${i+1} · ${s.kind}`,s.id)));sphereList.value=selected||''
    refreshSelection()
  }
  function selectSphere(id:string|undefined){selected=id;hooks.select(id);refresh()}
  function refreshSelection(){
    const sphere=config.spheres.find(s=>s.id===selected),point=sphere&&hooks.spherePosition(sphere.id)
    if(!sphere||!point||preview){gizmo.hidden=true;return}
    const p=point.project(hooks.camera),bounds=hooks.canvas.getBoundingClientRect()
    const radius=sphere.size*(bounds.height/(2*Math.tan(THREE.MathUtils.degToRad(hooks.camera.fov/2))*(hooks.camera.position.z-point.z)))
    gizmo.hidden=false;gizmo.style.left=`${bounds.left+(p.x+1)*bounds.width/2}px`;gizmo.style.top=`${bounds.top+(1-p.y)*bounds.height/2}px`;gizmo.style.width=gizmo.style.height=`${Math.max(24,radius*2)}px`
  }
  let resizeStart:StudioConfig|undefined,resizeY=0,resizeSize=0
  const handle=gizmo.querySelector('button')!
  handle.addEventListener('pointerdown',e=>{const sphere=config.spheres.find(s=>s.id===selected);if(!sphere||sphere.locked)return;e.preventDefault();resizeStart=clone(config);resizeY=e.clientY;resizeSize=sphere.size;handle.setPointerCapture(e.pointerId)})
  handle.addEventListener('pointermove',e=>{if(!resizeStart)return;const sphere=config.spheres.find(s=>s.id===selected);if(!sphere)return;sphere.size=Math.max(.01,Math.min(.5,resizeSize+(resizeY-e.clientY)*.002));hooks.change('spheres');refreshSelection()})
  handle.addEventListener('pointerup',()=>{if(resizeStart)record(resizeStart);resizeStart=undefined;refresh()})
  const paint=(e:PointerEvent)=>{const rect=hooks.canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height,b=config.brush
    if(brushKind==='eraser'){b.strokes=b.strokes.filter(s=>Math.hypot((s.x-x)*rect.width/rect.height,s.y-y)>b.size);hooks.change('brush.strokes');return}
    const last=b.strokes.at(-1);if(last&&Math.hypot((last.x-x)*rect.width/rect.height,last.y-y)<b.size*.35)return
    b.strokes.push({x,y,size:b.size,strength:b.strength,softness:b.softness,opacity:b.opacity,kind:brushKind});if(b.strokes.length>64)b.strokes.shift();hooks.change('brush.strokes')}
  hooks.canvas.addEventListener('pointerdown',e=>{if(!brushMode||e.button!==0)return;before=clone(config);painting=true;hooks.canvas.setPointerCapture(e.pointerId);paint(e)})
  hooks.canvas.addEventListener('pointermove',e=>{if(painting)paint(e)})
  const endPaint=()=>{if(painting&&before)record(before);painting=false;before=undefined}
  hooks.canvas.addEventListener('pointerup',endPaint);hooks.canvas.addEventListener('pointercancel',endPaint)
  window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!['z','y'].includes(e.key.toLowerCase()))return;const element=document.activeElement;if(element instanceof HTMLInputElement&&element.type!=='range')return;e.preventDefault();if(e.key.toLowerCase()==='y'||e.shiftKey)redo();else undo()})
  window.addEventListener('resize',refreshSelection)
  refresh()
  return {get sphereMode(){return sphereMode},selectSphere,refresh,refreshSelection,record,persist:draft}
}
