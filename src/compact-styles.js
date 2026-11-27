// Applied after the device styles so compact and spacious layouts share controls.
export const COMPACT_CSS = `
:host([compact]) ha-card{padding:15px;border-radius:22px}
:host([compact]) .header{gap:7px;min-height:44px}
:host([compact]) .header .name{font-size:16px;line-height:1.4;text-wrap:balance}
:host([compact]) .header .room{font-size:10px;margin-bottom:2px}
:host([compact]) .header .status{font-size:10px;padding:5px 7px;max-width:78px;flex-shrink:0}
:host([compact]) .header .icon-button{width:44px;height:44px}
:host([compact]) .device-overview,:host([compact]) .generic-overview{min-height:110px;padding:10px 12px;margin:12px 0;border-radius:16px;gap:4px}
:host([compact]) .device-overview .hero,:host([compact]) .generic-overview .hero{height:94px;padding:0}
:host([compact]) .device-value,:host([compact]) .generic-value{font-size:36px;line-height:1.25;letter-spacing:-1px}
:host([compact]) .device-value small{font-size:14px}
:host([compact]) .device-value.textual,:host([compact]) .generic-value.textual{font-size:23px;letter-spacing:0}
:host([compact]) .device-kicker,:host([compact]) .generic-kicker{font-size:10px}
:host([compact]) .device-note,:host([compact]) .generic-state{font-size:10px;margin-top:3px}
:host([compact]) .device-state{font-size:21px}
:host([compact]) .control-surface,:host([compact]) .generic-card .panel{padding:10px 12px;gap:8px;border-radius:15px;box-shadow:none}
:host([compact]) .control-label{font-size:10px;margin-bottom:2px}
:host([compact]) .stepper output{font-size:20px}
:host([compact]) .environment-readings{margin:8px 0;gap:4px;grid-template-columns:repeat(auto-fit,minmax(64px,1fr))}
:host([compact]) .mini-reading{gap:4px;align-items:center;min-height:44px}
:host([compact]) .mini-reading>ha-icon{display:none}
:host([compact]) .mini-reading>span{font-size:10px}
:host([compact]) .mini-reading strong{font-size:13px}
:host([compact]) .device-details{margin-top:8px}
:host([compact]) .device-details summary{min-height:44px;font-size:11px}
:host([compact]) .detail-content{display:grid;gap:10px;padding:0 0 6px}
:host([compact]) .detail-content .device-details{margin:0}
:host([compact]) .detail-content .mode-chips{padding-top:0;border-top:0;gap:4px}
:host([compact]) .feature-tile{min-height:54px;padding:8px;gap:6px}
:host([compact]) .device-extras{margin-top:10px}
:host([compact]) .device-footnote{font-size:9px;margin-top:8px}
:host([compact]) .device-alert,:host([compact]) .washer-alert,:host([compact]) .availability-note{padding:8px 10px;margin-top:10px;font-size:11px}
:host([compact]) .fridge-overview{margin:12px 0 10px;padding:10px;gap:10px;border-radius:16px;grid-template-columns:minmax(0,42%) minmax(0,1fr)}
:host([compact]) .fridge-overview .hero{height:160px}
:host([compact]) .fridge-overview .hero svg{transform:scale(1.05)}
:host([compact]) .temperature-zones{gap:5px}
:host([compact]) .temperature-zone{padding:6px 9px;border-radius:10px}
:host([compact]) .temperature-zone .device-value{font-size:24px;margin-top:0}
:host([compact]) .temperature-zone .device-value small{font-size:11px}
:host([compact]) .temperature-zone>span{font-size:9px;gap:4px}
:host([compact]) .temperature-zone ha-icon{--mdc-icon-size:13px}
:host([compact]) .temperature-presets{padding-top:8px}
:host([compact]) .cover-overview{margin:12px 0;padding:8px;border-radius:16px}
:host([compact]) .cover-overview .hero{height:112px;padding:0 65px 0 0}
:host([compact]) .cover-readout{right:12px;bottom:18px;max-width:45%}
:host([compact]) .cover-readout .device-value{font-size:29px}
:host([compact]) .cover-readout .device-note{font-size:9px}
:host([compact]) .position-control{gap:0}
:host([compact]) .vacuum-controls .button-row{display:flex;flex-wrap:wrap;gap:6px}
:host([compact]) .vacuum-controls .button-row button{flex:1 1 64px;font-size:10px;padding:6px 3px}
:host([compact]) .cleaning-progress{margin-bottom:8px}
:host([compact]) .sensor-readings{margin-top:16px}
:host([compact]) .sensor-reading .device-value{font-size:32px;margin-top:3px}
:host([compact]) .sensor-reading .device-value small{font-size:12px}
:host([compact]) .sensor-art{height:84px;margin:8px 0}
:host([compact]) .sensor-footer{padding-top:5px;font-size:10px}
:host([compact]) .washer-overview{margin-top:12px;padding:10px 12px;border-radius:16px}
:host([compact]) .washer-program{min-height:36px}
:host([compact]) .washer-program strong{font-size:14px}
:host([compact]) .washer-label{font-size:10px}
:host([compact]) .washer-hero-row{margin:0;gap:6px}
:host([compact]) .washer-card .hero{height:100px}
:host([compact]) .washer-time{font-size:36px;letter-spacing:-1px}
:host([compact]) .washer-time.long{font-size:25px}
:host([compact]) .washer-time-note{font-size:9px;margin-top:3px}
:host([compact]) .washer-progress-label{font-size:10px}
:host([compact]) .washer-actions{margin-top:10px;gap:7px}
:host([compact]) .washer-actions button{min-height:44px;font-size:11px;gap:5px}
:host([compact]) .washer-details{margin-top:8px;border-bottom:0;border-top:1px solid var(--soft-line)}
:host([compact]) .washer-details summary{min-height:44px}
:host([compact]) .washer-quick{margin:8px 0}
:host([compact]) .washer-quick .washer-setting{padding:7px 3px}
:host([compact]) .washer-quick .washer-setting>ha-icon{display:none}
:host([compact]) .washer-usage{padding-top:8px}
:host([compact]) .lock-summary{margin-top:12px}
:host([compact]) .lock-summary .device-state{font-size:clamp(20px,7cqw,26px);line-height:1.25}
:host([compact]) .camera-preview{margin-top:12px}
:host([compact]) .ptz-section{margin:12px 0}
:host([compact]) .generic-card .controls{margin-top:8px;gap:8px}
:host([compact]) .stats{margin-top:10px;padding-top:8px}
@container(max-width:280px){
  :host([compact]) ha-card{padding:12px}
  :host([compact]) .header .name{font-size:15px}
  :host([compact]) .header .status{font-size:9px;max-width:65px}
  :host([compact]) .environment-readings{gap:2px}
  :host([compact]) .mini-reading{padding:4px 0}
  :host([compact]) .device-value{font-size:32px}
}
`;
