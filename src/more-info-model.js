import {DOMAIN, validateConfig, available, feature, hasService, number, clamp, formattedState, capabilities, commandFor} from './model.js';
import {detectDeviceBindings} from './device-fields.js';
import {detectWasherBindings} from './washer-fields.js';

export const MORE_INFO_DOMAINS = new Set(['climate','light','cover','water_heater','vacuum','lock','camera','media_player','fan','switch','input_boolean','number','input_number','select','input_select','button','input_button','sensor','binary_sensor','event']);
const richDomains = {climate:'air_conditioner',light:'wall_light',cover:'curtain',water_heater:'water_heater',vacuum:'vacuum',lock:'door_lock',camera:'camera'};
const registryEntry = (collection,key,value) => Array.isArray(collection) ? collection.find(item=>item[key]===value) : collection?.[value];

export const moreInfoHasHistory = entityId => ['sensor','binary_sensor','event'].includes(DOMAIN(entityId));
export function moreInfoLockKind(hass,entityId,source={}){
  const domain=DOMAIN(entityId);
  if(!['lock','switch','input_boolean','sensor','binary_sensor'].includes(domain))return null;
  const state=hass?.states?.[entityId],entry=registryEntry(hass?.entities,'entity_id',entityId);
  const text=`${state?.attributes?.friendly_name||''} ${entry?.name||''} ${entry?.original_name||''} ${entityId}`;
  if(source.lock_kind==='child'||source.washer?.child_lock===entityId||/童锁|儿童锁|child[ _-]?lock|(?:control|panel|button)[ _-]?lock/i.test(text))return 'child';
  return domain==='lock'?'door':null;
}

export function moreInfoCapabilities(hass,config){
  const state=hass?.states?.[config.entity],caps=capabilities(hass,config,state);
  if(moreInfoLockKind(hass,config.entity,config)!=='child')return caps;
  if(['locking','unlocking'].includes(state?.state))return {...caps,power:null,controls:[]};
  const controls=caps.controls.map(control=>control.kind==='buttons'?{...control,buttons:control.buttons.map(button=>({...button,label:button.id==='lock'?'开启童锁':button.id==='unlock'?'关闭童锁':button.label}))}:control);
  if(['switch','input_boolean'].includes(caps.domain)&&caps.power)controls.push({id:'child_lock_actions',kind:'buttons',buttons:[{id:'power',service:caps.power,label:state.state==='off'?'开启童锁':'关闭童锁'}]});
  return {...caps,power:null,controls};
}

export function moreInfoCommand(hass,config,id,input){
  if(moreInfoLockKind(hass,config.entity,config)!=='child')return commandFor(hass,config,id,input);
  const caps=moreInfoCapabilities(hass,config),button=caps.controls.flatMap(control=>control.buttons||[]).find(button=>button.id===id);
  if(!button)throw new Error('当前童锁不可操作。');
  const command=commandFor(hass,config,id,input);
  if(id==='unlock'||id==='power'&&command.service==='turn_off')command.confirmation='确认关闭童锁？';
  return command;
}

export function moreInfoStateLabel(hass,entityId,config={}){
  if(hass?.connected===false)return '连接已断开';
  const state=hass?.states?.[entityId];
  if(moreInfoLockKind(hass,entityId,config)==='child'&&available(state)){
    const labels={locked:'童锁已开启',unlocked:'童锁已关闭',on:'童锁已开启',off:'童锁已关闭','1':'童锁已开启','0':'童锁已关闭',locking:'正在开启童锁',unlocking:'正在关闭童锁',jammed:'童锁异常'};
    if(labels[state.state])return labels[state.state];
  }
  if(DOMAIN(entityId)==='event'&&available(state)&&state.attributes?.event_type){
    try{return hass.formatEntityAttributeValue?.(state,'event_type')||String(state.attributes.event_type);}catch{return String(state.attributes.event_type);}
  }
  return formattedState(hass,state);
}

