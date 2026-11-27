import test from 'node:test';
import assert from 'node:assert/strict';
import {createMock} from '../demo/mock.js';
import {moreInfoConfig,moreInfoRoute,moreInfoExtraControls,moreInfoExtraCommand,moreInfoHasHistory,moreInfoStateLabel,moreInfoLockKind,moreInfoCapabilities,moreInfoCommand} from '../src/more-info-model.js';
import {deviceGroups} from '../src/editor-model.js';

function fixture(){
  const hass=createMock();
  const state=hass.states['climate.ac'];
  hass.states['climate.ac']={...state,attributes:{...state.attributes,supported_features:1|2|4|8|16|32|128|256|512,preset_mode:'none',preset_modes:['none','eco','sleep'],humidity:50,min_humidity:35,max_humidity:75,target_temp_low:20,target_temp_high:27,swing_horizontal_mode:'off',swing_horizontal_modes:['off','on']}};
  for(const name of ['set_preset_mode','set_humidity','set_swing_horizontal_mode'])hass.services.climate[name]={};
  return {hass,config:moreInfoConfig(hass,'climate.ac').config};
}

test('standard details route globally by entity domain and name, with safe generic panels',()=>{
  const {hass}=fixture();
  assert.equal(moreInfoRoute(hass,{entityId:'climate.ac'}).config.device,'air_conditioner');
  assert.equal(moreInfoRoute(hass,{entityId:'climate.floor'}).config.device,'floor_heating');
  assert.equal(moreInfoRoute(hass,{entityId:'light.strip'}).config.device,'led_strip');
  assert.equal(moreInfoRoute(hass,{entityId:'sensor.temperature'}).rich,false);
  assert.equal(moreInfoRoute(hass,{entityId:'switch.vent'}).rich,false);
  hass.states['cover.curtain'].attributes.device_class='garage';
  assert.equal(moreInfoRoute(hass,{entityId:'cover.curtain'}).rich,false);
});

test('main lights use chandeliers while explicit wall, strip and spot light names stay specific',()=>{
  const {hass}=fixture(),id='light.room_fixture';
  for(const [name,device] of [['客厅主灯','pendant_light'],['主卧主灯','pendant_light'],['餐厅吊灯','pendant_light'],['Main light','pendant_light'],['客厅壁灯','wall_light'],['主灯灯带','led_strip'],['主灯射灯','spotlight'],['主灯筒灯','downlight']]){
    hass.states[id]={entity_id:id,state:'on',attributes:{friendly_name:name}};
    assert.equal(moreInfoConfig(hass,id).config.device,device,name);
  }
  hass.states['light.opaque']={entity_id:'light.opaque',state:'on',attributes:{friendly_name:'Light'}};
  hass.entities['light.opaque']={entity_id:'light.opaque',device_id:'main_fixture'};
  hass.devices.main_fixture={id:'main_fixture',name:'客厅主灯'};
  assert.equal(moreInfoConfig(hass,'light.opaque').config.device,'pendant_light');
  assert.ok(deviceGroups(hass,'pendant_light').some(group=>group.deviceId==='main_fixture'));
  assert.equal(moreInfoConfig(hass,'light.opaque',{}, {entities:{'light.opaque':{device:'wall_light'}}}).config.device,'wall_light');
});

test('washer child locks use a functional lock panel rather than a front-door illustration',()=>{
  const {hass}=fixture(),id='lock.washer_child_lock';
  hass.states[id]={...hass.states[id],state:'unlocked'};
  const result=moreInfoConfig(hass,id);
  assert.equal(result.rich,false);
  assert.equal(result.config.lock_kind,'child');
  assert.equal(moreInfoStateLabel(hass,id,result.config),'童锁已关闭');
  assert.equal(moreInfoConfig(hass,'lock.front_door').rich,true);
});

test('child-lock recognition uses the entity role and never a parent device name alone',()=>{
  const {hass}=fixture();
  hass.states['lock.opaque']={entity_id:'lock.opaque',state:'locked',attributes:{friendly_name:'功能'}};
  hass.entities['lock.opaque']={entity_id:'lock.opaque',original_name:'Child Lock',device_id:'controls'};
  hass.devices.controls={id:'controls',name:'洗衣机'};
  assert.equal(moreInfoLockKind(hass,'lock.opaque'),'child');
  delete hass.entities['lock.opaque'].original_name;
  hass.devices.controls.name='带童锁的门锁';
  assert.equal(moreInfoLockKind(hass,'lock.opaque'),'door');
  assert.equal(moreInfoConfig(hass,'lock.opaque',{entity:'sensor.washer',washer:{child_lock:'lock.opaque'}}).config.lock_kind,'child');
  for(const [id,name,raw] of [['switch.child_lock','蒸烤箱 童锁','on'],['input_boolean.child_lock','儿童锁','off'],['binary_sensor.child_lock','童锁状态','on']]){
    hass.states[id]={entity_id:id,state:raw,attributes:{friendly_name:name}};
    assert.equal(moreInfoConfig(hass,id).rich,false);
    assert.equal(moreInfoConfig(hass,id).config.lock_kind,'child');
  }
});

