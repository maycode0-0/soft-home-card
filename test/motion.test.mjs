import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceMotion} from '../src/motion.js';
import {buildView,validateConfig} from '../src/model.js';
import {washerView} from '../src/washer.js';
import {createMock,DEMO_CONFIGS} from '../demo/mock.js';

const config=device=>validateConfig(DEMO_CONFIGS.find(c=>c.device===device));
function motion(h,c){const v=buildView(h,c);return deviceMotion(h,c,v,c.device==='washing_machine'?washerView(h,c,v):null);}

test('washer phase and power stop motion even when the start switch remains on',()=>{
  const h=createMock(),c=config('washing_machine');
  assert.equal(motion(h,c),'wash');
  for(const value of ['paused','idle','finished','已暂停','待机中']){
    h.states[c.washer.phase].state=value;assert.equal(motion(h,c),'',value);
  }
  h.states[c.washer.phase].state='spinning';assert.equal(motion(h,c),'wash');
  h.states[c.washer.power].state='off';assert.equal(motion(h,c),'');
  const power={device:'washing_machine',entity:c.washer.power};
  h.states[power.entity].state='on';assert.equal(motion(h,validateConfig(power)),'','power alone is not a wash cycle');
});

test('climate action takes priority over the selected operating mode',()=>{
  const h=createMock(),c=config('air_conditioner'),s=h.states[c.entity];
  assert.equal(motion(h,c),'air');
  s.attributes.hvac_action='idle';assert.equal(motion(h,c),'');
  s.attributes.hvac_action='heating';assert.equal(motion(h,c),'air');
  s.state='off';assert.equal(motion(h,c),'');
  s.state='heat';h.connected=false;assert.equal(motion(h,c),'');
});

test('numeric sensors do not imply operation; explicit heating and fast freeze do',()=>{
  const h=createMock();
  for(const device of ['tea_machine','temperature_humidity','water_heater','refrigerator'])assert.equal(motion(h,config(device)),'',device);
  h.states['sensor.tea'].state='heating';assert.equal(motion(h,config('tea_machine')),'heat');
  h.states['sensor.dryer'].state='烘干中';assert.equal(motion(h,config('dryer')),'dry');
  h.states['sensor.dryer'].state='48';assert.equal(motion(h,config('dryer')),'');
  const fridge=config('refrigerator');h.states[fridge.features.rapid_freeze].state='on';assert.equal(motion(h,fridge),'freeze');
});

test('motion describes operation in read-only mode and stops for unavailable devices',()=>{
  const h=createMock(),c={...config('wall_light'),read_only:true};
  assert.equal(motion(h,c),'light');
  for(const value of ['off','unavailable','unknown']){h.states[c.entity].state=value;assert.equal(motion(h,c),'',value);}
  const vacuum=config('vacuum');
  for(const [value,expected] of [['cleaning','clean'],['returning','return'],['docked',''],['paused',''],['error','']]){
    h.states[vacuum.entity].state=value;assert.equal(motion(h,vacuum),expected,value);
  }
  const cover=config('curtain');
  for(const [value,expected] of [['opening','opening'],['closing','closing'],['open',''],['closed','']]){
    h.states[cover.entity].state=value;assert.equal(motion(h,cover),expected,value);
  }
});
