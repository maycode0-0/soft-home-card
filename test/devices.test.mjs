import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, buildView, commandFor, capabilities } from '../src/model.js';
import { deviceView, deviceCommand, devicePicture } from '../src/devices.js';
import { detectDeviceBindings } from '../src/device-fields.js';
import { selectDeviceScope, entityOptions, clearEntityBindings } from '../src/editor-model.js';
import { createMock, DEMO_CONFIGS, state } from '../demo/mock.js';

test('typed feature bindings reject wrong devices, malformed IDs and wrong domains',()=>{
  for(const features of [[],true,{missing:'sensor.test'},{ptz_left:'bad'},{ptz_left:'camera.test'}])assert.throws(()=>validateConfig({device:'camera',features}));
  assert.throws(()=>validateConfig({device:'curtain',features:{battery:'sensor.test'}}));
  for(const c of DEMO_CONFIGS)assert.doesNotThrow(()=>validateConfig(c));
});
test('feature commands recheck read-only, service and availability and preserve parameter dialogs',()=>{
  const h=createMock(),c=DEMO_CONFIGS.find(x=>x.device==='air_conditioner');
  assert.equal(deviceCommand(h,c,'drying').target.entity_id,'switch.ac_drying');
  assert.throws(()=>deviceCommand(h,{...c,read_only:true},'drying'));
  h.connected=false;assert.throws(()=>deviceCommand(h,c,'drying'));h.connected=true;
  h.states['switch.ac_drying'].state='unavailable';assert.throws(()=>deviceCommand(h,c,'drying'));
  assert.deepEqual(deviceCommand(h,DEMO_CONFIGS.find(x=>x.device==='refrigerator'),'fridge_target'),{moreInfo:'number.fridge_target'});
});
test('features stay scoped to a physical device, ambiguous matches stay empty, room settings stay distinct',()=>{
  const h=createMock(),c=selectDeviceScope(h,{device:'vacuum'},'device:demo_vacuum');
  assert.equal(c.entity,'vacuum.robot');assert.equal(c.features.suction,'select.vacuum_suction_level');
  assert.equal(c.features.living_room_suction,'select.vacuum_suction_level_living_room');
  assert.ok(entityOptions(h,c,'features.suction').every(x=>h.entities[x.value].device_id==='demo_vacuum'));
  h.states['sensor.duplicate']=state('sensor.duplicate',90,{friendly_name:'电池电量'});
  assert.equal(detectDeviceBindings(h,'vacuum',['sensor.vacuum_battery','sensor.duplicate']).features,undefined);
  assert.equal(clearEntityBindings(c).features,undefined);
});
test('vacuum native controls check feature flags and service data; PIN locks use HA dialog',()=>{
  const h=createMock(),v=DEMO_CONFIGS.find(x=>x.device==='vacuum'),l=DEMO_CONFIGS.find(x=>x.device==='door_lock');
  assert.equal(commandFor(h,v,'return_home').service,'return_to_base');
  h.states[v.entity].attributes.supported_features=4;
  assert.throws(()=>commandFor(h,v,'start'));assert.equal(commandFor(h,v,'pause').service,'pause');
  assert.equal(commandFor(h,l,'unlock').confirmation,'确认解锁门锁？');
  h.states[l.entity].attributes.code_format='^\\d{6}$';
  assert.equal(capabilities(h,l,h.states[l.entity]).controls.length,0);
  assert.throws(()=>commandFor(h,l,'unlock'));
});
test('RGB colors are validated and translated, climate fans respect actual options',()=>{
  const h=createMock(),c=DEMO_CONFIGS[10];h.states[c.entity].attributes.supported_color_modes=['rgb'];
  assert.deepEqual(commandFor(h,c,'color','#a0b1c2').data,{rgb_color:[160,177,194]});
  assert.throws(()=>commandFor(h,c,'color','red'));
  const ac=DEMO_CONFIGS[5],a=h.states[ac.entity].attributes;Object.assign(a,{supported_features:a.supported_features|8,fan_modes:['auto','low'],fan_mode:'auto'});h.services.climate.set_fan_mode={};
  assert.deepEqual(commandFor(h,ac,'fan_mode','low').data,{fan_mode:'low'});
  assert.throws(()=>commandFor(h,ac,'fan_mode','high'));
});
test('offline feature readings never imply normal safety or fresh temperatures',()=>{
  const h=createMock(),c=DEMO_CONFIGS.find(x=>x.device==='door_lock');h.states[c.entity].state='unavailable';
  const d=deviceView(h,c,buildView(h,c));assert.ok(Object.values(d.fields).every(f=>!f.valid&&f.text==='—'&&!f.warning));
  h.states[c.entity].state='locked';h.states[c.features.tamper].state='on';assert.equal(deviceView(h,c,buildView(h,c)).fields.tamper.warning,true);
});
test('ONVIF PTZ targets only the configured camera and preserves explicit controls',()=>{
  const h=createMock(),c=validateConfig({device:'camera',entity:'camera.tp_ipc_mainstream'});
  h.states[c.entity]=state(c.entity,'idle',{friendly_name:'TP-IPC mainStream'});
  h.entities[c.entity]={entity_id:c.entity,platform:'onvif'};
  const ptz=config=>deviceView(h,config,buildView(h,config)).groups('ptz');
  assert.deepEqual(ptz(c),[]);
  h.services.onvif={ptz:{}};
  assert.deepEqual(new Set(ptz(c).map(f=>f.key)),new Set(['ptz_left','ptz_right','ptz_up','ptz_down']));
  for(const [key,direction] of Object.entries({ptz_left:{pan:'LEFT'},ptz_right:{pan:'RIGHT'},ptz_up:{tilt:'UP'},ptz_down:{tilt:'DOWN'}})){
    assert.deepEqual(deviceCommand(h,c,key),{domain:'onvif',service:'ptz',data:{...direction,move_mode:'ContinuousMove',distance:0.5,continuous_duration:0.4},target:{entity_id:c.entity}});
  }
  assert.deepEqual(deviceCommand(h,{...c,onvif_ptz:'RelativeMove'},'ptz_up').data,{tilt:'UP',move_mode:'RelativeMove',distance:0.1});
  assert.throws(()=>validateConfig({...c,onvif_ptz:'invalid'}));
  assert.throws(()=>deviceCommand(h,c,'ptz_home'));
  const manual={...c,features:{ptz_left:'button.camera_ptz_left'}};
  assert.deepEqual(deviceCommand(h,manual,'ptz_left'),{domain:'button',service:'press',data:{},target:{entity_id:'button.camera_ptz_left'}});
  assert.deepEqual(ptz({...manual,onvif_ptz:'off'}).map(f=>f.key),['ptz_left']);
  const readOnly={...c,read_only:true};
  assert.ok(ptz(readOnly).every(f=>f.disabled));
  assert.throws(()=>deviceCommand(h,readOnly,'ptz_up'));
  h.connected=false;
  assert.ok(ptz(c).every(f=>f.disabled));
  assert.throws(()=>deviceCommand(h,c,'ptz_up'));
  h.connected=true;
  h.states[c.entity].state='unavailable';
  assert.ok(ptz(c).every(f=>f.disabled));
  assert.throws(()=>deviceCommand(h,c,'ptz_up'));
  h.states[c.entity].state='idle';
  for(const platform of ['generic',undefined]){
    h.entities[c.entity].platform=platform;
    assert.deepEqual(ptz(c),[]);
    assert.throws(()=>deviceCommand(h,c,'ptz_up'));
  }
});
test('camera pictures accept HA proxies and reject executable or data URLs',()=>{
  const h=createMock(),id='camera.balcony';
  for(const url of ['javascript:alert(1)','data:image/svg+xml,hi','//other.example/test']){h.states[id].attributes.entity_picture=url;assert.equal(devicePicture(h,id),'');}
  h.states[id].attributes.entity_picture='/api/camera_proxy/camera.balcony';assert.equal(devicePicture(h,id),'/api/camera_proxy/camera.balcony');
});

