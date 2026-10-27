import { DOMAIN } from './model.js';

const TYPE_MATCH = {
  washing_machine: /洗衣|洗烘|滚筒|波轮|washing[ _-]?machine|washer|laundry/i,
  dryer: /烘干|干衣|洗烘|dryer|tumble/i,
  projector: /投影|projector/i,
  projector_lift: /投影.*(?:升降|支架)|(?:升降|支架).*投影|projector.*(?:lift|mount)|(?:lift|mount).*projector/i,
  screen: /幕布|投影幕|projector[ _-]?screen|projection[ _-]?screen/i,
  air_conditioner: /空调|air[ _-]?condition|(?:^|[ ._-])ac(?:$|[ ._-])/i,
  refrigerator: /冰箱|冷藏|冷冻|fridge|refrigerator|freezer/i,
  integrated_stove: /集成灶|烟机|油烟|灶具|stove|cooker[ _-]?hood|range[ _-]?hood/i,
  water_heater: /热水器|water[ _-]?heater|water[ _-]?boiler/i,
  floor_heating: /地暖|floor[ _-]?heat|underfloor/i,
  wall_light: /壁灯|wall[ _-]?(?:light|lamp)|sconce/i,
  spotlight: /射灯|spot[ _-]?light/i,
  downlight: /筒灯|down[ _-]?light|recessed/i,
  pendant_light: /吊灯|pendant|chandelier/i,
  led_strip: /灯带|灯条|led[ _-]?strip|light[ _-]?strip/i,
  tea_machine: /茶吧|饮水|净饮|tea[ _-]?machine|water[ _-]?dispenser|kettle/i,
  bathroom_mirror: /浴室镜|镜灯|镜前|bathroom[ _-]?mirror|mirror/i,
  temperature_humidity: /温湿度|温度|湿度|thermo|hygro|temperature|humidity/i,
  bathroom_heater: /浴霸|暖风机|bathroom[ _-]?heat|bath[ _-]?heat/i,
};
const MAIN_DOMAINS = {
  washing_machine:['sensor','switch','select','binary_sensor'], dryer:['sensor','switch','select','binary_sensor'],
  projector:['media_player','switch','remote','sensor'], projector_lift:['cover','switch','sensor'], screen:['cover','switch','sensor'],
  air_conditioner:['climate','switch','sensor'], refrigerator:['sensor','number','climate','switch'],
  integrated_stove:['fan','switch','sensor'], water_heater:['water_heater','climate','switch','sensor'], floor_heating:['climate','switch','sensor'],
  wall_light:['light','switch'], spotlight:['light','switch'], downlight:['light','switch'], pendant_light:['light','switch'], led_strip:['light','switch'],
  tea_machine:['sensor','water_heater','number','switch'], bathroom_mirror:['light','switch'], temperature_humidity:['sensor'], bathroom_heater:['climate','fan','switch','sensor'],
};
const registryMap=(value,key)=>Array.isArray(value)?Object.fromEntries(value.map(item=>[item[key],item])):value||{};
export const normalizedSearch = value => String(value||'').normalize('NFKC').toLocaleLowerCase().trim();
export function searchItems(items,query) {
  const tokens=normalizedSearch(query).split(/\s+/).filter(Boolean);
  return items.filter(item=>tokens.every(token=>normalizedSearch(`${item.label} ${item.description||''} ${item.value} ${item.search||''}`).includes(token)));
}
export function deviceGroups(hass,kind,showAll=false) {
  const entities=registryMap(hass?.entities,'entity_id'),devices=registryMap(hass?.devices,'id'),groups=new Map();
  for(const [id,state] of Object.entries(hass?.states||{})) {
    const entry=entities[id]||{},device=devices[entry.device_id]||{};
    // An integration's shared stable numeric identifier can group legacy entities.
    // Otherwise keep unregistered entities separate; never group all devices of one brand.
    const legacy=id.split('.')[1]?.match(/^(.+?_\d{6,})(?:_|$)/)?.[1];
    const key=entry.device_id?`device:${entry.device_id}`:legacy?`legacy:${legacy}`:`entity:${id}`;
    if(!groups.has(key))groups.set(key,{key,deviceId:entry.device_id||'',label:device.name_by_user||device.name||state.attributes?.friendly_name||id,model:device.model||'',manufacturer:device.manufacturer||'',entityIds:[],texts:[]});
    const group=groups.get(key);group.entityIds.push(id);
    group.texts.push(id,state.attributes?.friendly_name||'',entry.name||'',entry.original_name||'',device.model||'',device.name||'',device.name_by_user||'');
  }
  return [...groups.values()].filter(group=> {
    if(showAll)return true;
    const text=group.texts.join(' ');
    if(kind==='projector'&&/升降|支架|lift|mount|幕布|screen/i.test(text))return false;
    return !!TYPE_MATCH[kind]?.test(text);
  }).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));
}
export function entityScope(hass,config) {
  const groups=deviceGroups(hass,config.device,true);
  if(config.device_id)return groups.find(g=>g.deviceId===config.device_id)||null;
  if(config.entity_group){
    // Registry data may arrive after a legacy selection; follow the same entity.
    return groups.find(g=>g.key===config.entity_group)||groups.find(g=>g.entityIds.includes(config.entity))||null;
  }
  const current=groups.find(g=>g.entityIds.includes(config.entity));
  if(!current)return null;
  // An old unrelated default entity must not force the new category to show it.
  return deviceGroups(hass,config.device).some(g=>g.key===current.key)?current:null;
}
export function mainEntityScore(hass,kind,id) {
  const state=hass?.states?.[id],domain=DOMAIN(id),order=MAIN_DOMAINS[kind]||['sensor'];
  if(!order.includes(domain))return -1000;
  let score=100-order.indexOf(domain)*15;
  const text=`${id} ${state?.attributes?.friendly_name||''}`;
  if(['washing_machine','dryer'].includes(kind)) {
    if(/运行状态|工作状态|洗涤阶段|洗涤状态|烘干状态|程序状态|operation[ _-]?state|run(?:ning)?[ _-]?(?:state|status)|cycle[ _-]?state|phase/i.test(text))score+=120;
    if(domain==='switch'&&/电源|power/i.test(text))score+=60;
    if(/剩余|remaining|remain|time[ _-]?left/i.test(text))score+=15;
    if(/水温过高|故障|告警|门状态|洗涤剂|筒灯|overheat|door|detergent|down_light|error|fault|connectivity|device_status/i.test(text))score-=100;
    if(domain==='binary_sensor')score-=50;
  }
  if(kind==='temperature_humidity'&&(state?.attributes?.device_class==='temperature'||/温度|temperature/i.test(text)))score+=50;
  return score;
}
export function entityOptions(hass,config,field) {
  const scope=entityScope(hass,config);if(!scope)return [];
  const states=hass?.states||{};
  const role=field.startsWith('auxiliary.')?'auxiliary':field.startsWith('metrics.')?'metric':field;
  const eligible=id=>{
    const domain=DOMAIN(id);
    if(role==='entity')return (MAIN_DOMAINS[config.device]||['sensor']).includes(domain);
    if(role==='auxiliary')return ['switch','light','fan','button','input_button','input_boolean','select','number','script','climate','cover'].includes(domain);
    if(['power_entity','progress_entity'].includes(role))return ['sensor','number','input_number'].includes(domain);
    return !['automation','scene','camera','update','image','event'].includes(domain);
  };
  return scope.entityIds.filter(eligible).sort((a,b)=>role==='entity'?mainEntityScore(hass,config.device,b)-mainEntityScore(hass,config.device,a)||a.localeCompare(b):a.localeCompare(b)).map(id=>{
    const a=states[id]?.attributes||{};return {value:id,label:a.friendly_name||id,description:id+(a.unit_of_measurement?` · ${a.unit_of_measurement}`:''),search:a.device_class||''};
  });
}
export function selectDeviceScope(hass,config,key) {
  const group=deviceGroups(hass,config.device,true).find(g=>g.key===key);
  const next=clearEntityBindings(config);
  if(!group)return next;
  if(group.deviceId)next.device_id=group.deviceId;
  else next.entity_group=group.key;
  const candidates=group.entityIds.filter(id=>mainEntityScore(hass,config.device,id)>-1000).sort((a,b)=>mainEntityScore(hass,config.device,b)-mainEntityScore(hass,config.device,a)||a.localeCompare(b));
  if(candidates.length&&mainEntityScore(hass,config.device,candidates[0])>=0)next.entity=candidates[0];
  return next;
}
export function clearEntityBindings(config) {
  const next={...config};
  for(const key of ['device_id','entity_group','entity','primary_entity','primary_attribute','primary_label','primary_unit','secondary_entity','power_entity','progress_entity','auxiliary','metrics','actions','invert_position'])delete next[key];
  return next;
}
export function fieldLabels(kind) {
  const labels={primary:'主读数实体',secondary:'辅助读数实体',progress:false};
  if(['washing_machine','dryer'].includes(kind))return {primary:'剩余时间 / 主读数',secondary:'洗涤阶段 / 辅助读数',progress:true};
  if(kind==='temperature_humidity')return {primary:'温度传感器',secondary:'湿度传感器',progress:false};
  if(kind==='refrigerator')return {primary:'冷藏温度',secondary:'冷冻温度',progress:false};
  if(['projector_lift','screen'].includes(kind))return {...labels,primary:'行程 / 主读数',progress:true};
  return labels;
}
