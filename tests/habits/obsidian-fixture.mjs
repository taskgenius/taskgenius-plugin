export class Events {
  handlers = new Map();
  on(name, callback) { const list = this.handlers.get(name) ?? new Set(); list.add(callback); this.handlers.set(name, list); return {emitter: this, name, callback}; }
  offref(ref) { this.handlers.get(ref.name)?.delete(ref.callback); }
  trigger(name, ...args) { for (const callback of this.handlers.get(name) ?? []) callback(...args); }
}
export class Component {
  children = []; cleanups = [];
  addChild(child) { this.children.push(child); child.onload?.(); return child; }
  removeChild(child) { child.unload(); this.children = this.children.filter(value => value !== child); }
  register(callback) { this.cleanups.push(callback); }
  registerEvent(ref) { this.register(() => ref?.emitter?.offref(ref)); }
  registerInterval(id) { this.register(() => clearInterval(id)); }
  registerDomEvent(el, name, callback) { el.addEventListener(name, callback); this.register(() => el.removeEventListener(name, callback)); }
  unload() { this.onunload?.(); this.children.forEach(child => child.unload()); this.children = []; this.cleanups.splice(0).forEach(callback => callback()); }
}
export class Plugin extends Component {
  blocks = new Map(); commands = []; views = new Map();
  constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
  addSettingTab() {}
  addCommand(command) { this.commands.push(command); }
  addRibbonIcon() {}
  registerHoverLinkSource() {}
  registerEditorSuggest() {}
  registerMarkdownCodeBlockProcessor(language, callback) { if (this.blocks.has(language)) throw new Error(`Duplicate block: ${language}`); this.blocks.set(language, callback); return callback; }
  registerView(type, callback) { this.views.set(type, callback); }
}
export class TFile { constructor(path) { this.path = path; this.extension = path.split('.').pop(); this.basename = path.split('/').pop().replace(/\.md$/, ''); } }
export class TFolder { constructor(path) { this.path = path; this.children = []; } }
export class App {}
export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
export class Modal extends Component { constructor(app) { super(); this.app = app; this.modalEl = {addClass() {}}; this.contentEl = {empty(){}, win:{removeEventListener(){}}}; } close() { this.onClose?.(); } }
export class SuggestModal extends Modal {}
export class FuzzySuggestModal extends Modal {}
export class EditorSuggest extends Component {}
export class AbstractInputSuggest extends Component {}
export class ButtonComponent {}
export class ColorComponent {}
export class ItemView extends Component { constructor(leaf) { super(); this.leaf = leaf; } }
export class MarkdownRenderChild extends Component { constructor(containerEl) { super(); this.containerEl = containerEl; } }
export class Setting {
  constructor(root) {
    this.settingEl=root.createDiv({cls:'setting-item'});
    this.infoEl=this.settingEl.createDiv({cls:'setting-item-info'});
    this.nameEl=this.infoEl.createDiv({cls:'setting-item-name'});
    this.descEl=this.infoEl.createDiv({cls:'setting-item-description'});
    this.controlEl=this.settingEl.createDiv({cls:'setting-item-control'});
  }
  setName(value) { this.nameEl.textContent=value; return this; }
  setDesc(value) { this.descEl.textContent=value; return this; }
  setHeading() { this.settingEl.classList.add('setting-item-heading'); return this; }
  addControl(type, callback) {
    const element=this.controlEl.createEl(type==='dropdown'?'select':type==='button'?'button':'input');
    if (type==='toggle') element.type='checkbox';
    const component={inputEl:element,buttonEl:element,selectEl:element,
      setValue(value) { if(type==='toggle') element.checked=value; else element.value=value; return this; },
      setPlaceholder(value) {element.placeholder=value;return this;},
      setButtonText(value) {element.textContent=value;return this;},
      setCta() {return this;},
      onChange(fn) {element.addEventListener(type==='text'?'input':'change',()=>{ const promise=fn(type==='toggle'?element.checked:element.value); globalThis.lastSettingSave=promise; });return this;},
      onClick(fn) {element.addEventListener('click',fn);return this;},
      addOption(value,label) {const option=element.createEl('option',{text:label});option.value=value;return this;},
    };
    callback(component); return this;
  }
  addText(callback) {return this.addControl('text',callback);}
  addToggle(callback) {return this.addControl('toggle',callback);}
  addDropdown(callback) {return this.addControl('dropdown',callback);}
  addButton(callback) {return this.addControl('button',callback);}
}
export class Notice { constructor(text) { globalThis.lastNotice = text; } }
export class Menu {}
export const moment = Object.assign(() => ({format: () => '2026-11-08'}), {locale: () => globalThis.testLanguage ?? 'en'});
export const debounce = callback => callback;
export const normalizePath = value => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
export const parseYaml = JSON.parse;
export const stringifyYaml = value => JSON.stringify(value, null, 2) + '\n';
export const setIcon = () => {};
export const setTooltip = () => {};
export const getIconIds = () => [];
export const getAllTags = () => [];
export const prepareFuzzySearch = () => () => null;
export const renderResults = () => {};
export const requestUrl = request => { if (globalThis.mockHabitRequest) return globalThis.mockHabitRequest(request); throw new Error('Network calls are forbidden in tests'); };
export const Platform = {isMobile: false};
export const MarkdownRenderer = {render: async () => {}};

export function vaultFixture() {
  const files = new Map(), text = new Map(), metadata = new Map();
  const vault = Object.assign(new Events(), {
    configDir: '.obsidian',
    getAbstractFileByPath: path => files.get(path) ?? null,
    getMarkdownFiles: () => [...files.values()].filter(file => file instanceof TFile),
    adapter: {exists: async path => text.has(path), read: async path => { if (!text.has(path)) throw new Error('Missing file'); return text.get(path); }},
    read: async file => text.get(file.path) ?? '',
    cachedRead: async file => text.get(file.path) ?? '',
    createFolder: async path => { const folder = new TFolder(path); files.set(path, folder); return folder; },
    create: async (path, content) => {
      if (files.has(path)) throw new Error(`File exists: ${path}`);
      const file = new TFile(path); files.set(path, file); text.set(path, content);
      const folder = files.get(path.slice(0, path.lastIndexOf('/'))); folder?.children?.push(file);
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      if (fm) metadata.set(path, {frontmatter: parseYaml(fm[1])});
      return file;
    },
    createBinary: async (path, content) => { files.set(path,new TFile(path)); text.set(path,content); },
    modify: async (file, content) => { text.set(file.path, content); },
    process: async (file, callback) => { text.set(file.path, callback(text.get(file.path) ?? '')); },
  });
  const app = {
    vault, metadataCache: Object.assign(new Events(), {getFileCache: file => metadata.get(file.path) ?? null}),
    workspace: Object.assign(new Events(), {onLayoutReady: callback => callback()}),
    plugins: {enabledPlugins: new Set()},
    fileManager: {processFrontMatter: async (file, callback) => {
      const cache = metadata.get(file.path) ?? {frontmatter: {}}; callback(cache.frontmatter); metadata.set(file.path, cache);
    }},
  };
  return {app, files, text, metadata};
}
