import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const browser=await chromium.launch({
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
try{
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'})
  await page.locator('.site-hero[data-state="ready"]').waitFor({timeout:90000})
  assert.equal(await page.locator('.bottle-controls-panel').count(),2)
  assert.equal(await page.locator('.bottle-controls-panel[open]').count(),0)
  const original=await page.evaluate(()=>window.__nocturneAudit())
  const material=(audit,role)=>audit.bottle.find(item=>item.role===role)
  const set=async(key,value)=>page.locator(`[data-bottle-setting="${key}"]`).evaluate((input,next)=>{
    input.value=String(next);input.dispatchEvent(new Event('input',{bubbles:true}))
  },value)
  await page.locator('.bottle-controls-appearance summary').click()
  await set('glassTint','#80cfee')
  await set('liquidTint','#ec6838')
  await set('scale',1.2)
  await set('clarity',.45)
  await set('reflection',2.4)
  let changed=await page.evaluate(()=>window.__nocturneAudit())
  assert.equal(material(changed,'glass').color,'80cfee')
  assert.equal(material(changed,'liquid').attenuationColor,'ec6838')
  assert.equal(material(changed,'glass').transmission,.45)
  assert.equal(material(changed,'glass').reflection,2.4)
  assert.ok(changed.bottleScale>original.bottleScale*1.19)
  await page.locator('.bottle-controls-motion summary').click()
  assert.equal(await page.locator('.bottle-controls-appearance').evaluate(e=>e.open),false)
  await set('brightness',1.4)
  await set('lightColor','#b3d3ff')
  await set('rotationSpeed',2.1)
  await set('inertia',.95)
  await set('glow',2)
  changed=await page.evaluate(()=>window.__nocturneAudit())
  assert.ok(changed.lights.key>original.lights.key*1.39)
  assert.equal(changed.lights.keyColor,'b3d3ff')
  assert.equal(changed.bottleGlow,2)
  assert.ok(await page.evaluate(()=>localStorage.getItem('nocturne.visitor.bottle.v1')),'Visitor settings must be saved')
  await page.reload({waitUntil:'domcontentloaded',timeout:120000})
  await page.locator('.site-hero[data-state="ready"]').waitFor({timeout:120000})
  changed=await page.evaluate(()=>window.__nocturneAudit())
  assert.equal(await page.locator('[data-bottle-setting="scale"]').inputValue(),'1.2')
  assert.equal(await page.locator('[data-bottle-setting="lightColor"]').inputValue(),'#b3d3ff')
  assert.equal(material(changed,'glass').color,'80cfee')
  assert.equal(material(changed,'liquid').attenuationColor,'ec6838')
  assert.equal(material(changed,'glass').reflection,2.4)
  assert.equal(changed.bottleGlow,2)
  assert.ok(changed.lights.key>original.lights.key*1.39,'Saved lighting must be restored in the scene')
  await page.locator('.bottle-controls-motion summary').click()
  const bounds=await page.locator('.bottle-drag-target').boundingBox()
  const center={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}
  await page.mouse.move(center.x,center.y)
  await page.mouse.down();await page.mouse.move(center.x+60,center.y,{steps:6});await page.mouse.up()
  assert.ok(Math.abs((await page.evaluate(()=>window.__nocturneAudit())).rotation)>.2)
  await page.locator('.bottle-controls-reset').click()
  assert.equal(await page.evaluate(()=>localStorage.getItem('nocturne.visitor.bottle.v1')),null,'Reset must clear the saved settings')
  await page.reload({waitUntil:'domcontentloaded',timeout:120000})
  await page.locator('.site-hero[data-state="ready"]').waitFor({timeout:120000})
  const reset=await page.evaluate(()=>window.__nocturneAudit())
  assert.equal(material(reset,'glass').color,material(original,'glass').color)
  assert.equal(material(reset,'liquid').attenuationColor,material(original,'liquid').attenuationColor)
  assert.equal(material(reset,'glass').transmission,1)
  assert.equal(material(reset,'glass').reflection,1.15)
  assert.equal(reset.bottleScale,original.bottleScale)
  assert.equal(reset.lights.key,original.lights.key)
  assert.equal(reset.lights.rimColor,original.lights.rimColor)
  assert.equal(reset.bottleGlow,0)
  assert.equal(reset.rotation,0)
  assert.equal(await page.locator('[data-bottle-setting="scale"]').inputValue(),'1')
  // Compare actual rendered bottle pixels, not just the material property.
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.locator('.bottle-controls-appearance summary').click()
  await page.mouse.move(5,5)
  const crop={x:Math.round(bounds.x+30),y:Math.round(bounds.y+70),width:Math.round(bounds.width-60),height:Math.round(bounds.height-140)}
  await set('reflection',0)
  await page.waitForTimeout(500)
  const matte=await page.screenshot({clip:crop,timeout:120000})
  await set('reflection',3)
  await page.waitForTimeout(500)
  const shiny=await page.screenshot({clip:crop,timeout:120000})
  const changedPixels=await page.evaluate(async ([first,second])=>{
    const read=async base64=>{
      const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode()
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
      const context=canvas.getContext('2d');context.drawImage(image,0,0)
      return context.getImageData(0,0,image.width,image.height).data
    }
    const a=await read(first),b=await read(second);let count=0
    for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>50)count++
    return count
  },[matte.toString('base64'),shiny.toString('base64')])
  assert.ok(changedPixels>300,`Reflection must visibly change the bottle; changed ${changedPixels} pixels`)
  await page.setViewportSize({width:390,height:844})
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390)
  const bottle=await page.locator('.bottle-drag-target').boundingBox()
  const left=await page.locator('.bottle-controls-appearance summary').boundingBox()
  const right=await page.locator('.bottle-controls-motion summary').boundingBox()
  assert.ok(left.x+left.width<bottle.x+bottle.width/2 && right.x>bottle.x+bottle.width/2)
  assert.deepEqual(errors,[])
  console.log(`PASS bottle controls: saved and restored settings, reset across refresh, live materials, mobile layout and ${changedPixels} reflection pixels`)
}finally{await browser.close()}
