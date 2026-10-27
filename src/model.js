import { WASHER_FIELDS } from './washer-fields.js';
import { DEVICE_FIELDS } from './device-fields.js';

export const DEVICES = {
  washing_machine: ['洗衣机','mdi:washing-machine','blue'], dryer: ['烘干机','mdi:tumble-dryer','warm'],
  projector: ['投影仪','mdi:projector','blue'], projector_lift: ['投影仪升降支架','mdi:arrow-expand-vertical','blue'],
  screen: ['幕布','mdi:projector-screen','blue'], air_conditioner: ['空调','mdi:air-conditioner','blue'],
  refrigerator: ['冰箱','mdi:fridge-outline','blue'], integrated_stove: ['集成灶','mdi:stove','blue'],
  water_heater: ['热水器','mdi:water-boiler','warm'], floor_heating: ['地暖','mdi:heating-coil','warm'],
  wall_light: ['壁灯','mdi:wall-sconce','blue'], spotlight: ['射灯','mdi:spotlight-beam','blue'],
  downlight: ['筒灯','mdi:light-recessed','blue'], pendant_light: ['吊灯','mdi:ceiling-light-outline','blue'],
  led_strip: ['灯带','mdi:led-strip-variant','blue'], tea_machine: ['茶吧机','mdi:kettle-outline','warm'],
  bathroom_mirror: ['浴室镜','mdi:mirror-rectangle','blue'], temperature_humidity: ['温湿度计','mdi:thermometer-water','blue'],
  bathroom_heater: ['浴霸','mdi:fan','warm'],
  curtain: ['窗帘','mdi:curtains','blue'], door_lock: ['门锁','mdi:lock-outline','blue'],
  vacuum: ['扫地机器人','mdi:robot-vacuum','blue'], camera: ['摄像头','mdi:cctv','blue'],
};
export const DOMAIN = id => String(id || '').split('.')[0];
export const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
export const number = value => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || typeof value === 'boolean' || !['number','string'].includes(typeof value) || !Number.isFinite(Number(value)) ? null : Number(value);
export const available = state => !!state && !['unknown','unavailable'].includes(state.state);
export const feature = (state,bit) => ((Number(state?.attributes?.supported_features) || 0) & bit) === bit;
export const hasService = (hass,domain,service) => !!hass?.services?.[domain]?.[service];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entityPattern = /^[a-z_]+\.[a-z0-9_]+$/;
const stateLabels = { on:'已开启',off:'已关闭',idle:'待机',standby:'待机',paused:'已暂停',playing:'播放中',buffering:'缓冲中',opening:'上升中',closing:'下降中',open:'已打开',closed:'已关闭',cool:'制冷',heat:'制热',heat_cool:'自动温控',auto:'自动',dry:'除湿',fan_only:'送风',heating:'加热中',cooling:'制冷中',unavailable:'设备离线',unknown:'状态未知',color_temp:'色温',hs:'彩色',rgb:'彩色',rgbw:'彩色与白光',rgbww:'彩色与双色温',xy:'彩色',brightness:'亮度',onoff:'开关',eco:'节能',performance:'高性能' };

