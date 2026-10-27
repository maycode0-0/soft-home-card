import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SOFT_HOME_PLAYWRIGHT||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const port=18124;
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,SOFT_HOME_PORT:String(port)},stdio:'pipe',windowsHide:true});
let browser;
const results=[];
try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,'preview server starts');
  browser=await chromium.launch({headless:true,executablePath:process.env.SOFT_HOME_CHROMIUM||undefined});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.cards?.length===19&&window.cards.every(c=>c.shadowRoot.querySelector('ha-card')),{},{timeout:10000}).catch(error=>{throw new Error(`${error.message}\nBrowser errors: ${errors.join('\n')}`);});
  const wait=()=>page.waitForTimeout(100);
  const evaluate=async fn=>{const value=await page.evaluate(fn);await wait();return value;};
  const check=async (name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
  await check('all 19 device illustrations render without external assets',async()=>{
    assert.equal(await page.locator('soft-home-card .hero svg').count(),19);
    assert.equal(await page.locator('soft-home-card img').count(),0);
  });
  await check('brightness commits once on change, using correct entity',async()=>{
    const before=await page.evaluate(()=>mock.calls.length);
    await evaluate(()=>{const range=cards[10].shadowRoot.querySelector('#brightness');range.value=67;range.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>mock.calls.length),before);
    await evaluate(()=>cards[10].shadowRoot.querySelector('#brightness').dispatchEvent(new Event('change',{bubbles:true})));
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'light',service:'turn_on',data:{brightness_pct:67},target:{entity_id:'light.wall'}});
  });
  await check('color temperature and climate step use native HA service fields',async()=>{
    await evaluate(()=>{const el=cards[10].shadowRoot.querySelector('#color_temperature');el.value=4500;el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).data.color_temp_kelvin),4500);
    await page.locator('soft-home-card').nth(5).getByRole('button',{name:'升高温度'}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).data.temperature),26.5);
  });
  await check('cover inversion writes back correct position and stop remains separate',async()=>{
    await evaluate(()=>{const el=cards[3].shadowRoot.querySelector('#position');el.value=75;el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).data.position),25);
    await page.locator('soft-home-card').nth(3).getByRole('button',{name:'Ⅱ 停止',exact:true}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).service),'stop_cover');
  });
  await check('more-info event bubbles with exact sensor entity',async()=>{
    await page.locator('soft-home-card').nth(17).getByRole('button',{name:'查看详情',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.lastMoreInfo),'sensor.temperature');
  });
  await check('stop stays available while an open command is awaiting acknowledgement',async()=>{
    await evaluate(()=>{window.originalService=mock.callService;mock.callService=(domain,service,data,target)=>service==='open_cover'?new Promise(resolve=>window.resolveOpen=resolve):originalService(domain,service,data,target);mock.notify();});
    await page.locator('soft-home-card').nth(3).getByRole('button',{name:'↑ 上升',exact:true}).click();await wait();
    assert.equal(await page.locator('soft-home-card').nth(3).getByRole('button',{name:'Ⅱ 停止',exact:true}).isEnabled(),true);
    await page.locator('soft-home-card').nth(3).getByRole('button',{name:'Ⅱ 停止',exact:true}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).service),'stop_cover');
    await evaluate(()=>{resolveOpen();mock.callService=originalService;mock.notify();});
  });
  await check('auxiliary toggle targets mirror defog switch',async()=>{
    await page.locator('soft-home-card').nth(16).getByRole('button',{name:'除雾',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1).target),{entity_id:'switch.defog'});
  });
  await check('offline and readonly states cannot send control calls',async()=>{
    await evaluate(()=>{window.oldLight=mock.states['light.wall'];mock.states={...mock.states,'light.wall':{...oldLight,state:'unavailable'}};mock.notify();});
    assert.equal(await page.locator('soft-home-card').nth(10).locator('input[type=range]').count(),0);
    const before=await page.evaluate(()=>mock.calls.length);
    await evaluate(()=>cards[10]._execute('brightness',()=>{throw new Error('设备离线');}));
    assert.equal(await page.evaluate(()=>mock.calls.length),before);
    await evaluate(()=>{mock.states={...mock.states,'light.wall':oldLight};cards[10].setConfig({...cards[10]._config,read_only:true});mock.notify();});
    assert.equal(await page.locator('soft-home-card').nth(10).locator('input[type=range]').count(),0);
    await evaluate(()=>cards[10].setConfig({...cards[10]._config,read_only:false}));
  });
  await check('service failure is visible and does not fabricate state',async()=>{
    const before=await page.evaluate(()=>mock.states['light.wall'].attributes.brightness);
    await evaluate(()=>{mock.rejectNext=true;const range=cards[10].shadowRoot.querySelector('#brightness');range.value=5;range.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.match(await page.locator('soft-home-card').nth(10).locator('[role=alert]').innerText(),/设备连接失败/);
    assert.equal(await page.evaluate(()=>mock.states['light.wall'].attributes.brightness),before);
  });
  await check('unrelated hass updates preserve DOM and in-progress sliders',async()=>{
    assert.equal(await page.evaluate(async()=>{const card=cards[10],element=card.shadowRoot.querySelector('.hero');card.hass={...mock};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return element===card.shadowRoot.querySelector('.hero');}),true);
    assert.equal(await page.evaluate(async()=>{const card=cards[10],input=card.shadowRoot.querySelector('#brightness');input.value=72;input.dispatchEvent(new Event('input',{bubbles:true}));mock.states={...mock.states,'light.wall':{...mock.states['light.wall'],attributes:{...mock.states['light.wall'].attributes,brightness:100}}};mock.notify();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const same=input===card.shadowRoot.querySelector('#brightness');input.dispatchEvent(new Event('change',{bubbles:true}));return same;}),true);
    await wait();
  });
  await check('user-supplied text cannot inject HTML',async()=>{
    await evaluate(()=>cards[0].setConfig({...cards[0]._config,name:'<img src=x onerror="window.injected=true">'}));
    assert.equal(await page.locator('soft-home-card').nth(0).locator('.name img').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    await evaluate(()=>cards[0].setConfig({...cards[0]._config,name:'洗衣机'}));
  });
  await check('visual editor emits config and retains advanced fields',async()=>{
    await evaluate(()=>{const editor=document.querySelector('soft-home-card-editor');editor.setConfig({...editor._config,actions:[{label:'详情',action:'more-info'}]});});
    await page.getByRole('button',{name:'打开可视化编辑器'}).click();
    await page.locator('soft-home-card-editor input[data-field=name]').fill('阅读壁灯');
    await page.locator('soft-home-card-editor input[data-field=name]').dispatchEvent('change');
    assert.equal(await page.evaluate(()=>lastEditorConfig.name),'阅读壁灯');
    await page.locator('soft-home-card-editor select[data-field=device]').selectOption('pendant_light');
    assert.equal(await page.evaluate(()=>lastEditorConfig.device),'pendant_light');
    assert.equal(await page.evaluate(()=>lastEditorConfig.actions[0].action),'more-info');
    await page.locator('#editor-close').click();
  });
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.reload();await page.waitForFunction(()=>window.cards?.length===19&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
  await page.screenshot({path:path.join(root,'test-results/desktop.png'),fullPage:true});
  await page.locator('soft-home-card').nth(10).screenshot({path:path.join(root,'test-results/light-card.png')});
  await page.locator('soft-home-card').nth(5).screenshot({path:path.join(root,'test-results/climate-card.png')});
  await check('mobile layouts fit at 360px and 280px',async()=>{
    for(const width of [360,280]){await page.setViewportSize({width,height:900});await wait();const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,cards:cards.filter(c=>{const box=c.shadowRoot.querySelector('ha-card');return box.scrollWidth>box.clientWidth+2;}).map(c=>c._config.device)}));assert.deepEqual(overflow,{body:false,cards:[]},`viewport ${width}`);}
    await page.setViewportSize({width:360,height:900});await page.screenshot({path:path.join(root,'test-results/mobile.png'),fullPage:true});
  });
  await check('dark theme follows HA themes.darkMode',async()=>{
    await page.getByRole('button',{name:'切换深色'}).click();await wait();
    assert.equal(await page.locator('soft-home-card[dark]').count(),19);
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(root,'test-results/dark.png'),fullPage:true});
    await page.locator('soft-home-card').nth(10).screenshot({path:path.join(root,'test-results/dark-light-card.png')});
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'test-results/browser-results.json'),JSON.stringify({passed:results.length,tests:results,pageErrors:errors},null,2));
  console.log(`Browser checks passed: ${results.length}`);
}finally{await browser?.close();server.kill();}
