# Soft Home · 柔光设备卡片

按已确认的浅蓝白设计制作的 Home Assistant Lovelace 自定义卡片。19 种设备插画、中文可视化编辑器、深浅主题、真实实体读数与操作。

**安装只需要一个文件：`dist/soft-home-card.js`。无需 button-card、Mushroom、card-mod、CDN 或额外图片文件。**

## 安装

1. 在 Home Assistant 的配置目录中创建 `www/soft-home-card/`。
2. 把 `dist/soft-home-card.js` 放到 `/config/www/soft-home-card/soft-home-card.js`。如果使用随附安装包，直接把其中 `www/` 合并到 HA 的配置目录。
3. 打开 **设置 → 仪表盘 → 右上角菜单 → 资源**，添加：
   - URL：`/local/soft-home-card/soft-home-card.js?v=1.0.0`
   - 类型：**JavaScript 模块**
4. 刷新仪表盘，进入编辑模式 → 添加卡片，搜索 **Soft Home · 柔光设备卡片**。
5. 在编辑器里选设备外观和主实体，保存即可。实体 ID 不需要提前批量整理。

如果“资源”入口未显示，先在个人资料中开启高级模式。第一次创建 `www` 目录后若 `/local/` 返回 404，重启 HA 后再访问。升级时替换 JS 文件并更新资源 URL 的版本查询参数；仍显示旧版时清除浏览器或 Companion App 的前端缓存。

如果仪表盘使用 YAML 资源管理，按自己的现有配置合并下面一项，不要覆盖已有资源：

```yaml
lovelace:
  resources:
    - url: /local/soft-home-card/soft-home-card.js?v=1.0.0
      type: module
```

## 在编辑器里配置

- **设备外观**：选择 19 种插画之一。
- **主实体**：提供主要状态和自动控件。外观与实体域独立，例如浴霸可绑定 `climate`、`fan` 或 `switch`。
- **名称、房间、主题、强调色**：可选。浅色默认延续设计稿。
- **主读数**：可选其他实体或主实体属性。洗衣机可选剩余时间传感器。
- **辅助读数**：例如温湿度计的湿度实体、冰箱冷冻温度实体。
- **功率、进度**：可选功率传感器和 0–100 的进度传感器。没有数据时不会填入演示值。
- **辅助操作**：最多 3 个实体，可绑定洗衣启动按钮、除雾开关、换气开关、取水按钮或脚本。
- **底部概览**：最多 3 项实体/属性。不指定时显示主实体已有的属性。
- **只读展示**：保留读数和详情入口，禁用服务操作。

卡片通过当前登录的 HA 会话调用服务，不保存凭据。设备需要先通过对应集成接入 Home Assistant；卡片不提供新的设备集成。

## 19 种外观

| `device` | 设备 | 常见主实体 |
| --- | --- | --- |
| `washing_machine` | 洗衣机 | `sensor` / `switch` |
| `dryer` | 烘干机 | `sensor` / `switch` |
| `projector` | 投影仪 | `media_player` / `switch` |
| `projector_lift` | 投影仪升降支架 | `cover` |
| `screen` | 幕布 | `cover` |
| `air_conditioner` | 空调 | `climate` |
| `refrigerator` | 冰箱 | `sensor` / `number` |
| `integrated_stove` | 集成灶 | `fan` / `sensor` / `switch` |
| `water_heater` | 热水器 | `water_heater` / `climate` |
| `floor_heating` | 地暖 | `climate` |
| `wall_light` | 壁灯 | `light` |
| `spotlight` | 射灯 | `light` |
| `downlight` | 筒灯 | `light` |
| `pendant_light` | 吊灯 | `light` |
| `led_strip` | 灯带 | `light` |
| `tea_machine` | 茶吧机 | `sensor` / `number` / `switch` |
| `bathroom_mirror` | 浴室镜 | `light` / `switch` |
| `temperature_humidity` | 温湿度计 | `sensor` |
| `bathroom_heater` | 浴霸 | `climate` / `fan` / `switch` |

## 自动控件

控件同时检查实体能力、服务是否存在、连接状态和只读配置。`unknown`、`unavailable` 或实体不存在时不会发送控制命令。