export function validateConfig(config) {
  if (!config || !DEVICES[config.device]) throw new Error('请选择有效的 device 设备类型。');
  if (config.entity != null && (typeof config.entity !== 'string' || config.entity !== '' && !entityPattern.test(config.entity))) throw new Error('请选择主实体 entity，例如 light.living_room。');
  const c = {theme:'light',show_stats:true,read_only:false,...config};
  if (!['light','dark','auto'].includes(c.theme)) throw new Error('theme 必须为 light、dark 或 auto。');
  if (c.accent && !['blue','warm'].includes(c.accent)) throw new Error('accent 必须为 blue 或 warm。');
  if(c.washer!=null){
    if(typeof c.washer!=='object'||Array.isArray(c.washer))throw new Error('washer 必须为实体绑定对象。');
    for(const [key,id] of Object.entries(c.washer))if(!Object.hasOwn(WASHER_FIELDS,key)||typeof id!=='string'||!entityPattern.test(id))throw new Error(`washer.${key} 不是有效的洗衣机实体绑定。`);
  }
  if(c.features!=null){
    if(typeof c.features!=='object'||Array.isArray(c.features))throw new Error('features 必须为设备功能实体绑定对象。');
    for(const [key,id] of Object.entries(c.features)){
      const field=DEVICE_FIELDS[c.device]?.[key];
      if(!field||typeof id!=='string'||!entityPattern.test(id)||!field.domains.includes(DOMAIN(id)))throw new Error(`features.${key} 不是有效的设备功能绑定。`);
    }
  }
  for (const field of ['primary_entity','secondary_entity','power_entity','progress_entity']) {
    if (c[field] && !entityPattern.test(c[field])) throw new Error(`${field} 不是有效实体 ID。`);
  }
  for (const field of ['name','room','primary_attribute','primary_label','primary_unit','device_id','entity_group']) if (c[field] != null && typeof c[field] !== 'string') throw new Error(`${field} 必须为文本。`);
  for (const field of ['read_only','show_stats','invert_position']) if (c[field] != null && typeof c[field] !== 'boolean') throw new Error(`${field} 必须为布尔值。`);
  for (const field of ['metrics','auxiliary','actions']) if (c[field] != null && (!Array.isArray(c[field]) || c[field].length > 3)) throw new Error(`${field} 最多支持 3 项。`);
  for (const item of [...(c.metrics || []),...(c.auxiliary || [])]) {
    if (!item || !entityPattern.test(item.entity || '')) throw new Error('辅助实体和概览指标必须包含有效 entity。');
    if (item.precision != null && (!Number.isInteger(item.precision) || item.precision < 0 || item.precision > 6)) throw new Error('precision 必须是 0–6 的整数。');
  }
  for (const action of c.actions || []) {
    if (!action || typeof action.label !== 'string' || !action.label.trim()) throw new Error('自定义操作必须有 label。');
    if (!['more-info','perform-action'].includes(action.action)) throw new Error('自定义操作支持 more-info、perform-action。');
    if (action.entity && !entityPattern.test(action.entity)) throw new Error('操作 entity 无效。');
    if (action.action === 'perform-action' && !/^[a-z_]+\.[a-z0-9_]+$/.test(action.perform_action || '')) throw new Error('perform_action 必须为 domain.service。');
    if (action.data != null && (typeof action.data !== 'object' || Array.isArray(action.data))) throw new Error('操作 data 必须为对象。');
    if (action.target != null && (typeof action.target !== 'object' || Array.isArray(action.target))) throw new Error('操作 target 必须为对象。');
  }
  return c;
}

export function formattedState(hass,state) {
  if (!state) return '实体未找到';
  if (stateLabels[state.state]) return stateLabels[state.state];
  const deviceLabels={locked:'已上锁',unlocked:'未上锁',locking:'正在上锁',unlocking:'正在解锁',jammed:'锁体卡住',cleaning:'清洁中',docked:'已回充',returning:'回充中',error:'故障',recording:'录像中',streaming:'预览中',detected:'已检测到'};
  if(deviceLabels[state.state])return deviceLabels[state.state];
  try { return hass.formatEntityState?.(state) || String(state.state); } catch { return String(state.state); }
}

export function readMetric(hass,ref,fallbackName='') {
  if (!ref) return null;
  const state = hass?.states?.[ref.entity];
  const attrs = state?.attributes || {};
  const value = ref.attribute ? attrs[ref.attribute] : state?.state;
  const numeric = available(state) ? number(value) : null;
  const valid = available(state) && value != null && value !== '';
  const name = ref.name || attrs.friendly_name || fallbackName || ref.entity;
  let text = '—';
  if (valid) {
    if (numeric !== null) text = String(Number(numeric.toFixed(ref.precision ?? 1)));
    else if (typeof value === 'string' || typeof value === 'boolean') {
      if (!ref.attribute) text=formattedState(hass,state);
      else {
        text=stateLabels[value] || String(value);
        if (!stateLabels[value]) try {text=hass.formatEntityAttributeValue?.(state,ref.attribute)||text;} catch { /* Older HA versions may not expose attribute formatters. */ }
      }
    }
  }
  const unit = ref.unit ?? (ref.attribute ? '' : attrs.unit_of_measurement || '');
  return {name,text,unit:valid?unit:'',number:numeric,entity:ref.entity,valid};
}

