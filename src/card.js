import { ART } from './art.js';
import { DEVICES, validateConfig, buildView, commandFor, auxiliaryCommand, actionCommand, escapeHTML } from './model.js';
import { CARD_CSS } from './styles.js';
import { SoftHomeCardEditor } from './editor.js';

export class SoftHomeCard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._busy=new Set();this._error='';this._interaction=false;
    this.shadowRoot.addEventListener('click',event=>this._click(event));
    this.shadowRoot.addEventListener('input',event=>this._input(event));
    this.shadowRoot.addEventListener('change',event=>this._change(event));
    this.shadowRoot.addEventListener('pointerdown',event=>{if(event.target.matches('input,select'))this._interaction=true;});
    this.shadowRoot.addEventListener('pointerup',()=>{setTimeout(()=>{this._interaction=false;this._schedule();},0);});
    this.shadowRoot.addEventListener('pointercancel',()=>{this._interaction=false;this._schedule();});
    this.shadowRoot.addEventListener('focusout',()=>{this._interaction=false;this._schedule();});
  }
  setConfig(config){this._config=validateConfig(config);this._lastRender='';this._error='';this._interaction=false;this._schedule();}
  set hass(hass){this._hass=hass;this._schedule();}
  get hass(){return this._hass;}
  connectedCallback(){this._schedule();}
  disconnectedCallback(){cancelAnimationFrame(this._raf);this._raf=0;this._interaction=false;}
  getCardSize(){return this._config?.show_stats===false?9:11;}
  getGridOptions(){return {columns:12,rows:'auto',min_columns:6};}
  static getConfigElement(){return document.createElement('soft-home-card-editor');}
  static getStubConfig(hass){const id=Object.keys(hass?.states||{}).find(x=>x.startsWith('light.'))||Object.keys(hass?.states||{})[0]||'sensor.replace_me';return {type:'custom:soft-home-card',device:id.startsWith('light.')?'wall_light':'temperature_humidity',entity:id,show_stats:true};}
  _schedule(){if(this._raf||!this.isConnected)return;this._raf=requestAnimationFrame(()=>{this._raf=0;this._render();});}
  _info(entity=this._config.entity){this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity},bubbles:true,composed:true}));}
  _control(control){const E=escapeHTML,busy=this._busy.has(control.id),disabled=busy?'disabled':'';
    if(control.kind==='range')return `<div><label class="control-label" for="${control.id}"><span>${E(control.label)}</span><output data-output="${control.id}">${E(control.value)} ${E(control.unit)}</output></label><input id="${control.id}" data-control="${control.id}" class="${control.id==='color_temperature'?'color-temperature':''}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.value}" aria-label="${E(control.label)}" aria-valuetext="${E(control.value+' '+control.unit)}" ${disabled}></div>`;
    if(control.kind==='stepper')return `<div><div class="control-label">${E(control.label)}</div><div class="button-row stepper"><button data-command="temperature" data-value="${control.value-control.step}" aria-label="降低温度" ${busy||control.value<=control.min?'disabled':''}>−</button><output>${E(control.value)} ${E(control.unit)}</output><button data-command="temperature" data-value="${control.value+control.step}" aria-label="升高温度" ${busy||control.value>=control.max?'disabled':''}>＋</button></div></div>`;
    if(control.kind==='select')return `<label class="select-control"><span>${E(control.label)}</span><select data-control="${control.id}" aria-label="${E(control.label)}" ${disabled}>${!control.options.includes(control.value)?'<option value="" disabled selected>选择</option>':''}${control.options.map(o=>`<option value="${E(o)}" ${o===control.value?'selected':''}>${E(({heat:'制热',cool:'制冷',heat_cool:'自动温控',auto:'自动',off:'关闭',dry:'除湿',fan_only:'送风'})[o]||o)}</option>`).join('')}</select></label>`;
    return `<div class="button-row">${control.buttons.map(b=>`<button data-command="${b.id}" class="${b.id==='stop'?'stop':''}" aria-label="${E(b.label)}" ${this._busy.has(b.id)?'disabled':''}>${E(b.label)}</button>`).join('')}</div>`;
  }
  _render(){if(!this._hass||!this._config||this._interaction)return;const v=buildView(this._hass,this._config),c=this._config,E=escapeHTML;
    const dark=c.theme==='dark'||(c.theme==='auto'&&!!this._hass.themes?.darkMode);this.toggleAttribute('dark',dark);
    const renderKey=JSON.stringify([v,c,[...this._busy],this._error,dark]);if(renderKey===this._lastRender)return;this._lastRender=renderKey;
    const focused=this.shadowRoot.activeElement;const focusKey=focused?.dataset?.control||focused?.dataset?.command;
    const circumference=2*Math.PI*34,fill=v.primary.ratio===null?0:v.primary.ratio*circumference;
    const value=v.primary.text,unit=v.primary.unit;
    const primaryString=value+(unit?` ${unit}`:'');
    let art=ART[c.device];
    art=art.replace(/(<text\b[^>]*data-readout="(\d+)"[^>]*>)[\s\S]*?(<\/text>)/g,(_,open,index,close)=>open+E(index==='0'?primaryString:(v.secondary?.valid?`${v.secondary.text} ${v.secondary.unit}`:'—'))+close);
    const actionButtons=(c.actions||[]).map((a,i)=>`<button data-action="${i}" ${this._busy.has('action-'+i)||a.action!=='more-info'&&(!v.online||c.read_only)?'disabled':''}>${E(a.label)}</button>`).join('');
    const auxButtons=v.auxiliary.map((a,i)=>`<button data-aux="${i}" class="${a.on?'active':''}" title="${E(a.state)}" ${a.disabled||this._busy.has('aux-'+i)?'disabled':''}>${E(a.name)}</button>`).join('');
    const noControl=!v.caps.controls.length&&!auxButtons&&!actionButtons;
    this.shadowRoot.innerHTML=`<style>${CARD_CSS}</style><ha-card style="--accent:var(--soft-${v.accent})" aria-label="${E(v.name)}">
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
    if(focusKey){const target=[...this.shadowRoot.querySelectorAll('[data-control],[data-command]')].find(el=>(el.dataset.control||el.dataset.command)===focusKey&&!el.disabled);target?.focus({preventScroll:true});}
  }
  _input(event){const input=event.target,id=input.dataset.control;if(!id||input.type!=='range')return;this._interaction=true;
    const control=buildView(this._hass,this._config).caps.controls.find(x=>x.id===id);const output=this.shadowRoot.querySelector(`[data-output="${id}"]`);
    if(output&&control)output.textContent=`${input.value} ${control.unit}`;
    input.setAttribute('aria-valuetext',`${input.value} ${control?.unit||''}`);
  }
  _change(event){const input=event.target,id=input.dataset.control;if(!id)return;this._interaction=false;this._execute(id,()=>commandFor(this._hass,this._config,id,input.value));}
  _click(event){const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-info'))return this._info();
    const {command,value,aux,action}=button.dataset;
    if(command)this._execute(command,()=>commandFor(this._hass,this._config,command,value));
    if(aux!==undefined)this._execute('aux-'+aux,()=>auxiliaryCommand(this._hass,this._config,Number(aux)));
    if(action!==undefined)this._execute('action-'+action,()=>actionCommand(this._hass,this._config,Number(action)));
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
if(!window.customCards.some(card=>card.type==='soft-home-card'))window.customCards.push({type:'soft-home-card',name:'Soft Home · 柔光设备卡片',description:'19 种设备外观，原生实体控制，可视化配置，无外部卡片依赖。',preview:true});
