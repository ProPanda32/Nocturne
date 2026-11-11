import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createOpticalStage } from './optical-stage'
import { createGarden } from './garden'
import { approvedConfig, readDraft } from './studio-config'
import type { StudioConfig } from './studio-config'
import './hero.css'
const creator=import.meta.env.DEV&&location.pathname.endsWith('/creator.html')
const config:StudioConfig=creator?readDraft():approvedConfig()

const icon = (path:string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
const menuIcon=icon('<path d="M3 6h18M3 12h18M3 18h18"/>')
const searchIcon=icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')
const musicIcon=icon('<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>')
const mailIcon=icon('<rect x="2" y="5" width="20" height="14" rx="1"/><path d="m3 6 9 8 9-8"/>')
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
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'})
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1
  layer.append(renderer.domElement)
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.1,40)
  camera.position.z=5
  const stage=createOpticalStage(renderer,scene,camera)
  const root=new THREE.Group();root.name='Original Nocturne flacon';scene.add(root)
  const key=new THREE.DirectionalLight('#ffdfb0',2.5);scene.add(key)
  const rim=new THREE.DirectionalLight('#ffb963',2.1);scene.add(rim)
  const moon=new THREE.DirectionalLight('#90b6d5',.65);scene.add(moon)
  const ambient=new THREE.HemisphereLight('#71848b','#342712',.25);scene.add(ambient)
  const warm=new THREE.PointLight('#ffbf69',2.2,8,2);scene.add(warm)
  let garden:ReturnType<typeof createGarden>|undefined, bottleSize:THREE.Vector3|undefined
  let floor=.25, yaw=THREE.MathUtils.degToRad(config.bottle.rotationY), pitch=THREE.MathUtils.degToRad(config.bottle.rotationX), angularVelocity=0, verticalVelocity=0, dragging=false,settling=false,lastX=0,lastY=0,lastDragTime=0,previousTime=0,inView=true,quality='auto',pixelCap=1.5,adaptiveLow=false
  let studio:Awaited<ReturnType<(typeof import('./creator-studio'))['mountStudio']>>|undefined,bottleDragStart:StudioConfig|undefined
  let lastPointer=new THREE.Vector2(), lastPointerTime=0, rebuildTimer:number|undefined
  const qualitySelect=app.querySelector<HTMLSelectElement>('#quality')!
  app.querySelector<HTMLInputElement>('#exposure')!.addEventListener('input',e=>{renderer.toneMappingExposure=Number((e.target as HTMLInputElement).value)})
  qualitySelect.addEventListener('change',()=>{quality=qualitySelect.value;adaptiveLow=false;pixelCap=quality==='low'?1:quality==='high'?2:1.5;resize();rebuildGarden()})
  app.querySelector('.reset-view')!.addEventListener('click',()=>{yaw=0;pitch=0;angularVelocity=0;verticalVelocity=0;config.bottle.rotationY=0;config.bottle.rotationX=0;applyScene();studio?.refresh()})

  function applyScene(path='all'){
    const l=config.lighting,b=config.bottle,c=config.camera
    key.color.set(l.keyColor).lerp(new THREE.Color(l.temperature>=0?'#ffb875':'#8ebcff'),Math.abs(l.temperature)*.45);key.intensity=l.key;key.position.set(l.keyX,l.keyY,l.keyZ)
    rim.color.set(l.fillColor).lerp(new THREE.Color(l.temperature>=0?'#ffc18c':'#a5c6ff'),Math.abs(l.temperature)*.3);rim.intensity=l.fill;rim.position.set(l.fillX,l.fillY,l.fillZ)
    moon.color.set(l.rimColor);moon.intensity=l.rim;moon.position.set(l.rimX,l.rimY,l.rimZ)
    warm.color.set(l.warmColor);warm.intensity=l.warm;warm.position.set(l.warmX,l.warmY,l.warmZ)
    ambient.intensity=l.ambient;scene.environmentIntensity=l.reflection
    renderer.toneMappingExposure=l.exposure
    camera.position.set(c.x,c.y,c.z);camera.rotation.set(THREE.MathUtils.degToRad(c.pitch),THREE.MathUtils.degToRad(c.yaw),THREE.MathUtils.degToRad(c.roll));camera.zoom=c.zoom
    stage.setLook(config);stage.setBottle(config)
    if(path==='all'||path==='snapshot'||path.startsWith('particles'))garden?.updateParticles(path==='snapshot'?'all':path)
    if(path==='all'||path==='snapshot'||path.startsWith('spheres'))config.spheres.forEach(s=>garden?.updateSphere(s))
    root.rotation.set(pitch,yaw,THREE.MathUtils.degToRad(b.rotationZ))
    resize()
  }

  function frame() {
    if(!bottleSize)return
    const w=hero.clientWidth,h=hero.clientHeight,portrait=w/h<.9
    const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.z
    // Reference: top 23%, base 74%, centered. Portrait gets its own framing.
    const height=portrait?(h<720?.40:.44):w/h<1.4?.49:.52
    const width=portrait?.59:w/h<1.4?.43:.29
    const scale=Math.min(viewHeight*height/bottleSize.y,viewHeight*camera.aspect*width/bottleSize.x)*config.bottle.scale*(portrait?config.camera.mobileScale:1)
    root.scale.setScalar(scale)
    root.position.set(config.bottle.x,viewHeight*(portrait?.035:.012)+config.bottle.y+viewHeight*(portrait?config.camera.mobileFraming:config.camera.framing),config.bottle.z)
    floor=.5+root.position.y/viewHeight-bottleSize.y*scale/viewHeight/2
    target.style.width=`${bottleSize.x*scale/(viewHeight*camera.aspect)*w*1.15}px`
    target.style.height=`${bottleSize.y*scale/viewHeight*h*1.06}px`
    camera.updateMatrixWorld()
    const projected=root.position.clone().project(camera)
    target.style.left=`${(projected.x+1)*50}%`
    target.style.top=`${(1-projected.y)*50}%`
    hero.style.setProperty('--copy-top',`${Math.min(82,Math.max(76,(1-floor)*100+5))}%`)
  }
  function resize() {
    const w=hero.clientWidth,h=hero.clientHeight
    camera.aspect=w/h;camera.fov=config.camera.fov+(w/h<.9?3:0);camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio,pixelCap,w<700?1.5:2))
    renderer.setSize(w,h,false);frame()
  }
  function rebuildGarden(){garden?.dispose();garden=createGarden(renderer,scene,camera,stage,hero.clientWidth<700||quality==='low'||adaptiveLow,config);hero.dataset.particles=String(garden.count)}
  resize();rebuildGarden()
  const resizeObserver=new ResizeObserver(()=>{resize();window.clearTimeout(rebuildTimer);rebuildTimer=window.setTimeout(rebuildGarden,180)})
  resizeObserver.observe(hero)

  target.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;bottleDragStart=creator?structuredClone(config):undefined;lastX=e.clientX;lastY=e.clientY;lastDragTime=e.timeStamp;angularVelocity=0;verticalVelocity=0;target.setPointerCapture(e.pointerId);target.classList.add('is-dragging')})
  target.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY,dt=Math.max((e.timeStamp-lastDragTime)/1000,1/120);lastX=e.clientX;lastY=e.clientY;lastDragTime=e.timeStamp
    const b=config.bottle;const max=b.maxRotationSpeed;yaw+=dx*b.rotationSensitivity*b.rotationSpeed;pitch=THREE.MathUtils.clamp(pitch+dy*b.verticalSensitivity*b.rotationSpeed,-THREE.MathUtils.degToRad(b.verticalLimit),THREE.MathUtils.degToRad(b.verticalLimit))
    angularVelocity=THREE.MathUtils.clamp(dx*b.rotationSensitivity*b.rotationSpeed*b.momentumSensitivity/dt,-max,max);verticalVelocity=THREE.MathUtils.clamp(dy*b.verticalSensitivity*b.rotationSpeed*b.momentumSensitivity/dt,-max,max);root.rotation.set(pitch,yaw,root.rotation.z)})
  const release=()=>{if(dragging&&creator){config.bottle.rotationY=THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(yaw)+180,360)-180;config.bottle.rotationX=THREE.MathUtils.radToDeg(pitch);if(bottleDragStart)studio?.record(bottleDragStart);studio?.refresh();settling=true}bottleDragStart=undefined;dragging=false;target.classList.remove('is-dragging')}
  target.addEventListener('pointerup',release);target.addEventListener('pointercancel',release);target.addEventListener('lostpointercapture',release)
  target.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();angularVelocity=0;yaw+=(e.key==='ArrowRight'?1:-1)*.15;root.rotation.y=yaw}})
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
  gltf.scene.position.sub(bounds.getCenter(new THREE.Vector3()));root.add(gltf.scene);frame()
  target.hidden=false;status.hidden=true;hero.dataset.state='ready';applyScene()
  if(creator){
    const {mountStudio}=await import('./creator-studio')
    const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2(),plane=new THREE.Plane(),hit=new THREE.Vector3()
    raycaster.layers.enable(6);raycaster.layers.enable(7)
    let selected:string|undefined,dragSphere:string|undefined,dragStart:StudioConfig|undefined,sphereLast=0
    const canvas=renderer.domElement
    const locate=(e:PointerEvent)=>{const bounds=canvas.getBoundingClientRect();pointerNdc.set((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2);raycaster.setFromCamera(pointerNdc,camera)}
    canvas.addEventListener('pointerdown',e=>{if(!studio?.sphereMode||e.button!==0)return;locate(e)
      const intersection=raycaster.intersectObjects(garden?.spheres.map(s=>s.mesh)||[])[0]
      if(!intersection){selected=undefined;studio?.selectSphere(undefined);return}
      const sphere=intersection.object.userData.sphereId as string;selected=sphere;studio?.selectSphere(sphere)
      if(config.spheres.find(s=>s.id===sphere)?.locked)return
      dragSphere=sphere;dragStart=structuredClone(config);sphereLast=e.timeStamp;plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),intersection.object.position);canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing'
    })
    canvas.addEventListener('pointermove',e=>{if(!dragSphere)return;locate(e);if(!raycaster.ray.intersectPlane(plane,hit))return
      const sphere=config.spheres.find(s=>s.id===dragSphere);if(!sphere)return
      const z=sphere.z,view=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-z)
      sphere.x=hit.x/(view*camera.aspect/2);sphere.y=hit.y/(view/2)
      garden?.updateSphere(sphere);garden?.moveSphere(sphere.id,Math.min(5,Math.hypot(e.movementX,e.movementY)/Math.max((e.timeStamp-sphereLast)/1000,.016)/300)*sphere.interaction);sphereLast=e.timeStamp;studio?.refreshSelection()
    })
    const endSphere=()=>{if(dragSphere&&dragStart)studio?.record(dragStart);dragSphere=undefined;dragStart=undefined;canvas.style.cursor='';studio?.persist()}
    canvas.addEventListener('pointerup',endSphere);canvas.addEventListener('pointercancel',endSphere)
    studio=mountStudio(config,{change:(path)=>{if(path==='bottle.rotationY'){yaw=THREE.MathUtils.degToRad(config.bottle.rotationY);angularVelocity=0;settling=false}if(path==='bottle.rotationX'){pitch=THREE.MathUtils.degToRad(config.bottle.rotationX);verticalVelocity=0;settling=false}
      if(path==='all'||path==='snapshot'){yaw=THREE.MathUtils.degToRad(config.bottle.rotationY);pitch=THREE.MathUtils.degToRad(config.bottle.rotationX);angularVelocity=0;verticalVelocity=0;settling=false}
      if(path.startsWith('particles.spread')||path.startsWith('particles.depth')||path.startsWith('particles.cluster')||path==='camera.sceneDepth'||path==='spheres'||path==='all')rebuildGarden();applyScene(path)},
      select:(id)=>{selected=id},selected:()=>selected,preview:(on)=>{document.body.classList.toggle('creator-preview',on)},viewport:(w,h)=>{document.body.classList.toggle('viewport-preview',!!w);hero.style.width=w?`${w}px`:'';hero.style.height=h?`${h}px`:'';resize();rebuildGarden()},
      spherePosition:(id)=>garden?.sphereWorld(id),camera,canvas})
  }
  let frameCount=0,slowFrames=0,activeTime=0
  renderer.setAnimationLoop(now=>{
    const delta=previousTime?Math.min((now-previousTime)/1000,.05):1/60;previousTime=now
    if(document.hidden||!inView)return
    activeTime+=delta
    if(!dragging){const b=config.bottle;angularVelocity*=Math.exp(-delta*(b.damping/Math.max(b.inertia,.05)+b.friction));verticalVelocity*=Math.exp(-delta*(b.damping/Math.max(b.inertia,.05)+b.friction));if(reduced){angularVelocity=0;verticalVelocity=0}
      yaw+=(angularVelocity+(b.autoRotate&&!reduced?b.autoSpeed:0))*delta;pitch=THREE.MathUtils.clamp(pitch+verticalVelocity*delta,-THREE.MathUtils.degToRad(b.verticalLimit),THREE.MathUtils.degToRad(b.verticalLimit));root.rotation.set(pitch,yaw,THREE.MathUtils.degToRad(b.rotationZ))
      if(settling&&Math.abs(angularVelocity)+Math.abs(verticalVelocity)<.005){settling=false;b.rotationY=THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(yaw)+180,360)-180;b.rotationX=THREE.MathUtils.radToDeg(pitch);studio?.persist();studio?.refresh()}}
    garden?.tick(activeTime,delta,reduced);stage.render(activeTime,floor,reduced)
    frameCount++
    if(quality==='auto' && frameCount>120){if(delta>.03)slowFrames++;if(frameCount===240){if(slowFrames>85&&pixelCap>1){pixelCap=1;adaptiveLow=true;resize();rebuildGarden()}frameCount=0;slowFrames=0}}
    // Inspectable diagnostics without making the production scene mutable.
    if(frameCount%60===0){hero.dataset.rotation=yaw.toFixed(3);hero.dataset.pixelRatio=String(renderer.getPixelRatio());hero.dataset.frameMs=(delta*1000).toFixed(1)}
  })
  if(import.meta.env.DEV)Object.assign(window,{__nocturneAudit:()=>({bottle:stage.audit(),particles:garden?.count,rotation:yaw,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),sphereCount:garden?.spheres.length,config:creator?config:undefined}),
    __nocturneStudioAudit:()=>({garden:garden?.audit(),lights:{key:key.intensity,fill:rim.intensity,rim:moon.intensity},look:stage.lookAudit(),camera:{fov:camera.fov,position:camera.position.toArray()},bottle:{glass:stage.audit().find(m=>m.role==='glass'),liquid:stage.audit().find(m=>m.role==='liquid'),angularVelocity,yaw},brushStrokes:config.brush.strokes.length,spherePixels:garden?.spheres.map(s=>{const p=s.mesh.position.clone().project(camera);return {id:s.id,x:(p.x+1)*hero.clientWidth/2,y:(1-p.y)*hero.clientHeight/2}})})})
  window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);observer.disconnect();resizeObserver.disconnect();garden?.dispose();stage.dispose();renderer.dispose();void audio?.close()},{once:true})
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
}
start().catch(showError)
const header=app.querySelector<HTMLElement>('.site-header')!
window.addEventListener('scroll',()=>header.classList.toggle('is-scrolled',scrollY>hero.clientHeight*.85),{passive:true})
document.addEventListener('visibilitychange',()=>{if(audio&&document.hidden)void audio.suspend();else if(audio&&music.getAttribute('aria-pressed')==='true')void audio.resume()})
