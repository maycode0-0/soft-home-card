import './icons.js';
import {createMock, DEMO_CONFIGS} from './mock.js';

// Extract this file's quoted, flat scalars for the preview, not arbitrary YAML.
// Home Assistant loads the original YAML; no parser is shipped with the theme.
function previewVariables(source) {
  const common = {}, modes = {light: {}, dark: {}};
  let mode;
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^    (light|dark):\s*$/);
    if (heading) { mode = heading[1]; continue; }
    const shared = line.match(/^  ([\w-]+): (['"])(.*)\2\s*$/);
    if (shared) { common[shared[1]] = shared[3]; continue; }
    const scalar = line.match(/^      ([\w-]+): "(.*)"\s*$/);
    if (scalar && mode) modes[mode][scalar[1]] = scalar[2];
  }
  for (const name of ['light', 'dark']) {
    if (!modes[name]['soft-home-page'] || !modes[name]['soft-home-blue']) {
      throw new Error('主题缺少必要配色');
    }
  }
  return {common, modes};
}

const mock = createMock();
const cards = [];
const root = document.documentElement;
const dialog = document.querySelector('#settings-dialog');
let theme, noticeTimeout;

function notify(message) {
  const notice = document.querySelector('#notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { notice.hidden = true; }, 3200);
}

const swatches = [
  ['soft-home-page', '雾色背景'], ['soft-home-card', '柔光卡面'],
  ['soft-home-text', '清晰正文'], ['soft-home-blue', '湖蓝操作'],
  ['soft-home-green', '柔绿状态'], ['soft-home-amber', '暖色灯光'],
];

function setMode(mode) {
  if (!theme || !theme.modes[mode]) return;
  for (const [name, value] of Object.entries({...theme.common, ...theme.modes[mode]})) {
    root.style.setProperty('--' + name, value);
  }
  root.style.colorScheme = mode;
  root.dataset.mode = mode;
  mock.themes = {darkMode: mode === 'dark'};
  for (const card of cards) card.hass = {...mock};
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  document.querySelector('#mode-description').textContent = mode === 'dark' ? '夜色 · 深色模式' : '日光 · 浅色模式';
  document.querySelector('#palette-mode').textContent = mode === 'dark' ? '夜色色板' : '日光色板';
  document.querySelector('meta[name="theme-color"]').content = theme.modes[mode]['soft-home-page'];
  const palette = document.querySelector('#palette');
  palette.replaceChildren();
  for (const [key, label] of swatches) {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    const color = document.createElement('div');
    color.className = 'swatch-color';
    color.style.setProperty('--swatch', theme.modes[mode][key]);
    color.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = label;
    const hex = document.createElement('code');
    hex.textContent = theme.modes[mode][key];
    swatch.append(color, name, hex);
    palette.append(swatch);
  }
  try { localStorage.setItem('soft-home-theme-mode', mode); } catch { /* Storage can be disabled. */ }
}

function updateReadings() {
  const on = mock.states['light.wall'].state === 'on';
  document.querySelector('#native-light').setAttribute('aria-checked', String(on));
  document.querySelector('#light-state').textContent = on ? '已开启' : '已关闭';
  const position = mock.states['cover.curtain'].attributes.current_position;
  const output = document.querySelector('#curtain-state');
  output.firstChild.textContent = String(position);
}

function mountCards() {
  const definitions = [
    ['air_conditioner', '客厅空调', '客厅', '温控与舒适'],
    ['wall_light', '客厅壁灯', '客厅', '光线与氛围'],
    ['curtain', '客厅窗帘', '客厅', '窗边与自然光'],
    ['washing_machine', '阳台洗衣机', '生活阳台', '衣物与日常'],
  ];
  for (const [device, name, room, caption] of definitions) {
    const section = document.createElement('section');
    section.setAttribute('aria-label', name);
    const label = document.createElement('p');
    label.className = 'device-caption';
    label.textContent = caption;
    const card = document.createElement('soft-home-card');
    const config = DEMO_CONFIGS.find(item => item.device === device);
    card.setConfig({...config, type: 'custom:soft-home-card', name, room, theme: 'auto', compact: true});
    card.hass = mock;
    cards.push(card);
    section.append(label, card);
    document.querySelector('#device-grid').append(section);
  }
  mock.notify = () => {
    for (const card of cards) card.hass = {...mock};
    updateReadings();
  };
  updateReadings();
}

const scenes = {
  home: {name: '回家', light: 'on', brightness: 166, position: 65, climate: 'cool', temperature: 26},
  reading: {name: '阅读', light: 'on', brightness: 230, position: 85, climate: 'cool', temperature: 26},
  movie: {name: '观影', light: 'on', brightness: 38, position: 0, climate: 'cool', temperature: 25},
  night: {name: '晚安', light: 'on', brightness: 20, position: 0, climate: 'off', temperature: 26},
};

function selectScene(name, announce = true) {
  const scene = scenes[name];
  for (const button of document.querySelectorAll('[data-scene]')) {
    button.setAttribute('aria-pressed', String(button.dataset.scene === name));
  }
  mock.states = {
    ...mock.states,
    'light.wall': {...mock.states['light.wall'], state: scene.light, attributes: {...mock.states['light.wall'].attributes, brightness: scene.brightness}},
    'cover.curtain': {...mock.states['cover.curtain'], state: scene.position ? 'open' : 'closed', attributes: {...mock.states['cover.curtain'].attributes, current_position: scene.position}},
    'climate.ac': {...mock.states['climate.ac'], state: scene.climate, attributes: {...mock.states['climate.ac'].attributes, temperature: scene.temperature, hvac_action: scene.climate === 'off' ? 'idle' : 'cooling'}},
  };
  mock.notify();
  if (announce) notify('「' + scene.name + '」场景已应用到本地示例');
}

function clearScene() {
  for (const button of document.querySelectorAll('[data-scene]')) button.setAttribute('aria-pressed', 'false');
}

for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => setMode(button.dataset.mode);
for (const button of document.querySelectorAll('[data-scene]')) button.onclick = () => selectScene(button.dataset.scene);
for (const id of ['open-settings', 'open-palette']) document.getElementById(id).onclick = () => dialog.showModal();
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
document.querySelector('#native-light').onclick = async () => {
  const service = mock.states['light.wall'].state === 'on' ? 'turn_off' : 'turn_on';
  clearScene();
  await mock.callService('light', service, {}, {entity_id: 'light.wall'});
};
document.addEventListener('hass-more-info', event => {
  notify('示例实体：' + event.detail.entityId + '。安装后会打开 HA 原生详情。');
});
const callService = mock.callService;
mock.callService = async (...args) => { clearScene(); return callService(...args); };
document.querySelector('#download-theme').onclick = () => {
  const link = document.createElement('a');
  link.href = '/themes/soft_home.yaml';
  link.download = 'soft_home.yaml';
  link.click();
};

const navLinks = [...document.querySelectorAll('.side-nav a')];
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
  if (!visible) return;
  for (const link of navLinks) {
    if (link.hash === '#' + visible.target.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}, {rootMargin: '-5% 0px -45% 0px'});
for (const id of ['overview', 'devices', 'appearance']) observer.observe(document.getElementById(id));

try {
  const response = await fetch('/themes/soft_home.yaml');
  if (!response.ok) throw new Error('HTTP ' + response.status);
  theme = previewVariables(await response.text());
  mountCards();
  selectScene('home', false);
  let saved;
  try { saved = localStorage.getItem('soft-home-theme-mode'); } catch { /* Use system preference. */ }
  const requested = new URLSearchParams(location.search).get('mode');
  const initial = requested || saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setMode(['light', 'dark'].includes(initial) ? initial : 'light');
  root.dataset.ready = 'true';
} catch (error) {
  const message = document.querySelector('#preview-error');
  message.textContent = '主题预览加载失败：' + error.message + '。请运行 npm run demo，并通过本地 HTTP 地址打开此页。';
  message.hidden = false;
}
