import { DEVICES, escapeHTML } from './model.js';
import { EDITOR_CSS } from './styles.js';
import { deviceGroups, entityScope, entityOptions, selectDeviceScope, clearEntityBindings, fieldLabels } from './editor-model.js';
import { SoftHomePicker } from './picker.js';
import { WASHER_FIELDS } from './washer-fields.js';
import { DEVICE_FIELDS } from './device-fields.js';

export class SoftHomeCardEditor extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._showAll=false;this._registry={};
    this.shadowRoot.addEventListener('change',event=>this._change(event));
    this.shadowRoot.addEventListener('value-changed',event=>this._change(event));
    this.shadowRoot.addEventListener('focusout',()=>setTimeout(()=>{
      if(this._pendingRender&&!this.shadowRoot.activeElement){this._pendingRender=false;this._render();}
    },0));
  }
  setConfig(config){
    const next={show_stats:true,...config};
    if(JSON.stringify(next)===JSON.stringify(this._config))return;
    this._config=next;this._resetRows();this._render();
  }
  set hass(hass){this._hass=hass;this._refresh();this._loadRegistry();}
  get hass(){return this._hass;}
  _data(){return {...this._hass,entities:this._hass?.entities??this._registry.entities,devices:this._hass?.devices??this._registry.devices};}
  async _loadRegistry(){
    if(this._registryRequested||!this._hass?.callWS||this._hass.entities&&this._hass.devices)return;
    this._registryRequested=true;
    const result=await Promise.allSettled(['entity','device'].map(kind=>Promise.resolve().then(()=>this._hass.callWS({type:`config/${kind}_registry/list`}))));
    result.forEach((r,i)=>{if(r.status==='fulfilled')this._registry[i===0?'entities':'devices']=r.value;});
    this._refresh();
  }
  _refresh(){
    const data=this._data();
    // Ignore state ticks so an open search and unfinished text keep their focus.
    const key=JSON.stringify([data.entities,data.devices,Object.entries(data.states||{}).map(([id,s])=>[id,s.attributes?.friendly_name,s.attributes?.unit_of_measurement,s.attributes?.device_class])]);
    if(key===this._entityKey)return;this._entityKey=key;
    if(this.shadowRoot.activeElement)this._pendingRender=true;else this._render();
  }
  _resetRows(){this._rows={};for(const list of ['auxiliary','metrics'])this._rows[list]=[0,1,2].map(i=>({...this._config?.[list]?.[i]}));}
  _render(){
    if(!this._config)return;
    const c=this._config,E=escapeHTML,data=this._data(),scope=entityScope(data,c),labels=fieldLabels(c.device);
    const opened=new Set([...this.shadowRoot.querySelectorAll('details[open]')].map(el=>el.dataset.section));
    const pickers=[];
    const picker=(name,label,value,items,disabled=false,empty='这台设备没有可选实体')=>{
      pickers.push({name,label,value,items,disabled,empty});return `<soft-home-picker class="full" data-field="${name}"></soft-home-picker>`;
    };
    const field=(name,label,value='')=>`<label>${E(label)}<input data-field="${name}" type="text" value="${E(value)}"></label>`;
    const entity=(name,label,value='')=>picker(name,label,value,entityOptions(data,c,name),!scope);
    const check=(name,label,value=c[name])=>`<label class="check"><input data-field="${name}" type="checkbox" ${value?'checked':''}>${E(label)}</label>`;
    const details=(key,title,content)=>`<details data-section="${key}" ${opened.has(key)?'open':''}><summary>${title}</summary>${content}</details>`;
    const groups=deviceGroups(data,c.device,this._showAll);
    if(scope&&!groups.some(g=>g.key===scope.key))groups.unshift(scope);
    const devices=groups.map(g=>({value:g.key,label:g.label,description:[g.manufacturer,g.model,`${g.entityIds.length} 个实体`,g.deviceId||g.key].filter(Boolean).join(' · '),search:g.texts.join(' ')}));
    this.shadowRoot.innerHTML=`<style>${EDITOR_CSS}</style><div class="form">
      <label class="full">设备类型<select data-field="device">${Object.entries(DEVICES).map(([key,[name]])=>`<option value="${key}" ${c.device===key?'selected':''}>${name}</option>`).join('')}</select></label>
      ${picker('_scope',`选择具体${DEVICES[c.device]?.[0]||'设备'}`,scope?.key,devices,false,'未找到匹配设备，可勾选下方「搜索全部设备」手动选择')}
      <div class="full">${check('_showAll','找不到设备？搜索全部设备手动绑定',this._showAll)}</div>
      <div class="help full">${scope?`已限定为「${E(scope.label)}」的实体。输入名称或实体 ID 搜索参数。`:'先选择具体设备，再配置它的参数。同类设备会分别列出。'}<br>切换设备类型或具体设备会清空旧实体绑定和自定义操作。</div>
      ${entity('entity','主实体（状态 / 控制）',c.entity)}
      ${scope&&!scope.deviceId?'<p class="full">此集成未提供设备关联，当前按实体标识分组；无法关联的实体会单独列出。</p>':''}
      ${field('name','卡片名称（可选）',c.name)}${field('room','房间 / 副标题（可选）',c.room)}
      <label>主题<select data-field="theme">${[['light','浅蓝白'],['dark','深色'],['auto','跟随 HA']].map(([key,label])=>`<option value="${key}" ${(c.theme||'light')===key?'selected':''}>${label}</option>`).join('')}</select></label>
      <label>强调色<select data-field="accent"><option value="">按设备自动</option><option value="blue" ${c.accent==='blue'?'selected':''}>蓝色</option><option value="warm" ${c.accent==='warm'?'selected':''}>暖色</option></select></label>
      ${check('read_only','只读展示')}${['screen','projector_lift','curtain'].includes(c.device)?check('invert_position','反转行程读数（100 − HA 位置）'):''}
      ${details('readings','读数与参数',`<div class="form">${entity('primary_entity',labels.primary,c.primary_entity)}${field('primary_attribute','属性名（留空读取实体状态）',c.primary_attribute)}${field('primary_label','主读数标题',c.primary_label)}${field('primary_unit','单位（留空自动）',c.primary_unit)}${entity('secondary_entity',labels.secondary,c.secondary_entity)}${entity('power_entity','功率传感器',c.power_entity)}${labels.progress?entity('progress_entity',c.device==='washing_machine'?'洗涤进度传感器（0–100）':'环形进度传感器（0–100）',c.progress_entity):''}</div><p>参数均来自所选设备。未接入的参数不会显示，未配置的读数不会填入示例值。</p>`)}
      ${c.device==='washing_machine'?details('washer','洗衣机专属参数与操作',`<p>选择设备时会匹配名称明确的实体；可在这里修正或清除。参数点按后打开 HA 原生详情，启停与电源直接操作所绑定的开关。</p>${[['cycle','程序与进程'],['quick','常用参数'],['control','启停与电源'],['safety','安全状态'],['settings','更多设置'],['usage','本次用量']].map(([group,title])=>`<h4>${title}</h4><div class="form">${Object.entries(WASHER_FIELDS).filter(([,f])=>f.group===group).map(([key,f])=>entity(`washer.${key}`,f.name,c.washer?.[key])).join('')}</div>`).join('')}`):''}
      ${Object.keys(DEVICE_FIELDS[c.device]||{}).length?details('features',`${E(DEVICES[c.device][0])}专属功能与状态`,`<p>仅匹配所选设备内名称明确的实体。开关 / 按钮直接操作；其他参数打开 HA 原生详情调整。未绑定的功能不显示。</p>${['readings','zones','safety','event','media','actions','ptz','playback','settings','station','timers','rooms'].map(group=>{const fields=Object.entries(DEVICE_FIELDS[c.device]).filter(([,f])=>f.group===group);return fields.length?`<h4>${({readings:'实时读数',zones:'各温区实测温度',safety:'安全状态',event:'最近事件',media:'图像',actions:'快捷操作',ptz:'云台按钮 / 脚本',playback:'录像回放实体',settings:'设备设置',station:'基站与任务状态',timers:'定时',rooms:'分房间清洁参数'})[group]}</h4><div class="form">${fields.map(([key,f])=>entity('features.'+key,f.name,c.features?.[key])).join('')}</div>`:'';}).join('')}${c.device==='camera'?'<p>云台和录像查询由摄像头集成提供。绑定该设备已有的按钮或脚本；回放日期 / 时间通过所绑定实体的原生详情设置。</p>':''}`):''}
      ${details('auxiliary','辅助操作（最多 3 个）',`<div class="form">${this._rows.auxiliary.map((row,i)=>entity(`auxiliary.${i}.entity`,`操作 ${i+1}：实体`,row.entity)+field(`auxiliary.${i}.name`,`操作 ${i+1}：按钮文字`,row.name)).join('')}</div><p>选择这台设备的开关、按钮等实体，用于启动、除雾、换气等。跨设备脚本可在代码编辑器的 actions 中配置。</p>`)}
      ${details('metrics','底部概览（最多 3 项）',`<div class="form">${check('show_stats','显示设备概览')}${this._rows.metrics.map((row,i)=>entity(`metrics.${i}.entity`,`指标 ${i+1}：实体`,row.entity)+field(`metrics.${i}.name`,`指标 ${i+1}：标题`,row.name)+field(`metrics.${i}.attribute`,`指标 ${i+1}：属性名（可选）`,row.attribute)).join('')}</div><p>不指定时显示主实体已有的属性。</p>`)}
    </div>`;
    for(const options of pickers)this.shadowRoot.querySelector(`[data-field="${options.name}"]`).options=options;
  }
  _change(event){
    const input=event.target,key=input.dataset.field;if(!key)return;
    const value=event.type==='value-changed'?event.detail.value:input.type==='checkbox'?input.checked:input.value;
    if(key==='_showAll'){this._showAll=value;this._render();return;}
    let next={...this._config};let rebuild=false;
    const currentScope=entityScope(this._data(),next);
    if(currentScope?.deviceId)next.device_id=currentScope.deviceId;
    else if(currentScope)next.entity_group=currentScope.key;
    if(key==='device'){
      if(value===next.device)return;
      next={...clearEntityBindings(next),device:value};this._showAll=false;rebuild=true;
    }else if(key==='_scope'){
      if(value===entityScope(this._data(),next)?.key)return;
      next=selectDeviceScope(this._data(),next,value);rebuild=true;
    }else if(key.startsWith('washer.')||key.startsWith('features.')){
      const [object,field]=key.split('.');next[object]={...next[object]};
      if(value)next[object][field]=value;else delete next[object][field];
      if(!Object.keys(next[object]).length)delete next[object];
    }else if(key.includes('.')){
      const [list,index,prop]=key.split('.');this._rows[list][index]={...this._rows[list][index],[prop]:value};
      next[list]=this._rows[list].filter(row=>row.entity).map(row=>({...row}));if(!next[list].length)delete next[list];
    }else if(value==='')delete next[key];else next[key]=value;
    this._config=next;
    if(rebuild){this._resetRows();this._render();}
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:next},bubbles:true,composed:true}));
  }
}
if(!customElements.get('soft-home-card-editor'))customElements.define('soft-home-card-editor',SoftHomeCardEditor);
