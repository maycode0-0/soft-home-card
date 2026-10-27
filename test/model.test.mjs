import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,buildView,commandFor,auxiliaryCommand,actionCommand,capabilities,number,escapeHTML} from '../src/model.js';
import {washerView,washerCommand} from '../src/washer.js';
import {createMock,DEMO_CONFIGS} from '../demo/mock.js';
const state=(id,value,attributes={})=>({entity_id:id,state:value,attributes});
const hass=(states,services={})=>({states,services,connected:true,config:{unit_system:{temperature:'°C'}}});
const cfg=(device,entity,rest={})=>validateConfig({device,entity,...rest});
const services={light:{turn_on:{},turn_off:{}},cover:{open_cover:{},close_cover:{},stop_cover:{},set_cover_position:{}},climate:{set_temperature:{},set_hvac_mode:{},turn_on:{},turn_off:{}},media_player:{volume_set:{}},water_heater:{set_temperature:{},set_operation_mode:{}},switch:{turn_on:{},turn_off:{}},button:{press:{}},script:{turn_on:{}}};

test('washer controls use bound entities and recheck availability, services and read-only at click time',()=>{
  const h=createMock(),c=validateConfig(DEMO_CONFIGS[0]);
  assert.deepEqual(washerCommand(h,c,'start'),{domain:'switch',service:'turn_off',data:{},target:{entity_id:'switch.washer_start_pause'}});
  h.states['switch.washer_start_pause'].state='off';
  assert.equal(washerCommand(h,c,'start').service,'turn_on');
  assert.equal(washerCommand(h,c,'power').target.entity_id,'switch.washer_power');
  assert.throws(()=>washerCommand(h,{...c,read_only:true},'start'));
  h.connected=false;assert.throws(()=>washerCommand(h,c,'start'));h.connected=true;
  h.states['switch.washer_start_pause'].state='unavailable';assert.throws(()=>washerCommand(h,c,'start'));
  delete h.services.switch.turn_off;
  assert.equal(washerView(h,c,buildView(h,c)).controls.find(x=>x.key==='power').disabled,true);
});

test('washer distinguishes unknown values, zero usage, safety states and real progress',()=>{
  const h=createMock(),c=validateConfig(DEMO_CONFIGS[0]),view=()=>washerView(h,c,buildView(h,c));
  h.states['sensor.washer_energy_consumption'].state='0';
  h.states['select.washer_program'].state='unknown';
  h.states['sensor.progress'].state='unknown';
  let w=view();assert.equal(w.progress,null);assert.equal(w.fields.program.valid,false);assert.equal(w.fields.energy.text,'0');
  assert.equal(w.fields.door.text,'已关闭');assert.equal(w.fields.child_lock.text,'已锁定');assert.equal(w.fields.error.text,'无故障');
  h.states['sensor.washer_error_code'].state='E21';h.states['binary_sensor.washer_overheat'].state='on';
  assert.deepEqual(view().alerts.map(x=>x.key),['overheat','error']);
  h.states['sensor.progress'].state='0';assert.equal(view().progress,0);
  h.connected=false;w=view();assert.equal(w.progress,null);assert.ok(Object.values(w.fields).every(f=>f.text==='—'&&!f.valid));
  assert.ok(w.controls.every(control=>control.disabled));assert.equal(w.alerts.length,0);
});

test('washer config validates bindings and preserves legacy optional controls',()=>{
  for(const washer of [[],true,'sensor.test',{power:'bad'},{unexpected:'sensor.test'},{power:42}])assert.throws(()=>cfg('washing_machine','sensor.test',{washer}));
  const h=createMock(),c=cfg('washing_machine','sensor.washer',{auxiliary:[{entity:'button.wash_start'}]});
  assert.equal(washerView(h,c,buildView(h,c)).controls.length,0);
  assert.equal(auxiliaryCommand(h,c,0).service,'press');
});

