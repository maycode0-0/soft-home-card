import { escapeHTML } from './model.js';
import { searchItems } from './editor-model.js';

// A small, dependency-free searchable selector. No private HA component API needed.
export class SoftHomePicker extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._items=[];this._query='';this._value='';this._active=-1;this._open=false;
    this.shadowRoot.addEventListener('input',e=>{if(e.target.matches('input')){this._query=e.target.value;this._open=true;this._active=-1;this._results();}});
    this.shadowRoot.addEventListener('change',e=>e.stopPropagation());
    this.shadowRoot.addEventListener('focusin',e=>{if(e.target.matches('input')&&!this._open){this._query='';e.target.value='';this._open=true;this._results();}});
    this.shadowRoot.addEventListener('focusout',()=>setTimeout(()=>{if(!this.shadowRoot.activeElement)this._close();},0));
    this.shadowRoot.addEventListener('click',e=>{if(e.target.matches('input')&&!this._open){this._query='';e.target.value='';this._open=true;this._results();return;}const target=e.target.closest('button');if(!target)return;if(target.hasAttribute('data-clear'))this._choose('');else if(target.dataset.value!==undefined)this._choose(target.dataset.value);});
    this.shadowRoot.addEventListener('keydown',e=>this._key(e));
  }
  set options(options){this._items=options.items||[];this._value=options.value||'';this._label=options.label||'搜索';this._placeholder=options.placeholder||'搜索名称或实体 ID';this._disabled=!!options.disabled;this._empty=options.empty||'没有匹配项';this._render();}
  _selected(){const item=this._items.find(x=>x.value===this._value);return item?.label||this._value||'';}
  _render(){const E=escapeHTML;this.shadowRoot.innerHTML=`<style>
    :host{display:block;min-width:0;color:var(--primary-text-color,#23334c);font:inherit}*{box-sizing:border-box}.label{display:block;font-size:13px;margin-bottom:7px}.control{display:flex;align-items:center;border:1px solid var(--divider-color,#ccd8e7);border-radius:9px;background:var(--card-background-color,#fff)}.control:focus-within{outline:2px solid var(--primary-color,#3f86df);outline-offset:1px}input{width:100%;min-width:0;min-height:43px;border:0;background:transparent;color:inherit;font:inherit;padding:10px;outline:none}input:disabled{opacity:.5}button{color:inherit;font:inherit;cursor:pointer}.clear{flex:0 0 38px;background:transparent;border:0;min-height:40px;font-size:20px}.results{border:1px solid var(--divider-color,#ccd8e7);border-radius:9px;margin-top:5px;background:var(--card-background-color,#fff);max-height:260px;overflow-y:auto;overscroll-behavior:contain}.option{display:block;text-align:left;border:0;border-bottom:1px solid var(--divider-color,#ccd8e7);background:transparent;padding:10px;width:100%;min-height:48px;overflow-wrap:anywhere}.option:hover,.option.active{background:var(--secondary-background-color,#e9eff8)}.option[aria-selected=true]{color:var(--primary-color,#3f86df)}.description{display:block;color:var(--secondary-text-color,#71839d);font-size:11px;margin-top:4px}.message{font-size:12px;padding:12px;color:var(--secondary-text-color,#71839d)}[hidden]{display:none!important}
    </style><label class="label" for="search">${E(this._label)}</label><div class="control"><input id="search" type="search" role="combobox" aria-autocomplete="list" aria-controls="options" aria-expanded="false" aria-label="${E(this._label)}" autocomplete="off" placeholder="${E(this._placeholder)}" value="${E(this._selected())}" ${this._disabled?'disabled':''}><button class="clear" type="button" data-clear aria-label="清除${E(this._label)}" ${this._disabled||!this._value?'hidden':''}>×</button></div><div class="results" hidden><div id="options" role="listbox" aria-label="${E(this._label)}选项"></div><div class="message" role="status"></div></div>`;this._open=false;}
  _results(){
    const E=escapeHTML,all=searchItems(this._items,this._query);this._matches=all.slice(0,80);
    const input=this.shadowRoot.querySelector('input');input.setAttribute('aria-expanded',String(this._open));input.removeAttribute('aria-activedescendant');
    this.shadowRoot.querySelector('.results').hidden=!this._open;
    this.shadowRoot.querySelector('#options').innerHTML=this._matches.map((item,i)=>`<button type="button" tabindex="-1" role="option" class="option" id="option-${i}" aria-selected="${item.value===this._value}" data-value="${E(item.value)}"><span>${E(item.label)}</span><span class="description">${E(item.description||item.value)}</span></button>`).join('');
    this.shadowRoot.querySelector('.message').textContent=!all.length?this._empty:all.length>80?`显示前 80 项，共 ${all.length} 项，请继续输入缩小范围`:`${all.length} 项`;
  }
  _choose(value){this._value=value;this._close();this.shadowRoot.querySelector('.clear').hidden=!value;this.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true,composed:true}));}
  _close(){this._open=false;const input=this.shadowRoot.querySelector('input');if(!input)return;input.value=this._selected();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');this.shadowRoot.querySelector('.results').hidden=true;}
  _key(event){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this._close();return;}
    if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
    if(event.key==='Enter'&&!this._open)return;
    event.preventDefault();event.stopPropagation();
    if(!this._open){this._query='';this._open=true;this._results();}
    const length=this._matches?.length||0;if(!length)return;
    if(event.key==='Enter'){if(this._active>=0)this._choose(this._matches[this._active].value);return;}
    this._active=this._active<0?(event.key==='ArrowDown'?0:length-1):(this._active+(event.key==='ArrowDown'?1:-1)+length)%length;
    const options=this.shadowRoot.querySelectorAll('.option');options.forEach((el,i)=>el.classList.toggle('active',i===this._active));
    this.shadowRoot.querySelector('input').setAttribute('aria-activedescendant',`option-${this._active}`);options[this._active]?.scrollIntoView({block:'nearest'});
  }
}
if(!customElements.get('soft-home-picker'))customElements.define('soft-home-picker',SoftHomePicker);