function autoPrimary(hass,c,state) {
  const a = state?.attributes || {}, domain = DOMAIN(c.entity);
  let value = null, unit = '', label = '当前状态', ratio = null;
  if (domain === 'light' && (a.supported_color_modes || []).some(m => !['onoff','unknown'].includes(m))) {
    value = state.state === 'off' ? 0 : number(a.brightness) === null ? null : Math.round(a.brightness / 255 * 100);
    unit = '%'; label = '亮度'; ratio = value === null ? null : value/100;
  } else if (['climate','water_heater'].includes(domain)) {
    value = number(a.temperature); unit = hass?.config?.unit_system?.temperature || '°C'; label = '设定温度';
    if (value === null) { value = number(a.current_temperature); label = '当前温度'; }
    const min = number(a.min_temp), max = number(a.max_temp);
    if (value !== null && min !== null && max > min) ratio = (value-min)/(max-min);
  } else if (domain === 'cover') {
    value = number(a.current_position); value = value === null ? null : c.invert_position ? 100-value : value;
    unit = '%'; label = c.invert_position ? '展开程度' : '开启程度'; ratio = value === null ? null : value/100;
  } else if (domain === 'media_player' && number(a.volume_level) !== null) {
    value = Math.round(a.volume_level * 100); unit = '%'; label = '音量'; ratio = value/100;
  } else if (domain === 'fan' && number(a.percentage) !== null) {
    value = a.percentage; unit = '%'; label = '风速'; ratio = value/100;
  } else if (['sensor','number','input_number'].includes(domain)) {
    value = number(state?.state); unit = a.unit_of_measurement || ''; label = a.device_class === 'temperature' ? '当前温度' : a.device_class === 'humidity' ? '相对湿度' : '当前读数';
    if (unit === '%' && value !== null) ratio = value/100;
  }
  return {text:value === null ? (available(state) && ['on','off'].includes(state.state) ? (state.state==='on'?'ON':'OFF') : '—') : String(Number(value.toFixed(1))),unit,number:value,label,ratio};
}

