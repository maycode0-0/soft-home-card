import { ART } from './art.js';
import { DEVICES, validateConfig, buildView, commandFor, auxiliaryCommand, actionCommand, escapeHTML } from './model.js';
import { CARD_CSS } from './styles.js';
import { SoftHomeCardEditor } from './editor.js';
import { washerView, washerCommand } from './washer.js';
import { WASHER_CSS } from './washer-styles.js';
import { deviceLayout } from './device-layouts.js';
import { deviceCommand } from './devices.js';
import { DEVICE_CSS } from './device-styles.js';

export class SoftHomeCard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._busy=new Set();this._error='';this._interaction=false;
    this.shadowRoot.addEventListener('click',event=>this._click(event));
    this.shadowRoot.addEventListener('input',event=>this._input(event));
    this.shadowRoot.addEventListener('change',event=>this._change(event));
    this.shadowRoot.addEventListener('pointerdown',event=>{if(event.target.matches('input,select'))this._interaction=true;});
    this.shadowRoot.addEventListener('pointerup',()=>{setTimeout(()=>{this._interaction=false;this._schedule();},0);});
    this.shadowRoot.addEventListener('pointercancel',()=>{this._interaction=false;this._schedule();});
    this.shadowRoot.addEventListener('focusout',()=>{this._interaction=false;this._schedule();});
    this.shadowRoot.addEventListener('error',event=>{
      if(event.target.matches?.('[data-device-picture]')){event.target.hidden=true;const message=document.createElement('span');message.className='media-unavailable';message.textContent='画面暂不可用，点按查看实体详情';event.target.parentElement.append(message);}
    },true);
  }
  setConfig(config){const next=validateConfig(config);if(next.device!==this._config?.device||next.entity!==this._config?.entity||next.features?.event!==this._config?.features?.event){this._history=null;this._historyOpen=false;this._live=false;this._streamElement=null;}this._config=next;this._lastRender='';this._error='';this._interaction=false;this._schedule();}
  set hass(hass){this._hass=hass;if(this._streamElement)Object.assign(this._streamElement,{hass,stateObj:hass.states?.[this._config?.entity]});this._schedule();}
  get hass(){return this._hass;}
  connectedCallback(){this._schedule();}
  disconnectedCallback(){cancelAnimationFrame(this._raf);this._raf=0;this._interaction=false;}
  getCardSize(){return this._config?.show_stats===false?9:11;}
  getGridOptions(){return {columns:12,rows:'auto',min_columns:6};}
  static getConfigElement(){return document.createElement('soft-home-card-editor');}
  static getStubConfig(){return {type:'custom:soft-home-card',device:'washing_machine',show_stats:true};}
  _schedule(){if(this._raf||!this.isConnected)return;this._raf=requestAnimationFrame(()=>{this._raf=0;this._render();});}
  _info(entity=this._config.entity){this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity},bubbles:true,composed:true}));}
  _control(control){const E=escapeHTML,busy=this._busy.has(control.id),disabled=busy?'disabled':'';
    if(control.kind==='color')return `<label class="select-control"><span>${E(control.label)}</span><input type="color" data-control="${control.id}" value="${control.value}" aria-label="选择灯光颜色" ${disabled}></label>`;
    if(control.kind==='range')return `<div><label class="control-label" for="${control.id}"><span>${E(control.label)}</span><output data-output="${control.id}">${E(control.value)} ${E(control.unit)}</output></label><input id="${control.id}" data-control="${control.id}" class="${control.id==='color_temperature'?'color-temperature':''}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.value}" aria-label="${E(control.label)}" aria-valuetext="${E(control.value+' '+control.unit)}" ${disabled}></div>`;
    if(control.kind==='stepper')return `<div><div class="control-label">${E(control.label)}</div><div class="button-row stepper"><button data-command="temperature" data-value="${control.value-control.step}" aria-label="降低温度" ${busy||control.value<=control.min?'disabled':''}>−</button><output>${E(control.value)} ${E(control.unit)}</output><button data-command="temperature" data-value="${control.value+control.step}" aria-label="升高温度" ${busy||control.value>=control.max?'disabled':''}>＋</button></div></div>`;
    if(control.kind==='select')return `<label class="select-control"><span>${E(control.label)}</span><select data-control="${control.id}" aria-label="${E(control.label)}" ${disabled}>${!control.options.includes(control.value)?'<option value="" disabled selected>选择</option>':''}${control.options.map(o=>`<option value="${E(o)}" ${o===control.value?'selected':''}>${E(({heat:'制热',cool:'制冷',heat_cool:'自动温控',auto:'自动',off:'关闭',dry:'除湿',fan_only:'送风'})[o]||o)}</option>`).join('')}</select></label>`;
    return `<div class="button-row">${control.buttons.map(b=>`<button data-command="${b.id}" class="${b.id==='stop'?'stop':''}" aria-label="${E(b.label)}" ${this._busy.has(b.id)?'disabled':''}>${E(b.label)}</button>`).join('')}</div>`;
  }
  _washerMarkup(v,w,art,extras){
    const E=escapeHTML,c=this._config,icon=name=>`<ha-icon icon="${name}" aria-hidden="true"></ha-icon>`;
    const tile=field=>`<button class="washer-setting" data-info="${E(field.entity)}" aria-label="${E(field.name+'：'+field.text+(field.unit?' '+field.unit:'')+'，查看详情')}">${icon(field.icon)}<span><span class="washer-label">${E(field.name)}</span><strong>${E(field.text)}${field.unit?` <small>${E(field.unit)}</small>`:''}</strong></span><span class="washer-chevron" aria-hidden="true">›</span></button>`;
    const program=w.fields.program,quick=w.groups('quick'),safety=w.groups('safety').filter(f=>!['error','overheat'].includes(f.key));
    const settings=[...w.groups('settings'),...w.groups('safety').filter(f=>['error','overheat'].includes(f.key)),...w.groups('usage').filter(f=>['wash_time','spin_time'].includes(f.key))];
    const usage=c.show_stats?(c.metrics?v.metrics:[...w.groups('usage').filter(f=>['water_usage','energy'].includes(f.key)),...(v.power?[v.power]:[])]):[];
    const opened=this.shadowRoot.querySelector('details[data-washer-settings]')?.open;
    const remaining=w.hasRemaining?v.primary.text:'—',unit=v.primary.unit==='min'?'分钟':v.primary.unit;
    const progress=w.progress===null?null:Math.round(w.progress*100);
    return `<ha-card class="washer-card" style="--accent:var(--soft-${v.accent});--washer-action:${v.accent==='warm'?'#966022':'#286fc4'}" aria-label="${E(v.name)}">
      <header class="header"><div class="identity"><button class="name" data-info>${E(v.name)}</button><div class="room" title="${E(v.room)}">${E(v.room)}</div></div><span class="status ${!v.online||v.off||/待机|暂停/.test(w.status)?'neutral':''}">${E(w.status)}</span><button class="icon-button washer-more" data-info aria-label="查看${E(v.name)}详情">${icon('mdi:dots-horizontal')}</button></header>
      ${w.alerts.length?`<div class="washer-alert" role="alert">${icon('mdi:alert-circle-outline')}<span>${E(w.alerts.map(f=>f.name+' · '+f.text).join('，'))}</span></div>`:''}
      <section class="washer-overview" aria-label="洗涤概况">
        <button class="washer-program" data-info="${E(program?.entity||c.entity)}"><span><span class="washer-label">当前程序</span><strong>${E(program?.valid?program.text:program?'程序未知':'洗衣概况')}</strong></span><span class="washer-chevron" aria-hidden="true">›</span></button>
        <div class="washer-hero-row"><button class="hero ${!v.online?'offline':v.off?'inactive':''}" data-info aria-label="查看${E(v.name)}详情">${art.replace('viewBox="0 0 320 210"','viewBox="65 0 195 210"')}</button><div class="washer-countdown"><span class="washer-label">${E(c.primary_label||'剩余时间')}</span><div class="washer-time ${remaining.length>5?'long':''}">${E(remaining)}${w.hasRemaining&&v.primary.number!==null?`<span>${E(unit)}</span>`:''}</div><span class="washer-time-note">${!v.online?'等待设备连接':remaining==='—'?'等待设备上报':c.read_only?'只读展示':'设备实时读数'}</span></div></div>
        <div class="washer-progress-label"><span>${icon('mdi:progress-clock')}${E(w.phase)}</span><span>${progress===null?'':`${progress}%`}</span></div>
        ${progress!==null?`<div class="washer-progress" role="progressbar" aria-label="洗涤进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>`:''}
      </section>
      ${quick.length?`<section class="washer-quick" style="--washer-columns:${quick.length}" aria-label="常用洗涤参数">${quick.map(tile).join('')}</section>`:''}
      <div class="washer-actions">${w.controls.map(control=>`<button class="${control.key==='start'?'washer-start':''}" ${control.key==='main-power'?'data-command="power"':`data-washer="${control.key}"`} ${control.disabled||this._busy.has(control.key==='main-power'?'power':'washer-'+control.key)?'disabled':''}>${icon(control.icon)}${E(control.label)}</button>`).join('')}${!w.controls.length&&!extras?'<button data-info>查看设备详情 ›</button>':''}</div>
      ${extras?`<div class="extra washer-extras">${extras}</div>`:''}
      ${v.caps.controls.length?`<div class="controls">${v.caps.controls.map(control=>this._control(control)).join('')}</div>`:''}
      ${this._busy.size?'<div class="busy" role="status">正在发送操作…</div>':''}
      ${safety.length?`<section class="washer-safety" aria-label="安全状态">${safety.map(field=>`<button class="${field.warning?'warning':''}" data-info="${E(field.entity)}">${icon(field.icon)}<span>${E(field.name)} · ${E(field.text)}</span></button>`).join('')}</section>`:''}
      ${settings.length?`<details class="washer-details" data-washer-settings ${opened?'open':''}><summary><span>${icon('mdi:tune-variant')}更多设置与状态</span><span class="washer-chevron" aria-hidden="true">⌄</span></summary><div class="washer-setting-grid">${settings.map(tile).join('')}</div></details>`:''}
      ${usage.length?`<section class="washer-usage" aria-label="用量与概览"><span class="washer-label">${c.metrics?'设备概览':v.power?'用量与功率':'本次用量'}</span><div class="metric-grid" style="--metrics:${usage.length}">${usage.map(m=>`<div class="metric"><span class="metric-label">${E(m.name)}</span><span class="metric-value">${E(v.online?m.text:'—')} <span class="metric-unit">${E(v.online?m.unit:'')}</span></span></div>`).join('')}</div></section>`:''}
      ${this._error?`<div class="error" role="alert">${E(this._error)}</div>`:''}
    </ha-card>`;
  }
  _render(){if(!this._hass||!this._config||this._interaction)return;const c=this._config,E=escapeHTML;
    if(!c.entity){
      this.toggleAttribute('dark',c.theme==='dark'||c.theme==='auto'&&!!this._hass.themes?.darkMode);
      this.shadowRoot.innerHTML=`<style>${CARD_CSS}</style><ha-card><p class="main-title">${E(c.name||DEVICES[c.device][0])}</p><div class="hero">${ART[c.device].replace(/(<text\b[^>]*data-readout="\d+"[^>]*>)[\s\S]*?(<\/text>)/g,'$1—$2')}</div><p role="status">请在编辑器中选择具体设备和主实体。</p></ha-card>`;
      this._lastRender='';return;
    }
    const v=buildView(this._hass,c);
    const dark=c.theme==='dark'||(c.theme==='auto'&&!!this._hass.themes?.darkMode);this.toggleAttribute('dark',dark);
    const w=c.device==='washing_machine'?washerView(this._hass,c,v):null;
    const renderKey=JSON.stringify([v,w,c,Object.values(c.features||{}).map(id=>this._hass.states?.[id]),this._hass.states?.[c.entity],this._history,this._historyOpen,this._live,[...this._busy],this._error,dark]);if(renderKey===this._lastRender)return;this._lastRender=renderKey;
    const focused=this.shadowRoot.activeElement;
    const focusKind=focused?.hasAttribute('data-control')?'control':'command',focusKey=focused?.dataset?.[focusKind];
    const focusIndex=focusKey?[...this.shadowRoot.querySelectorAll(`[data-${focusKind}]`)].filter(el=>el.dataset[focusKind]===focusKey).indexOf(focused):-1;
    const transientFocus=['data-live','data-history','data-history-refresh'].find(attribute=>focused?.hasAttribute(attribute));
    const washerFocus=focused?.hasAttribute('data-washer')?['data-washer',focused.dataset.washer]:focused?.hasAttribute('data-info')?['data-info',focused.dataset.info]:focused?.matches('summary')?['summary',null]:null;
    const circumference=2*Math.PI*34,fill=v.primary.ratio===null?0:v.primary.ratio*circumference;
    const value=v.primary.text,unit=v.primary.unit;
    const primaryString=value+(unit?` ${unit}`:'');
    let art=ART[c.device];
    art=art.replace(/(<text\b[^>]*data-readout="(\d+)"[^>]*>)[\s\S]*?(<\/text>)/g,(_,open,index,close)=>open+E(index==='0'?primaryString:(v.secondary?.valid?`${v.secondary.text} ${v.secondary.unit}`:'—'))+close);
    const actionButtons=(c.actions||[]).map((a,i)=>`<button data-action="${i}" ${this._busy.has('action-'+i)||a.action!=='more-info'&&(!v.online||c.read_only)?'disabled':''}>${E(a.label)}</button>`).join('');
    const auxButtons=v.auxiliary.map((a,i)=>`<button data-aux="${i}" class="${a.on?'active':''}" title="${E(a.state)}" ${a.disabled||this._busy.has('aux-'+i)?'disabled':''}>${E(a.name)}</button>`).join('');
    const noControl=!v.caps.controls.length&&!auxButtons&&!actionButtons;
    const deviceMarkup=!w?deviceLayout(this,v,art,auxButtons+actionButtons):'';
    const openedSections=new Set([...this.shadowRoot.querySelectorAll('details[data-device-section][open]')].map(el=>el.dataset.deviceSection));
    const featureFocus=focused?.hasAttribute('data-feature')?focused.dataset.feature:null;
    this.shadowRoot.innerHTML=w?`<style>${CARD_CSS}${WASHER_CSS}</style>${this._washerMarkup(v,w,art,auxButtons+actionButtons)}`:deviceMarkup?`<style>${CARD_CSS}${DEVICE_CSS}</style>${deviceMarkup}`:`<style>${CARD_CSS}</style><ha-card style="--accent:var(--soft-${v.accent})" aria-label="${E(v.name)}">
      <header class="header"><button class="icon-button device-icon" data-info title="查看设备详情" aria-label="查看${E(v.name)}详情"><ha-icon icon="${v.icon}"></ha-icon></button><div class="identity"><button class="name" data-info>${E(v.name)}</button><div class="room" title="${E(v.room)}">${E(v.room)}</div></div><span class="status ${!v.online||v.off?'neutral':''}" title="${E(v.status)}">${E(v.status)}</span><button class="icon-button" ${v.caps.power?'data-command="power"':'data-info'} aria-label="${v.caps.power?(v.off?'开启':'关闭'):'查看详情'}" ${this._busy.has('power')?'disabled':''}><ha-icon icon="${v.caps.power?'mdi:power':'mdi:dots-horizontal'}"></ha-icon></button></header>
      <button class="hero ${!v.online?'offline':v.off?'inactive':''}" data-info aria-label="查看${E(v.name)}详情">${art}</button>
      <section class="panel"><div class="ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="track" cx="40" cy="40" r="34"/><circle class="fill" cx="40" cy="40" r="34" stroke-dasharray="${fill} ${circumference}"/></svg><div class="readout"><span class="value ${value.length>4?'small':''}">${E(value)}<span class="unit">${E(unit)}</span></span><span class="readout-label">${E(v.primary.label)}</span></div></div>
      <div class="main-info"><p class="main-title">${E(v.summary)}</p><p class="summary">${E(v.secondary?.valid?`${v.secondary.name} · ${v.secondary.text} ${v.secondary.unit}`:v.primary.label)}</p>
      <div class="controls">${v.caps.controls.map(control=>this._control(control)).join('')}</div>
      ${v.power?`<div class="power-reading"><span>当前功率</span><strong>${E(v.power.text)} ${E(v.power.unit)}</strong></div>`:''}
      ${noControl?'<button class="hint" data-info>查看实体详情 ›</button>':''}
      ${this._busy.size?'<div class="busy" role="status">正在发送操作…</div>':''}</div>
      ${auxButtons||actionButtons?`<div class="extra">${auxButtons}${actionButtons}</div>`:''}</section>
      ${c.show_stats&&v.metrics.length?`<section class="stats"><div class="stats-title">设备概览</div><div class="metric-grid" style="--metrics:${v.metrics.length}">${v.metrics.map(m=>`<div class="metric"><span class="metric-label" title="${E(m.name)}">${E(m.name)}</span><span class="metric-value">${E(m.text)} <span class="metric-unit">${E(m.unit)}</span></span></div>`).join('')}</div></section>`:''}
      ${this._error?`<div class="error" role="alert">${E(this._error)}</div>`:''}</ha-card>`;
    if(focusKey){const targets=[...this.shadowRoot.querySelectorAll(`[data-${focusKind}]`)].filter(el=>el.dataset[focusKind]===focusKey),target=targets[focusIndex];if(target&&!target.disabled)target.focus({preventScroll:true});}
    if(transientFocus)this.shadowRoot.querySelector(`[${transientFocus}]`)?.focus({preventScroll:true});
    if(w&&washerFocus){const [attribute,value]=washerFocus;const target=attribute==='summary'?this.shadowRoot.querySelector('summary'):[...this.shadowRoot.querySelectorAll(`[${attribute}]`)].find(el=>el.getAttribute(attribute)===value&&!el.disabled);target?.focus({preventScroll:true});}
    for(const el of this.shadowRoot.querySelectorAll('details[data-device-section]'))if(openedSections.has(el.dataset.deviceSection))el.open=true;
    if(deviceMarkup&&washerFocus){const [attribute,value]=washerFocus;const target=attribute==='summary'?this.shadowRoot.querySelector(`details[data-device-section="${focused?.parentElement?.dataset.deviceSection}"] summary`):[...this.shadowRoot.querySelectorAll('[data-info]')].find(el=>el.dataset.info===value);target?.focus({preventScroll:true});}
    if(featureFocus)[...this.shadowRoot.querySelectorAll('[data-feature]')].find(el=>el.dataset.feature===featureFocus&&!el.disabled)?.focus({preventScroll:true});
    const streamHost=this.shadowRoot.querySelector('[data-stream-host]');
    if(streamHost){this._streamElement=this._streamElement||document.createElement('ha-camera-stream');Object.assign(this._streamElement,{hass:this._hass,stateObj:this._hass.states?.[c.entity],controls:true,muted:true});streamHost.append(this._streamElement);}
  }
  _input(event){const input=event.target,id=input.dataset.control;if(!id||input.type!=='range')return;this._interaction=true;
    const control=buildView(this._hass,this._config).caps.controls.find(x=>x.id===id);const output=this.shadowRoot.querySelector(`[data-output="${id}"]`);
    if(output&&control)output.textContent=`${input.value} ${control.unit}`;
    input.setAttribute('aria-valuetext',`${input.value} ${control?.unit||''}`);
  }
  _change(event){const input=event.target,id=input.dataset.control;if(!id)return;this._interaction=false;this._execute(id,()=>commandFor(this._hass,this._config,id,input.value));}
  _click(event){const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-history')){this._historyOpen=!this._historyOpen;if(this._historyOpen&&!this._history)this._loadHistory();this._lastRender='';this._schedule();return;}
    if(button.hasAttribute('data-history-refresh')){this._historyOpen=true;this._loadHistory();return;}
    if(button.hasAttribute('data-live')){if(!customElements.get('ha-camera-stream'))return this._info();this._live=!this._live;this._lastRender='';this._schedule();return;}
    if(button.hasAttribute('data-info'))return this._info(button.dataset.info||undefined);
    if(button.dataset.washer)return this._execute('washer-'+button.dataset.washer,()=>washerCommand(this._hass,this._config,button.dataset.washer));
    if(button.dataset.feature)return this._execute('feature-'+button.dataset.feature,()=>deviceCommand(this._hass,this._config,button.dataset.feature));
    const {command,value,aux,action}=button.dataset;
    if(command)this._execute(command,()=>commandFor(this._hass,this._config,command,value));
    if(aux!==undefined)this._execute('aux-'+aux,()=>auxiliaryCommand(this._hass,this._config,Number(aux)));
    if(action!==undefined)this._execute('action-'+action,()=>actionCommand(this._hass,this._config,Number(action)));
  }
  async _loadHistory(){
    const entity=this._config.features?.event;if(!entity||this._history?.loading)return;
    const request={entity,loading:true,items:[]};this._history=request;this._lastRender='';this._schedule();
    try{
      if(!this._hass.callApi)throw new Error('当前会话不支持历史查询，请在 HA 详情中查看。');
      const end=new Date(),start=new Date(end.getTime()-7*86400000);
      const response=await this._hass.callApi('GET',`history/period/${encodeURIComponent(start.toISOString())}?filter_entity_id=${encodeURIComponent(entity)}&end_time=${encodeURIComponent(end.toISOString())}`);
      request.items=(Array.isArray(response?.[0])?response[0]:[]).filter(item=>item&&item.state&&!['unknown','unavailable'].includes(item.state)&&Number.isFinite(new Date(item.last_changed||item.last_updated).getTime())&&new Date(item.last_changed||item.last_updated)>=start).slice(-20).reverse();
    }catch(error){request.error=error?.message||'暂时无法读取记录，请在 HA 详情中查看。';}
    finally{request.loading=false;if(this._history===request){this._lastRender='';this._schedule();}}
  }
  async _execute(key,makeCommand){if(this._busy.has(key))return;
    try{let command=makeCommand();if(command.moreInfo)return this._info(command.moreInfo);
      if(command.confirmation){if(!window.confirm(typeof command.confirmation==='string'?command.confirmation:'执行此操作？'))return;command=makeCommand();}
      this._error='';this._busy.add(key);this._schedule();
      await this._hass.callService(command.domain,command.service,command.data,command.target);
    }catch(error){this._error=error?.message||String(error)||'操作失败，请检查设备连接。';}
    finally{this._busy.delete(key);this._lastRender='';this._schedule();}
  }
}
if(!customElements.get('soft-home-card'))customElements.define('soft-home-card',SoftHomeCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==='soft-home-card'))window.customCards.push({type:'soft-home-card',name:'Soft Home · 柔光设备卡片',description:'23 种设备外观，设备专属布局，原生实体控制，可视化配置。',preview:true});
