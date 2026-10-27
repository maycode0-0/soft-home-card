import { escapeHTML, readMetric, number, DOMAIN } from './model.js';
import { deviceView, devicePicture, LIGHT_DEVICES, COVER_DEVICES } from './devices.js';

export function deviceLayout(card,v,art,extras){
  const c=card._config,hass=card._hass,E=escapeHTML,d=deviceView(hass,c,v),f=d.fields;
  if(!['air_conditioner','refrigerator','temperature_humidity','door_lock','vacuum','camera',...LIGHT_DEVICES,...COVER_DEVICES].includes(c.device))return '';
  const icon=name=>`<ha-icon icon="mdi:${name}" aria-hidden="true"></ha-icon>`;
  const main=hass.states?.[c.entity],attrs=main?.attributes||{};
  const statusText=v.online&&['refrigerator','temperature_humidity'].includes(c.device)?'在线':v.status;
  const hero=(className='')=>`<button class="hero device-art ${className} ${!v.online?'offline':v.off?'inactive':''}" data-info aria-label="查看${E(v.name)}详情">${['refrigerator','door_lock'].includes(c.device)?art.replace('viewBox="0 0 320 210"','viewBox="75 0 170 210"'):art}</button>`;
  const value=(metric,cls='')=>`<strong class="device-value ${cls}">${E(metric?.text||'—')}<small>${E(metric?.unit||'')}</small></strong>`;
  const controls=list=>list.map(control=>card._control(control)).join('');
  const tile=field=>{
    const direct=['switch','input_boolean','button','input_button','script'].includes(DOMAIN(field.entity));
    const inspect=!direct||c.read_only,toggle=['switch','input_boolean'].includes(DOMAIN(field.entity));
    return `<button class="feature-tile ${field.on?'active':''} ${field.warning?'warning':''}" ${inspect?`data-info="${E(field.entity)}"`:`data-feature="${field.key}"`} ${!inspect&&(field.disabled||card._busy.has('feature-'+field.key))?'disabled':''} aria-label="${E(field.name+'：'+field.text+' '+field.unit)}">${icon(field.icon.replace('mdi:',''))}<span><span class="feature-name">${E(field.name)}</span><strong>${E(field.text)} <small>${E(field.unit)}</small></strong></span><span class="tile-trailing" aria-hidden="true">${toggle?icon(field.on?'toggle-switch':'toggle-switch-off-outline'):'›'}</span></button>`;
  };
  const tiles=fields=>fields.length?`<div class="feature-grid">${fields.map(tile).join('')}</div>`:'';
  const section=(key,label,fields)=>fields.length?`<details class="device-details" data-device-section="${key}"><summary><span>${icon(key==='rooms'?'home-outline':'tune-variant')}${E(label)}</span><span aria-hidden="true">⌄</span></summary>${tiles(fields)}</details>`:'';
  const metric=(entity,attribute,name,unit)=>{
    const m=readMetric(hass,{entity,attribute,name,unit});return v.online?m:{...m,text:'—',unit:'',valid:false};
  };
  const reading=(m,label,ico)=>`<button class="mini-reading" data-info="${E(m.entity)}">${icon(ico)}<span>${E(label)}<strong>${E(m.text)} <small>${E(m.unit)}</small></strong></span></button>`;
  const tempUnit=hass.config?.unit_system?.temperature||'°C';
  const battery=f.battery||(attrs.battery_level!=null?metric(c.entity,'battery_level','电池电量','%'):null);
  let body='';
  if(c.device==='air_conditioner'){
    const mode=v.caps.controls.find(x=>x.id==='mode');
    const indoor=f.indoor_temperature||(attrs.current_temperature!=null?metric(c.entity,'current_temperature','室内温度',tempUnit):null);
    const humidity=f.humidity||(attrs.current_humidity!=null?metric(c.entity,'current_humidity','相对湿度','%'):null);
    body=`<section class="device-overview climate-overview"><div><span class="device-kicker">${E(v.primary.label)}</span>${value(v.primary)}<span class="device-note">${E(v.summary)}</span></div>${hero()}</section>
      <section class="control-surface">${controls(v.caps.controls.filter(x=>x.id==='temperature'))}
      ${mode?`<div class="mode-chips" aria-label="运行模式">${mode.options.map(option=>`<button data-command="mode" data-value="${E(option)}" aria-pressed="${option===mode.value}" ${card._busy.has('mode')?'disabled':''}>${icon(({cool:'snowflake',heat:'white-balance-sunny',auto:'autorenew',heat_cool:'autorenew',dry:'water-outline',fan_only:'weather-windy',off:'power'})[option]||'tune-variant')}<span>${E(({cool:'制冷',heat:'制热',auto:'自动',heat_cool:'自动',dry:'除湿',fan_only:'送风',off:'关闭'})[option]||option)}</span></button>`).join('')}</div>`:''}
      ${controls(v.caps.controls.filter(x=>!['temperature','mode'].includes(x.id)))}</section>
      <div class="environment-readings">${[indoor,humidity,f.outdoor_temperature].filter(Boolean).map((m,i)=>reading(m,m.name,['thermometer','water-outline','thermometer'][i])).join('')}</div>
      ${tiles(d.groups('actions'))}${section('settings','舒适与清洁',d.groups('settings'))}${section('timers','定时设置',d.groups('timers'))}`;
  }else if(c.device==='refrigerator'){
    const zones=[f.fridge_temperature||{...v.primary,entity:c.primary_entity||c.entity,name:'冷藏室'},f.freezer_temperature||(v.secondary?{...v.secondary,name:'冷冻室'}:null),f.variable_temperature].filter(Boolean);
    body=`<section class="fridge-overview">${hero()}<div class="temperature-zones">${zones.map((m,i)=>`<button class="temperature-zone" data-info="${E(m.entity)}"><span>${icon(i===1?'snowflake':'thermometer')}${E(m.name)}</span>${value(v.online?m:{text:'—'})}</button>`).join('')}</div></section>
      ${d.groups('settings').length?`<div class="section-caption">温区与保鲜设置</div>${tiles(d.groups('settings'))}`:'<button class="device-detail-link" data-info>查看温区设置 ›</button>'}
      <div class="device-footnote">${icon('information-outline')}实测温度与设定温度分别显示</div>`;
  }else if(c.device==='temperature_humidity'){
    const temperature={...v.primary,entity:c.primary_entity||c.entity};
    body=`<section class="sensor-readings"><button class="sensor-reading" data-info="${E(temperature.entity)}"><span class="device-kicker">${icon('thermometer')}温度</span>${value(temperature)}</button>${v.secondary?`<button class="sensor-reading" data-info="${E(v.secondary.entity)}"><span class="device-kicker">${icon('water-outline')}相对湿度</span>${value(v.online?v.secondary:{text:'—'})}</button>`:''}</section>
      ${hero('sensor-art')}<div class="sensor-footer"><span>${battery?icon('battery-outline')+E(battery.text+' '+battery.unit):'环境实时读数'}</span><button data-info>查看历史 ${icon('chart-line')}</button></div>`;
  }else if(LIGHT_DEVICES.includes(c.device)){
    const kelvin=v.caps.controls.find(x=>x.id==='color_temperature'),brightness=v.caps.controls.find(x=>x.id==='brightness');
    body=`<section class="device-overview light-overview"><div><span class="device-kicker">${E(v.primary.label)}</span>${value(v.primary)}<span class="device-note">${v.off?'灯光已关闭':E(v.status)}</span></div>${hero()}</section>
      ${v.caps.controls.length?`<section class="control-surface light-controls">${controls(v.caps.controls)}${brightness?`<div class="preset-row brightness-presets" aria-label="快捷亮度">${[25,50,75,100].map(n=>`<button data-command="brightness" data-value="${n}" aria-pressed="${brightness.value===n}" ${card._busy.has('brightness')?'disabled':''}>${n}%</button>`).join('')}</div>`:''}
      ${kelvin?`<div class="temperature-presets" aria-label="快捷色温">${[kelvin.min,Math.max(kelvin.min,Math.min(kelvin.max,4000)),kelvin.max].filter((n,i,a)=>a.indexOf(n)===i).map((n,i)=>`<button data-command="color_temperature" data-value="${n}" aria-pressed="${Math.abs(kelvin.value-n)<50}" ${card._busy.has('color_temperature')?'disabled':''}><i style="--swatch:${['#f4be85','#efe6ce','#c6dff4'][i]}"></i><span>${['暖光','自然光','冷光'][i]}</span><small>${n} K</small></button>`).join('')}</div>`:''}</section>`:'<button class="device-detail-link" data-info>查看灯光详情 ›</button>'}`;
  }else if(COVER_DEVICES.includes(c.device)){
    const position=v.caps.controls.find(x=>x.id==='position');
    body=`<section class="cover-overview">${hero()}<div class="cover-readout"><span class="device-kicker">${E(v.primary.label)}</span>${value(v.primary)}<span class="device-note">${E(v.summary)}</span></div></section>
      ${v.caps.controls.length?`<section class="control-surface cover-controls">${controls(v.caps.controls.filter(x=>x.kind==='buttons'))}${position?`<div class="position-control">${card._control(position)}<div class="preset-row" aria-label="快捷位置">${[0,25,75,100].map(n=>`<button data-command="position" data-value="${n}" aria-pressed="${position.value===n}" ${card._busy.has('position')?'disabled':''}>${n}%</button>`).join('')}</div></div>`:''}</section>`:'<button class="device-detail-link" data-info>查看设备详情 ›</button>'}
      ${!position&&v.primary.number===null?'<div class="device-footnote">行程未上报，按设备能力显示可用控制</div>':''}`;
  }else if(c.device==='vacuum'){
    const progress=f.progress||(c.progress_entity?metric(c.progress_entity,undefined,'清洁进度','%'):null),ratio=progress?.valid?number(progress.text):null;
    const readings=[f.cleaning_time,f.cleaned_area,f.current_room].filter(Boolean);
    body=`<section class="device-overview vacuum-overview"><div><span class="device-kicker">全屋清洁</span><strong class="device-state">${E(v.status)}</strong>${battery?`<span class="device-note">${icon('battery-outline')}${E(battery.text+' '+battery.unit)}</span>`:''}</div>${hero()}</section>
      ${ratio!==null?`<div class="cleaning-progress"><div class="control-label"><span>清洁进度</span><output>${E(progress.text)}%</output></div><div class="device-progress" role="progressbar" aria-label="清洁进度" aria-valuenow="${Math.max(0,Math.min(100,ratio))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0,Math.min(100,ratio))}%"></span></div></div>`:''}
      ${readings.length?`<div class="environment-readings">${readings.map(m=>reading(m,m.name,m.key==='current_room'?'home-outline':m.key==='cleaned_area'?'ruler-square':'timer-outline')).join('')}</div>`:''}
      <section class="control-surface vacuum-controls">${controls(v.caps.controls)}${tiles(d.groups('settings').filter(x=>['cleaning_mode','suction','wetness'].includes(x.key)))}</section>
      ${tiles(d.groups('actions'))}${section('station','基站与任务状态',d.groups('station'))}${section('settings','更多清洁设置',d.groups('settings').filter(x=>!['cleaning_mode','suction','wetness'].includes(x.key)))}${section('rooms','分房间清洁',d.groups('rooms'))}`;
  }else if(c.device==='door_lock'){
    const locked=['locked','已上锁'].includes(main?.state),unsafe=['unlocked','jammed','未上锁'].includes(main?.state)||f.tamper?.warning||f.door?.warning;
    const event=f.event,picture=v.online&&f.snapshot?devicePicture(hass,f.snapshot.entity):'';
    const history=card._history,items=history?.items||[];
    body=`<section class="lock-summary ${unsafe?'warning':locked?'secure':''}">${icon(locked?'lock-outline':'lock-open-outline')}<div><strong class="device-state">${E(v.status)}</strong><div class="lock-safety">${[f.door,f.tamper].filter(Boolean).map(m=>`<button data-info="${E(m.entity)}">${E(m.text)}</button>`).join('')}</div></div></section>
      ${hero('lock-art')}${controls(v.caps.controls)}
      ${event?`<button class="recent-event" data-info="${E(event.entity)}">${icon('key-outline')}<span class="feature-name">最近开门<strong>${E(DOMAIN(event.entity)==='event'&&event.valid?hass.states[event.entity]?.attributes?.event_type||event.text:event.text)}</strong></span><span class="event-date">${event.valid?E(formatDeviceTime(hass.states[event.entity]?.last_changed)):''}</span></button>
      <div class="history-heading"><button data-history aria-expanded="${!!card._historyOpen}">${icon('history')}开门记录<span aria-hidden="true">${card._historyOpen?'⌃':'⌄'}</span></button><button data-history-refresh aria-label="刷新开门记录">${icon('refresh')}</button></div>
      ${card._historyOpen?`<div class="history-list" aria-live="polite">${history?.loading?'<p>正在读取记录…</p>':history?.error?`<p>${E(history.error)}</p><button data-info="${E(event.entity)}">查看 HA 历史 ›</button>`:items.length?items.map(item=>`<div class="history-item">${icon('key-outline')}<span><strong>${E(item.attributes?.event_type||item.state)}</strong><time>${E(formatDeviceTime(item.last_changed||item.last_updated))}</time></span></div>`).join(''):'<p>近 7 天没有可用记录</p>'}</div>`:''}`:''}
      ${f.snapshot?`<section class="lock-snapshot"><div class="section-caption">${icon('camera-outline')}猫眼抓拍</div><button class="snapshot-button" data-info="${E(f.snapshot.entity)}">${picture?`<img data-device-picture src="${E(picture)}" alt="猫眼最新抓拍" loading="lazy">`:`<span class="media-unavailable">${icon('camera-outline')}${v.online?'查看最新抓拍':'设备离线'}</span>`}</button></section>`:''}
      ${tiles([f.lithium_battery,f.doorbell].filter(Boolean))}${section('access','密码与授权',d.groups('actions'))}`;
  }else if(c.device==='camera'){
    const picture=v.online?devicePicture(hass,c.entity):'',ptz=d.groups('ptz');
    body=`<section class="camera-preview"><div class="camera-frame">${card._live&&v.online?'<div data-stream-host></div>':picture?`<button data-info aria-label="查看实时画面"><img data-device-picture src="${E(picture)}" alt="${E(v.name)}预览"></button>`:`<div class="camera-empty">${hero()}<span>${v.online?'打开实体详情查看画面':'设备离线，等待连接'}</span></div>`}</div><div class="camera-caption"><span>${icon(v.online?'video-outline':'video-off-outline')}${E(v.status)}</span><button data-live ${!v.online?'disabled':''}>${icon(card._live?'stop':'play')}${card._live?'停止预览':'实时画面'}</button></div></section>
      ${ptz.length?`<section class="ptz-section"><div><span class="section-caption">云台控制</span><p class="device-note">点按调整镜头方向</p></div><div class="ptz-pad">${['ptz_up','ptz_left','ptz_home','ptz_right','ptz_down'].filter(key=>f[key]).map(key=>`<button style="grid-area:${key.replace('ptz_','')}" data-feature="${key}" aria-label="${E(f[key].name)}" ${f[key].disabled||card._busy.has('feature-'+key)?'disabled':''}>${icon(f[key].icon.replace('mdi:',''))}</button>`).join('')}</div></section>`:''}
      ${tiles(d.groups('settings'))}${section('playback','录像回放',d.groups('playback'))}
      ${!d.groups('playback').length?'<button class="device-detail-link" data-info>查看录像与设备详情 ›</button>':''}`;
  }
  const customMetrics=c.metrics&&c.show_stats?v.metrics:[];
  const alerts=Object.values(f).filter(field=>field.warning);
  return `<ha-card class="device-card ${E(c.device)}-card" style="--accent:var(--soft-${v.accent});--device-action:${v.accent==='warm'?'#925d22':'#286fc4'}" aria-label="${E(v.name)}">
    <header class="header device-header"><div class="identity"><div class="room">${E(v.room)}</div><button class="name" data-info>${E(v.name)}</button></div>${battery&&c.device==='door_lock'?`<button class="battery-badge" data-info="${E(battery.entity)}" aria-label="电池电量 ${E(battery.text+' '+battery.unit)}">${icon('battery-outline')}${E(battery.text)}<small>${E(battery.unit)}</small></button>`:`<span class="status ${!v.online||v.off?'neutral':''}">${E(statusText)}</span>`}<button class="icon-button" ${v.caps.power?'data-command="power"':'data-info'} aria-label="${v.caps.power?(v.off?'开启':'关闭'):'查看详情'}" ${card._busy.has('power')?'disabled':''}>${icon(v.caps.power?'power':'dots-horizontal')}</button></header>
    ${alerts.length?`<div class="device-alert" role="alert">${icon('alert-circle-outline')}${E(alerts.map(x=>x.name+' · '+x.text).join('，'))}</div>`:''}
    ${body}${extras?`<div class="extra device-extras">${extras}</div>`:''}
    ${v.power?`<div class="power-reading"><span>当前功率</span><strong>${E(v.online?v.power.text:'—')} ${E(v.online?v.power.unit:'')}</strong></div>`:''}
    ${customMetrics.length?`<div class="stats device-stats"><div class="stats-title">设备概览</div><div class="metric-grid" style="--metrics:${customMetrics.length}">${customMetrics.map(m=>`<div class="metric"><span class="metric-label">${E(m.name)}</span><span class="metric-value">${E(v.online?m.text:'—')} <small>${E(v.online?m.unit:'')}</small></span></div>`).join('')}</div></div>`:''}
    ${card._busy.size?'<div class="busy" role="status">正在发送操作…</div>':''}${card._error?`<div class="error" role="alert">${E(card._error)}</div>`:''}
    ${c.read_only?'<div class="device-footnote">只读展示</div>':''}
  </ha-card>`;
}

export function formatDeviceTime(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