test('reject malformed config, preserve optional UI settings',()=>{
  assert.throws(()=>validateConfig({device:'missing',entity:'light.test'}));
  assert.throws(()=>cfg('wall_light','bad-id'));
  assert.throws(()=>cfg('wall_light','light.test',{metrics:[{entity:'sensor.test',precision:-1}]}));
  assert.throws(()=>cfg('wall_light','light.test',{actions:[{label:'Bad',action:'perform-action',perform_action:'turn_on'}]}));
  assert.equal(cfg('wall_light','light.test',{grid_options:{columns:12}}).grid_options.columns,12);
});
test('numeric conversion does not turn unknown values into zero',()=>{
  for(const input of [null,undefined,'','  ',[],true,'unknown',NaN,Infinity])assert.equal(number(input),null);
  assert.equal(number('0'),0);
});
test('brightness translates 255-scale state to percent; write uses brightness_pct',()=>{
  const h=hass({'light.test':state('light.test','on',{brightness:128,supported_color_modes:['color_temp'],min_color_temp_kelvin:2700,max_color_temp_kelvin:6500,color_temp_kelvin:3500})},services),c=cfg('wall_light','light.test');
  assert.equal(buildView(h,c).primary.text,'50');
  assert.deepEqual(commandFor(h,c,'brightness',65),{domain:'light',service:'turn_on',data:{brightness_pct:65},target:{entity_id:'light.test'}});
  assert.deepEqual(commandFor(h,c,'color_temperature',9000).data,{color_temp_kelvin:6500});
});
test('on/off-only lights do not get false brightness or color controls',()=>{
  const h=hass({'light.test':state('light.test','on',{supported_color_modes:['onoff']})},services),c=cfg('wall_light','light.test');
  assert.equal(buildView(h,c).primary.text,'ON');
  assert.equal(capabilities(h,c,h.states[c.entity]).controls.length,0);
  assert.throws(()=>commandFor(h,c,'brightness',50));
});
test('legacy mired bounds become kelvin without reversing warm and cool',()=>{
  const h=hass({'light.test':state('light.test','on',{brightness:128,supported_color_modes:['color_temp'],min_mireds:153,max_mireds:370,color_temp:250})},services),c=cfg('wall_light','light.test');
  const control=capabilities(h,c,h.states[c.entity]).controls.find(x=>x.id==='color_temperature');
  assert.equal(control.min,2703);assert.equal(control.max,6536);assert.equal(control.value,4000);
});
test('climate honors temperature step and clamps limits',()=>{
  const h=hass({'climate.test':state('climate.test','cool',{supported_features:1,temperature:26,min_temp:16,max_temp:30,target_temp_step:.5,hvac_modes:['off','cool','heat']})},services),c=cfg('air_conditioner','climate.test');
  assert.deepEqual(commandFor(h,c,'temperature',45).data,{temperature:30});
  assert.deepEqual(commandFor(h,c,'temperature',23.7).data,{temperature:23.5});
  assert.throws(()=>commandFor(h,c,'mode','unsupported'));
  assert.equal(commandFor(h,c,'mode','heat').data.hvac_mode,'heat');
});
test('range-only thermostats do not receive single-setpoint writes',()=>{
  const h=hass({'climate.test':state('climate.test','heat_cool',{supported_features:2,target_temp_low:18,target_temp_high:26,min_temp:10,max_temp:30})},services),c=cfg('air_conditioner','climate.test');
  assert.throws(()=>commandFor(h,c,'temperature',22));
});
test('cover inversion is symmetric; stop action is independent',()=>{
  const h=hass({'cover.test':state('cover.test','open',{supported_features:15,current_position:35})},services),c=cfg('screen','cover.test',{invert_position:true});
  assert.equal(buildView(h,c).primary.text,'65');
  assert.deepEqual(commandFor(h,c,'position',80).data,{position:20});
  assert.equal(commandFor(h,c,'stop').service,'stop_cover');
  h.states[c.entity]=state(c.entity,'open',{supported_features:3,current_position:35});
  assert.throws(()=>commandFor(h,c,'stop'));assert.throws(()=>commandFor(h,c,'position',50));
});
test('missing, offline, unknown, disconnected and read-only disable writes',()=>{
  const c=cfg('wall_light','light.test');
  for(const value of ['unavailable','unknown']){
    const h=hass({'light.test':state('light.test',value,{brightness:128,supported_color_modes:['brightness']})},services);
    assert.equal(buildView(h,c).primary.text,'—');assert.throws(()=>commandFor(h,c,'power'));
  }
  assert.equal(buildView(hass({},services),c).status,'实体未找到');
  const h=hass({'light.test':state('light.test','on',{supported_color_modes:['brightness'],brightness:128})},services);
  assert.throws(()=>commandFor(h,{...c,read_only:true},'power'));
  h.connected=false;assert.throws(()=>commandFor(h,c,'brightness',50));
});
test('remaining-time sensor and zero-valued power are represented honestly',()=>{
  const h=hass({'sensor.washer':state('sensor.washer','running'),'sensor.remaining':state('sensor.remaining','27',{unit_of_measurement:'min'}),'sensor.power':state('sensor.power','0',{unit_of_measurement:'W'}),'sensor.progress':state('sensor.progress','67')});
  const v=buildView(h,cfg('washing_machine','sensor.washer',{primary_entity:'sensor.remaining',primary_label:'剩余时间',power_entity:'sensor.power',progress_entity:'sensor.progress'}));
  assert.equal(v.primary.text,'27');assert.equal(v.primary.unit,'min');assert.equal(v.primary.ratio,.67);assert.equal(v.power.text,'0');
});
test('sensor card never infers a power switch',()=>{
  const h=hass({'sensor.temp':state('sensor.temp','24.6',{device_class:'temperature',unit_of_measurement:'°C'})},services),c=cfg('temperature_humidity','sensor.temp');
  assert.equal(buildView(h,c).primary.text,'24.6');assert.equal(buildView(h,c).caps.power,null);assert.throws(()=>commandFor(h,c,'power'));
});
test('auxiliary actions target their own entity; scripts do not inherit main entity',()=>{
  const h=hass({'light.mirror':state('light.mirror','on'),'switch.defog':state('switch.defog','off')},services),c=cfg('bathroom_mirror','light.mirror',{auxiliary:[{entity:'switch.defog'}],actions:[{label:'开始',action:'perform-action',perform_action:'script.turn_on',target:{entity_id:'script.start'}}]});
  assert.deepEqual(auxiliaryCommand(h,c,0).target,{entity_id:'switch.defog'});
  assert.deepEqual(actionCommand(h,c,0).target,{entity_id:'script.start'});
  const explicit=cfg('bathroom_mirror','light.mirror',{actions:[{label:'开始',action:'perform-action',perform_action:'script.turn_on',data:{entity_id:'script.start'}}]});
  assert.equal(actionCommand(h,explicit,0).target,undefined);
});
test('water heater uses operation_mode field and media volume maps to 0–1',()=>{
  const h=hass({'water_heater.test':state('water_heater.test','eco',{supported_features:3,min_temp:35,max_temp:75,temperature:55,operation_list:['eco','performance'],operation_mode:'eco'}),'media_player.test':state('media_player.test','playing',{supported_features:4,volume_level:.35})},services);
  assert.deepEqual(commandFor(h,cfg('water_heater','water_heater.test'),'mode','performance').data,{operation_mode:'performance'});
  assert.deepEqual(commandFor(h,cfg('projector','media_player.test'),'volume',55).data,{volume_level:.55});
});
test('user/device text is escaped at HTML boundaries',()=>assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
test('overview attributes use readable labels and off climate does not show stale heating',()=>{
  const h=hass({'climate.test':state('climate.test','off',{hvac_action:'heating',current_temperature:22})},services),c=cfg('floor_heating','climate.test');
  assert.equal(buildView(h,c).summary,'已关闭');
  assert.equal(buildView(h,c).metrics.find(m=>m.name==='运行状态').text,'已关闭');
});
