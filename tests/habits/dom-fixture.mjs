/** Minimal Obsidian DOM extensions on a real jsdom document. */
export function installObsidianDom(window) {
  const proto=window.HTMLElement.prototype;
  Object.defineProperties(proto,{doc:{get(){return this.ownerDocument;}},win:{get(){return this.ownerDocument.defaultView;}}});
  proto.createEl=function(tag,options={}) {
    if(typeof options==='string') options={cls:options};
    const child=this.ownerDocument.createElement(tag);
    if(options.cls) child.className=Array.isArray(options.cls)?options.cls.join(' '):options.cls;
    if(options.text!==undefined) child.textContent=options.text;
    for(const [key,value] of Object.entries(options.attr??{})) child.setAttribute(key,value);
    this.append(child); return child;
  };
  proto.createDiv=function(options){return this.createEl('div',options);};
  proto.createSpan=function(options){return this.createEl('span',options);};
  proto.empty=function(){this.replaceChildren();};
  proto.addClass=function(...names){this.classList.add(...names);};
  proto.addClasses=function(names){this.classList.add(...names);};
  proto.removeClass=function(...names){this.classList.remove(...names);};
  proto.toggleClass=function(name,enabled){this.classList.toggle(name,enabled);};
  proto.toggle=function(enabled){this.hidden=!enabled;};
  proto.show=function(){this.style.display="";};
  proto.hide=function(){this.style.display="none";};
  proto.isShown=function(){return this.style.display!=="none";};
  proto.setText=function(value){this.textContent=value;};
  proto.setCssProps=function(values){for(const [key,value]of Object.entries(values))this.style.setProperty(key,value);};
  proto.setAttr=function(key,value){this.setAttribute(key,value);};
  proto.onClickEvent=function(callback){this.addEventListener('click',callback);};
}
