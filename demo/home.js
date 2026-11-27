import './icons.js';
import {createHomeContext} from './home-context.js';

const {mock,configs}=createHomeContext();
window.mock=mock;window.cards=[];
let room='全部',attention=false,readOnly=false,running=false,runningSaved,noticeTimeout;
const rooms=['全部','客厅','主卧','餐厅','书房','次卧','厨房','生活阳台'];
const categories={air_conditioner:'温控与舒适',refrigerator:'分区保鲜',vacuum:'全屋清洁',spotlight:'重点照明',led_strip:'氛围照明',pendant_light:'用餐光线',curtain:'窗边光影',washing_machine:'衣物护理',temperature_humidity:'室内环境',projector_lift:'影音升降'};
const unavailable=card=>['unavailable','unknown'].includes(mock.states[card._config.entity]?.state);
const notify=text=>{
  const el=document.querySelector('#notice');el.textContent=text;el.hidden=false;
  clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>el.hidden=true,2800);
};
for(const [i,config] of configs.entries()){
  const item=document.createElement('section');
  const caption=document.createElement('div');caption.className='card-caption';
  const index=document.createElement('span');index.textContent=String(i+1).padStart(2,'0');
  caption.append(index,document.createTextNode(categories[config.device]));
  const card=document.createElement('soft-home-card');card.setConfig({...config,type:'custom:soft-home-card',theme:'auto'});card.hass=mock;
  item.append(caption,card);document.querySelector('#gallery').append(item);cards.push(card);
}
function filter(){
  let count=0;
  for(const card of cards){
    const visible=(room==='全部'||card._config.room===room)&&(!attention||unavailable(card));
    card.parentElement.hidden=!visible;if(visible)count++;
  }
  document.querySelector('#device-count').textContent=count+' 台设备';
  for(const button of document.querySelectorAll('#rooms button'))button.setAttribute('aria-pressed',button.dataset.room===room);
  document.querySelector('#attention').setAttribute('aria-pressed',attention);
}
for(const name of rooms){
  const button=document.createElement('button');button.dataset.room=name;button.textContent=name;
  const count=document.createElement('small');count.textContent=name==='全部'?configs.length:configs.filter(c=>c.room===name).length;
  button.append(count);button.setAttribute('aria-pressed',name===room);
  button.onclick=()=>{room=name;attention=false;filter();};document.querySelector('#rooms').append(button);
}
document.querySelector('#attention').onclick=()=>{room='全部';attention=!attention;filter();};
document.querySelector('#theme').onclick=event=>{
  mock.themes={darkMode:!mock.themes.darkMode};document.body.classList.toggle('dark',mock.themes.darkMode);
  const label=mock.themes.darkMode?'浅色':'深色';event.currentTarget.querySelector('span').textContent=label;
  event.currentTarget.setAttribute('aria-pressed',mock.themes.darkMode);event.currentTarget.setAttribute('aria-label','切换到'+label+'主题');
  for(const card of cards)card.hass={...mock};
};
document.querySelector('#readonly').onclick=event=>{
  readOnly=!readOnly;event.currentTarget.setAttribute('aria-pressed',readOnly);
  for(const card of cards)card.setConfig({...card._config,read_only:readOnly});
};
document.querySelector('#running').onclick=event=>{
  running=!running;event.currentTarget.setAttribute('aria-pressed',running);
  event.currentTarget.querySelector('span').textContent=running?'结束演示':'演示运行';
  if(running){
    runningSaved=mock.states;mock.states={...mock.states};
    for(const [id,value,attributes] of [
      ['climate.preview_living','cool',{hvac_action:'cooling'}],['vacuum.preview_robot','cleaning'],
      ['light.preview_spot','on',{brightness:179}],['cover.preview_living','opening'],
      ['switch.preview_washer_power','on'],['switch.preview_washer_start','on'],
    ])mock.states[id]={...mock.states[id],state:value,attributes:{...mock.states[id].attributes,...attributes}};
  }else mock.states=runningSaved;
  mock.notify();
};
mock.notify=()=>{
  for(const card of cards)card.hass={...mock};
  const climates=configs.filter(c=>c.device==='air_conditioner'),off=climates.filter(c=>mock.states[c.entity].state==='off').length;
  document.querySelector('#climate-summary').textContent=off===climates.length?'5 台已关闭':(climates.length-off)+' 台已开启';
  const curtain=mock.states['cover.preview_living'];
  document.querySelector('#curtain-summary').textContent=['opening','closing'].includes(curtain.state)?(curtain.state==='opening'?'正在打开':'正在关闭'):curtain.attributes.current_position+'% '+(curtain.state==='closed'?'已关闭':'已打开');
  document.querySelector('#snapshot-label').textContent=running?'演示运行中 · 仅保存在本页':'演示状态已更改 · 仅保存在本页';
  filter();notify('已更新预览，真实设备状态保持不变');
};
document.addEventListener('hass-more-info',event=>notify('实体详情 · '+(mock.states[event.detail.entityId]?.attributes.friendly_name||'设备')));
filter();
if(new URLSearchParams(location.search).get('running')==='1')document.querySelector('#running').click();
