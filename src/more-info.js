import {SoftHomeCard} from './card.js';
import {CARD_CSS} from './styles.js';
import {buildView, escapeHTML, DOMAIN, commandFor} from './model.js';
import {moreInfoRoute, moreInfoExtraControls, moreInfoExtraCommand, moreInfoHasHistory, moreInfoStateLabel, moreInfoCapabilities, moreInfoCommand} from './more-info-model.js';
import {MORE_INFO_CSS, MORE_INFO_PANEL_CSS} from './more-info-styles.js';

const nativeMoreInfoEvents=new WeakSet();
const addonKey=Symbol.for('soft-home-more-info');

class SoftHomeEntityPanel extends SoftHomeCard {
  _execute(key,makeCommand){
    return super._execute(key,this._config?.lock_kind==='child'?()=>moreInfoCommand(this._hass,this._config,key):makeCommand);
  }
  _info(entity=this._config.entity){
    this.dispatchEvent(new CustomEvent('soft-home-native-info',{detail:{entityId:entity},bubbles:true,composed:true}));
  }
  _render(){
    if(!this._config||!this._hass||this._interaction)return;
    if(this.rich){
      const advancedOpen=this.shadowRoot.querySelector('[data-more-info-advanced]')?.open;
      super._render();
      const card=this.shadowRoot.querySelector('ha-card');
      if(this._config.device==='air_conditioner'&&card&&!card.querySelector('[data-more-info-advanced]')){
        const advanced=[...card.children].filter(node=>node.matches('.feature-grid,.device-details'));
        if(advanced.length){
          const details=document.createElement('details');details.className='device-details';details.dataset.moreInfoAdvanced='';details.dataset.deviceSection='more-info-advanced';details.open=!!advancedOpen;
          const summary=document.createElement('summary');summary.textContent='更多设备功能　⌄';details.append(summary,...advanced);card.append(details);
        }
      }
      if(!this.shadowRoot.querySelector('[data-more-info-style]')){
        const style=document.createElement('style');style.dataset.moreInfoStyle='';style.textContent=MORE_INFO_PANEL_CSS;this.shadowRoot.append(style);
      }
      return;
    }
    const c=this._config,hass=this._hass,state=hass.states?.[c.entity],v=buildView(hass,c),E=escapeHTML;
    const dark=!!hass.themes?.darkMode;
    this.toggleAttribute('dark',dark);
    const key=JSON.stringify([state,v,dark,[...this._busy],this._error]);
    if(key===this._lastRender)return;this._lastRender=key;
    const active=this.shadowRoot.activeElement,focus=active?.dataset.control,attributesOpen=this.shadowRoot.querySelector('details')?.open;
    const childLock=c.lock_kind==='child',caps=childLock?moreInfoCapabilities(hass,c):v.caps;
    const value=!childLock&&v.primary.number!==null?v.primary.text:moreInfoStateLabel(hass,c.entity,c);
    const attributes=Object.entries(state?.attributes||{}).filter(([name])=>!['friendly_name','entity_picture','icon'].includes(name)&&!/token|password|secret|auth/i.test(name)).slice(0,32);
    const attrName=name=>{try{return hass.formatEntityAttributeName?.(state,name)||name;}catch{return name;}};
    const attrValue=(name,value)=>{try{return hass.formatEntityAttributeValue?.(state,name)||(typeof value==='object'?JSON.stringify(value):String(value??'—'));}catch{return String(value??'—');}};
    this.shadowRoot.innerHTML=`<style>${CARD_CSS}${MORE_INFO_PANEL_CSS}</style><ha-card>
      <section class="generic-detail ${childLock?'child-lock-detail '+(value==='童锁已开启'?'enabled':''):''}" ${childLock?'data-lock-kind="child"':''}>${childLock?'<span class="child-lock-symbol"><ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon></span>':''}<span class="generic-detail-label">${E(childLock?'童锁状态':v.primary.number!==null?v.primary.label:'当前状态')}</span><strong class="generic-detail-value ${childLock||v.primary.number===null?'textual':''}">${E(value)}${!childLock&&v.primary.unit?`<small>${E(v.primary.unit)}</small>`:''}</strong>
      ${childLock?'<p class="summary child-lock-description">设备按键保护 · 防止误触</p>':''}
      ${!v.online||c.read_only?`<p class="summary" role="status">${c.read_only?'只读模式 · 仅查看设备状态':'当前实体不可操作，请检查设备连接。'}</p>`:''}
      <div class="controls">${caps.controls.map(control=>this._control(control)).join('')}</div></section>
      ${attributes.length?`<details class="entity-attributes" ${attributesOpen?'open':''}><summary>状态属性 <span aria-hidden="true">⌄</span></summary><dl>${attributes.map(([name,value])=>`<dt>${E(attrName(name))}</dt><dd>${E(attrValue(name,value))}</dd>`).join('')}</dl></details>`:''}
      ${this._busy.size?'<p class="busy" role="status">正在发送操作…</p>':''}${this._error?`<p class="error" role="alert">${E(this._error)}</p>`:''}</ha-card>`;
    if(focus)this.shadowRoot.querySelector(`[data-control="${focus}"]`)?.focus({preventScroll:true});
  }
}
if(!customElements.get('soft-home-entity-panel'))customElements.define('soft-home-entity-panel',SoftHomeEntityPanel);

