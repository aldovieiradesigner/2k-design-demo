(() => {
'use strict';
document.documentElement.classList.add('js');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const q = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const header = q('.site-header');
const cursor = q('.cursor');
const menuToggle = q('.menu-toggle');
const menu = q('#mobile-menu');
let returnFocus = null;
let projects = [];

q('#year').textContent = new Date().getFullYear();

function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  menu.inert = !open;
  document.body.classList.toggle('menu-open', open);
  if (open) menu.querySelector('a').focus();
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {setMenu(false);menuToggle.focus();}
  if (e.key === 'Tab' && document.body.classList.contains('menu-open')) {
    const links = [menuToggle,...menu.querySelectorAll('a')];
    const first = links[0],last = links[links.length-1];
    if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();}
    if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
  }
});
window.matchMedia('(min-width: 761px)').addEventListener('change', e => {if(e.matches)setMenu(false)});

const revealObserver = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) {e.target.classList.add('in-view');revealObserver.unobserve(e.target);}
}), {threshold:.06, rootMargin:'0px 0px -25px'});
function reveal() {all('.reveal:not(.in-view)').forEach(el=>revealObserver.observe(el));}
reveal();

const manifesto = q('.word-reveal');
const originalChildren = [...manifesto.childNodes];
originalChildren.forEach(node => {
 if (node.nodeType === Node.TEXT_NODE) {
   const frag=document.createDocumentFragment();
   node.textContent.split(/(\s+)/).forEach(t=>{if(t.trim()){const s=document.createElement('span');s.className='word unlit';s.textContent=t;frag.appendChild(s)}else frag.appendChild(document.createTextNode(t))});
   node.replaceWith(frag);
 } else if(node.nodeType === Node.ELEMENT_NODE){node.classList.add('word','unlit')}
});
const words=[...manifesto.querySelectorAll('.word')];
const steps=all('.process-step');
const heroSequence=q('.hero-sequence');
const heroSection=q('.hero');
const heroTitle=q('#hero-title');
const pinnedScene=window.matchMedia('(min-width: 761px)');
let sceneProgress=0;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
function updateHeroScene(){
 const r=heroSequence.getBoundingClientRect();
 const travel=Math.max(1,heroSequence.offsetHeight-heroSection.offsetHeight);
 const pinned=pinnedScene.matches&&!reduced.matches;
 sceneProgress=reduced.matches?0:pinned?clamp(-r.top/(travel+heroSection.offsetHeight)):clamp(-r.top/heroSection.offsetHeight)*.35;
 const fade=pinned?1-smooth(.06,.48,sceneProgress):1;
 ['.hero-copy','.hero-bottom'].forEach(selector=>{const element=heroSection.querySelector(selector);element.inert=fade<.05;element.style.pointerEvents=fade<.05?'none':'';});
 heroSequence.style.setProperty('--scene-progress',sceneProgress.toFixed(4));
 heroSequence.style.setProperty('--copy-opacity',fade.toFixed(3));
 heroSequence.style.setProperty('--copy-y',`${pinned?-45*smooth(.04,.5,sceneProgress):0}px`);
 heroSequence.style.setProperty('--stage-shift',`${pinned?-Math.min(innerWidth*.17,260)*smooth(.12,.86,sceneProgress):0}px`);
 heroSequence.style.setProperty('--stage-opacity',String(pinned?1-smooth(.83,1,sceneProgress):1));
 heroSequence.style.setProperty('--scene-glow',String(pinned?Math.sin(sceneProgress*Math.PI)*.8:0));
 window.k2Stage?.setProgress(sceneProgress);
}
let scrollFrame=0;
function updateScroll() {
 scrollFrame=0;
 const y=window.scrollY, max=document.documentElement.scrollHeight-window.innerHeight;
 q('.scroll-progress').style.width=`${max>0?y/max*100:0}%`;
 header.classList.toggle('scrolled',y>35);
 updateHeroScene();
 const r=manifesto.getBoundingClientRect();
 const progress=Math.min(1,Math.max(0,(window.innerHeight*.86-r.top)/(window.innerHeight*.5+r.height*.3)));
 words.forEach((w,i)=>w.classList.toggle('unlit',!reduced.matches && i/words.length>progress));
 let active=0;
 steps.forEach((s,i)=>{const b=s.getBoundingClientRect();if(b.top<window.innerHeight*.6)active=i;});
 steps.forEach((s,i)=>s.classList.toggle('active',i===active));
 q('.process-art').style.setProperty('--phase',String(active));
}
function requestScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll)}
window.addEventListener('scroll',requestScroll,{passive:true});
window.addEventListener('resize',requestScroll,{passive:true});
reduced.addEventListener('change',updateScroll);
updateScroll();

