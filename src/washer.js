import { WASHER_FIELDS } from './washer-fields.js';
import { readMetric, DOMAIN, commandFor, auxiliaryCommand } from './model.js';

const washerStateLabels={idle:'待机中',standby:'待机中',running:'运行中',washing:'洗涤中',rinsing:'漂洗中',spinning:'脱水中',drying:'烘干中',paused:'已暂停',finished:'洗涤完成',completed:'洗涤完成'};

export function washerCommand(hass,c,key) {
  const entity=c.washer?.[key];
  if(!entity||!['power','start','night','care','memory','drum_light'].includes(key))throw new Error('未配置可用的洗衣机操作。');
  return auxiliaryCommand(hass,{...c,auxiliary:[{entity}]},0);
}

export function washerView(hass,c,v) {
  const fields={};
  for(const [key,definition] of Object.entries(WASHER_FIELDS)) {
    const entity=c.washer?.[key]||(key==='phase'?c.secondary_entity:undefined);
    if(!entity)continue;
    const state=hass.states?.[entity],metric=readMetric(hass,{entity,name:definition.name,precision:key==='energy'?3:1});
    if(!v.online)Object.assign(metric,{text:'—',unit:'',number:null,valid:false});
    const raw=String(state?.state||'').toLowerCase();
    let text=metric.text,warning=false;
    if(metric.valid){
      text=washerStateLabels[raw]||text;
      if(key==='door')text=({on:'已打开',off:'已关闭',open:'已打开',closed:'已关闭'})[raw]||text;
      if(key==='child_lock')text=({on:'已锁定',off:'已解锁',locked:'已锁定',unlocked:'已解锁'})[raw]||text;
      if(key==='error'){warning=metric.number!==0&&!['none','ok','off','无','正常'].includes(raw);text=warning?`故障 ${metric.text}`:'无故障';}
      if(['overheat','detergent_status'].includes(key)){warning=['on','true','1','problem','low','过高','不足','异常'].includes(raw);text=warning?(key==='overheat'?'水温过高':'洗涤剂不足'):['off','false','0','normal','ok','正常'].includes(raw)?'正常':text;}
      if(key==='door')warning=['on','open'].includes(raw);
    }
    fields[key]={...metric,text,key,icon:definition.icon,group:definition.group,warning,on:raw==='on'};
  }
  const state=hass.states?.[c.entity];
  const status=v.online?(washerStateLabels[state?.state]||v.status):v.status;
  const phase=fields.phase?.valid?fields.phase.text:status;
  const controls=['start','power'].filter(key=>fields[key]).map(key=>{
    const field=fields[key];let command;
    try{command=washerCommand(hass,c,key);}catch{ /* Show unavailable bound controls disabled. */ }
    const toggle=['switch','input_boolean'].includes(DOMAIN(field.entity));
    return {...field,disabled:!command||!!command.moreInfo,label:key==='power'?(field.on?'关闭电源':'开启电源'):toggle?(field.on?'暂停洗涤':'启动洗涤'):'启动洗涤',icon:key==='power'?'mdi:power':toggle&&field.on?'mdi:pause':'mdi:play'};
  });
  // Legacy configurations may use a switch as their main entity.
  if(!fields.power&&v.caps.power){let enabled=false;try{enabled=!!commandFor(hass,c,'power');}catch{}
    controls.push({key:'main-power',label:v.off?'开启电源':'关闭电源',icon:'mdi:power',disabled:!enabled});}
  return {fields,status,phase,controls,hasRemaining:!!(c.primary_entity||c.primary_attribute||v.primary.number!==null),
    progress:c.progress_entity&&v.online?v.primary.ratio:null,
    groups:group=>Object.values(fields).filter(field=>field.group===group),
    alerts:Object.values(fields).filter(field=>field.warning&&field.key!=='door')};
}
