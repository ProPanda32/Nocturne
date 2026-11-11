import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createOpticalStage } from './optical-stage'
import { createGarden } from './garden'
import './hero.css'
import { loadConfig, saveConfig, production, type SphereTransform } from './studio-config'
import { createCreatorStudio } from './creator-studio'
import { createBottleControls, type BottleControls } from './bottle-controls'

const icon = (path:string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
const menuIcon=icon('<path d="M3 6h18M3 12h18M3 18h18"/>')
const searchIcon=icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')
const musicIcon=icon('<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>')
const mailIcon=icon('<rect x="2" y="5" width="20" height="14" rx="1"/><path d="m3 6 9 8 9-8"/>')
const creatorMode=import.meta.env.DEV && new URLSearchParams(location.search).get('creator')==='1'
const app=document.querySelector<HTMLDivElement>('#app')!
app.innerHTML=`
  <a class="skip-link" href="#fragrance">Skip to the collection</a>
  <header class="site-header">
    <div class="header-left">
      <button class="header-menu" aria-label="Open menu" aria-haspopup="dialog" aria-controls="menu-dialog">${menuIcon}<span>Menu</span></button>
      <button class="header-search" aria-label="Search Nocturne" aria-haspopup="dialog" aria-controls="search-dialog">${searchIcon}<span>Search</span></button>
    </div>
    <a class="header-logo" href="#top" aria-label="Nocturne home">NOCTURNE</a>
    <div class="header-right">
      <a class="world-link" href="#story">Our world</a>
      <button class="music-toggle" aria-label="Play ambient sound" aria-pressed="false">${musicIcon}</button>
      <button class="mail-toggle" aria-label="Correspondence" aria-haspopup="dialog" aria-controls="mail-dialog">${mailIcon}</button>
    </div>
  </header>
  <main>
    <section class="site-hero" id="top" aria-label="An enchanted garden surrounding the Nocturne perfume bottle">
      <div class="scene-layer" aria-hidden="true"></div>
      <button class="bottle-drag-target" aria-label="Rotate the Nocturne bottle. Drag horizontally or use left and right arrow keys." hidden></button>
      <p class="load-status" role="status">Entering Nocturne<span class="loading-dot"> ·</span></p>
      <div class="hero-copy">
        <p class="hero-kicker">THE ESSENCE WITHIN</p>
        <h1><a href="#fragrance">Discover The Collection</a></h1>
        <p class="drag-hint">DRAG TO EXPLORE <span aria-hidden="true">~</span></p>
      </div>
      <div class="scene-error" role="status" hidden><p>The experience could not open.</p><button class="retry">Try again</button><a href="#fragrance">Explore the collection</a></div>
    </section>
    <section class="fragrance-section" id="fragrance" aria-labelledby="fragrance-title">
      <p class="section-index">01 / THE FRAGRANCE</p>
      <div class="editorial-grid"><div><p class="section-kicker">The Nocturne collection</p><h2 id="fragrance-title">Made for the<br>hours after dark.</h2></div>
      <div class="editorial-detail"><p class="product-name">NOCTURNE <span>EAU DE PARFUM</span></p><p>Deep amber held in sculpted crystal. A warm gold collar and a faceted cap catch the last light.</p><a href="#top" class="text-link">Explore the bottle <span aria-hidden="true">↗</span></a></div></div>
    </section>
    <section class="story-section" id="story" aria-labelledby="story-title"><p class="section-index">02 / THE WORLD OF NOCTURNE</p>
      <div class="editorial-grid"><h2 id="story-title">Light, held<br>in shadow.</h2><div class="editorial-detail"><p>Crystal, amber and gold. An intimate world that reveals itself slowly, in the hours between dusk and dawn.</p><a href="#top" class="text-link">Return to the experience <span aria-hidden="true">↑</span></a></div></div>
    </section>
  </main>
  <footer><a href="#top">NOCTURNE</a><span>EAU DE PARFUM</span><a href="#top">Back to top ↑</a></footer>
  <dialog id="menu-dialog" class="side-dialog" aria-labelledby="menu-title"><button class="dialog-close" aria-label="Close menu">×</button>
    <p class="section-kicker">NOCTURNE</p><h2 id="menu-title">Beyond the light.</h2>
    <nav aria-label="Explore Nocturne"><a href="#top">The experience</a><a href="#fragrance">The collection</a><a href="#story">Our world</a></nav>
    <button class="scene-controls-toggle text-link">Scene controls</button>
  </dialog>
  <dialog id="search-dialog" aria-labelledby="search-title"><button class="dialog-close" aria-label="Close search">×</button><h2 id="search-title">Explore Nocturne</h2>
    <label for="site-search">What are you looking for?</label><input id="site-search" type="search" placeholder="Fragrance, bottle, our world…" autocomplete="off"/>
    <nav class="search-results" aria-live="polite"><a href="#fragrance" data-terms="perfume fragrance collection amber">The fragrance collection</a><a href="#top" data-terms="bottle crystal glass experience">The bottle experience</a><a href="#story" data-terms="world story nocturne">Our world</a></nav><p class="search-empty" hidden>No matching pages. Try “fragrance” or “world”.</p>
  </dialog>
  <dialog id="mail-dialog" aria-labelledby="mail-title"><button class="dialog-close" aria-label="Close correspondence">×</button><p class="section-kicker">CORRESPONDENCE</p><h2 id="mail-title">A world unfolding.</h2><p>Our correspondence service is not yet open. In the meantime, discover the story of Nocturne.</p><a class="text-link" href="#story">Enter our world ↗</a></dialog>
  <dialog id="controls-dialog" aria-labelledby="controls-title"><button class="dialog-close" aria-label="Close scene controls">×</button><h2 id="controls-title">Scene controls</h2>
    <label>Illumination <input id="exposure" type="range" min="0.65" max="1.4" step=".05" value="1"/></label>
    <label>Rendering quality <select id="quality"><option value="auto">Automatic</option><option value="high">High</option><option value="low">Gentle on battery</option></select></label>
    <button class="reset-view text-link">Reset bottle view</button><p class="controls-note">Drag or use the arrow keys to turn the bottle. Your device’s reduced-motion preference is respected.</p>
  </dialog>`

const hero=app.querySelector<HTMLElement>('.site-hero')!
const layer=app.querySelector<HTMLElement>('.scene-layer')!
const target=app.querySelector<HTMLButtonElement>('.bottle-drag-target')!
const status=app.querySelector<HTMLElement>('.load-status')!
const errorPanel=app.querySelector<HTMLElement>('.scene-error')!
const showError=(error:unknown)=>{console.error(error);status.hidden=true;errorPanel.hidden=false;target.hidden=true;hero.dataset.state='error'}
app.querySelector('.retry')!.addEventListener('click',()=>location.reload())

const openDialog=(id:string)=>{document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());app.querySelector<HTMLDialogElement>(id)!.showModal()}
for(const [button,id] of [['.header-menu','#menu-dialog'],['.header-search','#search-dialog'],['.mail-toggle','#mail-dialog'],['.scene-controls-toggle','#controls-dialog']]) {
  app.querySelector(button)!.addEventListener('click',()=>openDialog(id))
}
app.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{
  dialog.querySelector('.dialog-close')!.addEventListener('click',()=>dialog.close())
  dialog.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>dialog.close()))
  dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()}})
})
app.querySelector<HTMLInputElement>('#site-search')!.addEventListener('input',event=>{
  const query=(event.target as HTMLInputElement).value.trim().toLowerCase();let count=0
  app.querySelectorAll<HTMLAnchorElement>('.search-results a').forEach(a=>{a.hidden=!(a.dataset.terms+' '+a.textContent).toLowerCase().includes(query);if(!a.hidden)count++})
  app.querySelector<HTMLElement>('.search-empty')!.hidden=count>0
})
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)')
let reduced=reducedQuery.matches
reducedQuery.addEventListener('change',()=>{reduced=reducedQuery.matches})

