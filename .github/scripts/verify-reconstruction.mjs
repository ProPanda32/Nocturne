import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const browser=await chromium.launch({
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const output='.github/preview'
await mkdir(output,{recursive:true})
const errors=[]
const report=[]
const viewports=[['desktop',1580,755],['large-desktop',1920,1080],['laptop',1366,768],['tablet-landscape',1024,768],['tablet-portrait',768,1024],['phone',390,844],['small-phone',360,640]]
const waitForHero=async page=>{
  await page.locator('.site-hero[data-state="ready"]').waitFor({state:'visible',timeout:60000})
  await page.locator('.site-hero canvas').waitFor({state:'visible',timeout:60000})
  await page.locator('.bottle-drag-target').waitFor({state:'visible',timeout:60000})
  await page.waitForFunction(()=>{
    if(typeof window.__nocturneAudit!=='function')return false
    const audit=window.__nocturneAudit()
    const roles=new Set(audit.bottle?.map(material=>material.role))
    return audit.particles>0 && ['glass','liquid','cap','gold'].every(role=>roles.has(role))
  },undefined,{timeout:60000})
}
const loadHero=async(page,reload=false)=>{
  if(reload)await page.reload({waitUntil:'domcontentloaded',timeout:60000})
  else await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:60000})
  await waitForHero(page)
}
try {
  const page=await browser.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())})
  await page.setViewportSize({width:1366,height:768})
  await loadHero(page)
  const mossBefore=await page.evaluate(()=>window.__nocturneProbe())
  assert.ok(mossBefore.enabled,'Green moss must use the GPU simulation')
  const heroBox=await page.locator('.site-hero').boundingBox()
  const hoverX=heroBox.x+(mossBefore.x+1)*heroBox.width/2+24
  const hoverY=heroBox.y+(1-mossBefore.y)*heroBox.height/2
  const startFrames=await page.evaluate(()=>window.__nocturneAudit().particleControls.simulationFrames)
  await page.mouse.move(hoverX,hoverY,{steps:12})
  assert.equal(await page.evaluate(()=>window.__nocturneAudit().particleControls.pointerActive),1,'Hover must reach the particle simulation')
  await page.waitForFunction(start=>window.__nocturneAudit().particleControls.simulationFrames>=start+12,startFrames,{timeout:120000})
  const mossAfter=await page.evaluate(()=>window.__nocturneProbe())
  const movement=Math.hypot(...mossAfter.offset.map((v,i)=>v-mossBefore.offset[i]))
  assert.ok(movement>.0003,`GPU hover must displace the green particles (measured ${movement})`)
  for(const [name,width,height] of viewports){
    await page.setViewportSize({width,height})
    await loadHero(page)
    await page.waitForTimeout(1500)
    const box=await page.locator('.bottle-drag-target').boundingBox()
    const copy=await page.locator('.hero-copy').boundingBox()
    const audit=await page.evaluate(()=>window.__nocturneAudit())
    assert.ok(box && copy,'Bottle and collection text must be present')
    assert.ok(Math.abs(box.x+box.width/2-(width-15)/2)<18,'Bottle must remain centered')
    assert.ok(box.y>height*.12 && box.y+box.height<height*.80,'Bottle framing must leave space above and below')
    assert.ok(copy.y+copy.height<=height+1,'Collection hierarchy must fit on screen')
    assert.ok(copy.y>box.y+box.height-20,'Copy must not obscure the product')
    assert.equal(await page.locator('.site-hero video, .site-hero img, .site-hero iframe').count(),0,'Hero must be real-time geometry')
    const materials=new Map(audit.bottle.map(m=>[m.role,m]))
    assert.equal(materials.get('glass').transmission,1)
    assert.equal(materials.get('liquid').transmission,1)
    assert.equal(materials.get('cap').transmission,1)
    assert.equal(materials.get('gold').metalness,1)
    assert.ok(audit.particles>=9216)
    await page.screenshot({path:`${output}/${name}.png`,timeout:120000,animations:'disabled'})
    report.push({name,width,height,bottleBounds:box,copyBounds:copy,...audit})
  }
  await page.setViewportSize({width:1366,height:768})
  await loadHero(page)
  const before=await page.evaluate(()=>window.__nocturneAudit().rotation)
  const b=await page.locator('.bottle-drag-target').boundingBox()
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2)
  await page.mouse.down();await page.mouse.move(b.x+b.width/2+70,b.y+b.height/2,{steps:10});await page.mouse.up()
  assert.ok(Math.abs(await page.evaluate(()=>window.__nocturneAudit().rotation)-before)>.15,'Drag must rotate the actual GLB')
  await page.locator('.bottle-drag-target').focus()
  const keyboardBefore=await page.evaluate(()=>window.__nocturneAudit().rotation)
  await page.keyboard.press('ArrowRight')
  assert.ok(await page.evaluate(()=>window.__nocturneAudit().rotation)>keyboardBefore,'Keyboard rotation must work')
  await page.getByRole('button',{name:'Open menu',exact:true}).click()
  assert.ok(await page.locator('#menu-dialog').isVisible())
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Search Nocturne',exact:true}).click()
  await page.locator('#site-search').fill('fragrance')
  assert.equal(await page.locator('.search-results a:visible').count(),1)
  await page.keyboard.press('Escape')
  await page.emulateMedia({reducedMotion:'reduce'})
  await loadHero(page,true)
  const still=await page.evaluate(()=>window.__nocturneAudit().rotation)
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(()=>window.__nocturneAudit().rotation),still,'Reduced motion must not auto-rotate')
  assert.deepEqual(errors,[],'Browser must have no runtime or shader errors')
  await writeFile(`${output}/verification.json`,JSON.stringify({checks:'passed',errors,viewports:report},null,2))
  console.log('PASS: seven layouts, material audit, drag, keyboard, navigation, search, reduced motion, shader/runtime checks.')
} catch(error) {
  await writeFile(`${output}/verification.json`,JSON.stringify({checks:'failed',error:String(error),errors,viewports:report},null,2))
  throw error
} finally {await browser.close()}
