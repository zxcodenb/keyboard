import './style.css';
import { createIcons, Keyboard as KeyboardIcon, SlidersHorizontal, Bookmark, ArrowUpRight, Check, ChevronRight, Plus, Sun, Wind, Waves, Palette, Power, RotateCcw, X, Usb, Sparkles, MousePointer2, ShieldCheck, RefreshCw, Trash2, CircleHelp } from 'lucide';
import { isMyGo } from 'mygo-runtime';
import { Keyboard, type Settings, type Snapshot, type Preset } from './mygo';
import { previewProfile } from './preview';

const native = isMyGo();
const icons = { Keyboard: KeyboardIcon, SlidersHorizontal, Bookmark, ArrowUpRight, Check, ChevronRight, Plus, Sun, Wind, Waves, Palette, Power, RotateCcw, X, Usb, Sparkles, MousePointer2, ShieldCheck, RefreshCw, Trash2, CircleHelp };
const icon = (name: string, extra = '') => `<i data-lucide="${name}" ${extra}></i>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const initial: Settings = { mode: 'solid', color: '#80e8c0', secondary: '#7e9bff', brightness: 70, speed: 45, power: true, overrides: {} };
let profile = previewProfile;
let keys = profile.keys;
let settings = structuredClone(initial);
let status: Snapshot = { profile, settings, controlled: false, connected: false, sending: false, message: '正在连接本地控制程序', presets: [] };
let presets: Preset[] = [];
let selected = new Set<number>();
let view = 'studio';
let error = '';
let timer: ReturnType<typeof setTimeout>;
let toastTimer: ReturnType<typeof setTimeout>;
let queue = Promise.resolve();
let revision = 0;
let busy = false;
let ready = !native;
let activePreset = 'mint';
const modes: Record<string, string> = { solid: '常亮', breathe: '呼吸', wave: '流光' };
const builtin = [
  { id: 'mint', name: '薄荷微光', description: '一抹清新，专注当下', color: '#80e8c0', secondary: '#7e9bff', mode: 'solid', tag: '日常', css: 'mint' },
  { id: 'sunset', name: '落日余温', description: '把黄昏留在指尖', color: '#ffc18c', secondary: '#ee8fac', mode: 'breathe', tag: '松弛', css: 'sunset' },
  { id: 'aurora', name: '极光漫游', description: '让灵感自由流动', color: '#80e8c0', secondary: '#ad90ff', mode: 'wave', tag: '灵感', css: 'aurora' },
  { id: 'night', name: '深夜蓝调', description: '安静陪伴每一个夜晚', color: '#91b8ff', secondary: '#8980de', mode: 'solid', tag: '夜间', css: 'night' },
];

$('#app').innerHTML = `
  <aside class="sidebar">
    <div class="window-drag"></div>
    <a class="brand" href="#" data-action="studio" aria-label="光序首页"><span class="brand-mark">${icon('waves')}</span><span><strong>光序</strong><small>你的桌面，另一种光</small></span></a>
    <div class="nav-caption">工作空间</div>
    <nav aria-label="主导航">
      <button class="nav-item active" data-action="studio">${icon('sliders-horizontal')}<span>灯光面板</span><span class="nav-dot"></span></button>
      <button class="nav-item" data-action="library">${icon('bookmark')}<span>我的预设</span><span class="nav-count">4</span></button>
    </nav>
    <div class="nav-caption device-caption">我的设备 <span>1</span></div>
    <div class="device-card"><div class="device-icon">${icon('keyboard')}</div><div><strong data-device-name></strong><span><b class="connection-dot"></b><span class="device-state">正在连接</span></span></div></div>
    <div class="sidebar-bottom">
      <div class="local-note">${icon('shield-check')}<div><strong>只属于你的工作空间</strong><p>本地运行 · 无需联网</p></div></div>
      <button class="help-button" data-action="help">${icon('circle-help')}<span>使用小贴士</span>${icon('arrow-up-right')}</button>
      <div class="sidebar-version"><span>光序</span><span>0.1.0</span></div>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div>工作空间 ${icon('chevron-right')} <span id="breadcrumb">灯光面板</span></div><span class="privacy-label">${icon('shield-check')} 为你的桌面而造</span></header>
    <main>
      <section class="page-heading"><div><div class="eyebrow">一点色彩，刚刚好</div><h1>灯光，随心而动<span>。</span></h1><p id="page-subtitle">让熟悉的键盘，拥有你的色彩。</p></div><div class="connection-pill"><b class="connection-dot"></b><span id="connection-label">正在连接</span></div></section>
      <div id="error-banner" role="alert" hidden><span></span><div class="error-actions"><button id="permission-button" data-action="permissions" hidden>打开输入监控 ${icon('arrow-up-right')}</button><button data-action="retry">重新连接 ${icon('refresh-cw')}</button></div></div>
      <div id="preview-banner" ${native ? 'hidden' : ''}>浏览器仅展示界面，不连接键盘。请打开「光序」桌面应用以控制灯光。</div>
      <section class="keyboard-card studio-only" aria-label="键盘灯光预览">
        <div class="keyboard-card-header"><div><span class="tiny-label">你的设备</span><h2 id="device-title"></h2></div><span class="transport"></span></div>
        <div class="keyboard-scene"><div class="ambient-glow"></div><div class="keyboard-case"><div class="keyboard-keys"></div><div class="case-brand"></div><div class="case-led"></div></div></div>
        <div class="keyboard-caption"><span class="live-pill"><b></b><span id="preview-label">灯光预览</span></span><span>${icon('mouse-pointer-2')} 点选按键，自由搭配颜色</span></div>
        <div class="scope-toolbar"><div class="scope-buttons" aria-label="选择键盘区域"><button class="active" data-scope="all">整个键盘</button></div><button class="selection-status" data-action="clear-selection">全键编辑 <span>·</span> 点击按键可多选</button></div>
      </section>
      <div class="controls-grid studio-only">
        <section class="control-card effects-card"><div class="card-title"><h2>${icon('sparkles')} 灯光效果</h2><span class="subtle-label">让光有自己的节奏</span></div><div class="effect-options" role="group" aria-label="灯光效果">${[['solid', 'sun', '常亮', '简单，亦是美'], ['breathe', 'wind', '呼吸', '像呼吸般自然'], ['wave', 'waves', '流光', '色彩缓缓流动']].map(([mode, glyph, title, desc]) => `<button class="effect-option" data-mode="${mode}" aria-pressed="false">${icon(glyph)}<strong>${title}</strong><small>${desc}</small><span class="effect-check">${icon('check')}</span></button>`).join('')}</div><div class="effect-bottom"><div id="solid-note">${icon('sun')} 恒定的光，恰到好处的陪伴。</div><label id="speed-control" hidden><span>变化速度</span><input type="range" id="speed" min="0" max="100" value="45" aria-label="变化速度"/><output id="speed-value">45%</output></label></div></section>
        <section class="control-card color-card"><div class="card-title"><h2>${icon('palette')} <span id="color-title">颜色与亮度</span></h2><button class="text-button" data-action="reset-keys" id="reset-keys" hidden>清除单键配色</button></div><div class="color-row"><div class="swatches" role="group" aria-label="快捷颜色">${['#80e8c0', '#91b8ff', '#b79af5', '#f1a4bc', '#ffc18c', '#f3e4a4', '#e8edef'].map(color => `<button class="swatch" data-color="${color}" style="--swatch:${color}" aria-label="选择颜色 ${color}">${icon('check')}</button>`).join('')}</div><label class="custom-color" title="自定义颜色">${icon('plus')}<input type="color" id="color-picker" value="#80e8c0" aria-label="自定义颜色"/></label></div><div class="color-detail"><label class="hex-field"><span id="hex-dot"></span><input id="hex-input" aria-label="十六进制颜色" value="#80E8C0" maxlength="7" spellcheck="false"/><span>HEX</span></label><span id="color-description">一抹清新薄荷绿</span><label class="secondary-color" id="secondary-control" hidden>另一种颜色<input type="color" id="secondary" value="#7e9bff" aria-label="流光第二种颜色"/></label></div><label class="brightness-control"><span>${icon('sun')} 亮度</span><input id="brightness" type="range" min="0" max="100" value="70" aria-label="灯光亮度"/><output id="brightness-value">70<span>%</span></output></label></section>
      </div>
      <section class="presets-section"><div class="section-heading"><div><h2 id="presets-title">从一束喜欢的光开始</h2><span id="presets-subtitle">为不同的心情，留一点色彩。</span></div><button class="save-button" data-action="save">${icon('plus')} 保存当前预设</button></div><div class="preset-grid" id="preset-grid"></div><div id="library-empty" hidden>${icon('bookmark')}<h3>收藏你自己的那束光</h3><p>调好颜色后，点击「保存当前预设」，下次一键点亮。</p></div></section>
      <div class="gentle-note studio-only">${icon('sparkles')} 好的氛围，从指尖开始。<span>修改即同步，无需额外应用。</span></div>
    </main>
    <footer class="statusbar"><div><span class="footer-dot"></span><span id="sync-status">正在连接控制程序</span><small id="status-detail">设置仅保存在本机</small></div><div class="footer-actions"><button class="restore-button" data-action="release">${icon('rotate-ccw')} 恢复键盘自带灯效</button><button class="power-button" data-action="power">${icon('power')}<span>开启灯光</span></button></div></footer>
  </div>
  <dialog id="preset-dialog"><form id="preset-form"><div class="dialog-heading"><span class="dialog-icon">${icon('bookmark')}</span><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('x')}</button></div><h2>留住这一刻的色彩</h2><p>给你的灯光起个名字，下次一键找回。</p><label for="preset-name">预设名称</label><input id="preset-name" maxlength="24" placeholder="例如：我的专注时刻" required autocomplete="off"/><div class="dialog-actions"><button type="button" data-action="close-dialog">取消</button><button class="primary-button" type="submit">保存预设 ${icon('check')}</button></div></form></dialog>
  <dialog id="help-dialog"><div class="dialog-heading"><span class="dialog-icon">${icon('sparkles')}</span><button class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('x')}</button></div><h2>让每一束光，恰到好处</h2><div class="help-list"><p><strong>点选，就是你的调色板</strong>点击键帽可多选，再选择颜色；点击「整个键盘」恢复全键编辑。单键配色会覆盖灯效基础色。</p><p><strong>关灯，不等于停止控制</strong>「关闭灯光」持续发送黑色；「恢复键盘自带灯效」停止发送，让键盘自行接管。</p><p><strong>关掉窗口，光也会留下</strong>关闭窗口后程序继续运行，点击程序坞图标重新打开。按 ⌘Q 退出后恢复键盘自带灯效。</p><p id="device-note"></p></div></dialog>
  <div id="toast" role="status" hidden>${icon('check')}<span></span></div>
