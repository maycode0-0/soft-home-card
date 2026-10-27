// Optional roles match only entities belonging to the selected physical device.
const readingDomains=['sensor','binary_sensor','number','select','input_number','input_select'];
const settingDomains=['select','number','switch','input_boolean','input_select','input_number'];
const triggerDomains=['button','input_button','script','switch','input_boolean'];
const role=(name,group,icon,match,domains=readingDomains,extra={})=>({name,group,icon:'mdi:'+icon,match,domains,...extra});

export const DEVICE_FIELDS={
  air_conditioner:{
    indoor_temperature:role('室内温度','readings','thermometer',/室内.*温度|indoor.*temp/i),
    humidity:role('相对湿度','readings','water-outline',/湿度|humidity/i),
    outdoor_temperature:role('室外温度','readings','thermometer',/室外.*温度|outdoor.*temp/i),
    power:role('电源','actions','power',/电源|(?:^|[_\s])power(?:$|[_\s])/i,['switch','input_boolean']),
    mode:role('运行模式','settings','tune-variant',/运行模式|operation.*mode|hvac.*mode/i,settingDomains),
    drying:role('内机防霉','settings','weather-windy',/防霉|内机.*干燥|mildew|anti.*mold/i,settingDomains),
    presence:role('随身感','settings','account-outline',/随身感|follow.*me|i.?feel/i,settingDomains),
    self_clean:role('自清洁','settings','water-check-outline',/自清洁|self.*clean/i,[...settingDomains,...triggerDomains]),
    timer_on:role('定时开机','timers','timer-outline',/定时开机|timer.*on|power.*on.*time/i),
    timer_off:role('定时关机','timers','timer-outline',/定时关机|timer.*off|power.*off.*time/i),
    cancel_timer:role('取消定时','actions','timer-off-outline',/取消定时|cancel.*timer/i,triggerDomains),
  },
  refrigerator:{
    fridge_temperature:role('冷藏室','zones','thermometer',/冷藏.*(?:显示|温度)|fridge.*temp|refrigerator.*temp/i,['sensor']),
    freezer_temperature:role('冷冻室','zones','snowflake',/冷冻.*(?:显示|温度)|freezer.*temp/i,['sensor']),
    variable_temperature:role('变温室','zones','thermometer',/变温.*(?:显示|温度)|variable.*temp|flex.*temp/i,['sensor']),
    fridge_target:role('冷藏设定','settings','tune-variant',/冷藏|fridge|refrigerator/i,['number','select','input_number','input_select']),
    freezer_target:role('冷冻设定','settings','tune-variant',/冷冻|freezer/i,['number','select','input_number','input_select']),
    variable_target:role('变温设定','settings','tune-variant',/变温|variable|flex/i,['number','select','input_number','input_select'],{exclude:/珍品|模式|mode/i}),
    variable_mode:role('变温模式','settings','tune-variant',/珍品变温|变温模式|variable.*mode|flex.*mode/i),
    rapid_freeze:role('速冻锁鲜','settings','snowflake',/速冻|锁鲜|rapid.*freez|fast.*freez/i,settingDomains),
    smart_storage:role('智能存储','settings','archive-outline',/智能存储|smart.*stor/i,settingDomains),
  },
  temperature_humidity:{battery:role('电池电量','readings','battery-outline',/电量|battery/i,['sensor'])},
  curtain:{},
  door_lock:{
    battery:role('干电池电量','readings','battery-outline',/干电池|battery/i,['sensor'],{exclude:/锂电池|lithium/i}),
    lithium_battery:role('锂电池电量','readings','battery-outline',/锂电池|lithium.*battery/i,['sensor']),
    door:role('门磁状态','safety','door-closed',/门磁|door.*(?:contact|state)|contact.*sensor/i,['binary_sensor','sensor']),
    tamper:role('防撬状态','safety','shield-check-outline',/防撬|tamper/i,['binary_sensor','sensor']),
    doorbell:role('门铃','safety','bell-outline',/门铃|doorbell/i,['binary_sensor','sensor','event']),
    event:role('最近开门','event','key-outline',/开锁事件|开门事件|unlock.*event|last.*unlock/i,['sensor','event']),
    snapshot:role('猫眼抓拍','media','camera-outline',/截图|抓拍|snapshot|capture|猫眼/i,['camera','image']),
    temporary_code:role('生成临时密码','actions','key-plus',/临时密码|temporary.*(?:code|password)/i,[...triggerDomains,'sensor','text','input_text']),
    authorizations:role('授权列表','actions','account-key-outline',/授权|authori[sz]|access.*list/i,[...triggerDomains,'sensor','select']),
  },
  vacuum:{
    battery:role('电池电量','readings','battery-outline',/电量|battery/i,['sensor']),
    cleaning_time:role('清洁时长','readings','timer-outline',/清洁时长|清扫时间|cleaning.*time/i,['sensor']),
    cleaned_area:role('清洁面积','readings','ruler-square',/清洁面积|清扫面积|cleaned.*area/i,['sensor']),
    progress:role('清洁进度','readings','progress-clock',/清洁进度|清扫进度|cleaning.*progress/i,['sensor']),
    current_room:role('当前房间','readings','home-outline',/当前房间|current.*room/i,['sensor']),
    status:role('设备状态','station','robot-vacuum',/^(?:status|状态)$|(?:^|[_\s])status(?:$|\s)/i,['sensor'],{exclude:/relocation|task|charge|dust|empty|wash|drain|steam/i}),
    task:role('任务状态','station','format-list-checks',/任务状态|task.*status/i,['sensor']),
    relocation:role('定位状态','station','map-marker-outline',/定位状态|relocation.*status/i,['sensor']),
    charging:role('充电状态','station','lightning-bolt-outline',/充电状态|charging.*(?:status|state)/i,['sensor']),
    mop_pad:role('拖布状态','station','water-outline',/拖布状态|mop.*pad$/i,['sensor','binary_sensor']),
    dust_collection:role('集尘状态','station','archive-outline',/集尘状态|dust.*collection/i,['sensor']),
    auto_empty_status:role('自动集尘','station','archive-outline',/auto.*empty.*status/i,['sensor']),
    base_status:role('基站状态','station','home-outline',/基站状态|self.*wash.*base.*status/i,['sensor']),
    drainage:role('排水状态','station','water-outline',/排水状态|drainage.*status/i,['sensor']),
    steam:role('蒸汽状态','station','weather-windy',/蒸汽状态|stream.*status|steam.*status/i,['sensor']),
    task_type:role('任务类型','station','format-list-checks',/任务类型|task.*type/i,['sensor']),
    error:role('故障信息','station','alert-circle-outline',/故障|(?:^|[_\s])error(?:$|[_\s])/i,['sensor','binary_sensor']),
    drying_progress:role('烘干进度','station','progress-clock',/烘干进度|drying.*progress/i,['sensor']),
    drying_left:role('烘干剩余','station','timer-outline',/烘干剩余|drying.*left/i,['sensor']),
    mapping_time:role('建图时长','station','map-outline',/建图时长|mapping.*time/i,['sensor']),
    cleaning_mode:role('清洁模式','settings','tune-variant',/清洁模式|cleaning.*mode/i,settingDomains,{roomExclude:true}),
    suction:role('吸力','settings','weather-windy',/吸力|suction.*level/i,settingDomains,{roomExclude:true}),
    wetness:role('湿度档位','settings','water-outline',/湿度档位|wetness.*level/i,settingDomains,{roomExclude:true}),
    route:role('清洁路线','settings','map-outline',/清洁路线|cleaning.*route/i,settingDomains,{roomExclude:true}),
    drying_time:role('烘干时长','settings','timer-outline',/烘干时长|drying.*time/i,settingDomains),
    mop_humidity:role('拖布湿度','settings','water-outline',/拖布湿度|mop.*pad.*humidity/i,settingDomains,{roomExclude:true}),
    self_clean_area:role('回洗面积','settings','ruler-square',/回洗面积|self.*clean.*area/i,settingDomains),
    self_clean_frequency:role('回洗频率','settings','restore',/回洗频率|self.*clean.*frequency/i,settingDomains),
    auto_empty_mode:role('集尘模式','settings','archive-outline',/集尘模式|auto.*empty.*mode/i,settingDomains),
    washing_mode:role('洗布模式','settings','water-check-outline',/洗布模式|washing.*mode/i,settingDomains),
    selected_map:role('使用地图','settings','map-outline',/使用地图|selected.*map/i,settingDomains),
    water_temperature:role('洗布水温','settings','thermometer',/洗布水温|water.*temperature/i,settingDomains),
    clean_genius:role('智能清洁','settings','tune-variant',/智能清洁|clean.*genius$/i,settingDomains),
    clean_genius_mode:role('智能清洁模式','settings','tune-variant',/clean.*genius.*mode/i,settingDomains),
    customized:role('自定义清洁','settings','tune-variant',/自定义清洁|customized.*cleaning/i,settingDomains),
    auto_drying:role('自动烘干','settings','weather-windy',/自动烘干|auto.*drying/i,settingDomains),
    silent_drying:role('静音烘干','settings','weather-night',/静音烘干|silent.*drying/i,settingDomains),
    max_suction:role('最大吸力','settings','weather-windy',/最大吸力|max.*suction/i,settingDomains),
    self_clean:role('清洗拖布','actions','water-check-outline',/清洗拖布|^self.*clean$/i,triggerDomains),
    start_empty:role('开始集尘','actions','archive-outline',/开始集尘|start.*auto.*empty/i,triggerDomains),
    manual_drying:role('手动烘干','actions','weather-windy',/手动烘干|manual.*drying/i,triggerDomains),
    re_clean:role('再次清洁','actions','restore',/再次清洁|start.*re.*cleaning/i,triggerDomains),
  },
  camera:{
    ptz_up:role('向上','ptz','arrow-up',/云台.*上|ptz.*up/i,triggerDomains),
    ptz_down:role('向下','ptz','arrow-down',/云台.*下|ptz.*down/i,triggerDomains),
    ptz_left:role('向左','ptz','arrow-left',/云台.*左|ptz.*left/i,triggerDomains),
    ptz_right:role('向右','ptz','arrow-right',/云台.*右|ptz.*right/i,triggerDomains),
    ptz_home:role('回到预置位','ptz','home-outline',/云台.*复位|ptz.*home|preset.*home/i,triggerDomains),
    privacy:role('隐私模式','settings','shield-check-outline',/隐私|privacy/i,settingDomains),
    motion:role('移动侦测','settings','motion-sensor',/移动侦测|motion.*detect/i,[...settingDomains,'binary_sensor']),
    playback_date:role('回放日期','playback','calendar-outline',/回放日期|playback.*date/i,['date','input_datetime','datetime']),
    playback_time:role('回放时间','playback','clock-outline',/回放时间|playback.*time/i,['input_datetime','datetime','time']),
    query:role('查询录像','playback','magnify',/查询录像|query.*record|search.*record/i,triggerDomains),
    play:role('播放录像','playback','play',/播放录像|play.*record|start.*playback/i,triggerDomains),
    stop_playback:role('停止回放','playback','stop',/停止回放|stop.*playback/i,triggerDomains),
  },
};

