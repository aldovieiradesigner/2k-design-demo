/* Local, reversible ink changes. All text remains real selectable HTML. */
(() => {
'use strict';
const selectors='h1,h2,h3,.about-lead,.about-fact strong,.contact-cta>span,.marquee-track>span';
const fine=matchMedia('(hover: hover) and (pointer: fine)');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let active=null,frame=0,point={x:0,y:0};
function attach(root=document){
 const groups=[...(root.matches?.(selectors)?[root]:[]),...root.querySelectorAll(selectors)];
 groups.forEach(group=>{
  if(group.querySelector('.text-ink'))return;
  const walker=document.createTreeWalker(group,NodeFilter.SHOW_TEXT,{acceptNode(node){
   if(!node.textContent.trim()||node.parentElement.closest('[aria-hidden="true"],script,style,.text-ink'))return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  if(!nodes.length)return;
  group.dataset.inkGroup='';
  nodes.forEach(node=>{
   const style=getComputedStyle(node.parentElement);
   const color=style.color;
   const strokeColor=style.webkitTextStrokeColor||color;
   const outlined=parseFloat(style.webkitTextStrokeWidth)>0&&(style.webkitTextFillColor==='transparent'||style.color==='rgba(0, 0, 0, 0)');
   const inkColor=outlined?strokeColor:color;
   const rgb=inkColor.match(/[\d.]+/g)?.map(Number)||[240,240,240];
   const red=rgb[0]>140&&rgb[0]>rgb[1]*1.6&&rgb[1]<140;
   const fontSize=parseFloat(style.fontSize)||30;
   const fragment=document.createDocumentFragment();
   node.textContent.split(/(\s+)/).forEach(text=>{
    if(!text.trim()){fragment.appendChild(document.createTextNode(text));return}
    const token=document.createElement('span');token.className=`text-ink ${red?'ink-red':'ink-light'}${outlined?' ink-original-outline':''}`;
    token.style.setProperty('--ink-color',inkColor);
    token.style.setProperty('--ink-active-color',outlined&&rgb[0]>150?'var(--red)':inkColor);
    token.style.setProperty('--ink-stroke',`${Math.max(.6,Math.min(1.25,fontSize/72))}px`);
    token.style.setProperty('--ink-radius',`${Math.max(70,Math.min(165,fontSize*1.8))}px`);
    const base=document.createElement('span');base.className='ink-base';base.textContent=text;
    const flip=document.createElement('span');flip.className='ink-flip';flip.setAttribute('aria-hidden','true');flip.textContent=text;
    token.append(base,flip);fragment.appendChild(token);
   });
   node.replaceWith(fragment);
  });
 });
}
function reset(){if(active){active.classList.remove('ink-hover');active=null}cancelAnimationFrame(frame);frame=0;}
function render(){
 frame=0;if(!active)return;
 active.querySelectorAll('.text-ink').forEach(token=>{
  const rect=token.getBoundingClientRect();
  token.style.setProperty('--ink-x',`${point.x-rect.left}px`);
  token.style.setProperty('--ink-y',`${point.y-rect.top}px`);
 });
}
document.addEventListener('pointermove',event=>{
 if(!fine.matches||reduced.matches){reset();return}
 const group=event.target.closest('[data-ink-group]');
 if(group!==active){reset();active=group;if(active)active.classList.add('ink-hover')}
 if(!active)return;
 point.x=event.clientX;point.y=event.clientY;
 if(!frame)frame=requestAnimationFrame(render);
},{passive:true});
document.addEventListener('pointerleave',reset);
window.addEventListener('scroll',reset,{passive:true});
fine.addEventListener('change',reset);reduced.addEventListener('change',reset);
window.k2TextEffects={attach};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>attach(),{once:true});else attach();
})();