| 实体域 | 可用控件 |
| --- | --- |
| `light` | 开关；支持时显示亮度、Kelvin 色温 |
| `climate` | 支持时显示设定温度、HVAC 模式、开关 |
| `water_heater` | 支持时显示目标温度、运行模式、开关 |
| `cover` | 支持时显示上升、停止、下降、位置百分比 |
| `media_player` | 支持时显示音量和开关；详情中使用其他播放功能 |
| `fan` | 开关；支持时显示风速百分比 |
| `switch` / `input_boolean` | 开关 |
| `number` / `input_number` | 按实体上下限和步长调节数值 |
| `select` / `input_select` | 选择实体提供的选项 |
| `button` / `input_button` | 执行按钮 |
| `sensor` / 其他 | 只读状态与 HA 原生详情入口 |

**幕布与支架的位置语义：**HA 标准 `current_position` 是 0=关闭、100=开启。默认直接显示“开启程度”。选择“反转行程读数”后显示 `100 − current_position`，拖动也反向换算；适用于“关闭=幕布落下”的集成。上升/下降始终调用 `open_cover`/`close_cover`，不会调换电机命令。以实际集成定义为准。

光源不支持亮度或色温时，相应滑条不会出现。双设定点温控器不显示单温度按钮，可进入 HA 原生详情使用上下限温度。RGB 颜色选择、历史曲线及所有设备特有功能不在此版本的自动控件范围内；可通过详情或辅助实体操作。

## 少量 YAML 示例（可选）

通常用可视化编辑器即可，以下仅用于了解配置结构。

```yaml
type: custom:soft-home-card
device: wall_light
entity: light.replace_with_your_entity
name: 壁灯
room: 卧室
```

一个包含环境读数的卡片：

```yaml
type: custom:soft-home-card
device: temperature_humidity
entity: sensor.replace_with_your_temperature
secondary_entity: sensor.replace_with_your_humidity
```

仅高级自定义服务需要代码编辑器。例如将“开始洗衣”连接到已有脚本：

```yaml
type: custom:soft-home-card
device: washing_machine
entity: sensor.replace_with_your_washer_state
primary_entity: sensor.replace_with_your_remaining_time
primary_label: 剩余时间
actions:
  - label: 开始洗衣
    action: perform-action
    perform_action: script.turn_on
    target:
      entity_id: script.replace_with_your_start_script
```

`actions` 最多 3 项，支持 `perform-action` 和 `more-info`。服务参数放在 `data`，目标放在 `target`；没有目标时不会擅自使用主实体。可用 `confirmation: "确定执行？"` 为特定操作开启确认。编辑器修改普通字段时保留高级 `actions` 配置。

主要可选配置：`primary_attribute`、`primary_unit`、`secondary_entity`、`power_entity`、`progress_entity`、`metrics`、`auxiliary`、`show_stats`、`read_only`、`invert_position`、`theme`、`accent`。`metrics` 项支持 `entity`、`attribute`、`name`、`unit`、`precision`；`auxiliary` 项支持 `entity`、`name`。

## 开发与验证

Node.js 20+：

```sh
npm run build
npm test
npm run demo
```

本地交互预览：`http://127.0.0.1:8124`。其中所有实体均为模拟数据，和实际安装的卡片逻辑隔离。测试浏览器需本地 Playwright 与 Chromium：

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

也可通过 `SOFT_HOME_PLAYWRIGHT` 指定 Playwright 模块路径，通过 `SOFT_HOME_CHROMIUM` 指定已有 Chromium 路径。构建从仓库 `design/soft-device-cards/sources/` 提取批准的插画，去除固定演示读数，再打包为单文件。

已按 Home Assistant 官方自定义卡片接口实现 `setConfig`、`hass`、`getCardSize`、`getGridOptions`、`getConfigElement`、`getStubConfig`、`config-changed` 和 `hass-more-info`。验证使用 Node 单元测试和 Chromium 模拟 HA 会话；尚未在你的实际 HA 实例或设备上验证。

参考：
- https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
- https://developers.home-assistant.io/docs/frontend/data/