const vacuumRooms=[['living_room','客厅'],['dining_hall','餐厅'],['kitchen','厨房'],['study','书房'],['corridor','走廊'],['primary_bedroom','主卧'],['secondary_bedroom','次卧'],['secondary_bathroom','次卫'],['primary_bathroom','主卫']];
const roomText=/客厅|餐厅|厨房|书房|走廊|主卧|次卧|次卫|主卫|living[ _]room|dining[ _]hall|kitchen|study|corridor|(?:primary|secondary)[ _](?:bedroom|bathroom)/i;
for(const [room,name] of vacuumRooms){
  for(const [key,label,pattern] of [['suction','吸力','suction.*level|吸力'],['wetness','湿度档位','wetness.*level|湿度档位'],['humidity','拖布湿度','mop.*pad.*humidity|拖布湿度'],['mode','清洁模式','cleaning.*mode|清洁模式'],['times','清洁次数','cleaning.*times|清洁次数'],['route','清洁路线','cleaning.*route|清洁路线'],['order','清洁顺序','order|清洁顺序']]){
    DEVICE_FIELDS.vacuum[room+'_'+key]=role(name+' · '+label,'rooms','home-outline',new RegExp(`(?=.*(?:${room.replaceAll('_','[ _]')}|${name}))(?=.*(?:${pattern}))`,'i'),settingDomains);
  }
}

export function detectDeviceBindings(hass,kind,ids){
  const features={};
  for(const [key,field] of Object.entries(DEVICE_FIELDS[kind]||{})){
    const matches=ids.filter(id=>{
      const text=`${id.split('.')[1]} ${hass.states?.[id]?.attributes?.friendly_name||''}`;
      return field.domains.includes(id.split('.')[0])&&field.match.test(text)&&!field.exclude?.test(text)&&!(field.roomExclude&&roomText.test(text));
    });
    if(matches.length===1)features[key]=matches[0];
  }
  const result=Object.keys(features).length?{features}:{};
  if(kind==='temperature_humidity'){
    const humidity=ids.filter(id=>id.startsWith('sensor.')&&(hass.states[id]?.attributes?.device_class==='humidity'||/湿度|humidity/i.test(id+' '+hass.states[id]?.attributes?.friendly_name)));
    if(humidity.length===1)result.secondary_entity=humidity[0];
  }
  return result;
}
