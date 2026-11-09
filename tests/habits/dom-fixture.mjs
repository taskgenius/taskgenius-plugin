/** Minimal Obsidian DOM extensions on a real jsdom document. */
export function installObsidianDom(window) {
  const proto=window.HTMLElement.prototype;
  window.Element.prototype.createSvg=function(tag,options={}){const child=this.ownerDocument.createElementNS('http://www.w3.org/2000/svg',tag);if(options.cls)child.setAttribute('class',options.cls);for(const[key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);this.append(child);return child;};
  window.SVGElement.prototype.empty=function(){this.replaceChildren();};

  Object.defineProperties(proto,{doc:{get(){return this.ownerDocument;}},win:{get(){return this.ownerDocument.defaultView;}}});
  proto.createEl=function(tag,options={},callback) {
    if(typeof options==='string') options={cls:options};
    const child=this.ownerDocument.createElement(tag);
    if(options.cls) child.className=Array.isArray(options.cls)?options.cls.join(' '):options.cls;
    if(options.text!==undefined) child.textContent=options.text;
    if(options.value!==undefined) child.value=options.value;
    if(options.type!==undefined) child.type=options.type;
    for(const [key,value] of Object.entries(options.attr??{})) child.setAttribute(key,value);
    this.append(child); callback?.(child); return child;
  };
  proto.createDiv=function(options,callback){return this.createEl('div',options,callback);};
  proto.createSpan=function(options,callback){return this.createEl('span',options,callback);};
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
