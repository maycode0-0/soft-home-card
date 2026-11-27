import './icons.js';
import {createMock} from './mock.js';
import {installHistoryPreview} from './more-info-history.js';

if(!window.softHomeDemoSkipHistory)installHistoryPreview();

const mock=createMock();
mock.states['lock.washer_child_lock']={...mock.states['lock.washer_child_lock'],state:'unlocked'};
mock.states['switch.oven_child_lock']={entity_id:'switch.oven_child_lock',state:'off',attributes:{friendly_name:'蒸烤箱 童锁'}};
mock.states['light.main']={...mock.states['light.pendant'],entity_id:'light.main',attributes:{...mock.states['light.pendant'].attributes,friendly_name:'客厅主灯'}};
mock.entities['light.main']={entity_id:'light.main',device_id:mock.entities['light.pendant'].device_id};
mock.states['sensor.temperature']={...mock.states['sensor.temperature'],state:'18.2',attributes:{...mock.states['sensor.temperature'].attributes,friendly_name:'主卧温湿度传感器 温度',state_class:'measurement'}};
mock.states['sensor.humidity']={...mock.states['sensor.humidity'],state:'56',attributes:{...mock.states['sensor.humidity'].attributes,friendly_name:'主卧温湿度传感器 湿度',device_class:'humidity',state_class:'measurement'}};
const unlockId='sensor.door_lock_unlock_event';
mock.states[unlockId]={...mock.states[unlockId],state:'无',attributes:{friendly_name:'门锁 开锁事件',device_class:'enum',options:['无','内开','家人外开（指纹）']}};
mock.states['event.door_lock_unlock']={entity_id:'event.door_lock_unlock',state:new Date(Date.now()-3*3600000).toISOString(),attributes:{friendly_name:'门锁事件',event_type:'指纹开锁'}};
mock.softHomeHistoryPreview=Object.fromEntries([unlockId,'event.door_lock_unlock'].map(id=>[id,['内开','家人外开（指纹）','内开','指纹外开','无'].map((value,index)=>({value,when:Date.now()-[3,4,9,20,23][index]*3600000}))]));
for(const [id,values] of [['sensor.temperature',[18.2,18.4,18.7,19.3,20.1,20.5,20.2,19.5,18.8,18.1,17.9,18.1,18.4]],['sensor.humidity',[56,55,53,51,49,50,52,55,57,59,58,57,56]]])mock.softHomeHistoryPreview[id]=values.map((value,index)=>({value,when:Date.now()-index*2*3600000}));
// Match the reported speaker: paused, features 16447, no volume/track readings.
mock.states['media_player.music']={entity_id:'media_player.music',state:'paused',attributes:{friendly_name:'音乐',device_class:'speaker',supported_features:16447}};
for(const service of ['media_play','media_pause','media_previous_track','media_next_track','media_stop','volume_mute','volume_down','volume_up','select_source','media_seek'])mock.services.media_player[service]={};
mock.states['climate.ac']={...mock.states['climate.ac'],state:'off',attributes:{...mock.states['climate.ac'].attributes,friendly_name:'主卧中央空调',current_temperature:20,current_humidity:56,supported_features:1|8|16|32|128|256,fan_mode:'auto',fan_modes:['auto','low','medium','high'],swing_mode:'off',swing_modes:['off','on'],preset_mode:'none',preset_modes:['none','eco','sleep']}};
mock.states['number.washer_rinse_count'].attributes={...mock.states['number.washer_rinse_count'].attributes,min:1,max:5,step:1};
mock.states['alarm_control_panel.home']={entity_id:'alarm_control_panel.home',state:'disarmed',attributes:{friendly_name:'安防主机'}};
mock.areas={bedroom:{area_id:'bedroom',name:'主卧'},living:{area_id:'living',name:'客厅'},laundry:{area_id:'laundry',name:'生活阳台'}};
mock.devices[mock.entities['climate.ac'].device_id].area_id='bedroom';
mock.devices[mock.entities['sensor.temperature'].device_id].area_id='bedroom';
mock.devices[mock.entities['light.main'].device_id].area_id='living';
mock.devices[mock.entities['lock.washer_child_lock'].device_id].area_id='laundry';
for(const service of ['set_fan_mode','set_swing_mode','set_preset_mode'])mock.services.climate[service]={};
mock.services.number={set_value:{}};
const originalService=mock.callService;
mock.callService=async(domain,service,data,target)=>{
  await originalService(domain,service,data,target);
  const state=mock.states[target?.entity_id];if(!state)return;
  const attributes={...state.attributes};
  if(domain==='climate')for(const key of ['preset_mode','fan_mode','swing_mode','target_temp_low','target_temp_high','humidity'])if(data[key]!==undefined)attributes[key]=data[key];
  const mediaState=({media_play:'playing',media_pause:'paused',media_stop:'idle'})[service];
  if(domain==='media_player'){
    if(data.is_volume_muted!==undefined)attributes.is_volume_muted=data.is_volume_muted;
    if(data.source!==undefined)attributes.source=data.source;
    if(data.seek_position!==undefined)attributes.media_position=data.seek_position;
  }
  mock.states={...mock.states,[target.entity_id]:{...state,attributes,...(domain==='number'&&service==='set_value'?{state:String(data.value)}:{}),...(domain==='media_player'&&mediaState?{state:mediaState}:{})}};
  mock.notify();
};

