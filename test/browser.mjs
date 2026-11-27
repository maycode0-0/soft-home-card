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
  await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.cards?.length===23&&window.cards.every(c=>c.shadowRoot.querySelector('ha-card')),{},{timeout:10000}).catch(error=>{throw new Error(`${error.message}\nBrowser errors: ${errors.join('\n')}`);});
  // Exercise the full, spacious control surface before checking compact disclosures.
  await page.evaluate(()=>cards.forEach(c=>c.setConfig({...c._config,compact:false})));
  await page.waitForFunction(()=>cards.every(c=>!c.hasAttribute('compact')));
  const wait=()=>page.waitForTimeout(100);
  const evaluate=async fn=>{const value=await page.evaluate(fn);await wait();return value;};
  const check=async (name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
  await check('all 23 devices render using bundled illustrations and local preview images',async()=>{
    assert.equal(await page.locator('soft-home-card ha-card').count(),23);
    assert.equal(await page.locator('soft-home-card .hero svg').count(),22);
    assert.equal(await page.locator('soft-home-card img').count(),2);
    assert.equal(await page.locator('soft-home-card .header > [data-device-info] ha-icon[icon="mdi:cog-outline"]').count(),23);
  });
  await check('running motion advances smoothly, stops on pause and respects reduced motion and viewport visibility',async()=>{
    const washer=page.locator('soft-home-card').first();
    assert.equal(await washer.locator('ha-card').getAttribute('data-motion'),'wash');
    await page.waitForFunction(()=>cards[0].shadowRoot.querySelector('.motion-drum').getAnimations()[0]?.currentTime>150);
    const time=await page.evaluate(()=>{
      const before=cards[0].shadowRoot.querySelector('.motion-drum').getAnimations()[0].currentTime;
      window.motionSaved={phase:mock.states['sensor.washer_phase'],remaining:mock.states['sensor.remaining']};
      mock.states['sensor.remaining']={...motionSaved.remaining,state:'26'};
      mock.notify();
      return before;
    });
    await washer.locator('.washer-time').filter({hasText:'26分钟'}).waitFor();
    assert.ok(await washer.locator('.motion-drum').evaluate((el,before)=>el.getAnimations()[0].currentTime>=before,time),'readout updates preserve the animation phase');
    await evaluate(()=>{mock.states['sensor.washer_phase']={...motionSaved.phase,state:'paused'};mock.notify();});
    await page.waitForFunction(()=>cards[0].shadowRoot.querySelector('ha-card').dataset.motion==='');
    assert.equal(await washer.locator('ha-card').getAttribute('data-motion'),'');
    assert.equal(await washer.locator('.motion-drum').evaluate(el=>el.getAnimations().length),0);
    await evaluate(()=>{mock.states['sensor.washer_phase']=motionSaved.phase;mock.states['sensor.remaining']=motionSaved.remaining;mock.notify();});
    await page.waitForFunction(()=>cards[0].shadowRoot.querySelector('ha-card').dataset.motion==='wash');
    await page.emulateMedia({reducedMotion:'reduce'});await wait();
    assert.equal(await washer.evaluate(el=>el.shadowRoot.getAnimations().length),0);
    await page.emulateMedia({reducedMotion:'no-preference'});await wait();
    await page.locator('soft-home-card').last().scrollIntoViewIfNeeded();await wait();
    await page.waitForFunction(()=>cards[0].hasAttribute('motion-paused'));
    assert.equal(await washer.getAttribute('motion-paused'),'');
    assert.ok(await washer.evaluate(el=>el.shadowRoot.getAnimations().every(a=>a.playState==='paused')));
    await washer.scrollIntoViewIfNeeded();await wait();
    await page.waitForFunction(()=>!cards[0].hasAttribute('motion-paused'));
    assert.equal(await washer.getAttribute('motion-paused'),null);
  });
  await check('washer has focused parameters, native entity details and real pause/power targets',async()=>{
    const card=page.locator('soft-home-card').first();
    assert.equal(await card.locator('.washer-time').innerText(),'27分钟');
    assert.equal(await card.getByRole('progressbar').getAttribute('aria-valuenow'),'72');
    await card.getByRole('button',{name:'水温：30 °C，查看详情',exact:true}).click();
    assert.equal(await page.evaluate(()=>lastMoreInfo),'select.washer_temperature');
    await card.getByRole('button',{name:'暂停洗涤',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'switch',service:'turn_off',data:{},target:{entity_id:'switch.washer_start_pause'}});
    assert.equal(await card.locator('.status').innerText(),'已暂停');
    await card.getByRole('button',{name:'启动洗涤',exact:true}).click();await wait();
    await card.getByRole('button',{name:'关闭电源',exact:true}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).target.entity_id),'switch.washer_power');
    await card.getByRole('button',{name:'开启电源',exact:true}).click();await wait();
  });
  await check('washer disclosure survives state updates and offline state does not show stale readings',async()=>{
    const card=page.locator('soft-home-card').first();
    await card.locator('.washer-details summary').click();
    await evaluate(()=>{mock.states['sensor.remaining']={...mock.states['sensor.remaining'],state:'26'};mock.notify();});
    assert.equal(await card.locator('.washer-details').getAttribute('open'),'');
    await evaluate(()=>{window.washerSaved=mock.states['sensor.washer'];mock.states['sensor.washer']={...washerSaved,state:'unavailable'};mock.notify();});
    assert.equal(await card.locator('.washer-time').innerText(),'—');
    assert.equal(await card.getByRole('progressbar').count(),0);
    assert.equal(await card.locator('[data-washer=start]').isDisabled(),true);
    assert.ok((await card.locator('.washer-safety').innerText()).includes('—'));
    await evaluate(()=>{mock.states['sensor.washer']=washerSaved;mock.states['sensor.remaining']={...mock.states['sensor.remaining'],state:'27'};mock.notify();});
    await card.locator('.washer-details summary').click();
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
  await check('washer editor keeps nested bindings while selecting and clearing individual parameters',async()=>{
    await editor.locator('details[data-section=washer] summary').click();
    const start=picker('washer.start');
    await start.getByRole('combobox').fill('switch.washer_start_pause');await start.getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.washer.start),'switch.washer_start_pause');
    const program=await page.evaluate(()=>lastEditorConfig.washer.program);
    await picker('washer.temperature').getByRole('button',{name:'清除水温'}).click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.washer.temperature),undefined);
    assert.equal(await page.evaluate(()=>lastEditorConfig.washer.program),program);
    await editor.locator('details[data-section=washer] summary').click();
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
  await page.reload();await page.waitForFunction(()=>window.cards?.length===23&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
  await page.evaluate(()=>cards.forEach(c=>c.setConfig({...c._config,compact:false})));await wait();
  await check('specialized settings, presets, curtain and vacuum commands target their bound entities',async()=>{
    await page.locator('soft-home-card').nth(10).getByRole('button',{name:'50%',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1).data),{brightness_pct:50});
    await page.locator('soft-home-card').nth(19).getByRole('button',{name:'25%',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'cover',service:'set_cover_position',data:{position:25},target:{entity_id:'cover.curtain'}});
    const ac=page.locator('soft-home-card').nth(5);
    await ac.getByRole('button',{name:'升高温度',exact:true}).focus();
    await ac.getByRole('button',{name:'升高温度',exact:true}).press('Enter');await wait();
    assert.equal(await page.evaluate(()=>cards[5].shadowRoot.activeElement?.getAttribute('aria-label')),'升高温度');
    await ac.locator('[data-device-section=settings] summary').click();
    await ac.locator('[data-feature=drying]').click();await wait();
    assert.equal(await ac.locator('[data-device-section=settings]').getAttribute('open'),'');
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).target.entity_id),'switch.ac_drying');
    const fridge=page.locator('soft-home-card').nth(6);
    await fridge.locator('[data-info="number.fridge_target"]').click();assert.equal(await page.evaluate(()=>lastMoreInfo),'number.fridge_target');
    await page.locator('soft-home-card').nth(21).getByRole('button',{name:'暂停清洁',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'vacuum',service:'pause',data:{},target:{entity_id:'vacuum.robot'}});
  });
  await check('compact door lock aligns unlock with doorbell and folds access actions',async()=>{
    const lock=page.locator('soft-home-card').nth(20);
    await evaluate(()=>{window.lockConfig=cards[20]._config;cards[20].setConfig({...lockConfig,compact:true});});
    const advanced=lock.locator('[data-device-section=access]');
    const temporaryCode=advanced.locator('[data-feature=temporary_code]');
    const authorizations=advanced.locator('[data-info="sensor.door_lock_authorizations"]');
    const controls=lock.locator('.lock-controls');
    const unlock=controls.getByRole('button',{name:'解锁',exact:true});
    const doorbell=controls.locator('[data-info="binary_sensor.door_lock_doorbell"]');
    assert.equal(await advanced.getByText('高级功能',{exact:true}).isVisible(),true);
    assert.equal(await advanced.getAttribute('open'),null);
    assert.equal(await temporaryCode.isVisible(),false);
    assert.equal(await authorizations.isVisible(),false);
    assert.equal(await lock.locator('.lock-art').count(),0);
    assert.equal(await lock.locator('.snapshot-button').isVisible(),true);
    const left=await unlock.boundingBox(),right=await doorbell.boundingBox();
    assert.ok(left&&right&&left.x+left.width<=right.x&&Math.abs(left.y-right.y)<1);
    assert.ok(Math.abs(left.width-right.width)<1&&Math.abs(left.height-right.height)<1);
    await doorbell.click();
    assert.equal(await page.evaluate(()=>lastMoreInfo),'binary_sensor.door_lock_doorbell');
    await advanced.locator('summary').press('Enter');
    await temporaryCode.click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'button',service:'press',data:{},target:{entity_id:'button.door_lock_temporary_code'}});
    assert.equal(await advanced.getAttribute('open'),'');
    await authorizations.click();
    assert.equal(await page.evaluate(()=>lastMoreInfo),'sensor.door_lock_authorizations');
    await advanced.locator('summary').click();
    await evaluate(()=>cards[20].setConfig(lockConfig));
  });
  await check('door history loads on demand and excludes reset states from opening records',async()=>{
    const lock=page.locator('soft-home-card').nth(20);
    await evaluate(()=>{
      const entity='sensor.door_lock_unlock_event';
      const original=mock.states[entity],callApi=mock.callApi;
      window.lockHistoryFixture={entity,original,callApi,requests:0};
      const reset={...original,state:'无',last_changed:new Date().toISOString()};
      mock.states[entity]=reset;
      mock.callApi=async(...args)=>{
        lockHistoryFixture.requests++;
        const [items]=await callApi(...args);
        return [[...items,{...reset,state:' None '},reset]];
      };
      mock.notify();
    });
    assert.equal(await page.evaluate(()=>lockHistoryFixture.requests),0);
    assert.equal(await lock.locator('.recent-event strong').innerText(),'—');
    assert.equal(await lock.locator('.recent-event .event-date').count(),0);
    await lock.locator('[data-history]').click();
    await lock.locator('.history-count').waitFor();
    assert.equal(await lock.locator('.history-item').count(),4);
    assert.equal(await lock.locator('.history-count').innerText(),'4');
    assert.equal(await lock.locator('.recent-event strong').innerText(),'内开');
    await evaluate(()=>{mock.states['sensor.door_lock_battery']={...mock.states['sensor.door_lock_battery'],state:'59'};mock.notify();});
    assert.equal(await lock.locator('.history-item').count(),4);
    await evaluate(()=>{
      const {entity,original,callApi}=lockHistoryFixture;
      mock.states[entity]=original;
      mock.callApi=callApi;
      mock.notify();
    });
  });
  await check('camera details, live overlay, PTZ and playback use the configured entities',async()=>{
    const camera=page.locator('soft-home-card').nth(22);
    const preview=camera.locator('.camera-preview');
    const gear=camera.locator('.header').getByRole('button',{name:'查看录像与设备详情'});
    const play=preview.getByRole('button',{name:'播放实时画面',exact:true});
    const pause=preview.getByRole('button',{name:'暂停实时画面',exact:true});
    assert.equal(await camera.locator('.status').count(),1);
    assert.equal(await preview.locator('.status').innerText(),'录像中');
    assert.equal(await play.innerText(),'');
    const frame=await preview.locator('.camera-frame').boundingBox(),button=await play.boundingBox();
    assert.ok(frame&&button&&Math.abs(frame.x+frame.width/2-button.x-button.width/2)<1);
    assert.ok(Math.abs(frame.y+frame.height/2-button.y-button.height/2)<1);
    await gear.click();assert.equal(await page.evaluate(()=>lastMoreInfo),'camera.balcony');
    await camera.locator('img[data-device-picture]').dispatchEvent('error');
    assert.equal(await camera.getByText('画面暂不可用',{exact:true}).isVisible(),true);
    await camera.getByRole('button',{name:'向左',exact:true}).click();await wait();
    assert.deepEqual(await page.evaluate(()=>mock.calls.at(-1)),{domain:'button',service:'press',data:{},target:{entity_id:'button.camera_ptz_left'}});
    await camera.locator('[data-device-section=playback] summary').click();
    await camera.locator('[data-info="date.camera_playback_date"]').click();assert.equal(await page.evaluate(()=>lastMoreInfo),'date.camera_playback_date');
    await camera.locator('[data-feature=query]').click();await wait();assert.equal(await page.evaluate(()=>mock.calls.at(-1).target.entity_id),'button.camera_query_recordings');
    await play.click();assert.equal(await page.evaluate(()=>lastMoreInfo),'camera.balcony');
    await page.evaluate(()=>customElements.define('ha-camera-stream',class extends HTMLElement{}));
    await play.click();await pause.waitFor();
    assert.equal(await page.evaluate(()=>cards[22].shadowRoot.querySelector('ha-camera-stream').stateObj.entity_id),'camera.balcony');
    assert.equal(await page.evaluate(()=>cards[22].shadowRoot.querySelector('ha-camera-stream').controls),true);
    assert.equal(await pause.locator('ha-icon').getAttribute('icon'),'mdi:pause');
    await page.mouse.move(0,0);
    assert.equal(await pause.evaluate(el=>getComputedStyle(el).opacity),'0');
    await preview.hover({position:{x:10,y:10}});
    assert.equal(await pause.evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.mouse.move(0,0);
    await gear.focus();
    await page.keyboard.press('Tab');
    assert.equal(await pause.evaluate(el=>el.getRootNode().activeElement===el&&getComputedStyle(el).opacity==='1'),true);
    await evaluate(()=>mock.notify());
    assert.equal(await page.evaluate(()=>cards[22].shadowRoot.querySelector('ha-camera-stream').hass===cards[22].hass),true);
    await page.keyboard.press('Enter');await play.waitFor();assert.equal(await camera.locator('ha-camera-stream').count(),0);
  });
  await check('ONVIF camera controls appear when PTZ loads and serialize movement',async()=>{
    const camera=page.locator('soft-home-card').nth(22);
    await evaluate(()=>{
      const entity='camera.tp_ipc_mainstream';
      const config=cards[22]._config;
      mock.states[entity]={...mock.states[config.entity],entity_id:entity,attributes:{friendly_name:'TP-IPC mainStream'}};
      mock.entities[entity]={entity_id:entity,platform:'onvif'};
      window.ptzTest={config,callService:mock.callService};
      cards[22].setConfig({device:'camera',entity});
      mock.notify();
    });
    assert.equal(await camera.locator('.ptz-pad button').count(),0);
    await evaluate(()=>{mock.services.onvif={ptz:{}};mock.notify();});
    assert.equal(await camera.locator('.ptz-pad button').count(),4);
    await page.evaluate(()=>{
      mock.callService=async function(...args){
        this.calls.push({domain:args[0],service:args[1],data:args[2],target:args[3]});
        await new Promise(resolve=>{ptzTest.finish=resolve;});
      };
      mock.notify();
      const root=cards[22].shadowRoot;
      root.querySelector('[data-feature=ptz_left]').click();
      root.querySelector('[data-feature=ptz_up]').click();
    });
    await camera.locator('[data-feature=ptz_up]:disabled').waitFor();
    assert.deepEqual(await page.evaluate(()=>mock.calls.filter(call=>call.domain==='onvif')),[
      {domain:'onvif',service:'ptz',data:{pan:'LEFT',move_mode:'ContinuousMove',distance:0.5,continuous_duration:0.4},target:{entity_id:'camera.tp_ipc_mainstream'}},
    ]);
    await evaluate(()=>{ptzTest.finish();mock.callService=ptzTest.callService;});
    assert.equal(await camera.locator('[data-feature=ptz_up]').isEnabled(),true);
    await evaluate(()=>{
      delete mock.states['camera.tp_ipc_mainstream'];delete mock.entities['camera.tp_ipc_mainstream'];delete mock.services.onvif;
      cards[22].setConfig(ptzTest.config);mock.notify();
    });
  });
  await check('new device editor binds camera roles and clears nested fields on device changes',async()=>{
    await page.getByRole('button',{name:'打开可视化编辑器'}).click();
    await editor.locator('select[data-field=device]').selectOption('camera');
    await picker('_scope').getByRole('combobox').click();await picker('_scope').getByRole('option').click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.entity),'camera.balcony');
    assert.equal(await page.evaluate(()=>lastEditorConfig.features.ptz_left),'button.camera_ptz_left');
    await editor.locator('details[data-section=features] summary').click();
    await picker('features.ptz_left').getByRole('button',{name:'清除向左'}).click();
    assert.equal(await page.evaluate(()=>lastEditorConfig.features.ptz_left),undefined);
    assert.equal(await page.evaluate(()=>lastEditorConfig.features.ptz_right),'button.camera_ptz_right');
    await editor.locator('select[data-field=onvif_ptz]').selectOption('RelativeMove');
    assert.equal(await page.evaluate(()=>lastEditorConfig.onvif_ptz),'RelativeMove');
    await editor.locator('select[data-field=device]').selectOption('curtain');
    assert.equal(await page.evaluate(()=>lastEditorConfig.features),undefined);
    assert.equal(await page.evaluate(()=>lastEditorConfig.onvif_ptz),undefined);
    await page.locator('#editor-close').click();
    await page.reload();await page.waitForFunction(()=>window.cards?.length===23&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
  });
  await page.screenshot({path:path.join(root,'test-results/desktop.png'),fullPage:true});
  await page.locator('soft-home-card').nth(10).screenshot({path:path.join(root,'test-results/light-card.png')});
  await page.locator('soft-home-card').nth(5).screenshot({path:path.join(root,'test-results/climate-card.png')});
  await check('mobile layouts fit at 360px and 280px',async()=>{
    for(const width of [360,280]){await page.setViewportSize({width,height:900});await wait();const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,cards:cards.filter(c=>{const box=c.shadowRoot.querySelector('ha-card');return box.scrollWidth>box.clientWidth+2;}).map(c=>c._config.device)}));assert.deepEqual(overflow,{body:false,cards:[]},`viewport ${width}`);}
    await page.setViewportSize({width:360,height:900});await page.screenshot({path:path.join(root,'test-results/mobile.png'),fullPage:true});
  });
  await check('dark theme follows HA themes.darkMode',async()=>{
    await page.getByRole('button',{name:'切换深色'}).click();await wait();
    assert.equal(await page.locator('soft-home-card[dark]').count(),23);
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(root,'test-results/dark.png'),fullPage:true});
    await page.locator('soft-home-card').nth(10).screenshot({path:path.join(root,'test-results/dark-light-card.png')});
  });
  await check('redesigned gallery supports dark, offline, read-only and expanded mobile settings',async()=>{
    await page.goto(`http://127.0.0.1:${port}/demo/redesign.html`);await page.waitForFunction(()=>window.cards?.length===9&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
    await page.screenshot({path:path.join(root,'test-results/redesign-preview.png'),fullPage:true});
    await page.getByRole('button',{name:'◐ 深色',exact:true}).click();await wait();
    assert.equal(await page.locator('soft-home-card[dark]').count(),9);
    await page.screenshot({path:path.join(root,'test-results/redesign-dark.png'),fullPage:true});
    await page.getByRole('button',{name:'模拟离线',exact:true}).click();await wait();
    assert.equal(await page.locator('soft-home-card [data-feature=ptz_left]').isDisabled(),true);
    assert.equal(await page.locator('soft-home-card img').count(),0);
    await page.getByRole('button',{name:'模拟离线',exact:true}).click();await wait();
    await page.getByRole('button',{name:'只读模式',exact:true}).click();await wait();
    assert.equal(await page.locator('soft-home-card [data-command]').count(),0);
    await page.getByRole('button',{name:'只读模式',exact:true}).click();await wait();
    for(const width of [375,280]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{for(const c of cards)for(const d of c.shadowRoot.querySelectorAll('details'))d.open=true;});await wait();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&cards.every(c=>{const el=c.shadowRoot.querySelector('ha-card');return el.scrollWidth<=el.clientWidth+2;})),true,`expanded gallery at ${width}px`);
    }
  });
  await check('home preview filters attention and rooms without resetting interactions or theme',async()=>{
    await page.setViewportSize({width:1440,height:1270});
    await page.goto(`http://127.0.0.1:${port}/demo/home.html`);
    await page.waitForFunction(()=>window.cards?.length===15&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
    const dimensions=await page.evaluate(()=>({columns:getComputedStyle(document.querySelector('#gallery')).gridTemplateColumns.split(' ').length,cards:cards.map(c=>({compact:c.hasAttribute('compact'),height:c.getBoundingClientRect().height}))}));
    assert.equal(dimensions.columns,4);
    assert.ok(dimensions.cards.every(c=>c.compact&&c.height<430),'compact home cards fit within 430px');
    await page.screenshot({path:path.join(root,'test-results/home-preview.png'),fullPage:true});
    await page.screenshot({path:path.join(root,'test-results/home-overview.png')});
    await page.locator('#attention').click();
    assert.equal(await page.locator('#gallery>section:visible').count(),3);
    assert.equal(await page.locator('#gallery>section:visible .availability-note.unavailable').count(),3);
    assert.equal(await page.locator('#gallery>section:visible [data-command]').count(),0);
    await page.locator('#rooms button[data-room="客厅"]').click();
    const light=page.locator('soft-home-card').filter({has:page.locator('ha-card[aria-label="幕布左边射灯"]')});
    await light.locator('[data-device-section="light-settings"] summary').click();
    await light.getByRole('button',{name:'50%',exact:true}).click();await wait();
    assert.equal(await light.locator('#brightness').inputValue(),'50');
    assert.equal(await light.locator('[data-device-section="light-settings"]').getAttribute('open'),'');
    await page.locator('#rooms button[data-room="厨房"]').click();
    assert.equal(await page.locator('#gallery>section:visible').count(),1);
    await page.locator('#rooms button[data-room="客厅"]').click();
    assert.equal(await light.locator('#brightness').inputValue(),'50');
    const callsBefore=await page.evaluate(()=>mock.calls.length);
    await page.locator('#running').click();await wait();
    await page.waitForFunction(()=>cards.some(c=>c.shadowRoot.querySelector('ha-card').dataset.motion==='wash'));
    assert.equal(await page.locator('soft-home-card ha-card[data-motion=wash]').count(),1);
    assert.equal(await page.locator('soft-home-card ha-card[data-motion=air]').count(),1);
    assert.equal(await page.locator('soft-home-card ha-card[data-motion=clean]').count(),1);
    assert.equal(await page.evaluate(()=>mock.calls.length),callsBefore);
    await page.locator('#running').click();await wait();
    await page.waitForFunction(()=>!cards.some(c=>c.shadowRoot.querySelector('ha-card').dataset.motion==='wash'));
    assert.equal(await light.locator('#brightness').inputValue(),'50');
    assert.equal(await page.locator('soft-home-card ha-card[data-motion=wash]').count(),0);
    await page.locator('#theme').click();await wait();
    assert.equal(await page.locator('soft-home-card[dark]').count(),15);
    await page.locator('#rooms button[data-room="全部"]').click();
    await page.locator('#notice').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(root,'test-results/home-dark.png'),fullPage:true});
    await page.locator('#readonly').click();await wait();
    assert.equal(await page.locator('soft-home-card [data-command]').count(),0);
    await page.locator('#readonly').click();await page.locator('#theme').click();await wait();
    for(const width of [375,768,1024,280]){
      await page.setViewportSize({width,height:900});await wait();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&cards.every(c=>{const el=c.shadowRoot.querySelector('ha-card');return el.scrollWidth<=el.clientWidth+2;})),true,`home preview at ${width}px`);
    }
    await page.setViewportSize({width:375,height:900});
    await page.reload();await page.waitForFunction(()=>window.cards?.length===15&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
    await page.screenshot({path:path.join(root,'test-results/home-mobile.png'),fullPage:true});
  });
  await check('compact controls keep real targets, preserve disclosures and retain the spacious option',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`http://127.0.0.1:${port}/demo/home.html?running=1`);
    await page.waitForFunction(()=>window.cards?.length===15&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
    const climate=page.locator('soft-home-card').first();
    assert.equal(await climate.locator('.mode-chips').isVisible(),false);
    await climate.getByRole('button',{name:'升高温度'}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).target.entity_id),'climate.preview_living');
    await climate.locator('[data-device-section="climate-settings"]>summary').click();
    await climate.locator('[data-command="mode"][data-value="heat"]').click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).data.hvac_mode),'heat');
    assert.equal(await climate.locator('[data-device-section="climate-settings"]').getAttribute('open'),'');
    const compactHeight=await climate.evaluate(el=>el.getBoundingClientRect().height);
    await page.evaluate(()=>cards[0].setConfig({...cards[0]._config,compact:false}));await wait();
    assert.equal(await climate.getAttribute('compact'),null);
    assert.equal(await climate.locator('.mode-chips').isVisible(),true);
    await page.evaluate(()=>cards[0].setConfig({...cards[0]._config,compact:true}));await wait();
    assert.ok(await climate.evaluate(el=>el.getBoundingClientRect().height)<compactHeight);
    const washer=page.locator('soft-home-card').nth(5);
    assert.equal(await washer.locator('.washer-safety').isVisible(),false);
    await washer.locator('.washer-details>summary').click();
    assert.equal(await washer.locator('.washer-safety').isVisible(),true);
    await washer.getByRole('button',{name:'暂停洗涤',exact:true}).click();await wait();
    assert.equal(await page.evaluate(()=>mock.calls.at(-1).target.entity_id),'switch.preview_washer_start');
    assert.equal(await washer.locator('.washer-details').getAttribute('open'),'');
    await page.reload();await page.waitForFunction(()=>window.cards?.length===15&&cards.every(c=>c.shadowRoot.querySelector('ha-card')));
    await page.locator('#notice').waitFor({state:'hidden'});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(root,'docs/home-compact-preview.png')});
    for(const width of [1440,1024,768,375,280]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(()=>cards.forEach(c=>c.shadowRoot.querySelectorAll('details').forEach(d=>d.open=true)));await wait();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&cards.every(c=>{const el=c.shadowRoot.querySelector('ha-card');return el.scrollWidth<=el.clientWidth+2;})),true,`expanded compact home at ${width}px`);
    }
  });
  await page.goto(`http://127.0.0.1:${port}/demo/washer.html`);
  await page.waitForFunction(()=>window.cards?.length===2&&cards.every(c=>c.shadowRoot.querySelector('.washer-card')));
  await page.locator('main').screenshot({path:path.join(root,'test-results/washer-preview.png')});
  await check('washer preview handles idle, alerts, offline and mobile themes without overflow',async()=>{
    await page.getByRole('button',{name:'待机',exact:true}).click();await wait();
    assert.equal(await page.locator('#light .washer-time').innerText(),'—');
    assert.equal(await page.getByRole('progressbar').count(),0);
    assert.equal(await page.locator('#light .status').innerText(),'待机中');
    await page.locator('#light').screenshot({path:path.join(root,'test-results/washer-idle.png')});
    await page.getByRole('button',{name:'告警',exact:true}).click();await wait();
    assert.match(await page.locator('#light .washer-alert').innerText(),/水温过高.*E21/);
    await page.getByRole('button',{name:'离线',exact:true}).click();await wait();
    assert.equal(await page.locator('#dark [data-washer=start]').isDisabled(),true);
    assert.equal(await page.locator('#dark .washer-safety').innerText().then(t=>t.includes('正常')),false);
    await page.getByRole('button',{name:'运行中',exact:true}).click();await wait();
    for(const width of [375,280]){
      await page.setViewportSize({width,height:900});await wait();
      await page.locator('#light .washer-details summary').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&cards.every(c=>{const el=c.shadowRoot.querySelector('ha-card');return el.scrollWidth<=el.clientWidth+2;})),true,`washer at ${width}px`);
      await page.locator('#light').screenshot({path:path.join(root,`test-results/washer-expanded-${width}.png`)});
      await page.locator('#light .washer-details summary').click();
    }
    await page.setViewportSize({width:375,height:900});await wait();
    await page.locator('#light').screenshot({path:path.join(root,'test-results/washer-mobile.png')});
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'test-results/browser-results.json'),JSON.stringify({passed:results.length,tests:results,pageErrors:errors},null,2));
  console.log(`Browser checks passed: ${results.length}`);
}finally{await browser?.close();server.kill();}
