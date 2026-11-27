import {createMock, state} from './mock.js';

// Names and readings from Home Assistant MCP on 2026-11-02 (Asia/Shanghai).
// MCP does not expose entity IDs or supported_features. IDs and capabilities
// below are local interaction fixtures, never installation-ready bindings.
export function createHomeContext(){
  const mock=createMock();
  mock.states={};mock.entities={};mock.devices={};
  const add=(id,value,name,attributes={})=>mock.states[id]=state(id,value,{friendly_name:name,...attributes});
  const sensor=(id,value,name,unit)=>add(id,value,name,{unit_of_measurement:unit});
  const configs=[];
  for(const [key,room,temperature,humidity] of [
    ['living','客厅',22,59],['bedroom','主卧',23.5,null],['dining','餐厅',22.5,58],['study','书房',22,57],['guest','次卧',22,58],
  ]){
    const entity='climate.preview_'+key;
    add(entity,'off',room+'中央空调',{temperature:26,current_temperature:temperature,supported_features:385,min_temp:16,max_temp:32,target_temp_step:.5,hvac_modes:['off','cool','heat','auto','dry']});
    const features={outdoor_temperature:'sensor.preview_'+key+'_outdoor',self_clean:'switch.preview_'+key+'_self_clean',presence:'switch.preview_'+key+'_presence'};
    sensor(features.outdoor_temperature,18.5,'室外机温度','°C');
    add(features.self_clean,'off','自清洁');add(features.presence,'off','随身感');
    if(humidity!==null){features.humidity='sensor.preview_'+key+'_humidity';sensor(features.humidity,humidity,'当前湿度','%');}
    configs.push({device:'air_conditioner',entity,name:room+'空调',room,features});
  }
  sensor('sensor.preview_fridge',3,'冷藏室显示温度','°C');
  sensor('sensor.preview_freezer',-18,'冷冻室显示温度','°C');
  sensor('sensor.preview_variable',-7,'变温室显示温度','°C');
  add('switch.preview_rapid_freeze','off','速冻锁鲜');add('switch.preview_smart_storage','off','智能存储');
  configs.push({device:'refrigerator',entity:'sensor.preview_fridge',name:'三温区冰箱',room:'厨房',features:{fridge_temperature:'sensor.preview_fridge',freezer_temperature:'sensor.preview_freezer',variable_temperature:'sensor.preview_variable',rapid_freeze:'switch.preview_rapid_freeze',smart_storage:'switch.preview_smart_storage'}});
  add('vacuum.preview_robot','docked','S50 Ultra 超薄上下水版',{supported_features:8192|4096|512|8|4});
  add('switch.preview_auto_drying','on','自动烘干');add('switch.preview_silent_drying','off','静音烘干');
  configs.push({device:'vacuum',entity:'vacuum.preview_robot',name:'S50 Ultra 扫拖机器人',room:'客厅',features:{auto_drying:'switch.preview_auto_drying',silent_drying:'switch.preview_silent_drying'}});
  for(const [key,room,name,device,dimmable] of [
    ['spot','客厅','幕布左边射灯','spotlight',true],['strip','客厅','客厅灯带','led_strip',true],['pendant','餐厅','餐厅吊灯','pendant_light',false],
  ]){
    const entity='light.preview_'+key;
    add(entity,'off',name,{supported_color_modes:[dimmable?'brightness':'onoff'],...(dimmable?{brightness:null}:{})});
    configs.push({device,entity,name,room});
  }
  add('cover.preview_living','open','客厅窗帘',{current_position:100,supported_features:15});
  add('cover.preview_bedroom','unavailable','主卧窗帘',{supported_features:15});
  add('cover.preview_lift','unknown','客厅投影仪升降支架',{supported_features:15});
  configs.push({device:'curtain',entity:'cover.preview_living',name:'客厅窗帘',room:'客厅'},{device:'curtain',entity:'cover.preview_bedroom',name:'主卧窗帘',room:'主卧'},{device:'projector_lift',entity:'cover.preview_lift',name:'投影仪升降支架',room:'客厅'});
  sensor('sensor.preview_bedroom_temperature','unavailable','主卧温湿度传感器 温度','°C');
  sensor('sensor.preview_bedroom_humidity','unavailable','主卧温湿度传感器 湿度','%');
  configs.push({device:'temperature_humidity',entity:'sensor.preview_bedroom_temperature',secondary_entity:'sensor.preview_bedroom_humidity',name:'主卧温湿度计',room:'主卧'});
  for(const [key,name] of [['power','电源'],['start','启停开关'],['night','夜间模式'],['care','忘取无忧'],['memory','程序记忆']])add('switch.preview_washer_'+key,'off',name);
  add('binary_sensor.preview_washer_door','off','门状态');
  configs.push({device:'washing_machine',entity:'switch.preview_washer_power',name:'滚筒洗衣机',room:'生活阳台',washer:{power:'switch.preview_washer_power',start:'switch.preview_washer_start',night:'switch.preview_washer_night',care:'switch.preview_washer_care',memory:'switch.preview_washer_memory',door:'binary_sensor.preview_washer_door'}});
  const priority=['climate.preview_living','sensor.preview_fridge','vacuum.preview_robot','light.preview_spot','cover.preview_living','switch.preview_washer_power'];
  configs.sort((a,b)=>(priority.indexOf(a.entity)<0?99:priority.indexOf(a.entity))-(priority.indexOf(b.entity)<0?99:priority.indexOf(b.entity)));
  return {mock,configs};
}
