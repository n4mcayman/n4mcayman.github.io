(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),states=[];let active=null,printing=false;
 document.body.dataset.broadcastReady='true';
 for(const brief of document.querySelectorAll('[data-motion-brief]')){
  const slides=[...brief.querySelectorAll('.brief-slides>[data-slide]')].slice(0,8),buttons=[...brief.querySelectorAll('[data-brief-slide]')],play=brief.querySelector('[data-brief-play]'),status=brief.querySelector('.brief-status');
  if(!slides.length||!play)continue;
  const state={brief,slides,index:0,remaining:6000,last:0,timer:null,playing:false,inView:false,manual:false,started:false};states.push(state);
  brief.dataset.enhanced='true';brief.querySelectorAll('.brief-controls[hidden]').forEach(el=>el.hidden=false);if(status){status.hidden=false;status.setAttribute('aria-live','off');}
  const say=text=>{if(status)status.textContent=text;};
  function label(){play.disabled=reduced.matches;play.textContent=reduced.matches?'Still view':state.playing?'Pause':'Play';play.setAttribute('aria-pressed',String(state.playing));}
  function show(index){state.index=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==state.index;slide.classList.toggle('is-current',i===state.index);});buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===state.index)));brief.dataset.slide=String(state.index);say(`${state.playing?'Playing':reduced.matches?'Still view':'Paused'} · fact ${state.index+1} of ${slides.length}.`);}
  function pause(manual=false){if(state.timer!==null){clearTimeout(state.timer);state.timer=null;}if(state.playing)state.remaining=Math.max(0,state.remaining-(performance.now()-state.last));state.playing=false;brief.dataset.playing='false';if(manual)state.manual=true;if(active===state)active=null;label();show(state.index);}
  function queue(){state.last=performance.now();state.timer=setTimeout(()=>{state.timer=null;if(!state.playing)return;state.remaining=6000;show(state.index+1);queue();},state.remaining);}
  function start(){if(state.playing||printing||reduced.matches||document.hidden||!state.inView)return;if(active&&active!==state)active.pause(true);state.manual=false;state.started=true;state.playing=true;brief.dataset.playing='true';active=state;label();show(state.index);queue();}
  state.pause=pause;state.start=start;
  brief.addEventListener('mouseenter',()=>pause(true));
  brief.addEventListener('focusin',()=>pause(true));
  play.addEventListener('click',()=>state.playing?pause(true):start());
  const select=index=>{pause(true);state.remaining=6000;show(index);};buttons.forEach((button,index)=>button.addEventListener('click',()=>select(index)));
  const controls=brief.querySelector('.brief-controls');if(controls&&slides.length>1){for(const [step,name]of [[-1,'Previous'],[1,'Next']]){const button=document.createElement('button');button.type='button';button.dataset.briefStep=String(step);button.textContent=name;button.setAttribute('aria-label',`${name} fact`);button.addEventListener('click',()=>select(state.index+step));controls.append(button);}}
  brief.addEventListener('keydown',event=>{if(event.target.tagName!=='BUTTON'||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();select(state.index+(event.key==='ArrowLeft'?-1:1));});
  show(0);label();
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{for(const entry of entries){state.inView=entry.isIntersecting&&entry.intersectionRatio>=.2;if(!state.inView)pause();else if(!state.manual)start();}},{threshold:[0,.2]}).observe(brief);
  else {state.inView=true;}
 }
 document.addEventListener('visibilitychange',()=>{for(const state of states){if(document.hidden)state.pause();else if(state.inView&&!state.manual)state.start();}});
 reduced.addEventListener('change',()=>{for(const state of states){state.pause();if(!reduced.matches&&state.inView&&!state.manual)state.start();}});
 let printStates=[];addEventListener('beforeprint',()=>{printing=true;printStates=states.map(state=>({state,playing:state.playing}));states.forEach(state=>state.pause());});addEventListener('afterprint',()=>{printing=false;for(const item of printStates)if(item.playing)item.state.start();printStates=[];});
 const fit=()=>{for(const brief of document.querySelectorAll('[data-motion-brief]'))for(const value of brief.querySelectorAll('.brief-slides .brief-value')){value.style.removeProperty('--brief-fit-size');const base=parseFloat(getComputedStyle(value).fontSize),available=brief.querySelector('.brief-slides').clientWidth,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(ctx&&available>0){ctx.font=`300 ${base}px ${getComputedStyle(value).fontFamily}`;const measured=ctx.measureText(value.textContent).width;if(measured>available)value.style.setProperty('--brief-fit-size',`${Math.max(30,base*available/measured)}px`);}}};
 document.fonts.ready.then(fit);if('ResizeObserver'in window){const observer=new ResizeObserver(fit);document.querySelectorAll('.brief-slides').forEach(el=>observer.observe(el));}else addEventListener('resize',fit);
})();
