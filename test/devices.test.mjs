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
test('camera pictures accept HA proxies and reject executable or data URLs',()=>{
  const h=createMock(),id='camera.balcony';
  for(const url of ['javascript:alert(1)','data:image/svg+xml,hi','//other.example/test']){h.states[id].attributes.entity_picture=url;assert.equal(devicePicture(h,id),'');}
  h.states[id].attributes.entity_picture='/api/camera_proxy/camera.balcony';assert.equal(devicePicture(h,id),'/api/camera_proxy/camera.balcony');
});