`;

function refreshIcons() { createIcons({ icons, attrs: { 'stroke-width': 1.7 } }); }
function notify(text: string) {
  clearTimeout(toastTimer);
  $('#toast span').textContent = text;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => $('#toast').hidden = true, 2600);
}
function setError(value: string) {
  error = value;
  $('#error-banner').hidden = !value;
  $('#error-banner > span').textContent = value;
  refreshStatus();
}
function refreshStatus() {
  const deviceError = status.message.startsWith('设备访问失败') ? status.message : '';
  $('#error-banner').hidden = !(error || deviceError);
  $('#permission-button').hidden = !deviceError;
  $('#error-banner > span').textContent = error || deviceError;
  const connected = native && status.connected && !error;
  document.body.classList.toggle('connected', connected);
  document.body.classList.toggle('sending', connected && status.sending && settings.power);
  $('.device-state').textContent = connected ? '设备已连接' : native ? '未连接' : '界面预览';
  $('#connection-label').textContent = connected ? '设备已连接' : native ? '等待设备连接' : '仅界面预览';
  $('#sync-status').textContent = error ? '连接异常' : !native ? '预览模式 · 不控制设备' : busy ? '正在同步灯光…' : deviceError ? '设备访问失败，请检查权限' : status.message;
  $('#status-detail').textContent = status.controlled ? '关闭窗口后，灯光继续保持' : '设置仅保存在本机';
  $('.power-button span').textContent = status.controlled && settings.power ? '关闭灯光' : '开启灯光';
  $('.power-button').classList.toggle('is-on', status.controlled && settings.power);
  $('#preview-label').textContent = connected && status.sending ? settings.power ? `${modes[settings.mode]} · 持续同步` : '灯光已关闭' : '灯光效果预览';
  for (const button of document.querySelectorAll<HTMLButtonElement>('.power-button, .restore-button, .save-button')) button.disabled = !ready;
}
function editingColor() { const first = selected.values().next().value; return first !== undefined ? settings.overrides[first] || settings.color : settings.color; }
function refreshControls() {
  const color = editingColor();
  for (const button of document.querySelectorAll<HTMLElement>('[data-mode]')) {
    const active = button.dataset.mode === settings.mode;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-color]')) {
    const active = button.dataset.color === color.toLowerCase();
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  $('#hex-dot').style.background = color;
  if (document.activeElement !== $('#hex-input')) $<HTMLInputElement>('#hex-input').value = color.toUpperCase();
  $<HTMLInputElement>('#color-picker').value = color;
  $<HTMLInputElement>('#secondary').value = settings.secondary;
  $<HTMLInputElement>('#brightness').value = String(settings.brightness);
  $<HTMLInputElement>('#speed').value = String(settings.speed);
  $('#brightness-value').innerHTML = `${settings.brightness}<span>%</span>`;
  $('#speed-value').textContent = `${settings.speed}%`;
  $('#brightness').style.setProperty('--fill', `${settings.brightness}%`);
  $('#speed').style.setProperty('--fill', `${settings.speed}%`);
  $('#solid-note').hidden = settings.mode !== 'solid';
  $('#speed-control').hidden = settings.mode === 'solid';
  $('#secondary-control').hidden = settings.mode !== 'wave';
  $('#color-description').hidden = settings.mode === 'wave';
  $('#color-description').textContent = color.toLowerCase() === '#80e8c0' ? '一抹清新薄荷绿' : selected.size ? '为选中的按键上色' : '你的专属色彩';
  $('#color-title').textContent = selected.size ? `单键颜色 · 已选 ${selected.size} 键` : '颜色与亮度';
  $('#reset-keys').hidden = Object.keys(settings.overrides).length === 0;
  $('.selection-status').innerHTML = selected.size ? `已选 ${selected.size} 个按键 <span>·</span> 取消选择 ×` : '全键编辑 <span>·</span> 点击按键可多选';
  for (const button of document.querySelectorAll<HTMLElement>('[data-key]')) {
    const active = selected.has(Number(button.dataset.key));
    button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-scope]')) button.classList.toggle('active', button.dataset.scope === 'all' && selected.size === 0);
  for (const button of document.querySelectorAll<HTMLElement>('[data-preset]')) button.classList.toggle('active', button.dataset.preset === activePreset);
  refreshStatus();
}
function renderPresets() {
  $('#preset-grid').innerHTML = builtin.map(p => `<button class="preset-card ${p.css}" data-preset="${p.id}"><div class="preset-art"><span class="preset-tag">${p.tag}</span><div class="mini-keys">${Array.from({ length: 20 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div><span class="preset-check">${icon('check')}</span></div><div class="preset-info"><strong>${p.name}</strong><small>${p.description}</small></div></button>`).join('') + presets.map(p => `<div class="saved-preset-wrap"><button class="preset-card custom-preset" data-preset="${escape(p.id)}" style="--preset-color:${p.settings.color};--preset-second:${p.settings.secondary}"><div class="preset-art"><span class="preset-tag">${modes[p.settings.mode]}</span><div class="mini-keys">${Array.from({ length: 20 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div><span class="preset-check">${icon('check')}</span></div><div class="preset-info"><strong>${escape(p.name)}</strong><small>我的配色 · ${p.settings.brightness}% 亮度</small></div></button><button class="delete-preset" data-delete="${escape(p.id)}" title="删除预设" aria-label="删除预设 ${escape(p.name)}">${icon('trash-2')}</button></div>`).join('');
  $('.nav-count').textContent = String(4 + presets.length);
  $('#library-empty').hidden = view !== 'library' || presets.length > 0;
  refreshIcons(); refreshControls();
}
function accept(snapshot: Snapshot) {
  status = snapshot; presets = snapshot.presets || [];
  if (!ready || snapshot.profile.id !== profile.id) {
    profile = snapshot.profile; keys = profile.keys; selected.clear(); renderProfile();
  }
  setError('');
}
function enqueue(operation: () => Promise<void>) {
  queue = queue.then(async () => {
    busy = true; refreshStatus();
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { busy = false; refreshStatus(); }
  });
  return queue;
}
function changed() {
  activePreset = '';
  refreshControls();
  if (!ready) return;
  if (!native) { $('#sync-status').textContent = '预览模式 · 不控制设备'; return; }
  const current = ++revision;
  clearTimeout(timer);
  timer = setTimeout(() => enqueue(async () => {
    if (current !== revision) return;
    accept(await Keyboard.apply(structuredClone(settings)));
  }), 140);
}
function changeColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  if (selected.size) for (const index of selected) settings.overrides[index] = color;
  else { settings.color = color; settings.overrides = {}; }
  changed();
}
function setView(next: string) {
  view = next;
  document.body.classList.toggle('library-view', view === 'library');
  $('#breadcrumb').textContent = view === 'library' ? '我的预设' : '灯光面板';
  $('h1').innerHTML = view === 'library' ? '把喜欢的光，留在手边<span>。</span>' : '灯光，随心而动<span>。</span>';
  $('#page-subtitle').textContent = view === 'library' ? '收藏每一种心情，下次见面，一键点亮。' : '让熟悉的键盘，拥有你的色彩。';
  $('#presets-title').textContent = view === 'library' ? '你的灯光收藏' : '从一束喜欢的光开始';
  for (const el of document.querySelectorAll<HTMLElement>('.nav-item')) el.classList.toggle('active', el.dataset.action === view);
  $('#library-empty').hidden = view !== 'library' || presets.length > 0;
  $('main').scrollTop = 0;
}
async function connect() {
  if (!native) return;
  try {
    const result = await Keyboard.snapshot();
    settings = structuredClone(result.settings); accept(result); ready = true;
    activePreset = ''; renderPresets();
  } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
}

document.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button, a[data-action]');
  if (!target || target.matches('[type=submit]')) return;
  event.preventDefault();
  if ('key' in target.dataset) {
    const index = Number(target.dataset.key);
    selected.has(index) ? selected.delete(index) : selected.add(index);
    refreshControls();
  } else if (target.dataset.scope) {
    const scope = target.dataset.scope;
    selected = new Set(scope === 'all' ? [] : keys.filter(k => k.group === scope).map(k => k.index));
    refreshControls(); target.classList.add('active');
  } else if (target.dataset.mode) { settings.mode = target.dataset.mode; changed(); }
  else if (target.dataset.color) changeColor(target.dataset.color);
  else if (target.dataset.preset) {
    const id = target.dataset.preset;
    const p = builtin.find(p => p.id === id);
    if (p) settings = { ...structuredClone(initial), color: p.color, secondary: p.secondary, mode: p.mode, brightness: p.id === 'night' ? 40 : 70 };
    else { const saved = presets.find(p => p.id === id); if (!saved) return; settings = structuredClone(saved.settings); }
    selected.clear(); changed(); activePreset = id; refreshControls();
    notify(native ? '已选择预设，正在同步' : '已预览配色');
  } else if (target.dataset.delete) {
    enqueue(async () => { accept(await Keyboard.deletePreset(target.dataset.delete!)); renderPresets(); notify('预设已删除'); });
  } else switch (target.dataset.action) {
    case 'studio': case 'library': setView(target.dataset.action); break;
    case 'clear-selection': selected.clear(); refreshControls(); break;
    case 'reset-keys': settings.overrides = {}; changed(); notify('已恢复全键配色'); break;
    case 'power': settings.power = !(status.controlled && settings.power); changed(); break;
    case 'release':
      clearTimeout(timer); revision++;
      if (!native) { notify('桌面应用中可恢复键盘自带灯效'); break; }
      enqueue(async () => { accept(await Keyboard.release()); refreshControls(); notify('已停止发送，键盘将恢复自带灯效'); }); break;
    case 'save':
      if (!native) { notify('请在桌面应用中保存预设'); break; }
      $<HTMLDialogElement>('#preset-dialog').showModal(); $<HTMLInputElement>('#preset-name').focus(); break;
    case 'help': $<HTMLDialogElement>('#help-dialog').showModal(); break;
    case 'close-dialog': target.closest('dialog')?.close(); break;
    case 'retry': void connect(); break;
    case 'permissions': enqueue(async () => { await Keyboard.openPermissions(); }); break;
  }
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
$('#brightness').addEventListener('input', event => { settings.brightness = Number((event.target as HTMLInputElement).value); changed(); });
$('#speed').addEventListener('input', event => { settings.speed = Number((event.target as HTMLInputElement).value); changed(); });
$('#color-picker').addEventListener('input', event => changeColor((event.target as HTMLInputElement).value));
$('#secondary').addEventListener('input', event => { settings.secondary = (event.target as HTMLInputElement).value; changed(); });
$('#hex-input').addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  const color = '#' + input.value.replace(/^#/, '');
  if (/^#[0-9a-f]{6}$/i.test(color)) { input.value = color.toUpperCase(); changeColor(color.toLowerCase()); }
  else { input.value = editingColor().toUpperCase(); notify('请输入六位十六进制颜色，例如 #80E8C0'); }
});
$('#preset-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $<HTMLInputElement>('#preset-name').value.trim();
  if (!name) { notify('请为预设起一个名字'); return; }
  const copy = structuredClone(settings);
  const submit = $<HTMLButtonElement>('#preset-form [type=submit]'); submit.disabled = true;
  enqueue(async () => {
    try { accept(await Keyboard.savePreset(name, copy)); renderPresets(); $<HTMLDialogElement>('#preset-dialog').close(); $<HTMLInputElement>('#preset-name').value = ''; notify('预设已保存在本机'); }
    finally { submit.disabled = false; }
  });
});

// 预览使用键盘档案提供的位置；不将屏幕动画频率用于硬件发送。
let keyElements: HTMLElement[] = [];
function renderProfile() {
  $('[data-device-name]').textContent = profile.name;
  $('#device-title').innerHTML = `${escape(profile.name)} <span>${escape(profile.description)}</span>`;
  $('.transport').innerHTML = `${icon('usb')} ${escape(profile.connection)}`;
  $('.case-brand').innerHTML = `${escape(profile.brand)} <span>${escape(profile.brandName)}</span>`;
  $('#device-note').innerHTML = `<strong>设备适配说明</strong>${escape(profile.note)}`;
  const positions = new Map(profile.leds.map(led => [led.index, led.position]));
  $('.keyboard-keys').style.aspectRatio = `${profile.width} / ${profile.displayHeight}`;
  $('.keyboard-keys').innerHTML = keys.map(k => `<button class="keycap${k.name === 'space' ? ' space-key' : ''}" data-key="${k.index}" data-position="${positions.get(k.index) ?? 0}" aria-label="${escape(k.name)}，灯珠 ${k.index}" aria-pressed="false" title="${escape(k.name)} · 索引 ${k.index}${k.note ? `（${escape(k.note)}）` : ''}" style="left:${k.x / profile.width * 100}%;top:${k.y / profile.height * 100}%;width:${k.w / profile.width * 100}%;height:${k.h / profile.height * 100}%"><span>${escape(k.label)}</span></button>`).join('');
  $('.scope-buttons').innerHTML = `<button class="active" data-scope="all">整个键盘</button>${profile.groups.map(group => `<button data-scope="${escape(group.id)}">${escape(group.name)}</button>`).join('')}`;
  keyElements = [...document.querySelectorAll<HTMLElement>('[data-key]')];
  refreshIcons();
}
let started = performance.now();
function paint() {
  if (document.hidden || view !== 'studio') return;
  const elapsed = (performance.now() - started) / 1000;
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(settings.color), b = rgb(settings.secondary);
  const period = 8 - settings.speed * .06;
  let level = settings.power ? settings.brightness / 100 : 0;
  if (settings.mode === 'breathe') level *= .15 + .85 * (1 - Math.cos(elapsed / period * Math.PI * 2)) / 2;
  for (const element of keyElements) {
    const index = Number(element.dataset.key);
    const mix = settings.mode === 'wave' ? Math.round((Math.sin(Number(element.dataset.position) * Math.PI * 2 - elapsed / period * Math.PI * 2) + 1) * 3.5) / 7 : 0;
    const color = settings.overrides[index] ? rgb(settings.overrides[index]) : a.map((v, i) => Math.round(v + (b[i] - v) * mix));
    element.style.setProperty('--key-color', color.map(c => Math.round(c * level)).join(' '));
  }
  $('.ambient-glow').style.opacity = String(level * .52);
  $('.ambient-glow').style.background = `radial-gradient(ellipse, ${settings.color}, transparent 68%)`;
}
renderProfile(); renderPresets(); refreshIcons(); refreshStatus(); paint();
void connect();
setInterval(paint, 80);
let polling = false;
setInterval(async () => {
  if (!native || busy || polling || !ready) return;
  polling = true;
  try { const snapshot = await Keyboard.snapshot(); accept(snapshot); }
  catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  finally { polling = false; }
}, 1800);
