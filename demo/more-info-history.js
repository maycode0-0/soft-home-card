// Local preview of HA's public element properties. Production uses HA's own
// registered history/logbook components and their real Recorder subscriptions.
export function installHistoryPreview(){
  if(customElements.get('ha-more-info-history-and-logbook'))return;
  class HistoryPreview extends HTMLElement {
    constructor(){super();this.attachShadow({mode:'open'});}
    set hass(value){this._hass=value;this._render();}
    get hass(){return this._hass;}
    set entityId(value){this._entityId=value;this._render();}
    get entityId(){return this._entityId;}
    _render(){
      if(!this._hass||!this._entityId)return;
      this.shadowRoot.innerHTML=`<style>:host{display:block;color:var(--primary-text-color,#243a55);font:14px/1.7 var(--primary-font-family,system-ui,sans-serif)}*{box-sizing:border-box}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}h3{font-size:17px;font-weight:550;margin:0}button{background:transparent;border:0;color:var(--primary-color,#286abc);font:inherit;font-size:11px;min-height:44px;cursor:pointer;padding:0 6px}button:focus-visible{outline:3px solid var(--primary-color,#286abc);outline-offset:2px}.timeline{display:flex;min-height:26px;border-radius:7px;overflow:hidden;margin:8px 0}.segment{font-size:10px;color:white;padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-right:1px solid #fff8}.axis{display:flex;justify-content:space-between;color:var(--secondary-text-color,#596f8a);font-size:10px}.activities{margin-top:24px}.list{max-height:220px;overflow-y:auto;scrollbar-width:thin}.row{display:flex;align-items:center;gap:10px;min-height:45px;border-bottom:1px solid var(--divider-color,#d7e2ef);font-size:12px}.dot{width:7px;height:7px;border-radius:50%;background:var(--primary-color,#286abc);flex-shrink:0}.label{flex:1;min-width:0;overflow-wrap:anywhere}time{font-size:10px;color:var(--secondary-text-color,#596f8a);white-space:nowrap}.day{font-size:11px;color:var(--secondary-text-color,#596f8a);margin:14px 0 3px}.empty{font-size:12px;color:var(--secondary-text-color,#596f8a);margin:0}.sample{font-size:9px;color:var(--secondary-text-color,#596f8a);margin:12px 0 0}</style><header><h3>历史</h3><button class="more">显示更多</button></header><div class="timeline" role="img" aria-label="开锁事件历史示例"></div><div class="axis"><span>24 小时前</span><span>12 小时前</span><span>现在</span></div><section class="activities"><header><h3>活动</h3><button class="more">显示更多</button></header><div class="list"></div></section><p class="sample">本地示例记录 · 安装后由 HA 原生组件读取真实历史与活动</p>`;
      const records=this._hass.softHomeHistoryPreview?.[this._entityId]||[];
      const timeline=this.shadowRoot.querySelector('.timeline'),list=this.shadowRoot.querySelector('.list');
      const attributes=this._hass.states[this._entityId]?.attributes||{};
      const numeric=records.length>1&&!!attributes.unit_of_measurement&&records.every(record=>Number.isFinite(Number(record.value)));
      if(!records.length){
        timeline.hidden=true;
        const note=document.createElement('p');note.className='empty';note.textContent='此本地实体未提供历史示例。';list.append(note);
      }
      if(numeric){
        const style=document.createElement('style');style.textContent=':host{color:var(--primary-text-color,var(--mi-text,#243a55))}button{color:var(--primary-color,var(--mi-blue,#286abc))}.axis,.sample{color:var(--secondary-text-color,var(--mi-muted,#596f8a))}.trend-chart{height:180px;color:var(--primary-color,var(--mi-blue,#286abc))}.trend-chart svg{display:block;width:100%;height:100%}.trend-chart text{fill:var(--secondary-text-color,var(--mi-muted,#596f8a));font:11px system-ui}.trend-chart .grid{stroke:var(--divider-color,var(--mi-line,#d7e2ef));stroke-width:1}';this.shadowRoot.append(style);
        timeline.className='trend-chart';
        const values=[...records].reverse().map(record=>Number(record.value)),minimum=Math.min(...values),maximum=Math.max(...values),padding=Math.max((maximum-minimum)*.2,.5),low=minimum-padding,high=maximum+padding;
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 520 180');svg.setAttribute('preserveAspectRatio','none');svg.dataset.trend=attributes.device_class||'numeric';
        const title=(attributes.device_class==='humidity'?'湿度':'温度')+'变化曲线';svg.setAttribute('role','img');svg.setAttribute('aria-label',title);
        const add=(tag,attrs,text)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;svg.append(node);return node;};
        for(const y of [32,90,148])add('path',{d:`M8 ${y}H512`,class:'grid'});
        const points=values.map((value,index)=>[8+index/(values.length-1)*504,160-(value-low)/(high-low)*140]);
        const line=points.map(([x,y],index)=>`${index?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
        add('path',{d:line+' L512 164 L8 164Z',fill:'currentColor',opacity:'.08'});
        add('path',{d:line,fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
        const last=points.at(-1);add('circle',{cx:last[0],cy:last[1],r:4,fill:'currentColor'});
        add('text',{x:10,y:15},maximum.toFixed(1)+' '+attributes.unit_of_measurement);add('text',{x:10,y:178},minimum.toFixed(1)+' '+attributes.unit_of_measurement);
        timeline.append(svg);this.shadowRoot.querySelector('.activities').hidden=true;
        this.shadowRoot.querySelector('.sample').textContent='本地示例曲线 · 安装后由 HA 原生历史组件读取真实记录';
      }
      for(const [index,record] of (numeric?[]:[...records].reverse()).entries()){
        const segment=document.createElement('span');segment.className='segment';segment.textContent=record.value;segment.style.background=['#4675bb','#b67587','#5d9d8c'][index%3];segment.style.flex='1';segment.title=record.value;timeline.append(segment);
      }
      let day='';
      for(const record of numeric?[]:records){
        const date=new Date(record.when),label=date.toLocaleDateString('zh-CN');
        if(label!==day){const heading=document.createElement('p');heading.className='day';heading.textContent=label;list.append(heading);day=label;}
        const row=document.createElement('div');row.className='row';
        const dot=document.createElement('span');dot.className='dot';dot.setAttribute('aria-hidden','true');
        const value=document.createElement('span');value.className='label';value.textContent=record.value;
        const time=document.createElement('time');time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        row.append(dot,value,time);list.append(row);
      }
      for(const button of this.shadowRoot.querySelectorAll('.more'))button.onclick=()=>this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:this._entityId,view:'history'},bubbles:true,composed:true}));
    }
  }
  customElements.define('ha-more-info-history-and-logbook',HistoryPreview);
}