test('child-lock actions use the correct bound lock/switch and have child-lock confirmation text',()=>{
  const {hass}=fixture(),id='lock.washer_child_lock';
  hass.states[id].state='unlocked';
  const {config}=moreInfoConfig(hass,id);
  assert.deepEqual(moreInfoCapabilities(hass,config).controls[0].buttons.map(button=>button.label),['开启童锁']);
  assert.deepEqual(moreInfoCommand(hass,config,'lock'),{domain:'lock',service:'lock',data:{},target:{entity_id:id}});
  hass.states[id].state='locked';
  assert.equal(moreInfoCommand(hass,config,'unlock').confirmation,'确认关闭童锁？');
  const door=moreInfoConfig(hass,'lock.front_door').config;
  assert.equal(moreInfoCommand(hass,door,'unlock').confirmation,'确认解锁门锁？');
  hass.states['switch.child_lock']={entity_id:'switch.child_lock',state:'off',attributes:{friendly_name:'蒸烤箱童锁'}};
  const toggle=moreInfoConfig(hass,'switch.child_lock').config;
  assert.deepEqual(moreInfoCommand(hass,toggle,'power'),{domain:'switch',service:'turn_on',data:{},target:{entity_id:'switch.child_lock'}});
  hass.states['switch.child_lock'].state='on';
  assert.equal(moreInfoCommand(hass,toggle,'power').confirmation,'确认关闭童锁？');
  hass.states['binary_sensor.child_lock']={entity_id:'binary_sensor.child_lock',state:'on',attributes:{friendly_name:'童锁状态'}};
  const readOnly=moreInfoConfig(hass,'binary_sensor.child_lock').config;
  assert.equal(moreInfoCapabilities(hass,readOnly).controls.length,0);
  assert.throws(()=>moreInfoCommand(hass,readOnly,'power'));
});

test('child-lock controls recheck read-only, availability, transition states, PINs and current services',()=>{
  for(const change of [(h,c)=>{c.read_only=true;},h=>{h.connected=false;},h=>{h.states['lock.washer_child_lock'].state='unknown';},h=>{h.states['lock.washer_child_lock'].state='unavailable';},h=>{h.states['lock.washer_child_lock'].state='locking';},h=>{h.states['lock.washer_child_lock'].attributes.code_format='number';},h=>{delete h.services.lock.unlock;}]){
    const {hass}=fixture(),{config}=moreInfoConfig(hass,'lock.washer_child_lock');change(hass,config);
    assert.throws(()=>moreInfoCommand(hass,config,'unlock'));
  }
});

test('history, settings, custom native context, excluded and unknown entities keep native details',()=>{
  const {hass}=fixture();
  for(const detail of [{entityId:'climate.ac',view:'history'},{entityId:'climate.ac',tab:'settings'},{entityId:'climate.ac',data:{special:true}},{entityId:null},{entityId:'alarm_control_panel.home'},{entityId:'climate.missing'}])assert.equal(moreInfoRoute(hass,detail),null);
  for(const context of [{fromUrl:true},{parentElement:{}},{large:true},{large:false}])assert.equal(moreInfoRoute(hass,{entityId:'climate.ac',...context}),null);
  for(const options of [{enabled:false},{exclude_domains:['climate']},{exclude_entities:['climate.ac']}])assert.equal(moreInfoRoute(hass,{entityId:'climate.ac'},{},options),null);
  hass.states['lock.front_door'].attributes.code_format='number';
  assert.equal(moreInfoRoute(hass,{entityId:'lock.front_door'}),null);
});

test('source bindings and read-only mode survive, but a different entity is never substituted',()=>{
  const {hass}=fixture();
  const source={entity:'climate.ac',device:'air_conditioner',features:{humidity:'sensor.ac_humidity'},read_only:true};
  assert.deepEqual(moreInfoConfig(hass,'climate.ac',source).config.features,source.features);
  assert.equal(moreInfoConfig(hass,'light.wall',source).config.read_only,true);
  const override={entities:{'climate.ac':{device:'air_conditioner',entity:'climate.floor',name:'主卧空调'}}};
  assert.equal(moreInfoConfig(hass,'climate.ac',{},override).config.entity,'climate.ac');
  assert.equal(moreInfoConfig(hass,'climate.ac',{},override).config.name,'主卧空调');
});

