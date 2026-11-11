import * as THREE from 'three'
import { studioEnvironment } from './bottle-rendering'
import type { StudioConfig } from './studio-config'

export const WORLD = 6
const CORE = 1, LIQUID = 2, GLASS = 3, LETTERS = 4
const screenVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`

/** The original nested transmission pipeline, with the live garden in both
 * optical buffers. All render targets stay linear until the final film pass. */
export function createOpticalStage(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const environment = studioEnvironment(renderer)
  scene.environment = environment.texture
  const options = { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true }
  const backdrop = new THREE.WebGLRenderTarget(1, 1, options)
  const interior = new THREE.WebGLRenderTarget(1, 1, options)
  const image = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  image.depthTexture = new THREE.DepthTexture(1, 1)
  const liquidDepth = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  const glassDepth = liquidDepth.clone()
  const size = { value: new THREE.Vector2() }
  const time = { value: 0 }
  const floor = { value: 0.26 }
  const depth = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying float z;void main(){vec4 p=modelViewMatrix*vec4(position,1.);z=-p.z;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying float z;void main(){gl_FragColor=vec4(z,0.,0.,1.);}`,
  })
  const sky = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { time, floorLine: floor, aspect: { value: 2 }, opticalFill: { value: 0 }, mistDensity:{value:0},mistColor:{value:new THREE.Color('#101c1e')} }, vertexShader: screenVertex,
    fragmentShader: `
      varying vec2 vUv; uniform float time, floorLine, aspect,opticalFill,mistDensity; uniform vec3 mistColor;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec2 p=vUv; float t=time*.012;
        float mist=noise(p*vec2(5.,9.)+t)*.55+noise(p*vec2(13.,22.)-t)*.25;
        float blue=exp(-length((p-vec2(.66,1.05))*vec2(2.8,2.1))*3.);
        float gold=exp(-length((p-vec2(.50,.43))*vec2(6.,5.))*2.4);
        vec3 c=vec3(.003,.005,.004)+skyBlue*blue*(.7+mist*mistStrength)*skyGlow;
        c+=skyGold*gold*(.65+mist*.5)*skyGlow;
        float shaft=pow(max(0.,1.-abs(p.x+.55*p.y-.98)*5.),14.);
        c+=vec3(.025,.047,.057)*shaft*mist;
        c=mix(c,mistColor,clamp(mistDensity*mist*.35,0.,.75));
        float wet=1.-smoothstep(floorLine-.015,floorLine+.025,p.y);
        c=mix(c,vec3(.009,.012,.011),wet*.72);
        // A diffuse studio transmission card: the real-time analogue of the
        // backlit scrim used to photograph clear glass. Only in optical capture.
        vec2 card=(p-vec2(.5,.51))*vec2(7.,3.4);
        c+=vec3(.88,.63,.34)*exp(-dot(card,card)*1.6)*opticalFill;
        gl_FragColor=vec4(c,1.);
      }`,
  })
  const copy = new THREE.MeshBasicMaterial({ map: backdrop.texture, depthTest: false, depthWrite: false, toneMapped: false })
  const film = new THREE.ShaderMaterial({
    uniforms: { frame: { value: image.texture }, depthMap: { value: image.depthTexture }, bottleMask: { value: glassDepth.texture }, bottleGlow: { value: 0 }, size, time, floor,
      near: { value: camera.near }, far: { value: camera.far }, focus: { value: 5 }, softness: { value: 1 }, grade: { value: new THREE.Vector4(1,1,1,0) }, glowAmount: { value: 1 }, brushCount:{value:0},brushes:{value:Array.from({length:64},()=>new THREE.Vector4())},brushKinds:{value:new Float32Array(64)} },
    vertexShader: screenVertex, depthTest: false, depthWrite: false,
    fragmentShader: `
      uniform sampler2D frame,depthMap,bottleMask; uniform vec2 size;
      uniform float time,floor,near,far,focus,softness,glowAmount,bottleGlow; uniform vec4 grade; varying vec2 vUv;
      uniform int brushCount; uniform vec4 brushes[64];uniform float brushKinds[64];
      float distanceAt(vec2 p){float d=texture2D(depthMap,p).x;return near*far/(far-d*(far-near));}
      vec3 softImage(vec2 p,float r){
        vec2 t=r/size; vec3 c=texture2D(frame,p).rgb*.24;
        c+=(texture2D(frame,p+vec2(t.x,0)).rgb+texture2D(frame,p-vec2(t.x,0)).rgb+texture2D(frame,p+vec2(0,t.y)).rgb+texture2D(frame,p-vec2(0,t.y)).rgb)*.12;
        c+=(texture2D(frame,p+t*.707).rgb+texture2D(frame,p-t*.707).rgb+texture2D(frame,p+vec2(t.x,-t.y)*.707).rgb+texture2D(frame,p+vec2(-t.x,t.y)*.707).rgb)*.07;
        return c;
      }
      void main(){
        vec2 p=vUv; float dist=distanceAt(p);
        float coc=clamp((focus-dist-.6)*9.,0.,18.)*softness;
        vec3 c=softImage(p,coc);
        float below=max(floor-p.y,0.);
        // Reflect the bottle silhouette only. The garden and wide amber
        // backdrop used to produce a bright rectangular pool behind the copy.
        float ripple=sin(p.y*700.+time*.35)*.00012;
        vec2 mirror=vec2(p.x+ripple,floor+below*.85);
        vec2 texel=1./size;
        float reflectedBottle=step(.01,texture2D(bottleMask,mirror).r)*.5;
        reflectedBottle+=step(.01,texture2D(bottleMask,mirror+vec2(3.,0.)*texel).r)*.125;
        reflectedBottle+=step(.01,texture2D(bottleMask,mirror-vec2(3.,0.)*texel).r)*.125;
        reflectedBottle+=step(.01,texture2D(bottleMask,mirror+vec2(0.,3.)*texel).r)*.125;
        reflectedBottle+=step(.01,texture2D(bottleMask,mirror-vec2(0.,3.)*texel).r)*.125;
        float reflectionFade=exp(-below*16.)*step(p.y,floor)*reflectedBottle;
        vec3 reflected=softImage(mirror,3.+below*12.);
        c=mix(c,reflected*vec3(.30,.25,.20),reflectionFade*.48);
        // Restrained local bloom preserves dark surround and avoids white clipping.
        vec3 halo=max(softImage(p,5.)-.9,0.)*.065+max(softImage(p,12.)-1.3,0.)*.035;
        c+=halo*glowAmount;
        if(bottleGlow>0.){
          float around=0.;
          for(int j=0;j<8;j++){
            float angle=float(j)*.785398;
            vec2 direction=vec2(cos(angle),sin(angle))/size;
            around+=step(.01,texture2D(bottleMask,p+direction*12.).r);
            around+=step(.01,texture2D(bottleMask,p+direction*26.).r)*.4;
          }
          float outside=1.-step(.01,texture2D(bottleMask,p).r);
          c+=vec3(.16,.10,.045)*bottleGlow*outside*around/8.;
        }
        float luma=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(luma),c,grade.y);
        c=(c-.5)*grade.z+.5;
        c*=grade.x;
        c.r+=grade.w*.10; c.b-=grade.w*.08;
        for(int i=0;i<64;i++){
          if(i>=brushCount)break;
          vec4 b=brushes[i];float weight=exp(-dot((p-b.xy)*vec2(size.x/size.y,1.),(p-b.xy)*vec2(size.x/size.y,1.))*2./max(b.z*b.z,.0001))*b.w;
          float l=dot(c,vec3(.2126,.7152,.0722));
          if(brushKinds[i]<.5)c=mix(c,c.gbr,weight*.7);
          else if(brushKinds[i]<1.5)c=mix(c,vec3(l)+(c-vec3(l))*1.8,weight);
          else if(brushKinds[i]<2.5)c+=vec3(.12,.045,-.035)*weight;
          else if(brushKinds[i]<3.5)c+=max(softImage(p,9.)-.25,0.)*weight*.35;
          else c+=vec3(.18)*weight;
        }
        c*=1.-.36*pow(length((p-.5)*vec2(1.1,.8)),1.7);
        c=shiftHue(c,globalHue*6.2831853);
        c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,globalSaturation);
        c=(c-.18)*contrast+.18;c*=brightness;
        c*=vec3(1.+temperature*.2+(warmth-1.)*.18,1.,1.-temperature*.2-(warmth-1.)*.12);
        c+=max(c-.8,0.)*(highlight-1.);
        // Creator brush strokes are localized screen-space color grades.
        for(int i=0;i<64;i++){if(i>=strokeCount)break;
          vec4 a=strokeData[i],e=strokeEffects[i];float d=distance(p,a.xy)/max(a.z,.001);
          float mask=(1.-smoothstep(max(0.,1.-e.z),1.,d))*a.w*e.y;
          if(e.x<.5)c=shiftHue(c,mask*e.w);
          else if(e.x<1.5)c=mix(c,vec3(dot(c,vec3(.299,.587,.114))),-mask*e.w);
          else if(e.x<2.5)c*=1.+mask*e.w;
          else if(e.x<3.5)c*=vec3(1.+mask*e.w*.25,1.,1.-mask*e.w*.18);
          else c+=max(c-.15,0.)*mask*e.w*.35;
        }
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const quad = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(new THREE.PlaneGeometry(2, 2), sky)
  quad.frustumCulled = false
  const screen = new THREE.Scene(); screen.add(quad)
  const screenCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1)
  const meshes: THREE.Mesh[] = []
  const bottleReflection = { value: 1 }

  function transmission(material: THREE.MeshPhysicalMaterial, source: THREE.Texture, role: string) {
    material.onBeforeCompile = shader => {
      shader.uniforms.opticalMap = { value: source }
      shader.uniforms.opticalSize = size
      shader.uniforms.backDepth = { value: role === 'liquid' ? liquidDepth.texture : glassDepth.texture }
      if(role==='glass'||role==='cap')shader.uniforms.bottleReflection=bottleReflection
      let pars = THREE.ShaderChunk.transmission_pars_fragment
        .replaceAll('transmissionSamplerMap', 'opticalMap').replaceAll('transmissionSamplerSize', 'opticalSize')
      if(role==='liquid') pars=pars.replace('vec3 attenuatedColor = transmittance * transmittedLight.rgb;',`
        // Bounded single-scattering fill through the liquid. Beer attenuation
        // still follows the measured optical path, preserving its clear edges.
        vec3 backlight=vec3(.36,.27,.16)*(.45+.55*(1.-exp(-thickness*8.)))*(.8+.2*abs(n.x));
        vec3 attenuatedColor=transmittance*(transmittedLight.rgb+backlight);
      `)
      if(role==='cap') pars=pars.replace('vec3 attenuatedColor = transmittance * transmittedLight.rgb;',`
        vec3 interiorLight=vec3(0.);
        #ifdef ENVMAP_TYPE_CUBE_UV
          vec3 ray=refract(-v,n,1./ior);
          interiorLight=textureCubeUV(envMap,ray,.09).rgb*.22;
          interiorLight+=textureCubeUV(envMap,reflect(ray,n),.07).rgb*.12;
        #endif
        vec3 attenuatedColor=transmittance*(transmittedLight.rgb+interiorLight+vec3(.014,.01,.006));
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float localHeight;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nlocalHeight=position.y;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float localHeight;\nuniform float bottleReflection;')
        .replace('#include <transmission_pars_fragment>', pars+'\nuniform sampler2D backDepth;\n')
        .replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;', `
          float backZ=texture2D(backDepth,gl_FragCoord.xy/opticalSize).r;
          float scale=max(length(modelMatrix[0].xyz),.0001);
          float path=max(backZ-vViewPosition.z,0.)/scale;
          material.thickness=${role === 'liquid' ? 'clamp(path,.005,.38)' : role === 'cap' ? 'clamp(path,.025,.24)' : 'clamp(path*.12,.014,.065)+.065*(1.-smoothstep(.08,.23,localHeight))'};
        `))
      if(role==='glass'||role==='cap')shader.fragmentShader=shader.fragmentShader.replace(
        'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',
        'vec3 totalSpecular = (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * bottleReflection;'
      )
    }
    material.customProgramCacheKey = () => 'garden-optics-v3-'+role
  }

  function configure(bottle: THREE.Object3D) {
    const originals = new Set<THREE.Material>()
    const facets: {parent:THREE.Mesh,edges:THREE.LineSegments}[]=[]
    bottle.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const source = object.material as THREE.Material
      originals.add(source)
      const name = source.name
      if (name.startsWith('Cap central facet')) { object.visible = false; return }
      const role = name.includes('bottle glass') ? 'glass' : name.includes('Crystal cap') ? 'cap'
        : name.includes('Amber extrait') ? 'liquid' : name.includes('hardware') ? 'gold'
          : name.includes('lettering') ? 'lettering' : name.includes('Meniscus') ? 'meniscus' : 'tube'
      const material = new THREE.MeshPhysicalMaterial({ name, roughness: .04, color: '#ffffff' })
      if (role === 'glass' || role === 'cap') {
        Object.assign(material, { transmission: 1, ior: 1.52, thickness: .05, roughness: role === 'cap' ? .012 : .022,
          attenuationDistance: 8, envMapIntensity: 1.15 })
        material.attenuationColor.set('#ffefdb')
        transmission(material, role === 'glass' ? interior.texture : backdrop.texture, role)
        if(role==='cap') {
          material.flatShading=true
          const edges=new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry,12),new THREE.LineBasicMaterial({color:'#e5bd85',transparent:true,opacity:.4,depthWrite:false}))
          edges.scale.setScalar(1.001);edges.layers.set(7);edges.name='Crystal facet bevel highlights'
          facets.push({parent:object,edges})
        }
      } else if (role === 'liquid') {
        Object.assign(material, { transmission: 1, ior: 1.36, thickness: .3, attenuationDistance: .32, roughness: .045, specularIntensity: .3 })
        material.color.set('#fff8e8'); material.attenuationColor.set('#e8bd77')
        transmission(material, backdrop.texture, role)
      } else if (role === 'gold') {
        material.color.set('#eac07a'); material.metalness = 1; material.roughness = .16
      } else if (role === 'lettering') {
        material.color.set('#f4dfb9'); material.metalness = .35; material.roughness = .3
        material.emissive.set('#c1a77a'); material.emissiveIntensity = .1
        material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -2
      } else if (role === 'meniscus') {
        material.color.set('#edbd69'); material.metalness = .15; material.roughness = .06
      } else {
        material.color.set('#edca91'); material.transparent = true; material.opacity = .12; material.depthWrite = false
      }
      material.userData.role = role
      object.material = material
      object.layers.set(role === 'liquid' ? LIQUID : role === 'glass' || role === 'cap' ? GLASS : role === 'lettering' ? LETTERS : CORE)
      meshes.push(object)
    })
    originals.forEach(m => m.dispose())
    facets.forEach(({parent,edges})=>parent.add(edges))
  }

  function setAppearance(config: StudioConfig) {
    const b=config.bottle
    for(const mesh of meshes){
      const material=mesh.material as THREE.MeshPhysicalMaterial
      const role=material.userData.role
      if(role==='glass'){material.color.set(b.glassTint);material.roughness=b.glassRoughness;material.ior=b.glassIor;material.transmission=b.glassTransmission}
      if(role==='cap')material.color.set(b.capTint)
      if(role==='liquid'){material.attenuationColor.set(b.liquidTint);material.attenuationDistance=b.liquidAbsorption}
      if(role==='gold')material.color.set(b.goldTint)
    }
    const a=config.atmosphere
    film.uniforms.grade.value.set(a.brightness,a.saturation,a.contrast,a.warmth)
    film.uniforms.glowAmount.value=a.glow
    sky.uniforms.mistDensity.value=a.fog;sky.uniforms.mistColor.value.set(a.fogColor)
    const strokes=config.brushes.slice(-64), vectors=film.uniforms.brushes.value as THREE.Vector4[], kinds=film.uniforms.brushKinds.value as Float32Array
    film.uniforms.brushCount.value=strokes.length
    strokes.forEach((stroke,i)=>{vectors[i].set(stroke.x,1-stroke.y,stroke.size,stroke.strength);kinds[i]=['Hue','Saturation','Warmth','Glow','Brightness'].indexOf(stroke.kind)})
  }

  function setBottleFinish(reflection:number,glow:number){
    bottleReflection.value=reflection/1.15
    for(const mesh of meshes){
      const material=mesh.material as THREE.MeshPhysicalMaterial
      if(material.userData.role==='glass'||material.userData.role==='cap')material.envMapIntensity=reflection
    }
    film.uniforms.bottleGlow.value=glow
  }

  function resize() {
    const next = renderer.getDrawingBufferSize(new THREE.Vector2())
    if (next.equals(size.value)) return
    size.value.copy(next)
    for (const t of [backdrop,interior,image,liquidDepth,glassDepth]) t.setSize(next.x,next.y)
    sky.uniforms.aspect.value = camera.aspect
  }
  function render(seconds: number, floorY: number, reducedMotion: boolean) {
    resize(); time.value = reducedMotion ? 0 : seconds; floor.value = floorY
    film.uniforms.focus.value = camera.position.z
    const mask = camera.layers.mask
    renderer.autoClear = false
    renderer.setClearColor(0,1)
    scene.overrideMaterial = depth
    camera.layers.set(LIQUID)
    renderer.setRenderTarget(liquidDepth); renderer.clear(); renderer.render(scene,camera)
    camera.layers.set(GLASS)
    renderer.setRenderTarget(glassDepth); renderer.clear(); renderer.render(scene,camera)
    scene.overrideMaterial = null

    renderer.setRenderTarget(backdrop); renderer.clear()
    sky.uniforms.opticalFill.value=0
    quad.material = sky; renderer.render(screen,screenCamera)
    camera.layers.mask = 1 | (1<<CORE) | (1<<WORLD)
    renderer.render(scene,camera)

    renderer.setRenderTarget(interior); renderer.clear()
    quad.material = copy; renderer.render(screen,screenCamera)
    camera.layers.mask = 1 | (1<<LIQUID)
    renderer.render(scene,camera)

    renderer.setRenderTarget(image); renderer.clear()
    sky.uniforms.opticalFill.value=0
    quad.material = sky; renderer.render(screen,screenCamera)
    camera.layers.mask = 1 | (1<<CORE) | (1<<GLASS) | (1<<LETTERS) | (1<<WORLD) | (1<<7)
    renderer.render(scene,camera)
    renderer.setRenderTarget(null); renderer.clear()
    quad.material = film; renderer.render(screen,screenCamera)
    camera.layers.mask = mask
    renderer.autoClear = true
  }
  return { configure, render, setAppearance, setBottleFinish, transmission, backdrop: backdrop.texture,
    glow:()=>film.uniforms.bottleGlow.value as number,
    audit: () => meshes.map(m => { const mat=m.material as THREE.MeshPhysicalMaterial; return {
      name:m.name,role:mat.userData.role,transmission:mat.transmission,ior:mat.ior,roughness:mat.roughness,metalness:mat.metalness,
      color:mat.color.getHexString(),attenuationColor:mat.attenuationColor.getHexString(),reflection:mat.envMapIntensity,
    } }),
    dispose: () => { environment.dispose(); [backdrop,interior,image,liquidDepth,glassDepth].forEach(t=>t.dispose());
      [depth,sky,copy,film].forEach(m=>m.dispose()); quad.geometry.dispose() },
  }
}