let mouseX=0,mouseY=0,cursorFrame=0;
function updateCursor(){cursorFrame=0;cursor.style.transform=`translate3d(${mouseX}px,${mouseY}px,0)`;}
document.addEventListener('pointermove',e=>{
 if(!fine.matches||reduced.matches)return;
 mouseX=e.clientX;mouseY=e.clientY;cursor.style.opacity='1';
 if(!cursorFrame)cursorFrame=requestAnimationFrame(updateCursor);
 const project=e.target.closest('.project-trigger');
 cursor.classList.toggle('project-hover',!!project);
 cursor.classList.toggle('link-hover',!project&&!!e.target.closest('a,button,summary'));
},{passive:true});
document.addEventListener('pointerleave',()=>cursor.style.opacity='0');
// The headline follows the light with a small amount of parallax.
const titleTarget={x:0,y:0,alpha:0,px:-500,py:-500};
const titleCurrent={x:0,y:0,alpha:0,px:-500,py:-500};
let titleFrame=0,touchLightTimer=0;
function drawTitle(){
 titleFrame=0;
 const k=reduced.matches?1:.2;
 ['x','y','alpha','px','py'].forEach(key=>titleCurrent[key]+=(titleTarget[key]-titleCurrent[key])*k);
 const move=fine.matches&&!reduced.matches;
 heroTitle.style.setProperty('--title-x',`${move?titleCurrent.x*9:0}px`);
 heroTitle.style.setProperty('--title-y',`${move?titleCurrent.y*6:0}px`);
 heroTitle.style.setProperty('--title-rx',`${move?-titleCurrent.y*3:0}deg`);
 heroTitle.style.setProperty('--title-ry',`${move?titleCurrent.x*3.5:0}deg`);
 let distance=0;['x','y','alpha'].forEach(key=>distance+=Math.abs(titleTarget[key]-titleCurrent[key]));
 distance+=Math.abs(titleTarget.px-titleCurrent.px)*.005+Math.abs(titleTarget.py-titleCurrent.py)*.005;
 if(distance>.002)requestTitle();
}
function requestTitle(){if(!titleFrame)titleFrame=requestAnimationFrame(drawTitle)}
function moveTitle(e,touch=false){
 if(reduced.matches||(!fine.matches&&!touch)||sceneProgress>.65)return;
 const r=heroSection.getBoundingClientRect();
 titleTarget.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);
 titleTarget.y=clamp((e.clientY-r.top)/Math.min(r.height,innerHeight)*2-1,-1,1);
 titleTarget.px=e.clientX;titleTarget.py=e.clientY;titleTarget.alpha=1;
 if(!titleCurrent.alpha){titleCurrent.px=e.clientX;titleCurrent.py=e.clientY}
 q('.coord').textContent=`X ${titleTarget.x.toFixed(2)} / Y ${(-titleTarget.y).toFixed(2)}`;
 requestTitle();
}
heroSection.addEventListener('pointermove',e=>moveTitle(e),{passive:true});
heroSection.addEventListener('pointerdown',e=>{
 if(fine.matches)return;
 moveTitle(e,true);clearTimeout(touchLightTimer);
 touchLightTimer=setTimeout(()=>{titleTarget.alpha=0;requestTitle()},1100);
},{passive:true});
heroSection.addEventListener('pointerleave',()=>{titleTarget.x=0;titleTarget.y=0;titleTarget.alpha=0;requestTitle()},{passive:true});
reduced.addEventListener('change',()=>{titleTarget.x=0;titleTarget.y=0;titleTarget.alpha=0;requestTitle()});
q('.contact').addEventListener('pointermove',e=>{
 if(!fine.matches||reduced.matches)return;
 const r=e.currentTarget.getBoundingClientRect();
 e.currentTarget.style.setProperty('--cx',`${e.clientX-r.left}px`);
 e.currentTarget.style.setProperty('--cy',`${e.clientY-r.top}px`);
},{passive:true});
all('.magnetic').forEach(el=>{
 el.addEventListener('pointermove',e=>{
  if(!fine.matches||reduced.matches)return;
  const r=el.getBoundingClientRect();
  const x=(e.clientX-r.left-r.width/2)*.09,y=(e.clientY-r.top-r.height/2)*.12;
  el.style.transform=`translate(${x}px,${y}px)`;
 },{passive:true});
 el.addEventListener('pointerleave',()=>el.style.transform='');
});
all('.service').forEach(service=>service.addEventListener('toggle',()=>{
 if(service.open)all('.service').forEach(s=>{if(s!==service)s.open=false});
}));