// A small harness of HA's public dialog contract. Production uses HA's manager.
class MoreInfoDemoRoot extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML='<slot></slot>';
    this._hass=mock;this.consumers=new Set();this.nativeEvents=[];
    this.addEventListener('show-dialog',async event=>{
      event.stopPropagation();const {dialogTag,dialogImport,dialogParams}=event.detail;
      await dialogImport();
      let dialog=this.shadowRoot.querySelector(dialogTag);
      if(!dialog){dialog=document.createElement(dialogTag);this.provideHass(dialog);}
      if(history.state?.dialog!==dialogTag)history.pushState({dialog:dialogTag},'');
      dialog.showDialog(dialogParams);if(dialog.parentNode!==this.shadowRoot)this.shadowRoot.append(dialog);
    });
    this.addEventListener('dialog-closed',event=>{
      if(history.state?.dialog===event.detail.dialog)history.back();
    });
    this.addEventListener('hass-more-info',event=>{
      this.nativeEvents.push(event.detail);
      this.shadowRoot.querySelector('soft-home-more-info-dialog')?.closeDialog();
      const log=document.querySelector('#native-log');log.textContent='已交还原生入口：'+event.detail.entityId+(event.detail.view?' · '+event.detail.view:'')+'。真实 HA 会在这里展示原生详情。';log.hidden=false;
    });
    window.addEventListener('popstate',()=>{
      if(history.state?.dialog!=='soft-home-more-info-dialog')this.shadowRoot.querySelector('soft-home-more-info-dialog')?.closeDialog();
    });
  }
  get hass(){return this._hass;}
  provideHass(element){this.consumers.add(element);element.hass=this._hass;}
  updateHass(){this._hass={...mock};for(const consumer of this.consumers)consumer.hass=this._hass;}
}
customElements.define('home-assistant',MoreInfoDemoRoot);
const root=document.querySelector('home-assistant');
mock.notify=()=>root.updateHass();
window.moreInfoDemo={mock,root};

for(const button of document.querySelectorAll('[data-entity]'))button.onclick=()=>button.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:button.dataset.entity},bubbles:true,composed:true}));
for(const button of document.querySelectorAll('[data-page]'))button.onclick=()=>{
  for(const tab of document.querySelectorAll('[data-page]'))tab.setAttribute('aria-pressed',String(tab===button));
  for(const content of document.querySelectorAll('[data-content]'))content.hidden=content.dataset.content!==button.dataset.page;
};
function setDark(dark){
  mock.themes={darkMode:dark};document.body.classList.toggle('dark',dark);mock.notify();
  const button=document.querySelector('#theme');button.textContent=dark?'切换浅色':'切换深色';button.setAttribute('aria-pressed',String(dark));
}
document.querySelector('#theme').onclick=()=>setDark(!mock.themes.darkMode);
const params=new URLSearchParams(location.search);
setDark(params.get('mode')==='dark');
document.documentElement.dataset.ready='true';
if(params.get('entity'))window.softHomeMoreInfo.open(params.get('entity'));