// Optional quiet, generated ambience starts only after the visitor presses play.
let audio:AudioContext|undefined, gain:GainNode|undefined
const music=app.querySelector<HTMLButtonElement>('.music-toggle')!
music.addEventListener('click',async()=>{
  try {
    if(!audio){audio=new AudioContext();gain=audio.createGain();gain.gain.value=0;gain.connect(audio.destination)
      for(const frequency of [110,164.81,220.12]){const oscillator=audio.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start()}}
    const playing=music.getAttribute('aria-pressed')!=='true'
    await audio.resume();gain!.gain.setTargetAtTime(playing?.012:0,audio.currentTime,.6)
    music.setAttribute('aria-pressed',String(playing));music.setAttribute('aria-label',playing?'Mute ambient sound':'Play ambient sound')
  } catch {music.setAttribute('aria-label','Ambient sound unavailable')}
})

async function start() {
  let config=loadConfig(creatorMode)
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'})
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1
  layer.append(renderer.domElement)
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.1,40)
  camera.position.z=5
  const stage=createOpticalStage(renderer,scene,camera)
  const root=new THREE.Group();root.name='Original Nocturne flacon';scene.add(root)
  const key=new THREE.DirectionalLight('#ffdfb0',2.5);key.position.set(-3,3,4);scene.add(key)
  const rim=new THREE.DirectionalLight('#ffb963',2.1);rim.position.set(3,2,-1);scene.add(rim)
  const moon=new THREE.DirectionalLight('#90b6d5',.65);moon.position.set(-1,6,-4);scene.add(moon)
  const ambient=new THREE.HemisphereLight('#71848b','#342712',.25);scene.add(ambient)
  const warm=new THREE.PointLight('#ffbf69',2.2,8,2);warm.position.set(.15,.1,-1.4);scene.add(warm)
  let garden:ReturnType<typeof createGarden>|undefined, bottleSize:THREE.Vector3|undefined
  let floor=.25, yaw=0, pitch=0, velocity=0, pitchVelocity=0, dragging=false, lastX=0,lastY=0, previousTime=0, inView=true, quality='auto', pixelCap=1.5, adaptiveLow=false
  const gardenSignature=()=>JSON.stringify([config.particles.count,config.particles.spread,config.particles.depth,config.particles.clustering,config.particles.color,config.particles.secondaryColor,config.camera.sceneDepth])
  let currentGardenSignature=''
  let lastPointer=new THREE.Vector2(), lastPointerTime=0, rebuildTimer:number|undefined, lastDragTime=0
  let sphereDragging:{id:string;startX:number;startY:number;home:THREE.Vector3}|undefined
  const qualitySelect=app.querySelector<HTMLSelectElement>('#quality')!
  app.querySelector<HTMLInputElement>('#exposure')!.addEventListener('input',e=>{config.lighting.exposure=Number((e.target as HTMLInputElement).value);applyConfig()})
  qualitySelect.addEventListener('change',()=>{quality=qualitySelect.value;adaptiveLow=false;pixelCap=quality==='low'?1:quality==='high'?2:1.5;resize();rebuildGarden()})
  app.querySelector('.reset-view')!.addEventListener('click',()=>{yaw=0;velocity=0;root.rotation.y=0})

  const studio=creatorMode?createCreatorStudio(hero,config,next=>{config=next;applyConfig()}):undefined
  const visitorControls=creatorMode?undefined:createBottleControls(hero,(settings,reset)=>{
    applyVisitorSettings(settings,reset)
  })
  function applyVisitorSettings(settings:BottleControls,reset:boolean){
    config.bottle.glassTint=settings.glassTint
    config.bottle.liquidTint=settings.liquidTint
    config.bottle.scale=settings.scale
    config.bottle.glassTransmission=settings.clarity
    config.bottle.dragSensitivity=production.bottle.dragSensitivity*settings.rotationSpeed
    config.bottle.inertia=settings.inertia
    config.lighting.key=production.lighting.key*settings.brightness
    config.lighting.rim=production.lighting.rim*settings.brightness
    config.lighting.ambient=production.lighting.ambient*settings.brightness
    config.lighting.keyColor=settings.lightColorChanged?settings.lightColor:production.lighting.keyColor
    config.lighting.rimColor=settings.lightColorChanged?settings.lightColor:production.lighting.rimColor
    if(reset){yaw=0;velocity=0}
    applyConfig()
  }
  if(visitorControls)applyVisitorSettings(visitorControls.settings,false)
  function applyConfig(){
    renderer.toneMappingExposure=config.lighting.exposure
    key.intensity=config.lighting.key;key.color.set(config.lighting.keyColor)
    key.position.set(config.lighting.keyX,config.lighting.keyY,config.lighting.keyZ)
    rim.intensity=config.lighting.rim;rim.color.set(config.lighting.rimColor);rim.position.set(config.lighting.rimX,config.lighting.rimY,config.lighting.rimZ)
    moon.intensity=config.lighting.back;moon.color.set(config.lighting.backColor);moon.position.set(config.lighting.backX,config.lighting.backY,config.lighting.backZ)
    ambient.intensity=config.lighting.ambient
    warm.intensity=config.lighting.warm*(visitorControls?.settings.brightness??1)
    warm.color.set(visitorControls?.settings.lightColorChanged?visitorControls.settings.lightColor:config.lighting.warmColor)
    warm.position.set(config.lighting.warmX,config.lighting.warmY,config.lighting.warmZ)
    camera.position.set(config.camera.x,config.camera.y,config.camera.distance)
    camera.rotation.set(config.camera.pitch,config.camera.yaw,config.camera.roll)
    camera.zoom=config.camera.zoom
    camera.fov=config.camera.fov+(hero.clientWidth/hero.clientHeight<.9?3:0)
    camera.updateProjectionMatrix()
    renderer.domElement.style.filter='hue-rotate('+config.atmosphere.hue+'deg)'
    stage.setAppearance(config)
    stage.setBottleFinish((visitorControls?.settings.reflection??config.bottle.glassReflection)*config.lighting.reflection/1.15,visitorControls?.settings.glow??0)
    garden?.setControls(config)
    garden?.syncSpheres(config.spheres)
    if(garden&&currentGardenSignature!==gardenSignature()){window.clearTimeout(rebuildTimer);rebuildTimer=window.setTimeout(rebuildGarden,180)}
    frame()
    if(creatorMode)saveConfig(config)
  }
  function frame() {
    if(!bottleSize)return
    const w=hero.clientWidth,h=hero.clientHeight,portrait=w/h<.9
    const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.z
    // Reference: top 23%, base 74%, centered. Portrait gets its own framing.
    const height=portrait?(h<720?.40:.44):w/h<1.4?.49:.52
    const width=portrait?.59:w/h<1.4?.43:.29
    const scale=Math.min(viewHeight*height/bottleSize.y,viewHeight*camera.aspect*width/bottleSize.x)
    root.scale.setScalar(scale*config.bottle.scale*(portrait?config.camera.mobileScale:1))
    root.position.set(config.bottle.x,viewHeight*(portrait?.035+config.camera.mobileFraming:.012+config.camera.framing)+config.bottle.y,config.bottle.z)
    root.rotation.set(config.bottle.rotationX+pitch,yaw+config.bottle.rotationY,config.bottle.rotationZ)
    floor=.5+root.position.y/viewHeight-bottleSize.y*scale/viewHeight/2
    target.style.width=`${bottleSize.x*scale/(viewHeight*camera.aspect)*w*1.15}px`
    target.style.height=`${bottleSize.y*scale/viewHeight*h*1.06}px`
    target.style.left=`${(50+(root.position.x-camera.position.x)/(viewHeight*camera.aspect)*100)}%`
    target.style.top=`${(50-(root.position.y-camera.position.y)/viewHeight*100)}%`
    hero.style.setProperty('--copy-top',`${Math.min(82,Math.max(76,(1-floor)*100+5))}%`)
  }
  function resize() {
    const w=hero.clientWidth,h=hero.clientHeight
    camera.aspect=w/h;camera.fov=config.camera.fov+(w/h<.9?3:0);camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio,pixelCap,w<700?1.5:2))
    renderer.setSize(w,h,false);frame()
  }
  function rebuildGarden(){window.clearTimeout(rebuildTimer);currentGardenSignature=gardenSignature();garden?.dispose();garden=createGarden(renderer,scene,camera,stage,hero.clientWidth<700||quality==='low'||adaptiveLow,config.particles.count,config.particles,config.camera.sceneDepth);hero.dataset.particles=String(garden.count);studio?.setSphereCount(garden.spheres.map(s=>({x:s.home.x,y:s.home.y,z:s.home.z,scale:s.mesh.scale.x,rotationY:s.mesh.rotation.y,color:'#'+s.mesh.userData.baseColor})));applyConfig()}
  resize();rebuildGarden()
  const resizeObserver=new ResizeObserver(()=>{resize();window.clearTimeout(rebuildTimer);rebuildTimer=window.setTimeout(rebuildGarden,180)})
  resizeObserver.observe(hero)

  target.addEventListener('pointerdown',e=>{if(e.button!==0||studio?.isBrushActive()||studio?.isSphereEditing())return;dragging=true;lastX=e.clientX;lastY=e.clientY;lastDragTime=performance.now();target.setPointerCapture(e.pointerId);target.classList.add('is-dragging')})
  target.addEventListener('pointermove',e=>{if(!dragging)return;const now=performance.now(),dt=Math.max((now-lastDragTime)/1000,.008);lastDragTime=now;const angle=(e.clientX-lastX)*.004*config.bottle.dragSensitivity,vertical=(e.clientY-lastY)*.004*config.bottle.verticalSensitivity;lastX=e.clientX;lastY=e.clientY;const measured=THREE.MathUtils.clamp(angle/dt*config.bottle.momentumSensitivity,-config.bottle.maxSpeed,config.bottle.maxSpeed);velocity=THREE.MathUtils.lerp(velocity,measured,.55);pitchVelocity=THREE.MathUtils.lerp(pitchVelocity,THREE.MathUtils.clamp(vertical/dt*config.bottle.momentumSensitivity,-config.bottle.maxSpeed,config.bottle.maxSpeed),.55);yaw+=angle;pitch=THREE.MathUtils.clamp(pitch+vertical,-config.bottle.verticalLimit,config.bottle.verticalLimit);root.rotation.set(config.bottle.rotationX+pitch,yaw+config.bottle.rotationY,config.bottle.rotationZ)})
  const release=()=>{dragging=false;target.classList.remove('is-dragging')}
  target.addEventListener('pointerup',release);target.addEventListener('pointercancel',release);target.addEventListener('lostpointercapture',release)
  target.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();velocity=0;yaw+=(e.key==='ArrowRight'?1:-1)*.15;root.rotation.y=yaw+config.bottle.rotationY}})
  if(studio){
    const picker=new THREE.Raycaster();picker.layers.enable(6);picker.layers.enable(7)
    const ndc=new THREE.Vector2()
    let brushDragging=false,lastBrushX=0,lastBrushY=0
    hero.addEventListener('pointerdown',e=>{
      if(e.button!==0||!garden||(e.target as HTMLElement).closest('.creator-sphere-handle')||!studio.isSphereEditing()&&!studio.isBrushActive())return
      const rect=hero.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height
      if(studio.isBrushActive()){brushDragging=true;lastBrushX=x;lastBrushY=y;studio.brushAt(x,y);hero.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();return}
      ndc.set(x*2-1,1-y*2);picker.setFromCamera(ndc,camera)
      const found=picker.intersectObjects(garden.spheres.map(s=>s.mesh),false)[0]
      if(!found)return
      const i=garden.spheres.findIndex(s=>s.mesh===found.object);if(i<0)return
      const sphere=garden.spheres[i],id=sphere.id
      if(!config.spheres[id])config.spheres[id]={x:sphere.home.x,y:sphere.home.y,z:sphere.home.z,scale:sphere.mesh.scale.x,rotationY:sphere.mesh.rotation.y}
      if(config.spheres[id].locked)return
      studio.snapshot();studio.selectSphere(id)
      sphereDragging={id,startX:e.clientX,startY:e.clientY,home:sphere.home.clone()}
      hero.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation()
    },true)
    hero.addEventListener('pointermove',e=>{
      if(brushDragging){const rect=hero.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;if(Math.hypot(x-lastBrushX,y-lastBrushY)>.015){studio.brushAt(x,y,false);lastBrushX=x;lastBrushY=y}e.stopPropagation();return}
      if(!sphereDragging||!garden)return
      const sphere=garden.spheres.find(s=>s.id===sphereDragging!.id);if(!sphere)return
      const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-sphereDragging.home.z)
      const dx=(e.clientX-sphereDragging.startX)/hero.clientWidth*viewHeight*camera.aspect
      const dy=-(e.clientY-sphereDragging.startY)/hero.clientHeight*viewHeight
      sphere.home.copy(sphereDragging.home).add(new THREE.Vector3(dx,dy,0))
      sphere.mesh.position.copy(sphere.home)
      const transform=config.spheres[sphereDragging.id] as SphereTransform
      transform.x=sphere.home.x;transform.y=sphere.home.y
      studio.selectSphere(sphereDragging.id);studio.save()
      garden.sphereMove(sphere.home,Math.min(Math.hypot(dx,dy)*15,5),transform.interaction??1,transform.movementDamping??7)
      e.stopPropagation()
    },true)
    const releaseSphere=()=>{sphereDragging=undefined;brushDragging=false}
    hero.addEventListener('pointerup',releaseSphere,true);hero.addEventListener('pointercancel',releaseSphere,true)
  }
  hero.addEventListener('pointermove',e=>{const b=hero.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*2-1,y=1-(e.clientY-b.top)/b.height*2
    const now=performance.now(),delta=Math.max((now-lastPointerTime)/1000,.016)
    const speed=Math.min(Math.hypot(x-lastPointer.x,y-lastPointer.y)/delta,5)
    garden?.pointer(x,y,speed);lastPointer.set(x,y);lastPointerTime=now})
  hero.addEventListener('pointerleave',()=>garden?.leave())
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting},{threshold:.02});observer.observe(hero)
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);showError('Graphics context lost')})
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload())

  const gltf=await new GLTFLoader().loadAsync(new URL('../Public/Assets/Models/nocturne-bottle.glb',import.meta.url).href)
  stage.configure(gltf.scene)
  const bounds=new THREE.Box3().setFromObject(gltf.scene);bottleSize=bounds.getSize(new THREE.Vector3())
  gltf.scene.position.sub(bounds.getCenter(new THREE.Vector3()));root.add(gltf.scene);applyConfig()
  target.hidden=false;status.hidden=true;hero.dataset.state='ready'
  let frameCount=0,slowFrames=0,activeTime=0
  renderer.setAnimationLoop(now=>{
    const delta=previousTime?Math.min((now-previousTime)/1000,.05):1/60;previousTime=now
    if(document.hidden||!inView)return
    activeTime+=delta
    if(!dragging){const decay=Math.exp(-delta*(config.bottle.damping*(1.5-config.bottle.inertia)+config.bottle.friction));velocity*=decay;pitchVelocity*=decay;if(reduced){velocity=0;pitchVelocity=0}yaw+=(velocity+(config.bottle.autoRotate?config.bottle.autoSpeed:0))*delta;pitch=THREE.MathUtils.clamp(pitch+pitchVelocity*delta,-config.bottle.verticalLimit,config.bottle.verticalLimit);root.rotation.set(config.bottle.rotationX+pitch,yaw+config.bottle.rotationY,config.bottle.rotationZ)}
    if(studio?.selectedSphereId&&garden){const selected=garden.spheres.find(s=>s.id===studio.selectedSphereId);if(selected){const projection=selected.mesh.position.clone().project(camera);const radius=selected.mesh.scale.x*hero.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-selected.mesh.position.z));studio.setSphereGizmo((projection.x+1)*hero.clientWidth/2,(1-projection.y)*hero.clientHeight/2,radius)}}else studio?.setSphereGizmo(0,0,0)
    garden?.tick(activeTime,delta,reduced);stage.render(activeTime,floor,reduced)
    frameCount++
    if(quality==='auto' && frameCount>120){if(delta>.03)slowFrames++;if(frameCount===240){if(slowFrames>85&&pixelCap>1){pixelCap=1;adaptiveLow=true;resize();rebuildGarden()}frameCount=0;slowFrames=0}}
    // Inspectable diagnostics without making the production scene mutable.
    if(frameCount%60===0){hero.dataset.rotation=yaw.toFixed(3);hero.dataset.pixelRatio=String(renderer.getPixelRatio());hero.dataset.frameMs=(delta*1000).toFixed(1)}
  })
  if(import.meta.env.DEV)Object.assign(window,{__nocturneProbe:()=>garden?.probeMoss(),__nocturneAudit:()=>({bottle:stage.audit(),bottleScale:root.scale.x,bottleGlow:stage.glow(),particles:garden?.count,rotation:yaw,renderFrames:frameCount,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),creator:creatorMode,config:studio?.config,lights:{key:key.intensity,keyColor:key.color.getHexString(),rim:rim.intensity,rimColor:rim.color.getHexString(),ambient:ambient.intensity,warm:warm.intensity},camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,fov:camera.fov},particleControls:garden?.audit(),spheres:garden?.spheres.map(s=>{const p=s.mesh.position.clone().project(camera);return{x:(p.x+1)*hero.clientWidth/2,y:(1-p.y)*hero.clientHeight/2}})})})
  window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);observer.disconnect();resizeObserver.disconnect();garden?.dispose();stage.dispose();renderer.dispose();void audio?.close()},{once:true})
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
}
start().catch(showError)
const header=app.querySelector<HTMLElement>('.site-header')!
window.addEventListener('scroll',()=>header.classList.toggle('is-scrolled',scrollY>hero.clientHeight*.85),{passive:true})
document.addEventListener('visibilitychange',()=>{if(audio&&document.hidden)void audio.suspend();else if(audio&&music.getAttribute('aria-pressed')==='true')void audio.resume()})