const dialog=q('#project-dialog');
function imageType(project,index){
 const item=project.gallery[index];
 if(typeof item==='object')return item.type || item.label || 'Portfólio 2K DESIGN';
 if(project.galleryLabels?.[index])return project.galleryLabels[index];
 if(project.galleryTypes?.[index])return project.galleryTypes[index];
 return project.imageType || project.mediaType || 'Portfólio 2K DESIGN';
}
function openProject(id,button){
 const project=projects.find(p=>p.id===id);if(!project)return;
 returnFocus=button;
 q('#dialog-title').textContent=project.title;
 q('#dialog-category').textContent=project.category+' / 2K DESIGN';
 q('#dialog-description').textContent=project.description||'Um projeto do universo 2K. Explore as imagens e os detalhes visuais desta produção.';
 const gallery=q('#dialog-gallery');gallery.replaceChildren();
 (project.gallery?.length?project.gallery:[project.image]).forEach((item,i)=>{
  const figure=document.createElement('figure');figure.className='gallery-figure';
  const img=document.createElement('img');img.src=typeof item==='string'?item:item.src||item.path;img.alt=`${project.title} — ${imageType(project,i)} — imagem ${i+1}`;img.loading=i?'lazy':'eager';img.decoding='async';
  const caption=document.createElement('figcaption');caption.textContent=`${String(i+1).padStart(2,'0')} / ${imageType(project,i).toUpperCase()}`;
  figure.append(img,caption);gallery.appendChild(figure);
 });
 q('#dialog-source').href=project.source;
 window.k2TextEffects?.attach(q('.dialog-heading'));
 window.k2TextReveal?.attach(q('.dialog-heading'));
 dialog.showModal();document.body.classList.add('modal-open');
 q('.dialog-scroll').scrollTop=0;
 cursor.classList.remove('project-hover');
}
function closeProject(){dialog.close()}
q('.dialog-close').addEventListener('click',closeProject);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProject()}});
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');returnFocus?.focus();});

function renderProjects(data){
 projects=data;
 const grid=q('#project-grid');grid.replaceChildren();
 data.forEach((p,i)=>{
  const article=document.createElement('article');article.className='project-card reveal';
  const button=document.createElement('button');button.type='button';button.className='project-trigger';button.setAttribute('aria-label',`Ver projeto ${p.title}`);
  const image=document.createElement('div');image.className='project-image';
  const img=document.createElement('img');img.src=p.image;img.alt=`${p.title} — ${p.imageType||p.mediaType||'projeto do portfólio 2K'}`;img.loading='lazy';img.decoding='async';img.width=1400;img.height=1000;
  const n=document.createElement('span');n.className='project-number';n.textContent=`[ ${String(i+1).padStart(2,'0')} ]`;
  const arrow=document.createElement('span');arrow.className='project-open';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');image.append(img,n,arrow);
  const caption=document.createElement('div');caption.className='project-caption';
  const h=document.createElement('h3');h.textContent=p.title;
  const category=document.createElement('span');category.className='mono';category.textContent=p.category.toUpperCase();caption.append(h,category);
  button.append(image,caption);button.addEventListener('click',()=>openProject(p.id,button));article.appendChild(button);grid.appendChild(article);
 });
 reveal();
 window.k2TextEffects?.attach(grid);
 window.k2TextReveal?.attach(grid);
}
fetch('assets/projects.json').then(r=>{if(!r.ok)throw Error('projects');return r.json()}).then(renderProjects).catch(()=>{
 const a=document.createElement('a');a.className='text-link';a.href='https://2kstudiodesign.com/html/projetos.html';a.textContent='Explore o portfólio completo da 2K ↗';q('#project-grid').appendChild(a);
});

})();
