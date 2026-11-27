import {available, DOMAIN, number} from './model.js';

const running=/^(running|washing|rinsing|spinning|drying|heating|boiling|运行中|洗涤中|漂洗中|脱水中|烘干中|加热中|烧水中)$/i;
const stopped=/^(off|idle|standby|paused|finished|completed|error|fault|待机|待机中|已关闭|已暂停|洗涤完成|故障)$/i;

// Motion follows reported operation, never a numeric reading or a pending command.
export function deviceMotion(hass,c,v,w){
  if(!v.online||v.off)return '';
  const main=hass.states?.[c.entity],raw=String(main?.state||''),a=main?.attributes||{};
  if(c.device==='washing_machine'){
    const phase=w?.fields.phase,power=w?.fields.power,start=w?.fields.start;
    if(power?.valid&&!power.on||phase?.valid&&stopped.test(hass.states[phase.entity]?.state)||stopped.test(raw))return '';
    const active=phase?.valid?hass.states[phase.entity]?.state:raw;
    return running.test(active)||start?.valid&&start.on?'wash':'';
  }
  if(c.device==='dryer')return running.test(raw)?'dry':'';
  if(['air_conditioner','floor_heating','bathroom_heater','water_heater'].includes(c.device)){
    const action=a.hvac_action;
    if(action&&['idle','off'].includes(action))return '';
    const active=action?['heating','cooling','drying','fan'].includes(action):['heat','cool','heat_cool','dry','fan_only'].includes(raw)||running.test(raw);
    return active?(c.device==='air_conditioner'?'air':'heat'):'';
  }
  if(DOMAIN(c.entity)==='light'||c.device==='bathroom_mirror')return raw==='on'?'light':'';
  if(c.device==='vacuum')return raw==='cleaning'?'clean':raw==='returning'?'return':'';
  if(['curtain','screen','projector_lift'].includes(c.device))return ['opening','closing'].includes(raw)?raw:'';
  if(c.device==='projector')return ['playing','on','buffering'].includes(raw)?'project':'';
  if(c.device==='integrated_stove')return raw==='on'&&number(a.percentage)!==0?'extract':'';
  if(c.device==='tea_machine')return running.test(raw)?'heat':'';
  if(c.device==='door_lock')return ['locking','unlocking'].includes(raw)?'lock':'';
  if(c.device==='camera')return ['recording','streaming'].includes(raw)?'record':'';
  if(c.device==='refrigerator'){
    const freeze=hass.states?.[c.features?.rapid_freeze];
    return available(freeze)&&freeze.state==='on'?'freeze':'';
  }
  return '';
}

export const MOTION_CSS=`
.motion-cover-guide,.motion-screen-guide{display:none}.motion-exhaust{opacity:0}
[data-motion=wash] .motion-drum,[data-motion=dry] .motion-drum{transform-box:fill-box;transform-origin:center;animation:soft-tumble 3.8s linear infinite}
[data-motion=dry] .motion-drum{animation-duration:6s}
[data-motion=air] .motion-flow{animation:soft-airflow 2.4s ease-in-out infinite;animation-delay:var(--motion-delay,0s)}
[data-motion=air] .motion-air-glow{animation:soft-breathe 3.8s ease-in-out infinite}
[data-motion=heat] .motion-steam,[data-motion=dry] .motion-steam,[data-motion=extract] .motion-exhaust{animation:soft-steam 3s ease-in-out infinite;animation-delay:var(--motion-delay,0s)}
[data-motion=light] .motion-glow,[data-motion=project] .motion-glow,[data-motion=heat] .motion-glow,[data-motion=freeze] .motion-glow{animation:soft-breathe 4s ease-in-out infinite}
[data-motion=clean] .motion-robot,[data-motion=return] .motion-robot{animation:soft-clean 3.6s ease-in-out infinite}
[data-motion=return] .motion-robot{animation-duration:5s}
[data-motion=clean] .motion-led,[data-motion=project] .motion-led,[data-motion=record] .motion-led{animation:soft-breathe 2.8s ease-in-out infinite}
[data-motion=opening] .motion-cover-guide,[data-motion=closing] .motion-cover-guide,[data-motion=opening] .motion-screen-guide,[data-motion=closing] .motion-screen-guide{display:block}
[data-motion=opening] .motion-guide-left{animation:soft-guide-left 1.8s ease-out infinite}
[data-motion=opening] .motion-guide-right{animation:soft-guide-right 1.8s ease-out infinite}
[data-motion=closing] .motion-guide-left{animation:soft-guide-right 1.8s ease-out infinite}
[data-motion=closing] .motion-guide-right{animation:soft-guide-left 1.8s ease-out infinite}
[data-motion=opening] .motion-travel{animation:soft-travel 1.8s linear infinite}
[data-motion=closing] .motion-travel{animation:soft-travel 1.8s linear infinite reverse}
[data-motion=lock] .motion-handle{transform-box:fill-box;transform-origin:left center;animation:soft-handle 2.4s ease-in-out infinite}
[data-motion]:not([data-motion=""]) .status:not(.neutral):before{animation:soft-status 3s ease-in-out infinite}
:host([motion-paused]) *,:host([motion-paused]) *:before{animation-play-state:paused!important}
@keyframes soft-tumble{to{transform:rotate(360deg)}}
@keyframes soft-airflow{0%{transform:translateY(-5px);opacity:.25}50%{opacity:.85}100%{transform:translateY(8px);opacity:.25}}
@keyframes soft-steam{0%{transform:translateY(3px);opacity:.25}50%{opacity:.8}100%{transform:translateY(-6px);opacity:.25}}
@keyframes soft-breathe{0%,100%{opacity:.55}50%{opacity:.95}}
@keyframes soft-clean{0%,100%{transform:translateX(-4px)}50%{transform:translateX(5px)}}
@keyframes soft-guide-left{0%{transform:translateX(4px);opacity:.25}50%{opacity:.9}100%{transform:translateX(-5px);opacity:.25}}
@keyframes soft-guide-right{0%{transform:translateX(-4px);opacity:.25}50%{opacity:.9}100%{transform:translateX(5px);opacity:.25}}
@keyframes soft-travel{to{stroke-dashoffset:18}}
@keyframes soft-handle{0%,100%{transform:rotate(0)}50%{transform:rotate(7deg)}}
@keyframes soft-status{0%,100%{opacity:.55}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
`;
