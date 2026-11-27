import { SoftHomeCard } from './card.js';
import './editor.js';

if(!customElements.get('soft-home-card'))customElements.define('soft-home-card',SoftHomeCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==='soft-home-card'))window.customCards.push({type:'soft-home-card',name:'Soft Home · 柔光设备卡片',description:'23 种设备外观，设备专属布局，原生实体控制，可视化配置。',preview:true});