export function capabilities(hass,c,state) {
  const a = state?.attributes || {}, domain = DOMAIN(c.entity);
  const allowed = available(state) && hass?.connected !== false && !c.read_only;
  const can = service => allowed && hasService(hass,domain,service);
  const modes = a.supported_color_modes || [];
  const caps = {domain,allowed,controls:[],power:null};
  const isOff = state?.state === 'off';
  if (['light','switch','input_boolean','fan'].includes(domain) && can(isOff?'turn_on':'turn_off')) caps.power = isOff?'turn_on':'turn_off';
  if (domain === 'media_player' && feature(state,isOff?128:256) && can(isOff?'turn_on':'turn_off')) caps.power = isOff?'turn_on':'turn_off';
  if (['climate','water_heater'].includes(domain) && feature(state,domain==='climate'?(isOff?256:128):8) && can(isOff?'turn_on':'turn_off')) caps.power = isOff?'turn_on':'turn_off';
  if (domain === 'light') {
    if (modes.some(m => !['onoff','unknown'].includes(m)) && can('turn_on')) caps.controls.push({id:'brightness',kind:'range',label:'亮度',min:0,max:100,step:1,value:isOff?0:Math.round((number(a.brightness)??0)/255*100),unit:'%',service:'turn_on'});
    let min = number(a.min_color_temp_kelvin), max = number(a.max_color_temp_kelvin), value = number(a.color_temp_kelvin);
    if (min === null && number(a.max_mireds)>0) min=Math.round(1e6/a.max_mireds);
    if (max === null && number(a.min_mireds)>0) max=Math.round(1e6/a.min_mireds);
    if (value === null && number(a.color_temp)>0) value=Math.round(1e6/a.color_temp);
    if (modes.includes('color_temp') && min !== null && max > min && can('turn_on')) caps.controls.push({id:'color_temperature',kind:'range',label:'色温',min,max,step:1,value:clamp(value??min,min,max),unit:'K',service:'turn_on'});
    if(modes.some(mode=>['hs','rgb','rgbw','rgbww','xy'].includes(mode))&&can('turn_on'))caps.controls.push({id:'color',kind:'color',label:'灯光颜色',value:Array.isArray(a.rgb_color)?'#'+a.rgb_color.slice(0,3).map(n=>clamp(Math.round(n),0,255).toString(16).padStart(2,'0')).join(''):'#ffffff',service:'turn_on'});
  }
  if (['climate','water_heater'].includes(domain)) {
    const min=number(a.min_temp),max=number(a.max_temp),value=number(a.temperature),step=number(a.target_temp_step) || (hass?.config?.unit_system?.temperature==='°F'?1:.5);
    if (feature(state,1) && min!==null && max>min && value!==null && can('set_temperature')) caps.controls.push({id:'temperature',kind:'stepper',label:'设定温度',min,max,step,value,unit:hass?.config?.unit_system?.temperature||'°C',service:'set_temperature'});
    const options=domain==='climate'?a.hvac_modes:a.operation_list,service=domain==='climate'?'set_hvac_mode':'set_operation_mode';
    if (Array.isArray(options) && options.length && can(service)) caps.controls.push({id:'mode',kind:'select',label:'运行模式',options,value:domain==='climate'?state.state:a.operation_mode,service});
    if(domain==='climate')for(const [id,attribute,service,label,bit] of [['fan_mode','fan_modes','set_fan_mode','风速',8],['swing_mode','swing_modes','set_swing_mode','摆风',32]]){
      if(feature(state,bit)&&Array.isArray(a[attribute])&&a[attribute].length&&can(service))caps.controls.push({id,kind:'select',label,options:a[attribute],value:a[id],service});
    }
  }
  if (domain === 'cover') {
    const buttons=[['open',1,'open_cover',c.device==='curtain'?'打开窗帘':'↑ 上升'],['stop',8,'stop_cover','Ⅱ 停止'],['close',2,'close_cover',c.device==='curtain'?'关闭窗帘':'↓ 下降']].filter(([,bit,s])=>feature(state,bit)&&can(s)).map(([id,,service,label])=>({id,service,label}));
    if (buttons.length) caps.controls.push({id:'motion',kind:'buttons',buttons});
    if (feature(state,4) && can('set_cover_position') && number(a.current_position)!==null) caps.controls.push({id:'position',kind:'range',label:c.invert_position?'展开程度':'开启程度',min:0,max:100,step:1,value:c.invert_position?100-a.current_position:a.current_position,unit:'%',service:'set_cover_position'});
  }
  if (domain==='media_player' && feature(state,4) && can('volume_set') && number(a.volume_level)!==null) caps.controls.push({id:'volume',kind:'range',label:'音量',min:0,max:100,step:1,value:Math.round(a.volume_level*100),unit:'%',service:'volume_set'});
  if (domain==='fan' && feature(state,1) && can('set_percentage') && number(a.percentage)!==null) caps.controls.push({id:'percentage',kind:'range',label:'风速',min:0,max:100,step:number(a.percentage_step)||1,value:a.percentage,unit:'%',service:'set_percentage'});
  if (['number','input_number'].includes(domain) && can('set_value') && number(state.state)!==null && number(a.min)!==null && number(a.max)>number(a.min)) caps.controls.push({id:'number',kind:'range',label:'设定值',min:Number(a.min),max:Number(a.max),step:number(a.step)||1,value:Number(state.state),unit:a.unit_of_measurement||'',service:'set_value'});
  if (['select','input_select'].includes(domain) && Array.isArray(a.options) && can('select_option')) caps.controls.push({id:'option',kind:'select',label:'选项',options:a.options,value:state.state,service:'select_option'});
  if (['button','input_button'].includes(domain) && can('press')) caps.controls.push({id:'press',kind:'buttons',buttons:[{id:'press',service:'press',label:'执行'}]});
  if(domain==='vacuum'){
    const buttons=[['start',8192,'start','开始清洁'],['pause',4,'pause','暂停清洁'],['return_home',16,'return_to_base','返回充电'],['stop',8,'stop','停止清洁'],['locate',512,'locate','寻找机器']].filter(([,bit,s])=>feature(state,bit)&&can(s)).map(([id,,service,label])=>({id,service,label}));
    if(buttons.length)caps.controls.push({id:'vacuum_actions',kind:'buttons',buttons});
    if(feature(state,32)&&Array.isArray(a.fan_speed_list)&&can('set_fan_speed'))caps.controls.push({id:'fan_speed',kind:'select',label:'吸力',options:a.fan_speed_list,value:a.fan_speed,service:'set_fan_speed'});
  }
  if(domain==='lock'){
    const buttons=[['lock','lock','上锁'],['unlock','unlock','解锁']].filter(([id,service])=>can(service)&&!a.code_format&&!(id==='unlock'&&state.state==='unlocked')&&!(id==='lock'&&state.state==='locked')).map(([id,service,label])=>({id,service,label}));
    if(buttons.length)caps.controls.push({id:'lock_actions',kind:'buttons',buttons});
  }
  return caps;
}

