export * from '../habits/obsidian-fixture.mjs';
import {Component} from '../habits/obsidian-fixture.mjs';
import actualMoment from 'moment';
export {actualMoment as moment};
export class ButtonComponent {
  constructor(root) { this.buttonEl=root.createEl('button'); }
  setIcon(icon) { this.buttonEl.dataset.icon=icon; return this; }
  setButtonText(text) {this.buttonEl.textContent=text;return this;}
  setTooltip(text) {this.buttonEl.title=text;return this;}
  setCta(){return this;}
  onClick(callback){this.buttonEl.addEventListener('click',callback);return this;}
}
export class ExtraButtonComponent extends ButtonComponent {}
export class DropdownComponent {
  constructor(root){this.selectEl=root.createEl('select');}
  addOption(value,label){const option=this.selectEl.createEl('option',{text:label});option.value=value;return this;}
  setValue(value){this.selectEl.value=value;return this;}
  onChange(callback){this.selectEl.addEventListener('change',()=>callback(this.selectEl.value));return this;}
}
export class ItemView extends Component { constructor(leaf){super();this.leaf=leaf;} }
export class SearchComponent {
  constructor(root){this.inputEl=root.createEl('input');}
  setPlaceholder(value){this.inputEl.placeholder=value;return this;}
  setValue(value){this.inputEl.value=value;return this;}
  onChange(callback){this.inputEl.addEventListener('input',()=>callback(this.inputEl.value));return this;}
}
export class Scope { register(){} }
export function setTooltip() {}
export const Platform={isMobile:false,isPhone:false,isDesktopApp:true};
export const debounce=(callback,delay)=>{
  let timer;
  const debounced=function(...args){clearTimeout(timer);timer=setTimeout(()=>callback.apply(this,args),delay);};
  debounced.cancel=()=>clearTimeout(timer);
  return debounced;
};
export class StubComponent extends Component {
  constructor(...args){super();this.element=document.createElement('div');this.containerEl=this.element;this.task=args[0];}
  load(){}
  setTasks(){}
  updateTasks(){}
  setViewMode(){}
  setIsTreeView(){}
  setTopNavigation(){}
  setActiveProject(){}
  refresh(){}
  destroy(){this.element.remove();}
}

export class Modal extends Component {
  constructor(app){super();this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.modalEl.createDiv({cls:'modal-header-button'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});}
  setTitle(value){this.titleEl ||= this.modalEl.createEl("h2");this.titleEl.textContent=value;return this;}
  open(){this.onOpen?.();return this;}
  close(){this.onClose?.();this.containerEl.remove();}
}
