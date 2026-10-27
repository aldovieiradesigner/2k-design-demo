/* A gently moving, draggable wall of real client marks. */
(() => {
'use strict';
const root=document.getElementById('client-grid');if(!root)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=false,visible=false,frame=0,last=0,rows=[],pauseButton;
function allowed(){return visible&&!document.hidden}
function request(){if(!frame&&allowed())frame=requestAnimationFrame(draw)}
function draw(time){
 frame=0;if(!allowed()){last=0;return}
 const dt=last?Math.min((time-last)/1000,.04):1/60;last=time;
 let moving=false;
 rows.forEach(row=>{
  const desired=row.hover ? .10 : 1;
  row.factor+=(desired-row.factor)*(1-Math.exp(-dt*5));
  const automatic=!paused&&!reduced.matches&&!row.drag&&!row.focus;
  if(automatic)row.phase+=row.speed*row.factor*dt;
  if(!row.drag){row.phase+=row.velocity*dt;row.velocity*=Math.exp(-dt*3.2);if(Math.abs(row.velocity)<.4)row.velocity=0}
  if(row.width>0)row.phase=((row.phase%row.width)+row.width)%row.width;
  row.track.style.transform=`translate3d(${-row.phase}px,0,0)`;
  moving=moving||automatic||!!row.drag||Math.abs(row.velocity)>.4;
 });
 if(moving)request();else last=0;
}
function measure(){rows.forEach((row,i)=>{const width=row.group.getBoundingClientRect().width;if(width<=0)return;const fraction=row.width?row.phase/row.width:(i*.27);row.width=width;row.phase=width*fraction;row.track.style.transform=`translate3d(${-row.phase}px,0,0)`});request()}
function resetMarks(row){row.lane.querySelectorAll('.client-mark').forEach(mark=>{mark.style.removeProperty('--mark-x');mark.style.removeProperty('--mark-y')})}
function createRow(clients,index){
 const lane=document.createElement('div');lane.className='client-lane';
 if(index===0){lane.setAttribute('role','group');lane.setAttribute('aria-label','Artistas e projetos. Use as setas para explorar as marcas.');lane.tabIndex=0}else lane.setAttribute('aria-hidden','true');
 const track=document.createElement('div');track.className='client-track';
 const group=document.createElement('div');group.className='client-loop';
 const ordered=[...clients.slice(index*3),...clients.slice(0,index*3)];
 ordered.forEach(client=>{
  const mark=document.createElement('div');mark.className='client-mark';
  const img=document.createElement('img');img.src=client.path;img.alt=client.name;img.loading='lazy';img.decoding='async';img.width=client.width;img.height=client.height;img.draggable=false;
  const name=document.createElement('span');name.className='client-name mono';name.textContent=client.name;name.setAttribute('aria-hidden','true');
  mark.append(img,name);
  const star=document.createElement('span');star.className='client-divider';star.textContent='·';star.setAttribute('aria-hidden','true');
  group.append(mark,star);
 });
 track.append(group);
 for(let i=0;i<3;i++){const copy=group.cloneNode(true);copy.setAttribute('aria-hidden','true');track.append(copy)}
 lane.append(track);root.append(lane);
 const row={lane,track,group,width:0,phase:0,speed:[24,-19,22][index],factor:1,hover:false,focus:false,drag:null,velocity:0};rows.push(row);
 lane.addEventListener('pointerenter',()=>{row.hover=true;request()},{passive:true});
 lane.addEventListener('pointerleave',()=>{row.hover=false;resetMarks(row);request()},{passive:true});
 lane.addEventListener('focusin',()=>{row.focus=true;request()});
 lane.addEventListener('focusout',()=>{row.focus=false;request()});
 lane.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();row.phase+=event.key==='ArrowRight'?180:-180;row.velocity=0;request();
 });
 lane.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  row.drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,time:performance.now(),started:false};row.velocity=0;request();
 });
 lane.addEventListener('pointermove',event=>{
  if(row.drag?.id===event.pointerId){
   const drag=row.drag,dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(!drag.started&&Math.abs(dy)>Math.abs(dx)+8){row.drag=null;request();return}
   if(!drag.started&&Math.abs(dx)>5){drag.started=true;lane.setPointerCapture(event.pointerId);lane.classList.add('is-dragging')}
   if(drag.started){
    const now=performance.now(),delta=event.clientX-drag.lastX;
    row.phase-=delta;row.velocity=Math.max(-700,Math.min(700,-delta/Math.max(.008,(now-drag.time)/1000)));
    drag.lastX=event.clientX;drag.time=now;request();
   }
  }
  if(event.pointerType==='touch'||reduced.matches)return;
  const mark=event.target.closest('.client-mark');if(!mark)return;
  const r=mark.getBoundingClientRect();
  mark.style.setProperty('--mark-x',`${((event.clientX-r.left)/r.width-.5)*8}px`);
  mark.style.setProperty('--mark-y',`${((event.clientY-r.top)/r.height-.5)*5}px`);
 },{passive:true});
 function release(event){if(!row.drag||row.drag.id!==event.pointerId)return;row.drag=null;lane.classList.remove('is-dragging');if(lane.hasPointerCapture(event.pointerId))lane.releasePointerCapture(event.pointerId);request()}
 lane.addEventListener('pointerup',release);lane.addEventListener('pointercancel',release);lane.addEventListener('lostpointercapture',release);
}
fetch('assets/clients.json').then(response=>{if(!response.ok)throw Error('clients');return response.json()}).then(clients=>{
 root.className='client-marquee';root.replaceChildren();
 const tools=document.createElement('div');tools.className='client-tools';
 const hint=document.createElement('span');hint.className='mono';hint.textContent='ARRASTE PARA EXPLORAR ↔';
 pauseButton=document.createElement('button');pauseButton.type='button';pauseButton.className='client-pause mono';pauseButton.setAttribute('aria-pressed','false');pauseButton.textContent='Pausar movimento Ⅱ';
 pauseButton.addEventListener('click',()=>{paused=!paused;pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.textContent=paused?'Retomar movimento ▷':'Pausar movimento Ⅱ';request()});
 tools.append(hint,pauseButton);root.append(tools);
 [0,1,2].forEach(i=>createRow(clients,i));
 function preferences(){root.classList.toggle('motion-reduced',reduced.matches);pauseButton.disabled=reduced.matches;pauseButton.textContent=reduced.matches?'Movimento reduzido':paused?'Retomar movimento ▷':'Pausar movimento Ⅱ';rows.forEach(row=>{row.velocity=0});request()}
 preferences();reduced.addEventListener('change',preferences);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(visible)request();else{cancelAnimationFrame(frame);frame=0}},{rootMargin:'80px'});observer.observe(root);
 const resize=new ResizeObserver(measure);resize.observe(root);measure();
 document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0}else request()});
 window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(event.persisted)return;observer.disconnect();resize.disconnect()});
 window.addEventListener('pageshow',()=>{last=0;request()});
}).catch(()=>{root.hidden=true});
})();