class SoftHomeMoreInfoDialog extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._pending=new Set();
    this.shadowRoot.innerHTML=`<style>${MORE_INFO_CSS}</style><dialog aria-labelledby="soft-detail-title"><header class="dialog-header"><div class="heading"><p class="eyebrow"></p><h2 id="soft-detail-title"></h2></div><button class="icon-button power" aria-label="电源" hidden><ha-icon icon="mdi:power" aria-hidden="true"></ha-icon></button>
      <button type="button" class="icon-button native-details" aria-label="原生详情" title="原生详情"><ha-icon icon="mdi:cog-outline" aria-hidden="true"></ha-icon></button>
      <button class="icon-button close" aria-label="关闭设备详情">×</button></header><div class="status-row"><span class="status-pill"></span><span class="status-note"></span></div><div class="content"><div class="panel-host"></div><div class="extras"></div><p class="detail-error" role="alert" hidden></p></div></dialog>`;
    this._dialog=this.shadowRoot.querySelector('dialog');
    this._historyHost=document.createElement('section');this._historyHost.className='native-history';this._historyHost.hidden=true;this._historyHost.setAttribute('aria-label','历史与活动');
    this.shadowRoot.querySelector('.panel-host').after(this._historyHost);
    this._historyHost.addEventListener('click',event=>{if(event.target.closest('[data-native-history]')&&this._params)this._native(this._params.entityId,'history');});
    this.shadowRoot.querySelector('.close').onclick=()=>this.closeDialog();
    this.shadowRoot.querySelector('.native-details').onclick=()=>this._native(this._params.entityId);
    this.shadowRoot.querySelector('.power').onclick=async()=>{
      const panel=this._panel,params=this._params;if(!panel||!params)return;
      this.shadowRoot.querySelector('.power').disabled=true;
      await panel._execute('power',()=>commandFor(this._hass,params.config,'power'));
      if(this._params===params)this._refresh();
    };
    this.addEventListener('soft-home-native-info',event=>{event.stopPropagation();this._native(event.detail.entityId);});
    // Requests from HA history/logbook that pass the global router need the native modal.
    this.addEventListener('hass-more-info',()=>this.closeDialog());
    this._dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeDialog();});
    this._dialog.addEventListener('close',()=>{if(!this._dialog.open)this._finishClose();});
    this._dialog.addEventListener('click',event=>{
      const rect=this._dialog.getBoundingClientRect();
      if(event.target===this._dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))this.closeDialog();
    });
    this.shadowRoot.addEventListener('change',event=>{
      if(event.target.dataset.extra)this._executeExtra(event.target.dataset.extra,event.target.value);
    });
    this.shadowRoot.addEventListener('focusout',()=>queueMicrotask(()=>this._refreshExtras()));
  }
  set hass(value){this._hass=value;if(this._params)this._refresh();}
  get hass(){return this._hass;}
  connectedCallback(){this._openWhenReady();}
  disconnectedCallback(){this.closeDialog();}
  showDialog(params){
    if(!params?.entityId||!params.config)return;
    this._cancelHistoryWait?.();this._historyComponents=[];
    this._params=params;this._active=true;this._extraKey='';this._error='';this._pending=new Set();this._showError();
    this._panel=document.createElement('soft-home-entity-panel');this._panel.rich=params.rich;
    this._panel.setConfig(params.config);this._panel.hass=this._hass;
    this.shadowRoot.querySelector('.panel-host').replaceChildren(this._panel);
    this._refresh();this._openWhenReady();this._startHistory(params);
  }
  _openWhenReady(){
    if(!this.isConnected||!this._active||this._dialog.open)return;
    this._dialog.showModal();
    this.shadowRoot.querySelector('.close').focus({preventScroll:true});
  }
  _refresh(){
    const params=this._params,hass=this._hass;if(!params||!hass)return;
    const state=hass.states?.[params.entityId],v=buildView(hass,params.config),dark=!!hass.themes?.darkMode;
    this.toggleAttribute('dark',dark);this._dialog.classList.toggle('dark',dark);
    this.shadowRoot.querySelector('.eyebrow').textContent=params.config.room||'SOFT HOME · 设备详情';
    this.shadowRoot.querySelector('h2').textContent=params.config.name||state?.attributes?.friendly_name||params.entityId;
    const statusRow=this.shadowRoot.querySelector('.status-row');
    statusRow.hidden=params.config.device==='camera';
    const pill=statusRow.querySelector('.status-pill'),status=moreInfoStateLabel(hass,params.entityId,params.config);pill.textContent=status;pill.classList.toggle('neutral',!v.online||v.off||moreInfoHasHistory(params.entityId)||params.config.lock_kind==='child'&&status!=='童锁已开启');
    const temperature=state?.attributes?.current_temperature,humidity=state?.attributes?.current_humidity;
    this.shadowRoot.querySelector('.status-note').textContent=[temperature!=null?`当前 ${temperature} ${hass.config?.unit_system?.temperature||'°C'}`:'',humidity!=null?`湿度 ${humidity}%`:''].filter(Boolean).join(' · ');
    const power=this.shadowRoot.querySelector('.power');power.hidden=!v.caps.power||params.config.lock_kind==='child';power.classList.toggle('active',!v.off);power.setAttribute('aria-label',v.off?'开启设备':'关闭设备');
    power.disabled=this._panel?._busy.has('power')||false;
    if(this._panel)this._panel.hass=hass;
    for(const component of this._historyComponents||[])component.hass=hass;
    this._refreshExtras();
  }
  async _startHistory(params){
    this._historyHost.replaceChildren();
    this._historyHost.hidden=!moreInfoHasHistory(params.entityId);
    if(this._historyHost.hidden)return;
    const attach=()=>{
      const names=customElements.get('ha-more-info-history-and-logbook')?['ha-more-info-history-and-logbook']:['ha-more-info-history','ha-more-info-logbook'].every(name=>customElements.get(name))?['ha-more-info-history','ha-more-info-logbook']:[];
      if(!names.length)return false;
      const components=names.map(name=>{
        const component=document.createElement(name);component.hass=this._hass;component.entityId=params.entityId;return component;
      });
      this._historyHost.replaceChildren(...components);this._historyComponents=components;return true;
    };
    try{
      if(attach())return;
      this._historyHost.innerHTML='<p class="history-message" role="status">正在加载历史与活动…</p>';
      let cancel;
      await new Promise(resolve=>{
        const timer=setTimeout(resolve,3000);
        cancel=()=>{clearTimeout(timer);resolve();};this._cancelHistoryWait=cancel;
        customElements.whenDefined('ha-more-info-history-and-logbook').then(cancel);
      });
      if(this._cancelHistoryWait===cancel)this._cancelHistoryWait=null;
      if(this._params!==params||attach())return;
    }catch{if(this._params!==params)return;}
    this._historyHost.innerHTML='<p class="history-message" role="status">历史组件暂不可用，请在原生面板查看记录。</p><button class="native-button" data-native-history>查看历史与活动 ↗</button>';
  }
  _refreshExtras(){
    if(!this._params||!this._hass)return;
    const extras=this.shadowRoot.querySelector('.extras');
    if(extras.contains(this.shadowRoot.activeElement))return;
    const controls=moreInfoExtraControls(this._hass,this._params.config),key=JSON.stringify([controls,[...this._pending]]);
    if(key===this._extraKey)return;this._extraKey=key;
    const E=escapeHTML,labels={none:'无',home:'在家',away:'离家',sleep:'睡眠',eco:'节能',comfort:'舒适',boost:'强力',auto:'自动'};
    extras.innerHTML=controls.map(control=>`<label class="extra-control"><span>${E(control.label)}</span>${control.kind==='select'?`<select data-extra="${control.id}" ${this._pending.has(control.id)?'disabled':''}>${!control.options.includes(control.value)?'<option value="" selected disabled>选择</option>':''}${control.options.map(option=>`<option value="${E(option)}" ${option===control.value?'selected':''}>${E(labels[option]||option)}</option>`).join('')}</select>`:`<div class="extra-input"><input type="number" data-extra="${control.id}" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.value}" ${this._pending.has(control.id)?'disabled':''}><span>${E(control.unit)}</span></div>`}</label>`).join('');
  }
  async _executeExtra(id,input){
    if(this._pending.has(id)||!this._params)return;
    const request=this._params,pending=this._pending;
    try{
      const command=moreInfoExtraCommand(this._hass,request.config,id,input);
      this._error='';pending.add(id);this.shadowRoot.activeElement?.blur();this._refreshExtras();this._showError();
      await this._hass.callService(command.domain,command.service,command.data,command.target);
    }catch(error){if(this._params===request)this._error=error?.message||'操作失败，请检查设备连接。';}
    finally{pending.delete(id);if(this._params===request){this._refreshExtras();this._showError();}}
  }
  _showError(){const error=this.shadowRoot.querySelector('.detail-error');error.hidden=!this._error;error.textContent=this._error||'';}
  _native(entityId,view){
    const root=this.getRootNode().host||document.querySelector('home-assistant');
    this.closeDialog();
    if(!root)return;
    const event=new CustomEvent('hass-more-info',{detail:{entityId,...(view?{view}:{})},bubbles:true,composed:true});
    nativeMoreInfoEvents.add(event);queueMicrotask(()=>root.dispatchEvent(event));
  }
  closeDialog(){
    if(this._dialog.open)this._dialog.close();
    this._finishClose();return true;
  }
  _finishClose(){
    if(!this._active)return;
    this._active=false;this._params=null;this._panel=null;this._extraKey='';this._error='';
    this._cancelHistoryWait?.();this._cancelHistoryWait=null;this._historyComponents=[];this._historyHost.replaceChildren();this._historyHost.hidden=true;
    this.shadowRoot.querySelector('.panel-host').replaceChildren();
    this.shadowRoot.querySelector('.extras').replaceChildren();
    this._showError();
    this.dispatchEvent(new CustomEvent('dialog-closed',{detail:{dialog:this.localName},bubbles:true,composed:true}));
  }
}
if(!customElements.get('soft-home-more-info-dialog'))customElements.define('soft-home-more-info-dialog',SoftHomeMoreInfoDialog);

