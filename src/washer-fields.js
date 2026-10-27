// Each binding is optional. Detection is limited to the selected physical device.
export const WASHER_FIELDS = {
  program: {name:'洗涤程序',group:'cycle',icon:'mdi:washing-machine',match:/洗涤程序|(?:^|[_\s])program(?:$|\s)/i},
  phase: {name:'当前进程',group:'cycle',icon:'mdi:progress-clock',match:/当前进程|洗涤阶段|(?:^|[_\s])(?:phase|process|stage)(?:$|\s)/i},
  temperature: {name:'水温',group:'quick',icon:'mdi:thermometer',match:/温度设定|设定温度|洗涤温度|(?:^|[_\s])(?:temperature|temp)(?:$|\s)/i,exclude:/过高|overheat/i},
  spin_speed: {name:'脱水转速',group:'quick',icon:'mdi:rotate-right',match:/脱水转速|spin[_\s]?(?:speed|rpm)/i},
  rinse: {name:'漂洗次数',group:'quick',icon:'mdi:water-outline',match:/漂洗次数|rinse[_\s]?(?:count|times|cycles)/i},
  mode: {name:'洗涤模式',group:'settings',icon:'mdi:tune-variant',match:/模式$|(?:^|[_\s])(?:wash[_\s]?)?mode(?:$|\s)/i,exclude:/夜间|night|烘干|dry/i},
  water_level: {name:'水位',group:'settings',icon:'mdi:waves',match:/水位|water[_\s]?level/i},
  detergent: {name:'洗衣液投放',group:'settings',icon:'mdi:water-plus-outline',match:/洗衣液|detergent[_\s]?(?:dose|dispens)|auto[_\s]?dos/i},
  stain: {name:'特渍类型',group:'settings',icon:'mdi:tshirt-crew-outline',match:/特渍|stain/i},
  drying: {name:'烘干',group:'settings',icon:'mdi:tumble-dryer',match:/烘干|(?:^|[_\s])dry(?:ing)?(?:$|\s)/i},
  anti_crease: {name:'智能抖散',group:'settings',icon:'mdi:air-filter',match:/抖散|anti[_\s]?crease/i},
  night: {name:'夜间模式',group:'settings',icon:'mdi:weather-night',match:/夜间模式|night[_\s]?mode/i},
  care: {name:'忘取无忧',group:'settings',icon:'mdi:weather-windy',match:/忘取无忧|fresh[_\s]?care/i},
  memory: {name:'程序记忆',group:'settings',icon:'mdi:restore',match:/程序记忆|(?:^|[_\s])memory(?:$|\s)/i},
  drum_light: {name:'筒灯',group:'settings',icon:'mdi:lightbulb-outline',match:/筒灯|drum[_\s]?light|down[_\s]?light/i},
  door: {name:'机门',group:'safety',icon:'mdi:door-closed',match:/门状态|door(?:[_\s]?(?:state|status))?(?:$|\s)/i,exclude:/lock/i},
  child_lock: {name:'童锁',group:'safety',icon:'mdi:lock-outline',match:/童锁|child[_\s]?lock/i},
  detergent_status: {name:'洗涤剂',group:'safety',icon:'mdi:water-check-outline',match:/洗涤剂状态|detergent[_\s]?(?:status|state|low)/i},
  overheat: {name:'水温告警',group:'safety',icon:'mdi:thermometer-alert',match:/水温过高|overheat|temp.*high/i},
  error: {name:'错误代码',group:'safety',icon:'mdi:alert-circle-outline',match:/错误代码|故障代码|error[_\s]?code|fault[_\s]?code/i},
  water_usage: {name:'本次用水',group:'usage',icon:'mdi:water-outline',match:/本次用水|water[_\s]?(?:usage|consumption)/i},
  energy: {name:'本次耗电',group:'usage',icon:'mdi:lightning-bolt-outline',match:/本次耗电|energy[_\s]?(?:usage|consumption)/i},
  wash_time: {name:'洗涤时间',group:'usage',icon:'mdi:timer-outline',match:/洗涤时间|wash[_\s]?time/i},
  spin_time: {name:'脱水时间',group:'usage',icon:'mdi:timer-outline',match:/脱水时间|spin[_\s]?time/i},
  power: {name:'电源开关',group:'control',icon:'mdi:power',match:/电源|(?:^|[_\s])power(?:$|\s)/i,domains:['switch','input_boolean']},
  start: {name:'启动 / 暂停',group:'control',icon:'mdi:play-pause',match:/启停|开始洗衣|启动.*暂停|(?:^|[_\s])(?:start|start_pause|wash_start)(?:$|\s)/i,domains:['switch','input_boolean','button','input_button']},
};

export function detectWasherBindings(hass,ids) {
  const find=(match,domains,exclude)=>{
    const hits=ids.filter(id=>{
      const text=`${id.split('.')[1]} ${hass.states[id]?.attributes?.friendly_name||''}`;
      return (!domains||domains.includes(id.split('.')[0]))&&match.test(text)&&!exclude?.test(text);
    });
    // Ambiguous roles remain unbound for the user to choose explicitly.
    return hits.length===1?hits[0]:undefined;
  };
  const washer={};
  for(const [key,field] of Object.entries(WASHER_FIELDS)) {
    const id=find(field.match,field.domains||['sensor','binary_sensor','select','number','switch','light','lock','input_boolean'],field.exclude);
    if(id)washer[key]=id;
  }
  const result={};
  if(Object.keys(washer).length)result.washer=washer;
  const remaining=find(/剩余时间|(?:^|[_\s])remaining(?:[_\s]?time)?(?:$|\s)/i,['sensor','number']);
  const progress=find(/洗涤进度|(?:^|[_\s])progress(?:$|\s)/i,['sensor','number']);
  if(remaining){result.primary_entity=remaining;result.primary_label='剩余时间';}
  if(progress)result.progress_entity=progress;
  return result;
}
