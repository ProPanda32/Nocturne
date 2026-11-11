import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { WORLD } from './optical-stage'
import type { StudioConfig, SphereTransform } from './studio-config'

export function seeded(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15,1 | seed);
    t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
type Stage = { backdrop: THREE.Texture }
const palette = ['#bc9248','#e6d7b1','#a75179','#683d72','#40522c','#d9aa71']

/** One deterministic 3D garden. Screen-space anchors are recomposed for portrait;
 * depth, real geometry and camera projection provide perspective and parallax. */
export function createGarden(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, stage: Stage, compact: boolean, density=1) {
  const root = new THREE.Group(); root.name = 'Living garden'; scene.add(root)
  const random = seeded(83107)
  const aspect = camera.aspect
  const portrait = aspect < .9
  const vh = (z: number) => 2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(camera.position.z-z)
  const world = (x: number, y: number, z: number) => {z*=config.camera.sceneDepth;return new THREE.Vector3(x*vh(z)*aspect/2,y*vh(z)/2,z)}
  const particleSettings=config.particles
  const r = (a: number,b: number) => a+(b-a)*random()
  const exclusion = portrait ? .39 : .225
  const clusters = Array.from({length: 120},(_,i) => {
    let x = r(-1.2,1.2), y = r(-.57,1.3)
    // The banks have different profiles, not mirrored wings. Their irregular
    // inner edges open around the product, then fold back across the top.
    const bankEdge=exclusion+.045+Math.sin(y*7+(x<0?1.6:.1))*.055
    if (Math.abs(x)<bankEdge) x = (x<0?-1:1)*(bankEdge+random()*.25)
    if (i<22) { x=r(-1.15,1.15); y=r(-.66,-.43); if(Math.abs(x)<exclusion) x+=(x<0?-1:1)*exclusion }
    return {x,y,z:r(-5.2,-.6),spread:r(.075,.20)}
  })
  function sample() {
    const c=clusters[Math.floor(random()*clusters.length)]
    const a=random()*Math.PI*2, d=Math.sqrt(random())*c.spread*particleSettings.cluster
    let x=c.x+Math.cos(a)*d, y=c.y+Math.sin(a)*d*1.7
    if(Math.abs(x)<exclusion && y>-.5 && y<.64) x=(x<0?-1:1)*(exclusion+random()*.12)
    return world(x*particleSettings.spread,y*particleSettings.spread,(c.z+r(-.7,.7))*particleSettings.depth)
  }
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const mossPositions:THREE.Vector3[]=[]
  const mossOffset={value:null as THREE.Texture|null}
  const mossEnabled={value:0}
  const mossStrength={value:1}
  const mossMaterial = new THREE.MeshStandardMaterial({color:'#76813d',roughness:.82,metalness:.08})
  mossMaterial.onBeforeCompile = s => {
    Object.assign(s.uniforms,{mossOffset,mossEnabled,mossStrength,hoverPointer:pointer,hoverActive:active,hoverSpeed:speed,hoverRadius:radius,hoverRepulsion:repulsion,hoverAttraction:attraction,hoverSensitivity:velocitySensitivity})
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition; attribute vec2 simRef; uniform sampler2D mossOffset; uniform float mossEnabled,mossStrength; uniform vec2 hoverPointer; uniform float hoverActive,hoverSpeed,hoverRadius,hoverRepulsion,hoverAttraction,hoverSensitivity;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmossPosition=position;')
      .replace('#include <project_vertex>',THREE.ShaderChunk.project_vertex.replace('mvPosition = instanceMatrix * mvPosition;', 'mvPosition = instanceMatrix * mvPosition; mvPosition.xyz += texture2D(mossOffset,simRef).xyz*mossEnabled*mossStrength;')+`
        vec2 hoverDelta=gl_Position.xy/max(gl_Position.w,.001)-hoverPointer;
        float hoverFalloff=exp(-dot(hoverDelta,hoverDelta)*4./max(hoverRadius*hoverRadius*.0324,.0001));
        float hoverDistance=(.022+min(hoverSpeed*hoverSensitivity,4.)*.009)*hoverActive*hoverFalloff*hoverRepulsion*mossStrength*(1.-2.*hoverAttraction);
        gl_Position.xy+=normalize(hoverDelta+vec2(.0001))*hoverDistance*gl_Position.w;`)
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float n=sin(mossPosition.x*43.)*sin(mossPosition.y*47.)*sin(mossPosition.z*39.);
        diffuseColor.rgb*=.55+.45*smoothstep(-.7,.8,n);`)
  }
  const mossCount = compact?7000:18000
  const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mossMaterial,mossCount)
  moss.name='Moss and lichen'; moss.layers.set(WORLD)
  for(let i=0;i<mossCount;i++) {
    dummy.position.copy(sample()); const size=r(.006,.024)
    mossPositions.push(dummy.position.clone())
    dummy.scale.set(size*r(.6,1.7),size*r(.6,1.5),size)
    dummy.rotation.set(r(0,6),r(0,6),r(0,6)); dummy.updateMatrix(); moss.setMatrixAt(i,dummy.matrix)
    color.setHSL(r(.17,.28),r(.25,.65),r(.02,.13)); moss.setColorAt(i,color)
  }
  root.add(moss)

  // Irregular, asymmetric woody stems and tapered leaves, with a few bead flowers.
  const branchMaterial = new THREE.MeshStandardMaterial({color:'#373827',roughness:.62,metalness:.15})
  const leafMaterial = new THREE.MeshPhysicalMaterial({color:'#879059',roughness:.38,metalness:.12,clearcoat:.6,side:THREE.DoubleSide})
  const leafGeometry = new THREE.SphereGeometry(1,5,3)
  const leafCount=compact?1700:3600
  const leaves = new THREE.InstancedMesh(leafGeometry,leafMaterial,leafCount); leaves.layers.set(WORLD); leaves.name='Wet leaves'
  let leafIndex=0
  const stems:THREE.BufferGeometry[]=[]
  for(let i=0;i<(compact?44:83);i++) {
    const c=clusters[i%clusters.length]
    const points = Array.from({length:6},(_,j)=>world(c.x+Math.sin(j*.64+i)*.07+j*(i%2?-.013:.018),c.y+j*.055,c.z+Math.sin(j)*.16))
    const curve=new THREE.CatmullRomCurve3(points)
    stems.push(new THREE.TubeGeometry(curve,18,r(.002,.006),4,false))
    for(let j=0;j<44 && leafIndex<leafCount;j++,leafIndex++) {
      const t=random(), p=curve.getPoint(t), sign=j%2?1:-1
      dummy.position.copy(p).add(new THREE.Vector3(sign*r(.015,.065),r(-.025,.03),r(-.025,.025)))
      const size=r(.015,.045)*(1-t*.45)
      dummy.scale.set(size,size*.27,size*.55); dummy.rotation.set(r(-1,1),r(-1,1),sign*r(.25,1.2))
      dummy.updateMatrix(); leaves.setMatrixAt(leafIndex,dummy.matrix)
      color.setHSL(r(.18,.30),r(.2,.55),r(.045,.17)); leaves.setColorAt(leafIndex,color)
    }
  }
  const branches=new THREE.Mesh(mergeGeometries(stems),branchMaterial)
  branches.name='Merged botanical stems';branches.layers.set(WORLD);root.add(branches)
  stems.forEach(g=>g.dispose())
  leaves.count=leafIndex; root.add(leaves)

  const pearl = new THREE.MeshPhysicalMaterial({color:'#d9c9b0',roughness:.42,metalness:.04,clearcoat:.25,specularIntensity:.55})
  pearl.onBeforeCompile = s => {
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 marbleP;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmarbleP=position;')
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 marbleP;')
      .replace('#include <color_fragment>',`#include <color_fragment>
      vec3 q=normalize(marbleP)*3.;
      float vein=abs(sin(q.x*4.+sin(q.y*5.+sin(q.z*4.))*1.8));
      float fine=1.-smoothstep(.025,.11,vein);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.12,.027),fine*.97);`)
  }
  const amber = new THREE.MeshPhysicalMaterial({color:'#f5c177',roughness:.045,metalness:.08,transmission:.87,thickness:.14,ior:1.46,attenuationColor:new THREE.Color('#ad6429'),attenuationDistance:.5})
  const pink = new THREE.MeshPhysicalMaterial({color:'#b65e90',roughness:.1,metalness:.12,transmission:.65,thickness:.12,ior:1.45,clearcoat:1})
  const glass = new THREE.MeshPhysicalMaterial({color:'#fff4e3',roughness:.025,transmission:1,thickness:.12,ior:1.45})
  // Orbs are excluded from the backdrop capture, then refract that completed
  // capture in the final pass. Never read and write the same GPU texture.
  const gardenSize={value:new THREE.Vector2(1,1)}
  for(const m of [amber,pink,glass]) {
    m.onBeforeCompile=s=>{
      s.uniforms.gardenMap={value:stage.backdrop}; s.uniforms.gardenSize=gardenSize
      m.userData.shader=s
      s.fragmentShader=s.fragmentShader.replace('#include <transmission_pars_fragment>',THREE.ShaderChunk.transmission_pars_fragment.replaceAll('transmissionSamplerMap','gardenMap').replaceAll('transmissionSamplerSize','gardenSize'))
    }
    m.customProgramCacheKey=()=> 'garden-orb'
  }
  const gold=new THREE.MeshStandardMaterial({color:'#b88b42',metalness:.94,roughness:.2})
  const mossOrb=mossMaterial.clone();mossOrb.color.set('#263813')
  mossOrb.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmossPosition=position;')
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 mossPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float n=sin(mossPosition.x*43.)*sin(mossPosition.y*47.)*sin(mossPosition.z*39.);
        diffuseColor.rgb*=.55+.45*smoothstep(-.7,.8,n);`)
  }
  const mossGeometry=new THREE.IcosahedronGeometry(1,3)
  const mossVertices=mossGeometry.attributes.position
  for(let i=0;i<mossVertices.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(mossVertices,i)
    const bump=1+.07*Math.sin(p.x*23)*Math.cos(p.y*31)*Math.sin(p.z*27)
    mossVertices.setXYZ(i,p.x*bump,p.y*bump,p.z*bump)
  }
  mossGeometry.computeVertexNormals()
  const materials=[glass,pink,amber,mossOrb,pearl,gold]
  const spheres: {id:string,mesh:THREE.Mesh,home:THREE.Vector3,phase:number}[]=[]
  const orbGeometry=new THREE.SphereGeometry(1,32,24)
  // Large accents are deliberately sparse. Depth-of-field softens these edges.
  function addSphere(sphere:SphereConfig){
    const kind=kindIndex[sphere.kind]
    const mesh=new THREE.Mesh(kind===3?mossGeometry:orbGeometry,materials[kind].clone())
    mesh.layers.set([0,1,2].includes(kind)?7:WORLD)
    mesh.name=['Clear bubble','Rose glass','Amber glass','Moss sphere','Veined pearl','Gold bead'][kind]
    root.add(mesh);spheres.push({id:String(i),mesh,home:mesh.position.clone(),phase:random()*6})
  }
  function updateSphere(sphere:SphereConfig){
    const entry=spheres.find(s=>s.id===sphere.id);if(!entry)return
    const {mesh,home}=entry;const kind=kindIndex[sphere.kind]
    if(mesh.userData.kind!==kind){(mesh.material as THREE.Material).dispose();mesh.material=materials[kind].clone();mesh.geometry=kind===3?mossGeometry:orbGeometry;mesh.layers.set([0,1,2].includes(kind)?7:WORLD);mesh.userData.kind=kind}
    const x=portrait?sphere.x*1.12:sphere.x
    home.copy(world(x,sphere.y,sphere.z));mesh.position.copy(home)
    mesh.scale.setScalar(sphere.size*(portrait?.62:1));mesh.rotation.y=THREE.MathUtils.degToRad(sphere.rotation)
    const material=mesh.material as THREE.MeshPhysicalMaterial
    material.color.set(sphere.color);material.color.offsetHSL(sphere.hue/360,0,0)
    const hsl={h:0,s:0,l:0};material.color.getHSL(hsl);material.color.setHSL(hsl.h,THREE.MathUtils.clamp(hsl.s*sphere.saturation,0,1),hsl.l)
    material.opacity=sphere.opacity;material.transparent=sphere.opacity<1||material.transmission>0
    material.ior=sphere.ior;material.roughness=sphere.roughness;material.metalness=sphere.metalness;material.envMapIntensity=sphere.reflection
    material.emissive.set(sphere.color);material.emissiveIntensity=sphere.glow
  }
  config.spheres.forEach(addSphere)

  // Thousands of small, physically shaded ground beads make the transition
  // from living banks to the reflecting water; they are not large white balls.
  const groundCount=compact?750:1800
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),new THREE.MeshStandardMaterial({roughness:.21,metalness:.68}),groundCount)
  beads.layers.set(WORLD);beads.name='Ground dew'
  for(let i=0;i<groundCount;i++) {
    const z=r(-4.8,2.8), x=r(-1.15,1.15)
    const radius=r(.004,.019)
    dummy.position.copy(world(x,0,z));dummy.position.y=-vh(0)*(portrait?.185:.248)+radius
    if(Math.abs(x)<.24 && z>-.5 && random()<.85)dummy.position.x+=(x<0?-1:1)*vh(z)*aspect*.25
    dummy.scale.setScalar(radius);dummy.updateMatrix();beads.setMatrixAt(i,dummy.matrix)
    color.set(palette[Math.floor(random()*palette.length)]).multiplyScalar(r(.35,1.2));beads.setColorAt(i,color)
  }
  root.add(beads)

  const visibleCount=Math.round((compact?96:160)**2*Math.max(.2,Math.min(1.5,density)))
  const dimension=Math.ceil(Math.sqrt(mossCount+visibleCount)), count=dimension*dimension-mossCount
  const gpu=new GPUComputationRenderer(dimension,dimension,renderer)
  const origin=gpu.createTexture(), zero=gpu.createTexture()
  const mossRefs=new Float32Array(mossCount*2)
  for(let i=0;i<mossCount;i++){
    const p=mossPositions[i];origin.image.data.set([p.x,p.y,p.z,random()*6.28],i*4)
    mossRefs.set([(i%dimension+.5)/dimension,(Math.floor(i/dimension)+.5)/dimension],i*2)
  }
  moss.geometry.setAttribute('simRef',new THREE.InstancedBufferAttribute(mossRefs,2))
  const positions=new Float32Array(count*3), refs=new Float32Array(count*2), colors=new Float32Array(count*3), sizes=new Float32Array(count)
  for(let i=0;i<count;i++) {
    let p=sample()
    if(i%5===0) {
      let x=r(-1.08,1.08),y=r(-.65,1.15)
      if(Math.abs(x)<exclusion && y>-.48&&y<.67)x+=(x<0?-1:1)*exclusion
      p=world(x,y,r(-4.8,.65))
    }
    const texel=i+mossCount
    positions.set(p.toArray(),i*3);origin.image.data.set([p.x,p.y,p.z,random()*6.28],texel*4)
    refs.set([(texel%dimension+.5)/dimension,(Math.floor(texel/dimension)+.5)/dimension],i*2)
    const botanical=Math.sin(p.x*2.1+Math.sin(p.y*3.3)+p.z*.65)
    const hue=botanical>.45?2:botanical<-.25?4:random()<.11?1:0
    color.set(hue===2?particleSettings.secondaryColor:hue===0?particleSettings.color:palette[hue]).multiplyScalar(r(.3,hue===4?1.1:2.2));colors.set(color.toArray(),i*3)
    sizes[i]=i%127===0?r(4,7):r(1.1,3.8)
  }
  const pointer={value:new THREE.Vector2(99,99)}, particleCameraEye={value:camera.position.clone()}, projectionScale={value:new THREE.Vector2()}, speed={value:0}, dt={value:1/60}, elapsed={value:0}, active={value:0}
  const repulsion={value:1}, radius={value:1}, returnStrength={value:3.8}, damping={value:3.2}, motionScale={value:1}, ambientSpeed={value:1}, attraction={value:0}, velocitySensitivity={value:1}, sphereForce={value:1}, spherePointer={value:new THREE.Vector3(99,99,0)}, sphereSpeed={value:0}
  const velocity=gpu.addVariable('velocity',`
    uniform sampler2D origins;uniform vec2 pointer,projectionScale;uniform vec3 particleCameraEye,spherePointer;uniform float dt,speed,pointerActive,repulsion,radius,returnStrength,damping,motionScale,attraction,velocitySensitivity,sphereForce,sphereSpeed;
    void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;
      vec3 p=texture2D(origins,uv).xyz;vec3 o=texture2D(offsets,uv).xyz;vec3 v=texture2D(velocity,uv).xyz;
      vec3 location=p+o;vec2 projected=(location.xy-particleCameraEye.xy)*projectionScale/max(particleCameraEye.z-location.z,.1);
      vec2 d=projected-pointer;float influence=exp(-dot(d,d)*4./max(radius*radius*.0324,.0001))*pointerActive;
      vec3 force=normalize(vec3(d.x/projectionScale.x,d.y/projectionScale.y,.0001))*influence*(1.+min(speed*velocitySensitivity*40.,18.))*repulsion*(1.-2.*attraction);
      vec3 sd=p+o-spherePointer;float si=exp(-dot(sd,sd)*4.);force+=normalize(sd+vec3(.0001))*si*sphereSpeed*sphereForce*.4;
      v+=(force-o*returnStrength)*dt*motionScale;v*=exp(-dt*damping);
      gl_FragColor=vec4(clamp(v,vec3(-2.),vec3(2.)),1.);}`,zero)
  const offsets=gpu.addVariable('offsets',`uniform float dt;void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;vec3 p=texture2D(offsets,uv).xyz;vec3 v=texture2D(velocity,uv).xyz;gl_FragColor=vec4(p+v*dt,1.);}`,zero.clone())
  gpu.setVariableDependencies(velocity,[velocity,offsets]);gpu.setVariableDependencies(offsets,[velocity,offsets])
  Object.assign(velocity.material.uniforms,{origins:{value:origin},pointer,particleCameraEye,projectionScale,speed,dt,pointerActive:active,repulsion,radius,returnStrength,damping,motionScale,attraction,velocitySensitivity,sphereForce,spherePointer,sphereSpeed})
  offsets.material.uniforms.dt=dt
  const gpuError=gpu.init()
  mossOffset.value=zero;mossEnabled.value=gpuError?0:1
  if(gpuError) console.warn('Particle simulation unavailable; using animated vertex field:',gpuError)
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    uniforms:{offsetMap:{value:zero},simulate:{value:gpuError?0:1},time:elapsed,pixelRatio:{value:renderer.getPixelRatio()},sizeMultiplier:{value:1},opacityMultiplier:{value:.92},brightnessMultiplier:{value:1},ambientSpeed,hoverPointer:pointer,hoverActive:active,hoverSpeed:speed,hoverRadius:radius,hoverRepulsion:repulsion,hoverAttraction:attraction,hoverSensitivity:velocitySensitivity},
    vertexShader:`attribute vec2 reference;attribute float beadSize;attribute vec3 tint;
      uniform sampler2D offsetMap;uniform vec2 hoverPointer;uniform float simulate,time,pixelRatio,sizeMultiplier,ambientSpeed,hoverActive,hoverSpeed,hoverRadius,hoverRepulsion,hoverAttraction,hoverSensitivity;varying vec3 vColor;varying float fog;
      void main(){vec3 p=position+texture2D(offsetMap,reference).xyz*simulate;
        p+=vec3(sin(time*ambientSpeed*.18+p.y*3.),cos(time*ambientSpeed*.13+p.x*2.),0.)*.009;
        vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;
        vec2 hoverDelta=gl_Position.xy/max(gl_Position.w,.001)-hoverPointer;
        float hoverFalloff=exp(-dot(hoverDelta,hoverDelta)*4./max(hoverRadius*hoverRadius*.0324,.0001));
        float hoverDistance=(.022+min(hoverSpeed*hoverSensitivity,4.)*.009)*hoverActive*hoverFalloff*hoverRepulsion*(1.-2.*hoverAttraction);
        gl_Position.xy+=normalize(hoverDelta+vec2(.0001))*hoverDistance*gl_Position.w;
        gl_PointSize=clamp(beadSize*sizeMultiplier*pixelRatio*5./-v.z,1.,14.);vColor=tint;fog=exp(-max(-v.z-6.,0.)*.08);}`,
    fragmentShader:`varying vec3 vColor;varying float fog;uniform float opacityMultiplier,brightnessMultiplier;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;
      float z=sqrt(1.-r);vec3 n=vec3(p,z);float diffuse=.18+.55*max(dot(n,normalize(vec3(-.6,.8,1.))),0.);
      float spec=pow(max(dot(n,normalize(vec3(-.4,.5,1.))),0.),30.);
      vec3 c=vColor*(diffuse+.18)+mix(vColor,vec3(1.3,.93,.57),.3)*spec;
      gl_FragColor=vec4(c*fog*brightnessMultiplier,(1.-smoothstep(.64,1.,r))*opacityMultiplier);}`,
  })
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('reference',new THREE.BufferAttribute(refs,2))
  geometry.setAttribute('tint',new THREE.BufferAttribute(colors,3));geometry.setAttribute('beadSize',new THREE.BufferAttribute(sizes,1))
  const particles=new THREE.Points(geometry,material);particles.layers.set(WORLD);particles.frustumCulled=false;particles.name='GPU botanical bead field';root.add(particles)
  const drawingSize=new THREE.Vector2()
  let simulationFrames=0
  function probeMoss(){
    const projection=new THREE.Vector3(), readback=new Float32Array(4), velocityReadback=new Float32Array(4)
    let index=0, nearest=Infinity
    for(let i=0;i<mossPositions.length;i++){
      projection.copy(mossPositions[i]).project(camera)
      const distance=(projection.x-.55)**2+(projection.y-.12)**2
      if(projection.z<1&&distance<nearest){nearest=distance;index=i}
    }
    projection.copy(mossPositions[index]).project(camera)
    if(!gpuError){
      renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(offsets),index%dimension,Math.floor(index/dimension),1,1,readback)
      renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(velocity),index%dimension,Math.floor(index/dimension),1,1,velocityReadback)
    }
    return {x:projection.x,y:projection.y,origin:mossPositions[index].toArray(),offset:[readback[0],readback[1],readback[2]],velocity:[velocityReadback[0],velocityReadback[1],velocityReadback[2]],pointer:[pointer.value.x,pointer.value.y],active:active.value,frames:simulationFrames,enabled:!gpuError}
  }
  const sphereMaterials={glass,pink,amber,moss:mossOrb,cream:pearl,gold}
  function syncSpheres(settings:Record<string,SphereTransform>){
    for(const [id,saved] of Object.entries(settings)){
      let sphere=spheres.find(s=>s.id===id)
      if(!sphere && id.startsWith('extra-')){
        const mesh=new THREE.Mesh(orbGeometry,glass.clone());mesh.layers.set(7);root.add(mesh)
        sphere={id,mesh,home:new THREE.Vector3(),phase:random()*6};spheres.push(sphere)
      }
      if(!sphere)continue
      const {mesh,home}=sphere;mesh.visible=!saved.deleted;mesh.userData.settings=saved
      home.set(saved.x,saved.y,saved.z);mesh.position.copy(home);mesh.scale.setScalar(saved.scale);mesh.rotation.y=saved.rotationY
      const kind=saved.material
      const desired=kind?sphereMaterials[kind]:undefined
      if(desired && kind && mesh.userData.materialKind!==kind){
        if(mesh.userData.ownMaterial)(mesh.material as THREE.Material).dispose()
        mesh.material=desired.clone();mesh.userData.ownMaterial=true;mesh.userData.materialKind=kind
        mesh.layers.set(['glass','pink','amber'].includes(kind)?7:WORLD)
      }
      if(!mesh.userData.ownMaterial){mesh.material=(mesh.material as THREE.Material).clone();mesh.userData.ownMaterial=true}
      const mat=mesh.material as THREE.MeshPhysicalMaterial
      if(saved.color)mat.color.set(saved.color)
      mat.opacity=saved.opacity??1;mat.transparent=mat.opacity<1;mat.roughness=saved.roughness??desired?.roughness??mat.roughness
      mat.metalness=saved.metalness??desired?.metalness??mat.metalness
      if('transmission' in mat){const physical=desired instanceof THREE.MeshPhysicalMaterial?desired:undefined;mat.transmission=saved.transmission??physical?.transmission??mat.transmission;mat.ior=saved.ior??physical?.ior??mat.ior}
    }
  }
  return {
    count, root, spheres, syncSpheres, probeMoss,
    audit:()=>({repulsion:repulsion.value,radius:radius.value,returnStrength:returnStrength.value,damping:damping.value,size:material.uniforms.sizeMultiplier.value,opacity:material.uniforms.opacityMultiplier.value,mossCount,mossStrength:mossStrength.value,simulatedMoss:!gpuError,simulationFrames,pointerActive:active.value,pointerX:pointer.value.x,pointerY:pointer.value.y}),
    setControls(config:StudioConfig){
      const p=config.particles
      repulsion.value=p.repulsion;radius.value=p.radius;returnStrength.value=p.returnStrength;damping.value=p.damping;motionScale.value=p.speed;ambientSpeed.value=p.ambientSpeed
      attraction.value=p.attraction;sphereForce.value=p.sphereForce;velocitySensitivity.value=p.velocitySensitivity
      mossStrength.value=p.mossStrength
      material.uniforms.sizeMultiplier.value=p.size;material.uniforms.opacityMultiplier.value=p.opacity;material.uniforms.brightnessMultiplier.value=p.brightness
    },
    pointer(x:number,y:number,movement:number){pointer.value.set(x,y);speed.value=movement;active.value=1},
    sphereMove(position:THREE.Vector3,movement:number){spherePointer.value.copy(position);sphereSpeed.value=Math.min(movement,5)},
    leave(){active.value=Math.min(active.value,.95)},
    tick(seconds:number,delta:number,reduced:boolean){
      elapsed.value=reduced?0:seconds;dt.value=Math.min(delta,.033)
      particleCameraEye.value.copy(camera.position)
      const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));projectionScale.value.set(1/(tangent*camera.aspect),1/tangent)
      material.uniforms.pixelRatio.value=renderer.getPixelRatio()
      if(!gpuError&&!reduced){gpu.compute();simulationFrames++;const texture=gpu.getCurrentRenderTarget(offsets).texture;material.uniforms.offsetMap.value=texture;mossOffset.value=texture}
      renderer.getDrawingBufferSize(drawingSize)
      gardenSize.value.copy(drawingSize)
      speed.value*=Math.exp(-delta*4)
      if(active.value<1)active.value*=Math.exp(-delta*5)
      sphereSpeed.value*=Math.exp(-delta*7)
      for(const {mesh,home,phase} of spheres){
        if(!mesh.visible)continue
        mesh.position.copy(home)
        const options=mesh.userData.settings as SphereTransform|undefined
        if(!reduced){mesh.position.y+=Math.sin(seconds*.3*(options?.floatSpeed??1)+phase)*.006;mesh.rotation.y+=delta*.015*(options?.floatSpeed??1)}
      }
    },
    dispose(){root.removeFromParent();const geometries=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();
      root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))}})
      geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());gpu.dispose();origin.dispose();zero.dispose()},
  }
}
