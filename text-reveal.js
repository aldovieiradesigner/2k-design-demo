/* One entrance per text block; the ink interaction remains on the inner word. */
(() => {
'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const headings='main h1,main h2,main h3,.dialog-heading h2';
const details='.hero-meta>span,.hero-copy .eyebrow,main p,.section-label>span,main .text-link,.projects-bottom>.mono,.round-link,.process-step>.mono,.about-fact,.contact-cta,.contact-links>a,.contact-links>.mono,.hero-bottom>a,.hero-bottom>span,.dialog-heading p,.dialog-heading>.mono';
const pending=new Set();
let observer;
function finish(element){element.classList.add('is-entered','enter-done');pending.delete(element);observer?.unobserve(element)}
function enter(element){
 if(element.classList.contains('is-entered'))return;
 element.classList.add('is-entered');pending.delete(element);observer?.unobserve(element);
 setTimeout(()=>element.classList.add('enter-done'),1450);
}
function prepare(element,title){
 if(element.classList.contains('enter-ready')||!element.textContent.trim())return;
 // The block observer still reveals project images; text uses its own word masks.
 if(title){
  const tokens=[...element.querySelectorAll('.text-ink')];
  if(!tokens.length)return;
  tokens.forEach((token,index)=>{
   const mask=document.createElement('span');mask.className='reveal-word';
   token.before(mask);mask.append(token);
   token.style.setProperty('--enter-delay',`${Math.min(index*58,350)+(element.matches('h1')?120:0)}ms`);
  });
  element.classList.add('text-enter');
 }else{
  element.classList.add('copy-enter');
  const hero=element.closest('.hero');
  const delay=hero?(element.matches('.eyebrow')?60:element.matches('p')?410:element.matches('.text-link')?530:90):70;
  element.style.setProperty('--enter-delay',`${delay}ms`);
 }
 element.classList.add('enter-ready');
 if(reduced.matches){finish(element);return}
 pending.add(element);observer.observe(element);
}
function attach(root=document){
 const find=selector=>[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
 find(headings).forEach(element=>prepare(element,true));
 find(details).forEach(element=>prepare(element,false));
}
function start(){
 if(!('IntersectionObserver' in window))return;
 observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting)enter(entry.target)});
 },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
 attach();
 document.documentElement.classList.add('text-motion');
 // Keyboard navigation must never focus a control that is still concealed.
 document.addEventListener('focusin',event=>{
  const target=event.target.closest('.enter-ready');if(target)finish(target);
 });
 reduced.addEventListener('change',()=>{if(reduced.matches)[...pending].forEach(finish)});
 window.addEventListener('beforeprint',()=>[...pending].forEach(finish));
 // Restored browser history keeps its scroll position and already revealed text.
 window.addEventListener('pageshow',event=>{if(event.persisted&&reduced.matches)[...pending].forEach(finish)});
 window.k2TextReveal={attach};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
