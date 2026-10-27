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
    assert.equal(await page.evaluate(()=>lastEditorConfig.actions[0].action),'more-info');
    await page.locator('soft-home-card-editor select[data-field=device]').selectOption('pendant_light');
    assert.equal(await page.evaluate(()=>lastEditorConfig.device),'pendant_light');
    assert.equal(await page.evaluate(()=>lastEditorConfig.entity),undefined);
    assert.equal(await page.evaluate(()=>lastEditorConfig.actions),undefined);
    await page.locator('#editor-close').click();
  });
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  const editor=page.locator('soft-home-card-editor');
  const picker=field=>editor.locator(`soft-home-picker[data-field="${field}"]`);
  await check('new card stub opens without silently binding an unrelated light',async()=>{
    assert.equal(await page.evaluate(()=>{const C=customElements.get('soft-home-card'),c=new C();c.setConfig(C.getStubConfig(mock));return c._config.entity;}),undefined);
  });
  await check('washer device picker filters by type and scopes every parameter to one washer',async()=>{
    await page.getByRole('button',{name:'打开可视化编辑器'}).click();
    await editor.locator('select[data-field=device]').selectOption('washing_machine');
    await picker('_scope').getByRole('combobox').click();
    assert.equal(await picker('_scope').getByRole('option').count(),2);
    await picker('_scope').getByRole('combobox').fill('阳台');
    assert.equal(await picker('_scope').getByRole('option').count(),1);
    await picker('_scope').getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.device_id),'demo_washing_machine');
    assert.equal(await page.evaluate(()=>lastEditorConfig.entity),'sensor.washer');
    assert.equal(await page.evaluate(()=>[...document.querySelector('soft-home-card-editor').shadowRoot.querySelectorAll('soft-home-picker')].filter(p=>p.dataset.field!=='_scope').every(p=>p._items.every(x=>mock.entities[x.value].device_id==='demo_washing_machine'))),true);
    await editor.locator('details[data-section=readings] summary').click();
  });
  await check('parameter search accepts Chinese and IDs, keyboard selection, clear and HA feedback',async()=>{
    const p=picker('primary_entity'),input=p.getByRole('combobox');
    await input.fill('剩余');assert.equal(await p.getByRole('option').count(),1);
    await input.press('ArrowDown');await input.press('Enter');
    assert.equal(await page.evaluate(()=>lastEditorConfig.primary_entity),'sensor.remaining');
    await input.click();await input.fill('SENSOR.POWER');
    assert.equal(await p.getByRole('option').count(),1);
    assert.equal(await page.evaluate(()=>lastEditorConfig.primary_entity),'sensor.remaining','typing does not emit partial IDs');
    await page.evaluate(()=>{const e=document.querySelector('soft-home-card-editor');e.hass={...mock};e.setConfig({...lastEditorConfig});});
    assert.equal(await input.inputValue(),'SENSOR.POWER');
    await input.press('ArrowUp');await input.press('Enter');
    assert.equal(await page.evaluate(()=>lastEditorConfig.primary_entity),'sensor.power');
    await p.getByRole('button',{name:'清除剩余时间 / 主读数'}).click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.primary_entity),undefined);
    await input.click();await input.fill('light.wall');assert.equal(await p.getByRole('option').count(),0);
    await input.press('Escape');
  });
  await check('optional rows keep names entered before entities and survive sparse deletion',async()=>{
    await editor.locator('details[data-section=metrics] summary').click();
    const title=editor.locator('input[data-field="metrics.1.name"]');await title.fill('剩余分钟');await title.dispatchEvent('change');
    await picker('metrics.1.entity').getByRole('combobox').fill('remaining');await picker('metrics.1.entity').getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.metrics[0].name),'剩余分钟');
    await picker('metrics.0.entity').getByRole('combobox').fill('sensor.power');await picker('metrics.0.entity').getByRole('option').click();
    await picker('metrics.0.entity').getByRole('button',{name:'清除指标 1：实体'}).click();
    await title.fill('倒计时');await title.dispatchEvent('change');
    assert.deepEqual(await page.evaluate(()=>lastEditorConfig.metrics),[{name:'倒计时',entity:'sensor.remaining'}]);
  });
  await check('switching physical washer clears previous readings and actions',async()=>{
    await picker('_scope').getByRole('combobox').fill('次卧');await picker('_scope').getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.device_id),'washer_two');
    assert.equal(await page.evaluate(()=>lastEditorConfig.metrics),undefined);
    await picker('primary_entity').getByRole('combobox').fill('remaining');
    assert.equal(await picker('primary_entity').getByRole('option').count(),1);
    assert.match(await picker('primary_entity').getByRole('option').innerText(),/sensor.remaining_two/);
    await picker('primary_entity').getByRole('combobox').press('Escape');
    await picker('_scope').getByRole('combobox').fill('阳台');await picker('_scope').getByRole('option').click();
    await picker('primary_entity').getByRole('combobox').fill('剩余');
    await page.locator('#editor-dialog').screenshot({path:path.join(root,'test-results/editor-search.png')});
    await page.setViewportSize({width:360,height:900});
    assert.equal(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
    await page.locator('#editor-dialog').screenshot({path:path.join(root,'test-results/editor-mobile.png')});
    await page.setViewportSize({width:1440,height:1000});await page.locator('#editor-close').click();
  });
  await check('registry loads asynchronously once; rejected registry uses safe fallback',async()=>{
    const result=await page.evaluate(async()=>{
      const make=async(fail)=>{
        let calls=0;const e=document.createElement('soft-home-card-editor');document.body.append(e);
        e.setConfig({device:'washing_machine',entity:'sensor.washer'});
        const h={...mock,entities:undefined,devices:undefined,callWS:async({type})=>{calls++;if(fail)throw new Error('not permitted');return Object.values(type.includes('entity_registry')?mock.entities:mock.devices);}};
        e.hass=h;await new Promise(r=>setTimeout(r,50));e.hass={...h};
        const p=e.shadowRoot.querySelector('[data-field=primary_entity]');const items=p._items.map(x=>x.value);e.remove();return {calls,items};
      };return {loaded:await make(false),fallback:await make(true)};
    });
    assert.equal(result.loaded.calls,2);assert.ok(result.loaded.items.includes('sensor.remaining'));
    assert.equal(result.fallback.calls,2);assert.deepEqual(result.fallback.items,['sensor.washer']);
  });
  await check('manual device discovery expands devices while keeping parameters scoped',async()=>{
    await page.evaluate(()=>{
      const e=document.querySelector('soft-home-card-editor');
      const h={...mock,states:{...mock.states,'sensor.opaque':{state:'20',attributes:{friendly_name:'参数 A'}}},entities:{...mock.entities,'sensor.opaque':{entity_id:'sensor.opaque',device_id:'opaque'}},devices:{...mock.devices,opaque:{id:'opaque',name:'X100'}}};
      e.hass=h;e.setConfig({device:'washing_machine'});
    });
    await page.getByRole('button',{name:'打开可视化编辑器'}).click();
    await picker('_scope').getByRole('combobox').fill('X100');assert.equal(await picker('_scope').getByRole('option').count(),0);
    await editor.locator('input[data-field=_showAll]').check();
    await picker('_scope').getByRole('combobox').fill('X100');await picker('_scope').getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.device_id),'opaque');
    await picker('entity').getByRole('combobox').click();
    assert.equal(await picker('entity').getByRole('option').count(),1);
    assert.match(await picker('entity').getByRole('option').innerText(),/sensor.opaque/);
    await page.locator('#editor-close').click();
  });
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
