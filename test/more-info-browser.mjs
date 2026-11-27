import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)),port=18125;
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,SOFT_HOME_PORT:String(port)},stdio:'pipe',windowsHide:true});
let browser;
try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${port}/demo/more-info.html`)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,'preview server starts');
  browser=await chromium.launch({headless:true,executablePath:process.env.SOFT_HOME_CHROMIUM||undefined,channel:process.env.SOFT_HOME_BROWSER_CHANNEL||undefined});
  const page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/demo/more-info.html`);
  await page.waitForSelector('html[data-ready=true]');
  const dialog=page.locator('soft-home-more-info-dialog');
  const open=async(entity,scope='[data-content=dashboard]')=>{
    await page.locator(`${scope} [data-entity="${entity}"]`).click();
    await dialog.locator('dialog[open]').waitFor();
    await dialog.locator('soft-home-entity-panel ha-card').waitFor();
  };
  const close=async()=>{
    if(await dialog.locator('dialog[open]').count())await dialog.getByRole('button',{name:'关闭设备详情',exact:true}).click();
    await page.waitForFunction(()=>!history.state?.dialog);
  };
  const emit=detail=>page.evaluate(detail=>moreInfoDemo.root.dispatchEvent(new CustomEvent('hass-more-info',{detail,bubbles:true,composed:true})),detail);
  const checks=[];
  const check=async(name,fn)=>{
    try{await fn();checks.push(name);console.log('PASS '+name);}
    catch(error){fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/more-info-failure.png')});console.error('Browser errors:',errors);throw error;}
  };

  await check('global dashboard entry uses HA show-dialog contract and actual Soft Home climate controls',async()=>{
    await open('climate.ac');
    assert.equal(await dialog.locator('h2').innerText(),'主卧中央空调');
    assert.equal(await dialog.locator('.climate-overview').count(),1);
    assert.match(await dialog.locator('.status-note').innerText(),/当前 20 °C/);
    assert.equal(await page.evaluate(()=>history.state.dialog),'soft-home-more-info-dialog');
    assert.equal(await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length),0);
    await dialog.getByRole('button',{name:'升高温度',exact:true}).click();
    await page.waitForFunction(()=>moreInfoDemo.mock.states['climate.ac'].attributes.temperature===26.5);
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1)),{domain:'climate',service:'set_temperature',data:{temperature:26.5},target:{entity_id:'climate.ac'}});
    await dialog.locator('[data-extra=preset_mode]').selectOption('eco');
    await page.waitForFunction(()=>moreInfoDemo.mock.states['climate.ac'].attributes.preset_mode==='eco');
  });
  await check('HA-provided updates change readings and mode without recreating the panel',async()=>{
    await page.evaluate(()=>{const p=moreInfoDemo.root.shadowRoot.querySelector('soft-home-more-info-dialog').shadowRoot.querySelector('soft-home-entity-panel');window.originalPanel=p;moreInfoDemo.mock.themes={darkMode:true};moreInfoDemo.mock.states['climate.ac']={...moreInfoDemo.mock.states['climate.ac'],attributes:{...moreInfoDemo.mock.states['climate.ac'].attributes,current_temperature:21}};moreInfoDemo.mock.notify();});
    await dialog.locator('dialog.dark').waitFor();
    assert.match(await dialog.locator('.status-note').innerText(),/当前 21 °C/);
    assert.equal(await dialog.locator('soft-home-entity-panel').evaluate(el=>el===window.originalPanel),true);
  });
  await check('backend failures stay visible and do not fabricate an updated preset',async()=>{
    await page.evaluate(()=>{moreInfoDemo.mock.rejectNext=true;});
    await dialog.locator('[data-extra=preset_mode]').selectOption('sleep');
    await dialog.locator('.detail-error:not([hidden])').waitFor();
    assert.match(await dialog.locator('.detail-error').innerText(),/设备连接失败/);
    assert.equal(await page.evaluate(()=>moreInfoDemo.mock.states['climate.ac'].attributes.preset_mode),'eco');
  });
  await check('native details escape bypasses interception once and closes the custom dialog',async()=>{
    await dialog.getByRole('button',{name:'原生详情',exact:false}).click();
    await page.waitForFunction(()=>moreInfoDemo.root.nativeEvents.length===1);
    assert.equal(await page.evaluate(()=>moreInfoDemo.root.nativeEvents[0].entityId),'climate.ac');
    await page.waitForFunction(()=>!history.state?.dialog);
    assert.equal(await dialog.locator('dialog[open]').count(),0);
  });
  await check('camera details separate the preview control from the single native settings entry',async()=>{
    const entityId='camera.balcony';
    await page.evaluate(id=>{
      const {mock}=moreInfoDemo;
      mock.states[id]={...mock.states[id],state:'idle'};
      mock.notify();
    },entityId);
    await emit({entityId});
    await dialog.locator('.camera-preview').waitFor();
    assert.equal(await dialog.locator('.camera-preview .status').innerText(),'待机');
    assert.equal(await dialog.getByText('待机',{exact:true}).filter({visible:true}).count(),1);
    assert.equal(await dialog.getByRole('button',{name:'原生详情',exact:true}).count(),1);
    assert.equal(await dialog.getByRole('button',{name:'播放实时画面',exact:true}).count(),1);
    const gear=dialog.locator('.dialog-header').getByRole('button',{name:'原生详情',exact:true});
    assert.equal(await gear.locator('ha-icon').getAttribute('icon'),'mdi:cog-outline');
    await page.evaluate(()=>{if(!customElements.get('ha-camera-stream'))customElements.define('ha-camera-stream',class extends HTMLElement{});});
    await dialog.getByRole('button',{name:'播放实时画面',exact:true}).click();
    const stream=dialog.locator('ha-camera-stream');
    await stream.waitFor({state:'attached'});
    assert.equal(await stream.evaluate(el=>el.stateObj.entity_id),entityId);
    await dialog.getByRole('button',{name:'暂停实时画面',exact:true}).click();
    await stream.waitFor({state:'detached'});
    const count=await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length);
    await gear.click();
    await page.waitForFunction(count=>moreInfoDemo.root.nativeEvents.length===count+1,count);
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.root.nativeEvents.at(-1)),{entityId});
    await close();
  });
  await check('the settings/entity-list entry is replaced by the same global handler',async()=>{
    await page.locator('[data-page=settings]').click();await open('climate.ac','[data-content=settings]');
    await close();
    await open('number.washer_rinse_count','[data-content=settings]');
    const range=dialog.locator('input[data-control=number]');await range.fill('4');await range.dispatchEvent('input');await range.dispatchEvent('change');
    await page.waitForFunction(()=>moreInfoDemo.mock.states['number.washer_rinse_count'].state==='4');
    await close();
  });
  await check('unsupported domains, requested native tabs and PIN locks pass through untouched',async()=>{
    const count=await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length);
    await page.locator('[data-content=settings] [data-entity="alarm_control_panel.home"]').click();
    await emit({entityId:'climate.ac',view:'history'});
    await page.evaluate(()=>{moreInfoDemo.mock.states['lock.front_door'].attributes.code_format='number';moreInfoDemo.mock.notify();});
    await emit({entityId:'lock.front_door'});
    assert.equal(await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length),count+3);
    assert.equal(await dialog.locator('dialog[open]').count(),0);
  });
  await check('light, cover and generic sensor details render and retain native history access',async()=>{
    await page.locator('[data-page=dashboard]').click();
    for(const [entity,selector] of [['light.wall','.light-overview'],['cover.curtain','.cover-overview'],['sensor.temperature','.generic-detail']]){
      await open(entity);assert.equal(await dialog.locator(selector).count(),1);await close();
    }
  });
  await check('child locks show key-protection controls and only call their own lock entity',async()=>{
    await open('lock.washer_child_lock');
    assert.equal(await dialog.locator('[data-lock-kind=child]').count(),1);
    assert.equal(await dialog.locator('.lock-summary,.lock-art').count(),0);
    assert.equal(await dialog.locator('.status-pill').innerText(),'童锁已关闭');
    await dialog.getByRole('button',{name:'开启童锁',exact:true}).click();
    await dialog.getByRole('button',{name:'关闭童锁',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1)),{domain:'lock',service:'lock',data:{},target:{entity_id:'lock.washer_child_lock'}});
    assert.equal(await dialog.locator('.generic-detail-value').innerText(),'童锁已开启');
    const promptPromise=page.waitForEvent('dialog'),click=dialog.getByRole('button',{name:'关闭童锁',exact:true}).click();
    const prompt=await promptPromise;assert.equal(prompt.message(),'确认关闭童锁？');await prompt.accept();await click;
    await dialog.getByRole('button',{name:'开启童锁',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1)),{domain:'lock',service:'unlock',data:{},target:{entity_id:'lock.washer_child_lock'}});
    await close();
    await page.evaluate(()=>{window.softHomeMoreInfoConfig={entities:{'lock.washer_child_lock':{read_only:true}}};});
    await open('lock.washer_child_lock');
    assert.equal(await dialog.getByRole('button',{name:'开启童锁',exact:true}).count(),0);await close();
    await page.evaluate(()=>{window.softHomeMoreInfoConfig={};});
  });
  await check('switch child locks use switch services while real door locks keep their appearance and confirmation',async()=>{
    await emit({entityId:'switch.oven_child_lock'});
    await dialog.getByRole('button',{name:'开启童锁',exact:true}).waitFor();
    assert.equal(await dialog.locator('.power').isVisible(),false);
    await dialog.getByRole('button',{name:'开启童锁',exact:true}).click();
    await dialog.getByRole('button',{name:'关闭童锁',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1)),{domain:'switch',service:'turn_on',data:{},target:{entity_id:'switch.oven_child_lock'}});
    await close();
    await page.evaluate(()=>{delete moreInfoDemo.mock.states['lock.front_door'].attributes.code_format;moreInfoDemo.mock.states['lock.front_door'].state='locked';moreInfoDemo.mock.notify();});
    await open('lock.front_door');
    assert.equal(await dialog.locator('.lock-art svg').count(),1);
    assert.equal(await dialog.locator('[data-lock-kind=child]').count(),0);
    const promptPromise=page.waitForEvent('dialog'),click=dialog.getByRole('button',{name:'解锁',exact:true}).click();
    const prompt=await promptPromise;assert.equal(prompt.message(),'确认解锁门锁？');await prompt.accept();await click;
    await dialog.getByRole('button',{name:'上锁',exact:true}).waitFor();
    assert.equal(await dialog.locator('.lock-summary.warning').count(),1);
    assert.equal(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1).target.entity_id),'lock.front_door');await close();
  });
  await check('main lights render a six-lamp chandelier and their brightness still targets the main light',async()=>{
    await open('light.main');
    assert.equal(await dialog.locator('soft-home-entity-panel').evaluate(el=>el._config.device),'pendant_light');
    assert.equal(await dialog.locator('[data-art=chandelier]').count(),1);
    assert.equal(await dialog.locator('[data-lamp]').count(),6);
    const brightness=dialog.locator('input[data-control=brightness]');await brightness.fill('55');await brightness.dispatchEvent('input');await brightness.dispatchEvent('change');
    await page.waitForFunction(()=>moreInfoDemo.mock.calls.at(-1).target.entity_id==='light.main');
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1).data),{brightness_pct:55});
    await close();await open('light.wall');
    assert.equal(await dialog.locator('soft-home-entity-panel').evaluate(el=>el._config.device),'wall_light');
    assert.equal(await dialog.locator('[data-art=chandelier]').count(),0);await close();
  });
  await check('temperature and humidity preserve numeric units and bind separate HA history charts to the correct sensors',async()=>{
    for(const [entity,kind,unit] of [['sensor.temperature','temperature','°C'],['sensor.humidity','humidity','%']]){
      await open(entity);
      const component=dialog.locator('ha-more-info-history-and-logbook');await component.locator(`[data-trend=${kind}]`).waitFor();
      assert.equal(await component.evaluate(el=>el.entityId),entity);
      assert.equal(await component.evaluate(el=>el.hass===moreInfoDemo.root.hass),true);
      assert.match(await dialog.locator('.generic-detail-value').innerText(),new RegExp(unit));
      assert.equal(await component.locator(`[data-trend=${kind}] path[stroke="currentColor"]`).count(),1);
      await close();
    }
  });
  await check('cleared unlock values retain the HA history/logbook element and its native show-more request',async()=>{
    const before=await page.evaluate(()=>moreInfoDemo.mock.calls.length);
    await open('sensor.door_lock_unlock_event');
    assert.equal(await dialog.locator('.generic-detail-value').innerText(),'无');
    const history=dialog.locator('ha-more-info-history-and-logbook');
    await history.locator('.row').first().waitFor();
    assert.equal(await history.locator('.row').count(),5);
    assert.equal(await history.evaluate(el=>el.entityId),'sensor.door_lock_unlock_event');
    assert.equal(await history.evaluate(el=>el.hass===moreInfoDemo.root.hass),true);
    await history.evaluate(el=>{window.originalHistoryComponent=el;});
    await page.evaluate(()=>{moreInfoDemo.mock.states['sensor.door_lock_unlock_event']={...moreInfoDemo.mock.states['sensor.door_lock_unlock_event'],state:'无'};moreInfoDemo.mock.notify();});
    assert.equal(await history.evaluate(el=>el===window.originalHistoryComponent&&el.hass===moreInfoDemo.root.hass),true);
    await history.getByRole('button',{name:'显示更多',exact:true}).first().click();
    await page.waitForFunction(()=>!history.state?.dialog);
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.root.nativeEvents.at(-1)),{entityId:'sensor.door_lock_unlock_event',view:'history'});
    assert.equal(await page.evaluate(()=>moreInfoDemo.mock.calls.length),before);
    await open('event.door_lock_unlock');
    assert.equal(await dialog.locator('.status-pill').innerText(),'指纹开锁');
    assert.equal(await dialog.locator('.generic-detail-value').innerText(),'指纹开锁');
    assert.equal(await dialog.locator('ha-more-info-history-and-logbook').evaluate(el=>el.entityId),'event.door_lock_unlock');
    await close();
  });
  await check('late HA history registration attaches only to the currently open entity',async()=>{
    const late=await browser.newPage();
    try{
      await late.addInitScript(()=>{window.softHomeDemoSkipHistory=true;});
      await late.goto(`http://127.0.0.1:${port}/demo/more-info.html?entity=sensor.door_lock_unlock_event`);
      const lateDialog=late.locator('soft-home-more-info-dialog');
      await lateDialog.getByText('正在加载历史与活动…',{exact:true}).waitFor();
      await lateDialog.getByRole('button',{name:'关闭设备详情',exact:true}).click();
      await late.waitForFunction(()=>!history.state?.dialog);
      await late.locator('[data-entity="sensor.temperature"]').click();
      await late.evaluate(async()=>{(await import('/demo/more-info-history.js')).installHistoryPreview();});
      const component=lateDialog.locator('ha-more-info-history-and-logbook');await component.waitFor();
      assert.equal(await component.evaluate(el=>el.entityId),'sensor.temperature');
      assert.equal(await component.locator('.row').count(),0);
    }finally{await late.close();}
  });
  await check('missing HA history offers native access and older separate history/logbook elements remain supported',async()=>{
    const missing=await browser.newPage();
    try{
      await missing.addInitScript(()=>{window.softHomeDemoSkipHistory=true;});
      await missing.goto(`http://127.0.0.1:${port}/demo/more-info.html?entity=sensor.door_lock_unlock_event`);
      const missingDialog=missing.locator('soft-home-more-info-dialog');
      await missingDialog.getByText('历史组件暂不可用，请在原生面板查看记录。',{exact:true}).waitFor();
      await missingDialog.getByRole('button',{name:'查看历史与活动',exact:false}).click();
      await missing.waitForFunction(()=>!history.state?.dialog);
      assert.deepEqual(await missing.evaluate(()=>moreInfoDemo.root.nativeEvents.at(-1)),{entityId:'sensor.door_lock_unlock_event',view:'history'});
      await missing.evaluate(()=>{
        customElements.define('ha-more-info-history',class extends HTMLElement{});
        customElements.define('ha-more-info-logbook',class extends HTMLElement{});
      });
      await missing.locator('[data-entity="sensor.door_lock_unlock_event"]').click();
      await missingDialog.locator('ha-more-info-history').waitFor({state:'attached'});
      for(const tag of ['ha-more-info-history','ha-more-info-logbook'])assert.equal(await missingDialog.locator(tag).evaluate(el=>el.entityId==='sensor.door_lock_unlock_event'&&el.hass===moreInfoDemo.root.hass),true);
    }finally{await missing.close();}
  });
  await check('read-only and offline entities show state without service controls',async()=>{
    await page.evaluate(()=>{window.softHomeMoreInfoConfig={entities:{'climate.ac':{device:'air_conditioner',read_only:true}}};});
    await open('climate.ac');
    assert.equal(await dialog.locator('[data-extra]').count(),0);
    assert.equal(await dialog.locator('.power').isVisible(),false);
    assert.equal(await dialog.getByRole('button',{name:'升高温度',exact:true}).count(),0);
    await close();
    await page.evaluate(()=>{window.softHomeMoreInfoConfig={};moreInfoDemo.mock.states['climate.ac']={...moreInfoDemo.mock.states['climate.ac'],state:'unavailable'};moreInfoDemo.mock.notify();});
    await open('climate.ac');assert.equal(await dialog.locator('.power').isVisible(),false);assert.equal(await dialog.locator('[data-extra]').count(),0);await close();
    await page.evaluate(()=>{moreInfoDemo.mock.states['climate.ac']={...moreInfoDemo.mock.states['climate.ac'],state:'off'};moreInfoDemo.mock.notify();});
  });
  await check('reported music player without volume readings can play, pause and skip with exact entity targets',async()=>{
    await open('media_player.music');
    for(const name of ['上一首','播放','下一首'])assert.equal(await dialog.getByRole('button',{name,exact:true}).isVisible(),true);
    assert.equal(await dialog.locator('input[type=range]').count(),0);
    assert.equal(await dialog.locator('.power').isVisible(),false);
    await dialog.getByRole('button',{name:'播放',exact:true}).click();
    await dialog.getByRole('button',{name:'暂停',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1)),{domain:'media_player',service:'media_play',data:{},target:{entity_id:'media_player.music'}});
    await dialog.getByRole('button',{name:'暂停',exact:true}).click();
    await dialog.getByRole('button',{name:'播放',exact:true}).waitFor();
    for(const [name,service] of [['上一首','media_previous_track'],['下一首','media_next_track']]){
      await dialog.getByRole('button',{name,exact:true}).click();
      await page.waitForFunction(service=>moreInfoDemo.mock.calls.at(-1).service===service,service);
      assert.equal(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1).target.entity_id),'media_player.music');
    }
    await page.evaluate(()=>{moreInfoDemo.mock.rejectNext=true;});
    await dialog.getByRole('button',{name:'播放',exact:true}).click();
    await dialog.locator('soft-home-entity-panel [role=alert]').waitFor();
    assert.equal(await page.evaluate(()=>moreInfoDemo.mock.states['media_player.music'].state),'paused');
    await close();
  });
  await check('reported media mute, volume, source and progress controls submit real supported service fields',async()=>{
    await page.evaluate(()=>{
      const state=moreInfoDemo.mock.states['media_player.music'];window.musicOriginal=state;
      moreInfoDemo.mock.states['media_player.music']={...state,attributes:{...state.attributes,supported_features:16447|1024|2048|4096,volume_level:.35,is_volume_muted:false,media_duration:240,media_position:30,source:'音乐',source_list:['音乐','蓝牙']}};
      moreInfoDemo.mock.notify();
    });
    await open('media_player.music');
    await dialog.getByRole('button',{name:'静音',exact:true}).click();
    await dialog.getByRole('button',{name:'取消静音',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>moreInfoDemo.mock.calls.at(-1).data),{is_volume_muted:true});
    await dialog.locator('select[data-control=media_source]').selectOption('蓝牙');
    await page.waitForFunction(()=>moreInfoDemo.mock.states['media_player.music'].attributes.source==='蓝牙');
    for(const [id,value,key,expected] of [['volume','60','volume_level',.6],['media_seek','80','seek_position',80]]){
      const slider=dialog.locator(`input[data-control=${id}]`);await slider.fill(value);await slider.dispatchEvent('input');await slider.dispatchEvent('change');
      await page.waitForFunction(({key,expected})=>moreInfoDemo.mock.calls.at(-1).data[key]===expected,{key,expected});
    }
    await close();
    await page.evaluate(()=>{moreInfoDemo.mock.states['media_player.music']=window.musicOriginal;moreInfoDemo.mock.notify();});
  });
  await check('Escape, browser back and HA close requests all release the modal',async()=>{
    await open('climate.ac');await page.keyboard.press('Escape');await page.waitForFunction(()=>!history.state?.dialog);
    assert.equal(await dialog.locator('dialog[open]').count(),0);
    await open('climate.ac');await page.goBack();await dialog.locator('dialog[open]').waitFor({state:'hidden'});
    await open('climate.ac');await emit({entityId:null});await page.waitForFunction(()=>!history.state?.dialog);
    assert.equal(await dialog.locator('dialog[open]').count(),0);
  });
  await check('loading the add-on first leaves registration to the dashboard card',async()=>{
    const registrations=()=>page.evaluate(()=>['soft-home-card','soft-home-card-editor','soft-home-picker'].map(tag=>!!customElements.get(tag)));
    assert.deepEqual(await registrations(),[false,false,false]);
    await page.addScriptTag({url:`http://127.0.0.1:${port}/dist/soft-home-card.js`});
    assert.deepEqual(await registrations(),[true,true,true]);
  });
  await check('loading the add-on twice is idempotent and disabling restores native routing',async()=>{
    await page.addScriptTag({url:`http://127.0.0.1:${port}/dist/soft-home-more-info.js?again=1`});
    await open('climate.ac');await close();
    const count=await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length);
    await page.evaluate(()=>softHomeMoreInfo.disable());await emit({entityId:'climate.ac'});
    assert.equal(await page.evaluate(()=>moreInfoDemo.root.nativeEvents.length),count+1);
    assert.equal(await dialog.locator('dialog[open]').count(),0);
    await page.evaluate(()=>softHomeMoreInfo.enable());
  });
  await check('small screens contain the dialog and reduced motion is respected',async()=>{
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:844});await open('climate.ac');
      const bounds=await dialog.locator('dialog').evaluate(el=>({width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
      assert.ok(bounds.left>=0&&bounds.right<=width,JSON.stringify(bounds));assert.ok(bounds.scroll<=bounds.client,JSON.stringify(bounds));
      const nativeBounds=await dialog.locator('.dialog-header .native-details').boundingBox();assert.ok(nativeBounds.y>=0&&nativeBounds.y+nativeBounds.height<=844,'native escape stays visible');await close();
    }
    await page.emulateMedia({reducedMotion:'reduce'});await open('climate.ac');
    assert.equal(await dialog.locator('.close').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await close();
  });

  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.setViewportSize({width:1440,height:1040});
  await page.evaluate(()=>{moreInfoDemo.mock.themes={darkMode:false};document.body.classList.remove('dark');moreInfoDemo.mock.notify();});
  await open('lock.washer_child_lock');await page.screenshot({path:path.join(root,'docs/more-info-child-lock-preview.png')});await close();
  await page.setViewportSize({width:320,height:844});await open('lock.washer_child_lock');
  const childBox=await dialog.locator('dialog').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(childBox.scroll<=childBox.client);
  await page.screenshot({path:path.join(root,'test-results/child-lock-mobile.png')});await close();
  await page.setViewportSize({width:1440,height:1040});
  await open('light.main');await page.screenshot({path:path.join(root,'docs/more-info-main-light-preview.png')});await close();
  await open('sensor.temperature');await dialog.locator('[data-trend=temperature]').waitFor();
  await page.screenshot({path:path.join(root,'docs/more-info-temperature-preview.png')});await close();
  await open('sensor.humidity');await dialog.locator('[data-trend=humidity]').waitFor();
  await page.screenshot({path:path.join(root,'docs/more-info-humidity-preview.png')});await close();
  await page.setViewportSize({width:390,height:844});
  for(const entity of ['light.main','sensor.temperature','sensor.humidity']){
    await open(entity);const box=await dialog.locator('dialog').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(box.scroll<=box.client);
    await page.screenshot({path:path.join(root,'test-results/'+entity.replace('.','-')+'-mobile.png')});await close();
  }
  await page.setViewportSize({width:1440,height:1040});
  await open('sensor.door_lock_unlock_event');await dialog.locator('ha-more-info-history-and-logbook .row').first().waitFor();
  await page.screenshot({path:path.join(root,'docs/more-info-history-preview.png')});await close();
  await page.setViewportSize({width:390,height:844});await open('sensor.door_lock_unlock_event');
  const historyBounds=await dialog.locator('dialog').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(historyBounds.scroll<=historyBounds.client);
  await page.screenshot({path:path.join(root,'test-results/more-info-history-mobile.png')});await close();
  await page.setViewportSize({width:1440,height:1040});
  await open('media_player.music');await page.screenshot({path:path.join(root,'docs/more-info-music-preview.png')});await close();
  await page.setViewportSize({width:390,height:844});await open('media_player.music');
  const musicBounds=await dialog.locator('dialog').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(musicBounds.scroll<=musicBounds.client);
  await page.screenshot({path:path.join(root,'test-results/more-info-music-mobile.png')});await close();
  await page.setViewportSize({width:1440,height:1040});
  await open('climate.ac');await page.screenshot({path:path.join(root,'docs/more-info-light-preview.png')});
  await page.evaluate(()=>{moreInfoDemo.mock.themes={darkMode:true};document.body.classList.add('dark');moreInfoDemo.mock.notify();});
  await page.screenshot({path:path.join(root,'docs/more-info-dark-preview.png')});
  await close();
  await page.setViewportSize({width:390,height:844});await open('climate.ac');
  await page.screenshot({path:path.join(root,'docs/more-info-mobile-preview.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'test-results/more-info.json'),JSON.stringify({checks,errors},null,2));
  console.log('Global more-info browser checks passed; screenshots saved.');
}finally{await browser?.close();server.kill();}