if(!window[addonKey]){
  let enabled=false;
  const handle=event=>{
    if(nativeMoreInfoEvents.has(event))return;
    const path=event.composedPath(),root=path.find(node=>node?.localName==='home-assistant')||document.querySelector('home-assistant');
    if(!root?.hass||typeof root.provideHass!=='function'||!root.shadowRoot)return;
    if(event.detail?.entityId===null){root.shadowRoot.querySelector('soft-home-more-info-dialog')?.closeDialog();return;}
    if(typeof globalThis.HTMLDialogElement?.prototype.showModal!=='function')return;
    const source=path.find(node=>node?.localName==='soft-home-card')?._config||{};
    const route=moreInfoRoute(root.hass,event.detail,source,window.softHomeMoreInfoConfig||{});
    if(!route)return;
    const openEvent=new CustomEvent('show-dialog',{detail:{dialogTag:'soft-home-more-info-dialog',dialogImport:()=>Promise.resolve(),dialogParams:{entityId:event.detail.entityId,...route},addHistory:true},bubbles:true,composed:true});
    root.dispatchEvent(openEvent);
    event.preventDefault();event.stopImmediatePropagation();
  };
  const api={
    get enabled(){return enabled;},
    enable(){if(!enabled){window.addEventListener('hass-more-info',handle,true);enabled=true;}},
    disable(){if(enabled){window.removeEventListener('hass-more-info',handle,true);enabled=false;}document.querySelector('home-assistant')?.shadowRoot?.querySelector('soft-home-more-info-dialog')?.closeDialog();},
    open(entityId){document.querySelector('home-assistant')?.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId},bubbles:true,composed:true}));},
  };
  window[addonKey]=api;window.softHomeMoreInfo=api;api.enable();
}