function defaultMetrics(hass,c,state) {
  const a=state?.attributes||{}, domain=DOMAIN(c.entity), refs=[];
  const add=(attribute,name,unit='')=>{if(a[attribute]!=null)refs.push({entity:c.entity,attribute,name,unit});};
  if (['climate','water_heater'].includes(domain)) {add('current_temperature','当前温度',hass.config?.unit_system?.temperature||'°C');add('current_humidity','相对湿度','%');if(state?.state==='off')refs.push({entity:c.entity,name:'运行状态'});else add('hvac_action','运行状态');add('fan_mode','风速');add('operation_mode','运行模式');}
  if(domain==='light'){add('color_temp_kelvin','色温','K');add('color_mode','色彩模式');}
  if(domain==='media_player'){add('source','输入源');add('media_title','正在播放');}
  if(domain==='fan'){add('preset_mode','预设模式');add('percentage','风速','%');}
  if(c.power_entity)refs.push({entity:c.power_entity,name:'当前功率'});
  if(c.secondary_entity)refs.push({entity:c.secondary_entity,name:'辅助读数'});
  if(!refs.length)refs.push({entity:c.entity,name:'设备状态'});
  return refs.slice(0,3).map(ref=>readMetric(hass,ref));
}

export function buildView(hass,c) {
  const state=hass?.states?.[c.entity],a=state?.attributes||{},online=available(state)&&hass?.connected!==false;
  let primary=autoPrimary(hass,c,state);
  if(c.primary_entity || c.primary_attribute){const m=readMetric(hass,{entity:c.primary_entity||c.entity,attribute:c.primary_attribute,name:c.primary_label,unit:c.primary_unit});primary={text:m.text,unit:m.unit,number:m.number,label:c.primary_label||m.name,ratio:m.unit==='%'&&m.number!==null?m.number/100:null};}
  primary.label=c.primary_label||primary.label;
  if(c.primary_unit!=null)primary.unit=c.primary_unit;
  if(!online)primary={...primary,text:'—',unit:'',number:null,ratio:null};
  if(c.progress_entity&&online){const progress=readMetric(hass,{entity:c.progress_entity});primary.ratio=progress.number===null?null:progress.number/100;}
  if(primary.ratio!==null)primary.ratio=clamp(primary.ratio,0,1);
  const fallback=DEVICES[c.device];
  const status=hass?.connected===false?'连接已断开':formattedState(hass,state);
  const caps=capabilities(hass,c,state);
  return {name:c.name||fallback[0],room:c.room||a.friendly_name||c.entity,icon:fallback[1],accent:c.accent||fallback[2],status,online,off:state?.state==='off',primary,caps,
    metrics:c.metrics ? c.metrics.map(ref=>readMetric(hass,ref)) : defaultMetrics(hass,c,state),
    secondary:c.secondary_entity?readMetric(hass,{entity:c.secondary_entity}):null,
    power:c.power_entity?readMetric(hass,{entity:c.power_entity,name:'当前功率'}):null,
    summary:c.read_only?'只读模式':!online?'请检查实体和连接':state.state==='off'?status:a.hvac_action ? (stateLabels[a.hvac_action]||a.hvac_action) : status,
    auxiliary:(c.auxiliary||[]).map(ref=>{const s=hass?.states?.[ref.entity];return {...ref,name:ref.name||s?.attributes?.friendly_name||ref.entity,state:formattedState(hass,s),disabled:!online||c.read_only||!available(s),on:s?.state==='on'};})};
}