test('never-pressed HA buttons remain usable while unavailable buttons stay disabled',()=>{
  const h=createMock(),c={device:'air_conditioner',entity:'climate.living_room',features:{cancel_timer:'button.cancel_timer'}};
  h.states[c.entity]=state(c.entity,'off');
  h.services.button={press:{}};
  h.states['button.cancel_timer']=state('button.cancel_timer','unknown');
  const field=deviceView(h,c,buildView(h,c)).fields.cancel_timer;
  assert.equal(field.text,'点按执行');assert.equal(field.disabled,false);
  assert.deepEqual(deviceCommand(h,c,'cancel_timer'),{domain:'button',service:'press',data:{},target:{entity_id:'button.cancel_timer'}});
  assert.throws(()=>deviceCommand(h,{...c,read_only:true},'cancel_timer'));
  h.states['button.cancel_timer'].state='unavailable';
  assert.equal(deviceView(h,c,buildView(h,c)).fields.cancel_timer.disabled,true);
  assert.throws(()=>deviceCommand(h,c,'cancel_timer'));
  h.states['button.cancel_timer'].state='unknown';h.states[c.entity].state='unknown';
  assert.throws(()=>deviceCommand(h,c,'cancel_timer'));
});

test('Dreame no_error is healthy and real error values still raise an alert',()=>{
  const h=createMock(),c={device:'vacuum',entity:'vacuum.robot',features:{error:'sensor.robot_error'}};
  h.states['sensor.robot_error']=state('sensor.robot_error','no_error');
  let field=deviceView(h,c,buildView(h,c)).fields.error;
  assert.equal(field.warning,false);assert.equal(field.text,'无故障');
  h.states['sensor.robot_error'].state='brush_stuck';
  assert.equal(deviceView(h,c,buildView(h,c)).fields.error.warning,true);
});
