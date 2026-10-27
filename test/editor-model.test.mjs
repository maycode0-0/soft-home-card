import test from 'node:test';
import assert from 'node:assert/strict';
import {createMock,state} from '../demo/mock.js';
import {DEVICES,validateConfig} from '../src/model.js';
import {deviceGroups,entityScope,entityOptions,selectDeviceScope,clearEntityBindings,searchItems} from '../src/editor-model.js';

test('type discovery and physical device grouping isolate two washers and unrelated lights',()=>{
  const h=createMock(),groups=deviceGroups(h,'washing_machine');
  assert.deepEqual(new Set(groups.map(g=>g.deviceId)),new Set(['demo_washing_machine','washer_two']));
  const c=selectDeviceScope(h,{device:'washing_machine'},'device:demo_washing_machine');
  assert.equal(c.entity,'sensor.washer');
  for(const field of ['entity','primary_entity','secondary_entity','power_entity','progress_entity','auxiliary.0.entity','metrics.0.entity']){
    assert.ok(entityOptions(h,c,field).every(x=>h.entities[x.value].device_id===c.device_id));
  }
  assert.ok(entityOptions(h,c,'primary_entity').some(x=>x.value==='sensor.remaining'),'generic names remain associated by registry');
  assert.deepEqual(entityOptions(h,c,'auxiliary.0.entity').map(x=>x.value),['button.wash_start']);
});
test('all 19 device categories find their matching demo device',()=>{
  const h=createMock();
  for(const kind of Object.keys(DEVICES))assert.ok(deviceGroups(h,kind).some(g=>g.deviceId===`demo_${kind}`),kind);
});
test('registry maps and registry lists behave equally; old main entity infers scope',()=>{
  const h=createMock(),c={device:'washing_machine',entity:'sensor.washer'};
  const expected=entityOptions(h,c,'primary_entity');
  h.entities=Object.values(h.entities);h.devices=Object.values(h.devices);
  assert.deepEqual(entityOptions(h,c,'primary_entity'),expected);
  assert.equal(entityScope(h,{device:'washing_machine',entity:'light.wall'}),null);
  assert.deepEqual(entityOptions(h,{device:'washing_machine',entity:'light.wall'},'entity'),[]);
});
test('manual discovery binds opaque device names and remains strictly scoped',()=>{
  const h=createMock();h.devices.opaque={id:'opaque',name:'X100'};
  h.states['sensor.uuid1']=state('sensor.uuid1',20,{friendly_name:'参数'});
  h.entities['sensor.uuid1']={entity_id:'sensor.uuid1',device_id:'opaque'};
  assert.ok(!deviceGroups(h,'washing_machine').some(g=>g.deviceId==='opaque'));
  const c=selectDeviceScope(h,{device:'washing_machine'},'device:opaque');
  assert.equal(entityScope(h,c).deviceId,'opaque');
  assert.deepEqual(entityOptions(h,c,'primary_entity').map(x=>x.value),['sensor.uuid1']);
});
test('fault and connectivity sensors are not automatically chosen as washer cycle state',()=>{
  const id='binary_sensor.midea_208907221565269_device_status';
  const h={states:{[id]:state(id,'on',{friendly_name:'洗衣机设备状态'})}};
  const c=selectDeviceScope(h,{device:'washing_machine'},'legacy:midea_208907221565269');
  assert.equal(c.entity,undefined);assert.ok(entityScope(h,c));
});
test('legacy numeric IDs group only the same device and manual entity scope survives reload',()=>{
  const ids=['binary_sensor.midea_208907221565269_device_status','sensor.midea_208907221565269_remaining','sensor.midea_208907221565270_remaining'];
  const h={states:Object.fromEntries(ids.map(id=>[id,state(id,'on',{friendly_name:'滚筒洗衣机'})]))};
  assert.equal(deviceGroups(h,'washing_machine').length,2);
  const c=selectDeviceScope(h,{device:'washing_machine'},'legacy:midea_208907221565269');
  assert.equal(c.entity,ids[1]);assert.equal(entityOptions(h,c,'primary_entity').length,2);
  h.states['sensor.opaque']=state('sensor.opaque',10,{friendly_name:'X100'});
  const manual=selectDeviceScope(h,{device:'washing_machine'},'entity:sensor.opaque');
  assert.equal(entityScope(h,JSON.parse(JSON.stringify(manual))).key,'entity:sensor.opaque');
  h.entities={'sensor.opaque':{entity_id:'sensor.opaque',device_id:'new_registry'}};
  assert.equal(entityScope(h,manual).deviceId,'new_registry');
});
test('missing or removed device never falls back to all household entities',()=>{
  const h=createMock();
  assert.deepEqual(entityOptions(h,{device:'washing_machine'},'entity'),[]);
  assert.deepEqual(entityOptions(h,{device:'washing_machine',device_id:'removed'},'primary_entity'),[]);
  delete h.entities;delete h.devices;
  const groups=deviceGroups(h,'washing_machine');
  assert.ok(groups.every(g=>g.entityIds.length===1));
});
test('changing device clears old targets, preserves presentation, and permits incomplete setup',()=>{
  const c={device:'washing_machine',device_id:'old',entity:'sensor.old',primary_entity:'sensor.old',auxiliary:[{entity:'button.old'}],metrics:[{entity:'sensor.old'}],actions:[{label:'旧设备',action:'more-info'}],name:'洗衣',theme:'dark'};
  assert.deepEqual(clearEntityBindings(c),{device:'washing_machine',name:'洗衣',theme:'dark'});
  assert.doesNotThrow(()=>validateConfig(clearEntityBindings(c)));
  for(const bad of [4,false,{},'bad'])assert.throws(()=>validateConfig({device:'washing_machine',entity:bad}));
});
test('search accepts Chinese names, case-insensitive entity IDs and multiple tokens',()=>{
  const items=entityOptions(createMock(),{device:'washing_machine',device_id:'demo_washing_machine'},'primary_entity');
  assert.deepEqual(searchItems(items,'剩余').map(x=>x.value),['sensor.remaining']);
  assert.deepEqual(searchItems(items,'SENSOR. REMAIN').map(x=>x.value),['sensor.remaining']);
  assert.deepEqual(searchItems(items,'次卧'),[]);
});