// Re-evaluate capabilities at the instant of a click, so stale UI cannot send a stale command.
export function commandFor(hass,c,id,input) {
  const state=hass?.states?.[c.entity],caps=capabilities(hass,c,state);
  if (!caps.allowed) throw new Error('当前实体不可操作。');
  let service,data={};
  if(id==='power')service=caps.power;
  else {
    const control=caps.controls.find(x=>x.id===id);
    const button=caps.controls.flatMap(x=>x.buttons||[]).find(x=>x.id===id);
    if(button)service=button.service;
    else if(control){
      service=control.service;
      if(control.kind==='color'){
        if(typeof input!=='string'||!/^#[0-9a-f]{6}$/i.test(input))throw new Error('无效颜色。');
        data={rgb_color:[1,3,5].map(offset=>parseInt(input.slice(offset,offset+2),16))};
      }else if(control.kind==='select'){
        if(!control.options.includes(input))throw new Error('不支持该选项。');
        data={[id==='mode'?(caps.domain==='climate'?'hvac_mode':'operation_mode'):['fan_mode','swing_mode','fan_speed'].includes(id)?id:'option']:input};
      }else{
        const raw=number(input);if(raw===null)throw new Error('无效数值。');
        const step=control.step || 1;
        const value=Number(clamp(control.min+Math.round((clamp(raw,control.min,control.max)-control.min)/step)*step,control.min,control.max).toFixed(6));
        if(id==='brightness')data={brightness_pct:value};
        if(id==='color_temperature')data={color_temp_kelvin:Math.round(value)};
        if(id==='temperature')data={temperature:value};
        if(id==='position')data={position:c.invert_position?100-value:value};
        if(id==='volume')data={volume_level:value/100};
        if(id==='percentage')data={percentage:value};
        if(id==='number')data={value};
      }
    }
  }
  if(!service)throw new Error('设备不支持该操作。');
  return {domain:caps.domain,service,data,target:{entity_id:c.entity},...(caps.domain==='lock'&&id==='unlock'?{confirmation:'确认解锁门锁？'}:{})};
}

export function auxiliaryCommand(hass,c,index) {
  const ref=c.auxiliary?.[index],state=hass?.states?.[ref?.entity],domain=DOMAIN(ref?.entity);
  if(c.read_only || hass?.connected===false || !available(hass?.states?.[c.entity]) || !available(state))throw new Error('辅助实体不可操作。');
  let service;
  if(['switch','input_boolean','light','fan'].includes(domain))service=state.state==='off'?'turn_on':'turn_off';
  if(['button','input_button'].includes(domain))service='press';
  if(domain==='script')service='turn_on';
  if(!service || !hasService(hass,domain,service))return {moreInfo:ref.entity};
  return {domain,service,data:{},target:{entity_id:ref.entity}};
}

export function actionCommand(hass,c,index) {
  const a=c.actions?.[index];
  if(!a)throw new Error('操作未配置。');
  if(a.action==='more-info')return {moreInfo:a.entity||c.entity};
  if(c.read_only || hass?.connected===false || !available(hass?.states?.[c.entity]))throw new Error('当前实体不可操作。');
  const [domain,service]=a.perform_action.split('.');
  if(!hasService(hass,domain,service))throw new Error(`操作不存在：${a.perform_action}`);
  // Never invent a main-entity target for a different domain (e.g. script or automation).
  return {domain,service,data:{...(a.data||{})},target:a.target?{...a.target}:undefined,confirmation:a.confirmation};
}
