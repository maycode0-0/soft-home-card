import { DEVICE_FIELDS } from './device-fields.js';
import { readMetric, available, DOMAIN, auxiliaryCommand } from './model.js';

export const LIGHT_DEVICES=['wall_light','spotlight','downlight','pendant_light','led_strip','bathroom_mirror'];
export const COVER_DEVICES=['curtain','screen','projector_lift'];
export function deviceView(hass,c,v){
  const fields={};
  for(const [key,definition] of Object.entries(DEVICE_FIELDS[c.device]||{})){
    const entity=c.features?.[key];if(!entity)continue;
    const metric=readMetric(hass,{entity,name:definition.name}),state=hass.states?.[entity];
    if(!v.online)Object.assign(metric,{text:'—',unit:'',number:null,valid:false});
    let text=metric.text,warning=false;
    if(metric.valid){
      if(['button','input_button','script'].includes(DOMAIN(entity))){text='点按执行';metric.unit='';metric.number=null;}
      if(key==='door'){text=({on:'已打开',off:'已关闭',open:'已打开',closed:'已关闭'})[state.state]||text;warning=['on','open'].includes(state.state);}
      if(key==='tamper'){warning=['on','detected','problem'].includes(state.state);text=warning?'防撬报警':['off','clear','normal'].includes(state.state)?'正常':text;}
      if(key==='error'){warning=metric.number!==0&&!['none','ok','off','无','正常','无错误'].includes(state.state);text=warning?text:'无故障';}
    }
    fields[key]={...definition,...metric,text,key,warning,on:state?.state==='on',disabled:!v.online||c.read_only||!available(state)};
  }
  return {fields,groups:group=>Object.values(fields).filter(field=>field.group===group)};
}

// Settings open the HA entity dialog, preserving each integration's real options.
// Only bound buttons, scripts and switches execute directly.
export function deviceCommand(hass,c,key){
  const entity=c.features?.[key],definition=DEVICE_FIELDS[c.device]?.[key];
  if(!entity||!definition)throw new Error('未绑定该设备功能。');
  const state=hass.states?.[entity];
  if(c.read_only||hass.connected===false||!available(hass.states?.[c.entity])||!available(state))throw new Error('当前功能不可操作。');
  if(['switch','input_boolean','button','input_button','script'].includes(DOMAIN(entity)))return auxiliaryCommand(hass,{...c,auxiliary:[{entity}]},0);
  return {moreInfo:entity};
}

export function devicePicture(hass,entity){
  const picture=hass.states?.[entity]?.attributes?.entity_picture;
  if(typeof picture!=='string')return '';
  // HA supplies authenticated proxy paths; never accept executable/data URLs.
  if(picture.startsWith('/')&&!picture.startsWith('//'))return hass.hassUrl?.(picture)||picture;
  return /^https?:\/\//i.test(picture)?picture:'';
}
