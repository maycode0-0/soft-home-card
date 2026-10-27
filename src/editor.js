import { DEVICES, escapeHTML } from './model.js';
import { EDITOR_CSS } from './styles.js';

export class SoftHomeCardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.addEventListener('change',event=>this._change(event));}
  setConfig(config){this._config={show_stats:true,...config};this._render();}
  set hass(hass){this._hass=hass;const key=Object.keys(hass.states||{}).sort().join('|');if(key!==this._entityKey){this._entityKey=key;this._render();}}
  get hass(){return this._hass;}
  _entities(selected='',optional=false){
    const states=this._hass?.states||{};
    const ids=Object.keys(states).sort();
    if(selected&&!ids.includes(selected))ids.unshift(selected);
    return `<option value="">${optional?'不配置':'选择实体'}</option>`+ids.map(id=>`<option value="${escapeHTML(id)}" ${id===selected?'selected':''}>${escapeHTML(states[id]?.attributes?.friendly_name || id)} · ${escapeHTML(id)}</option>`).join('');
  }
  _render(){if(!this._config)return;const c=this._config,E=escapeHTML;
    const field=(name,label,value='',type='text')=>`<label>${E(label)}<input data-field="${name}" type="${type}" value="${E(value)}"></label>`;
    const entity=(name,label,value='',optional=true)=>`<label class="full">${E(label)}<select data-field="${name}">${this._entities(value,optional)}</select></label>`;
    const check=(name,label)=>`<label class="check"><input data-field="${name}" type="checkbox" ${c[name]?'checked':''}>${E(label)}</label>`;
    this.shadowRoot.innerHTML=`<style>${EDITOR_CSS}</style><div class="form">
      <label class="full">设备外观<select data-field="device">${Object.entries(DEVICES).map(([key,[name]])=>`<option value="${key}" ${c.device===key?'selected':''}>${name}</option>`).join('')}</select></label>
      ${entity('entity','主实体',c.entity,false)}${field('name','卡片名称（可选）',c.name)}${field('room','房间 / 副标题（可选）',c.room)}
      <label>主题<select data-field="theme">${[['light','浅蓝白'],['dark','深色'],['auto','跟随 HA']].map(([key,label])=>`<option value="${key}" ${(c.theme||'light')===key?'selected':''}>${label}</option>`).join('')}</select></label>
      <label>强调色<select data-field="accent"><option value="">按设备自动</option><option value="blue" ${c.accent==='blue'?'selected':''}>蓝色</option><option value="warm" ${c.accent==='warm'?'selected':''}>暖色</option></select></label>
      ${check('read_only','只读展示')}${check('invert_position','反转行程读数（100 − HA 位置）')}
      <div class="help full">外观与主实体独立：卡片根据实体支持的能力显示控件。传感器只有读数；需要启动、除雾、换气等操作时，可在下方添加实际按钮或开关实体。</div>
      <details><summary>主读数与辅助读数</summary><div class="form">${entity('primary_entity','自定义主读数实体',c.primary_entity)}${field('primary_attribute','属性名（留空读取实体状态）',c.primary_attribute)}${field('primary_label','主读数标题',c.primary_label)}${field('primary_unit','单位（留空自动）',c.primary_unit)}${entity('secondary_entity','辅助读数（如湿度）',c.secondary_entity)}${entity('power_entity','功率传感器',c.power_entity)}${entity('progress_entity','环形进度传感器（0–100）',c.progress_entity)}</div><p>洗衣机可把剩余时间传感器设为主读数，把运行进度传感器设为环形进度。未配置的数据不会使用示例值。</p></details>
      <details><summary>辅助操作（最多 3 个）</summary><div class="form">${[0,1,2].map(i=>entity(`auxiliary.${i}.entity`,`操作 ${i+1}：实体`,c.auxiliary?.[i]?.entity)+field(`auxiliary.${i}.name`,`操作 ${i+1}：按钮文字`,c.auxiliary?.[i]?.name)).join('')}</div><p>开关 / 灯 / 风扇：开关切换；按钮：执行；脚本：运行。其他实体打开详情。可用于除雾、启动洗衣、换气、保温等。</p></details>
      <details><summary>底部概览（最多 3 项）</summary><div class="form">${check('show_stats','显示设备概览')}${[0,1,2].map(i=>entity(`metrics.${i}.entity`,`指标 ${i+1}：实体`,c.metrics?.[i]?.entity)+field(`metrics.${i}.name`,`指标 ${i+1}：标题`,c.metrics?.[i]?.name)+field(`metrics.${i}.attribute`,`指标 ${i+1}：属性名（可选）`,c.metrics?.[i]?.attribute)).join('')}</div><p>不指定指标时显示当前实体已提供的属性。高级服务操作可通过代码编辑器配置 actions。</p></details>
    </div>`;
  }
  _change(event){const input=event.target,key=input.dataset.field;if(!key)return;const next={...this._config},value=input.type==='checkbox'?input.checked:input.value;
    if(key.includes('.')){const [list,index,prop]=key.split('.');const rows=(next[list]||[]).map(x=>({...x}));while(rows.length<=Number(index))rows.push({});rows[index]={...rows[index],[prop]:value};next[list]=rows.filter(x=>x.entity);if(!next[list].length)delete next[list];}
    else if(value==='')delete next[key];else next[key]=value;
    this._config=next;
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:next},bubbles:true,composed:true}));
    // Rebuild indexed rows after removal so the remaining editor fields keep their mapping.
    if(key.includes('.')&&key.endsWith('.entity'))this._render();
  }
}
if(!customElements.get('soft-home-card-editor'))customElements.define('soft-home-card-editor',SoftHomeCardEditor);
