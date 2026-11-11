import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'})
  await page.locator('.site-hero[data-state="ready"]').waitFor({timeout:60000})
  const before=await page.evaluate(()=>window.__nocturneProbe())
  assert.ok(before.enabled,'Green particles must use GPU motion')
  const box=await page.locator('.site-hero').boundingBox()
  const x=box.x+(before.x+1)*box.width/2+24
  const y=box.y+(1-before.y)*box.height/2
  const initialFrames=await page.evaluate(()=>window.__nocturneAudit().particleControls.simulationFrames)
  await page.mouse.move(x,y,{steps:12})
  assert.equal(await page.evaluate(()=>window.__nocturneAudit().particleControls.pointerActive),1,'Pointer must reach the particles')
  await page.waitForFunction(start=>window.__nocturneAudit().particleControls.simulationFrames>=start+12,initialFrames,{timeout:120000})
  const after=await page.evaluate(()=>window.__nocturneProbe())
  const motion=Math.hypot(...after.offset.map((v,i)=>v-before.offset[i]))
  console.log('Green particle probe:',JSON.stringify({before,after,motion}))
  assert.ok(motion>.0003,`GPU simulation must displace the green particle; measured ${motion}`)
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.mouse.move(5,5)
  await page.waitForTimeout(600)
  const clip={x:Math.max(0,Math.min(1366-320,Math.round(x-160))),y:Math.max(0,Math.min(768-240,Math.round(y-120))),width:320,height:240}
  const baseline=await page.screenshot({clip,timeout:120000,animations:'disabled'})
  const renderBefore=await page.evaluate(()=>window.__nocturneAudit().renderFrames)
  await page.mouse.move(x,y)
  await page.waitForFunction(start=>window.__nocturneAudit().renderFrames>=start+2,renderBefore,{timeout:60000})
  const hover=await page.screenshot({clip,timeout:120000,animations:'disabled'})
  const changedPixels=await page.evaluate(async ([a,b])=>{
    async function pixels(base64){
      const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode()
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0)
      return ctx.getImageData(0,0,image.width,image.height).data
    }
    const before=await pixels(a),after=await pixels(b);let changed=0
    for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>40)changed++
    return changed
  },[baseline.toString('base64'),hover.toString('base64')])
  assert.ok(changedPixels>150,`Hover must visibly alter the rendered scene; changed ${changedPixels} pixels`)
  assert.deepEqual(errors,[],'No shader or runtime errors')
  console.log(`PASS green particle hover displacement: ${motion.toFixed(4)} world units, ${changedPixels} visibly changed pixels`)
} finally {await browser.close()}