export function moreInfoConfig(hass,entityId,source={},options={}) {
  const state=hass?.states?.[entityId],domain=DOMAIN(entityId);
  if(!state||!MORE_INFO_DOMAINS.has(domain)||domain==='lock'&&state.attributes?.code_format)return null;
  const entry=registryEntry(hass.entities,'entity_id',entityId);
  const physical=registryEntry(hass.devices,'id',entry?.device_id);
  const a=state.attributes||{},text=`${a.friendly_name||''} ${entry?.name||entry?.original_name||''} ${physical?.name_by_user||physical?.name||''} ${entityId}`;
  let device=richDomains[domain]||null;
  if(domain==='climate'&&/地暖|underfloor|floor[_ -]?heat/i.test(text))device='floor_heating';
  if(domain==='light'){
    for(const [kind,pattern] of [['bathroom_mirror',/镜|mirror/i],['led_strip',/灯带|灯条|strip/i],['spotlight',/射灯|spot/i],['downlight',/筒灯|downlight|recessed/i],['wall_light',/壁灯|wall[ _-]?(?:light|lamp)|sconce/i],['pendant_light',/主灯|吊灯|pendant|chandelier|(?:^|[ ._-])(?:main|primary)[ _-]?(?:light|lamp)(?:$|[ ._-])/i]])if(pattern.test(text)){device=kind;break;}
  }
  if(domain==='cover'){
    if(['garage','door','gate','damper'].includes(a.device_class))device=null;
    else if(/升降|支架|lift|mount/i.test(text))device='projector_lift';
    else if(/幕布|screen/i.test(text))device='screen';
  }
  if(domain==='media_player'&&/投影|projector/i.test(text))device='projector';
  const configured=options.entities?.[entityId]||(source.entity===entityId?source:null);
  if(configured?.device)device=configured.device;
  const lockKind=moreInfoLockKind(hass,entityId,{...source,...configured});
  if(lockKind==='child')device=null;
  const area=registryEntry(hass.areas,'area_id',entry?.area_id||physical?.area_id);
  const config={device:device||'projector',entity:entityId,name:a.friendly_name||entityId,room:area?.name||'',theme:'auto',compact:false,show_stats:true,read_only:source.read_only===true};
  if(device&&entry?.device_id){
    const entities=Array.isArray(hass.entities)?hass.entities:Object.values(hass.entities||{});
    const ids=entities.filter(item=>item.device_id===entry.device_id).map(item=>item.entity_id);
    Object.assign(config,detectDeviceBindings(hass,device,ids));
    if(device==='washing_machine')Object.assign(config,detectWasherBindings(hass,ids));
  }
  // An explicit per-entity override may customize bindings, never the event's entity ID.
  Object.assign(config,configured||{},{entity:entityId,compact:false,theme:'auto'});
  if(lockKind)config.lock_kind=lockKind;else delete config.lock_kind;
  config.read_only=source.read_only===true||configured?.read_only===true;
  try{return {config:validateConfig(config),rich:!!device};}catch{return null;}
}

export function moreInfoRoute(hass,detail,source,options={}) {
  const view=detail?.view||detail?.tab||'info';
  if(options.enabled===false||view!=='info'||!detail?.entityId)return null;
  if(detail.fromUrl||detail.parentElement||detail.large!=null||Object.keys(detail.data||{}).length)return null;
  if(options.exclude_entities?.includes(detail.entityId)||options.exclude_domains?.includes(DOMAIN(detail.entityId)))return null;
  return moreInfoConfig(hass,detail.entityId,source,options);
}

export function moreInfoExtraControls(hass,config) {
  const state=hass?.states?.[config.entity],a=state?.attributes||{},domain=DOMAIN(config.entity);
  if(config.read_only||hass?.connected===false||!available(state))return [];
  const controls=[];
  const select=(id,attribute,label,bit,service)=>{
    if(feature(state,bit)&&Array.isArray(a[attribute])&&a[attribute].length&&hasService(hass,domain,service))controls.push({id,kind:'select',label,options:a[attribute],value:a[id]??'',service});
  };
  if(domain==='climate'){
    select('preset_mode','preset_modes','预设模式',16,'set_preset_mode');
    select('swing_horizontal_mode','swing_horizontal_modes','左右摆风',512,'set_swing_horizontal_mode');
    const min=number(a.min_temp),max=number(a.max_temp),low=number(a.target_temp_low),high=number(a.target_temp_high);
    if(feature(state,2)&&hasService(hass,domain,'set_temperature')&&min!==null&&max>min&&low!==null&&high!==null){
      const step=number(a.target_temp_step)||(hass.config?.unit_system?.temperature==='°F'?1:.5),unit=hass.config?.unit_system?.temperature||'°C';
      for(const [id,label,value] of [['target_temp_low','温度下限',low],['target_temp_high','温度上限',high]])controls.push({id,kind:'number',label,value,min,max,step,unit,service:'set_temperature'});
    }
    if(feature(state,4)&&hasService(hass,domain,'set_humidity')&&number(a.humidity)!==null){
      controls.push({id:'humidity',kind:'number',label:'目标湿度',value:number(a.humidity),min:number(a.min_humidity)??30,max:number(a.max_humidity)??99,step:1,unit:'%',service:'set_humidity'});
    }
  }
  if(domain==='fan')select('preset_mode','preset_modes','预设模式',8,'set_preset_mode');
  return controls;
}

export function moreInfoExtraCommand(hass,config,id,input) {
  const controls=moreInfoExtraControls(hass,config),control=controls.find(item=>item.id===id);
  if(!control)throw new Error('当前实体不支持该操作，或暂时不可操作。');
  let data;
  if(control.kind==='select'){
    if(!control.options.includes(input))throw new Error('不支持该选项。');
    data={[id]:input};
  }else{
    const raw=number(input);if(raw===null)throw new Error('请输入有效数值。');
    const value=Number(clamp(control.min+Math.round((clamp(raw,control.min,control.max)-control.min)/control.step)*control.step,control.min,control.max).toFixed(6));
    if(id==='target_temp_low'||id==='target_temp_high'){
      data=Object.fromEntries(controls.filter(item=>['target_temp_low','target_temp_high'].includes(item.id)).map(item=>[item.id,item.id===id?value:item.value]));
      if(data.target_temp_low>data.target_temp_high)throw new Error('温度下限不能高于温度上限。');
    }else data={[id]:value};
  }
  return {domain:DOMAIN(config.entity),service:control.service,data,target:{entity_id:config.entity}};
}