test('device-registry discovery remains inside the selected physical device',()=>{
  const {hass}=fixture();
  const selected=hass.entities['climate.ac'].device_id;
  const result=moreInfoConfig(hass,'climate.ac');
  for(const entity of Object.values(result.config.features||{}))assert.equal(hass.entities[entity].device_id,selected);
  const invalid={entities:{'climate.ac':{device:'not_a_device'}}};
  assert.equal(moreInfoConfig(hass,'climate.ac',{},invalid),null);
});

test('climate extras use actual supported features, options and services',()=>{
  const {hass,config}=fixture();
  assert.deepEqual(moreInfoExtraControls(hass,config).map(control=>control.id),['preset_mode','swing_horizontal_mode','target_temp_low','target_temp_high','humidity']);
  const command=moreInfoExtraCommand(hass,config,'preset_mode','eco');
  assert.deepEqual(command,{domain:'climate',service:'set_preset_mode',data:{preset_mode:'eco'},target:{entity_id:'climate.ac'}});
  assert.throws(()=>moreInfoExtraCommand(hass,config,'preset_mode','invented'));
  delete hass.services.climate.set_preset_mode;
  assert.throws(()=>moreInfoExtraCommand(hass,config,'preset_mode','eco'));
});

test('dual temperatures snap to steps, preserve the other bound and reject crossing',()=>{
  const {hass,config}=fixture();
  assert.deepEqual(moreInfoExtraCommand(hass,config,'target_temp_low',21.3).data,{target_temp_low:21.5,target_temp_high:27});
  assert.throws(()=>moreInfoExtraCommand(hass,config,'target_temp_low',30),/下限/);
  assert.throws(()=>moreInfoExtraCommand(hass,config,'target_temp_high',18),/下限/);
  assert.deepEqual(moreInfoExtraCommand(hass,config,'humidity',100).data,{humidity:75});
  for(const invalid of ['',null,NaN,Infinity,'not a number'])assert.throws(()=>moreInfoExtraCommand(hass,config,'humidity',invalid));
});

test('stale controls cannot operate read-only, disconnected, offline or newly unsupported entities',()=>{
  for(const change of [(hass,c)=>{c.read_only=true;},hass=>{hass.connected=false;},hass=>{hass.states['climate.ac'].state='unavailable';},hass=>{hass.states['climate.ac'].attributes.supported_features=0;}]){
    const {hass,config}=fixture();change(hass,config);
    assert.deepEqual(moreInfoExtraControls(hass,config),[]);
    assert.throws(()=>moreInfoExtraCommand(hass,config,'preset_mode','eco'));
  }
});

test('fan preset commands stay in the fan domain and require the fan preset feature',()=>{
  const {hass}=fixture();
  hass.states['fan.stove'].attributes={...hass.states['fan.stove'].attributes,supported_features:9,preset_modes:['auto','sleep'],preset_mode:'auto'};
  hass.services.fan.set_preset_mode={};
  const {config}=moreInfoConfig(hass,'fan.stove');
  assert.deepEqual(moreInfoExtraCommand(hass,config,'preset_mode','sleep'),{domain:'fan',service:'set_preset_mode',data:{preset_mode:'sleep'},target:{entity_id:'fan.stove'}});
});

test('a cleared unlock sensor retains history and event entities use the reported event type',()=>{
  const {hass}=fixture();
  hass.states['sensor.door_lock_unlock_event']={entity_id:'sensor.door_lock_unlock_event',state:'无',attributes:{friendly_name:'门锁 开锁事件'}};
  hass.states['event.front_door']={entity_id:'event.front_door',state:'2026-11-24T18:43:32+00:00',attributes:{friendly_name:'开锁事件',event_type:'fingerprint'}};
  assert.equal(moreInfoRoute(hass,{entityId:'sensor.door_lock_unlock_event'}).rich,false);
  assert.equal(moreInfoStateLabel(hass,'sensor.door_lock_unlock_event'),'无');
  assert.equal(moreInfoRoute(hass,{entityId:'event.front_door'}).rich,false);
  assert.equal(moreInfoStateLabel(hass,'event.front_door'),'fingerprint');
  for(const id of ['sensor.door_lock_unlock_event','event.front_door','sensor.temperature','binary_sensor.door_lock_contact'])assert.equal(moreInfoHasHistory(id),true);
  assert.equal(moreInfoHasHistory('media_player.music'),false);
  hass.states['event.front_door'].state='unavailable';
  assert.equal(moreInfoStateLabel(hass,'event.front_door'),'设备离线');
  hass.connected=false;
  assert.equal(moreInfoStateLabel(hass,'event.front_door'),'连接已断开');
});
