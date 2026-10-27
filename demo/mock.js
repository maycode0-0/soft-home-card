export const state=(id,value,attributes={})=>({entity_id:id,state:String(value),attributes,last_changed:new Date().toISOString(),last_updated:new Date().toISOString()});
const light=(name,brightness=204)=>({friendly_name:name,brightness,supported_color_modes:['color_temp'],color_mode:'color_temp',color_temp_kelvin:3000,min_color_temp_kelvin:2700,max_color_temp_kelvin:6500});
const climate=(name,temperature=26)=>({friendly_name:name,supported_features:385,temperature,current_temperature:24.6,min_temp:16,max_temp:32,target_temp_step:.5,hvac_modes:['off','cool','heat','auto','dry'],hvac_action:'cooling'});
export function createMock(){
  const states={
    'sensor.washer':state('sensor.washer','洗涤中',{friendly_name:'阳台洗衣机'}),
    'sensor.remaining':state('sensor.remaining',27,{unit_of_measurement:'min',friendly_name:'剩余时间'}),
    'sensor.progress':state('sensor.progress',72),
    'sensor.power':state('sensor.power',1870,{unit_of_measurement:'W',friendly_name:'功率'}),
    'sensor.dryer':state('sensor.dryer','烘干中',{friendly_name:'阳台烘干机'}),
    'sensor.dryer_remaining':state('sensor.dryer_remaining',48,{unit_of_measurement:'min'}),
    'button.wash_start':state('button.wash_start','2026-01-01T00:00:00Z',{friendly_name:'开始洗衣'}),
    'media_player.projector':state('media_player.projector','playing',{friendly_name:'客厅投影仪',volume_level:.35,supported_features:388,source:'HDMI 1',media_title:'电影时光'}),
    'cover.lift':state('cover.lift','closing',{friendly_name:'投影仪升降支架',current_position:35,supported_features:15}),
    'cover.screen':state('cover.screen','closed',{friendly_name:'客厅幕布',current_position:0,supported_features:15}),
    'climate.ac':state('climate.ac','cool',climate('客厅空调')),
    'sensor.fridge':state('sensor.fridge',4,{friendly_name:'冰箱冷藏温度',unit_of_measurement:'°C'}),
    'sensor.freezer':state('sensor.freezer',-18,{friendly_name:'冷冻温度',unit_of_measurement:'°C'}),
    'fan.stove':state('fan.stove','on',{friendly_name:'集成灶烟机',percentage:66,supported_features:1}),
    'water_heater.bath':state('water_heater.bath','eco',{friendly_name:'浴室热水器',supported_features:3,temperature:55,current_temperature:53,min_temp:35,max_temp:75,operation_list:['eco','performance'],operation_mode:'eco'}),
    'climate.floor':state('climate.floor','heat',{...climate('客厅地暖',24),hvac_action:'heating',hvac_modes:['off','heat']}),
    'light.wall':state('light.wall','on',light('卧室壁灯',166)),
    'light.spot':state('light.spot','on',light('客厅射灯')),
    'light.down':state('light.down','on',{...light('走廊筒灯',191),color_temp_kelvin:4000}),
    'light.pendant':state('light.pendant','on',light('餐厅吊灯',230)),
    'light.strip':state('light.strip','on',{...light('客厅灯带',115),color_temp_kelvin:2700}),
    'sensor.tea':state('sensor.tea',85,{friendly_name:'茶吧机水温',unit_of_measurement:'°C'}),
    'button.tea':state('button.tea','2026-01-01T00:00:00Z',{friendly_name:'取水'}),
    'light.mirror':state('light.mirror','on',{...light('浴室镜灯',179),color_temp_kelvin:4000}),
    'switch.defog':state('switch.defog','off',{friendly_name:'除雾'}),
    'sensor.temperature':state('sensor.temperature',24.6,{friendly_name:'卧室温度',unit_of_measurement:'°C',device_class:'temperature'}),
    'sensor.humidity':state('sensor.humidity',56,{friendly_name:'相对湿度',unit_of_measurement:'%',device_class:'humidity'}),
    'climate.bath':state('climate.bath','heat',{...climate('浴室暖风',28),hvac_action:'heating',hvac_modes:['off','heat','fan_only']}),
    'switch.vent':state('switch.vent','off',{friendly_name:'换气'}),
  };
  const definitions={light:['turn_on','turn_off'],cover:['open_cover','close_cover','stop_cover','set_cover_position'],climate:['set_temperature','set_hvac_mode','turn_on','turn_off'],water_heater:['set_temperature','set_operation_mode'],fan:['turn_on','turn_off','set_percentage'],media_player:['turn_on','turn_off','volume_set'],button:['press'],switch:['turn_on','turn_off'],script:['turn_on']};
  const mock={states,services:Object.fromEntries(Object.entries(definitions).map(([d,list])=>[d,Object.fromEntries(list.map(s=>[s,{}]))])),config:{unit_system:{temperature:'°C'}},themes:{darkMode:false},connected:true,calls:[],rejectNext:false,
    formatEntityState:s=>String(s.state),
    async callService(domain,service,data,target){
      this.calls.push({domain,service,data,target});
      if(this.rejectNext){this.rejectNext=false;throw new Error('模拟：设备连接失败');}
      const id=target?.entity_id,s=this.states[id];if(!s)return;
      let value=s.state,attributes={...s.attributes};
      if(service==='turn_on')value='on';if(service==='turn_off')value='off';
      if(data.brightness_pct!==undefined)attributes.brightness=Math.round(data.brightness_pct/100*255);
      if(data.color_temp_kelvin!==undefined)attributes.color_temp_kelvin=data.color_temp_kelvin;
      if(data.temperature!==undefined)attributes.temperature=data.temperature;
      if(data.volume_level!==undefined)attributes.volume_level=data.volume_level;
      if(data.percentage!==undefined)attributes.percentage=data.percentage;
      if(data.position!==undefined){attributes.current_position=data.position;value=data.position===0?'closed':'open';}
      if(data.hvac_mode!==undefined)value=data.hvac_mode;
      if(data.operation_mode!==undefined){attributes.operation_mode=data.operation_mode;value=data.operation_mode;}
      if(service==='open_cover')value='opening';if(service==='close_cover')value='closing';if(service==='stop_cover')value=attributes.current_position===0?'closed':'open';
      this.states={...this.states,[id]:state(id,value,attributes)};this.notify?.();
    }};
  mock.callService=mock.callService.bind(mock);
  return mock;
}
export const DEMO_CONFIGS=[
  {device:'washing_machine',entity:'sensor.washer',room:'阳台 · 洗护',primary_entity:'sensor.remaining',primary_label:'剩余时间',progress_entity:'sensor.progress',power_entity:'sensor.power',auxiliary:[{entity:'button.wash_start',name:'开始洗衣'}]},
  {device:'dryer',entity:'sensor.dryer',room:'阳台 · 洗护',primary_entity:'sensor.dryer_remaining',primary_label:'剩余时间'},
  {device:'projector',entity:'media_player.projector',room:'客厅 · 影音'},
  {device:'projector_lift',entity:'cover.lift',room:'客厅 · 影音',invert_position:true},
  {device:'screen',entity:'cover.screen',room:'客厅 · 影音',invert_position:true},
  {device:'air_conditioner',entity:'climate.ac',room:'客厅 · 温控'},
  {device:'refrigerator',entity:'sensor.fridge',room:'厨房 · 保鲜',secondary_entity:'sensor.freezer'},
  {device:'integrated_stove',entity:'fan.stove',room:'厨房 · 烹饪'},
  {device:'water_heater',entity:'water_heater.bath',room:'浴室 · 热水'},
  {device:'floor_heating',entity:'climate.floor',room:'客厅 · 温控'},
  {device:'wall_light',entity:'light.wall',room:'卧室 · 氛围'},
  {device:'spotlight',entity:'light.spot',room:'客厅 · 重点照明'},
  {device:'downlight',entity:'light.down',room:'走廊 · 基础照明'},
  {device:'pendant_light',entity:'light.pendant',room:'餐厅 · 用餐'},
  {device:'led_strip',entity:'light.strip',room:'客厅 · 氛围'},
  {device:'tea_machine',entity:'sensor.tea',room:'餐厅 · 饮水',auxiliary:[{entity:'button.tea',name:'取水'}]},
  {device:'bathroom_mirror',entity:'light.mirror',room:'浴室 · 镜前',auxiliary:[{entity:'switch.defog',name:'除雾'}]},
  {device:'temperature_humidity',entity:'sensor.temperature',room:'卧室 · 环境',secondary_entity:'sensor.humidity'},
  {device:'bathroom_heater',entity:'climate.bath',room:'浴室 · 温控',auxiliary:[{entity:'switch.vent',name:'换气'}]},
];
