/* Recorrido 3D del campus de la UPEC (Tulcán) para la landing de AMY.
   Modelo aproximado levantado de fotografías y de la vista satelital: edificio central, plaza de la estrella,
   canchas, altar de banderas, coliseo 05 de Abril y el conjunto Aulas 2 / Aulas 4 analizado planta por planta.
   La cámara avanza con el scroll de la sección: cada .campus-chapter es un corte del recorrido. */
import * as THREE from 'three';

export const CHAPTER_NAMES = ['Portada','Fachada','Puerta','Vestíbulo','Patio posterior','Aulas 4','Conjunto','Cubierta','Segundo piso','Primer piso','Planta baja','Fachada al patio','Patio de Aulas','Visita'];

export function createCampusScene(root, { onChapter } = {}) {
const disposers = [];
const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); disposers.push(() => t.removeEventListener(ev, fn, o)); };
const q = k => root.querySelector('[data-campus="' + k + '"]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sections = Array.from(root.querySelectorAll('.campus-chapter'));
const N = sections.length;
const NAMES = CHAPTER_NAMES;

/* ---------- navegación por cortes (funciona aunque no haya WebGL) ---------- */
const railEl = q('rail');
railEl.textContent = '';
const railBtns = NAMES.map((n, i) => {
  if (i === 5) { const s = document.createElement('li'); s.className = 'campus-rail-split'; s.setAttribute('aria-hidden', 'true'); railEl.appendChild(s); }
  const li = document.createElement('li'); const b = document.createElement('button');
  b.type = 'button'; b.innerHTML = '<span>' + String(i).padStart(2, '0') + ' · ' + n + '</span><i></i>';
  b.setAttribute('aria-label', 'Ir al corte ' + n);
  b.addEventListener('click', () => goTo(i)); li.appendChild(b); railEl.appendChild(li); return b;
});
const absTop = el => el.getBoundingClientRect().top + window.scrollY;
function goTo(i) { window.scrollTo({ top: absTop(sections[i]), behavior: reduce ? 'auto' : 'smooth' }); }
[['btn-top', 0], ['btn-door', 2], ['btn-levels', 8]].forEach(([k, i]) => { const b = q(k); if (b) on(b, 'click', () => goTo(i)); });

let target = 0;
function computeTarget() {
  const y = window.scrollY;
  let p = 0;
  for (let i = 0; i < N - 1; i++) {
    const a = absTop(sections[i]), b = absTop(sections[i + 1]);
    if (y >= a && y < b) { p = i + (y - a) / (b - a); break; }
    if (y >= b) p = i + 1;
  }
  target = Math.max(0, Math.min(N - 1, p));
}
on(window, 'scroll', computeTarget, { passive: true });
computeTarget();

const canvas = q('canvas');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { root.classList.add('no-webgl'); return { ok: false, dispose() { disposers.forEach(f => f()); } }; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 7000);

function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R = rng(11);
const C = h => new THREE.Color(h);
const FH = 3.6;
const clamp01=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp01((v-a)/(b-a)); return t*t*(3-2*t);};

/* ---------- texturas procedurales ---------- */
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function makeCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c;}
function tex(cv, srgb){const t=new THREE.CanvasTexture(cv); if(srgb!==false) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=aniso; return t;}
const repCache = new Map();
function rep(base,key,rx,ry){const k=key+':'+rx.toFixed(2)+':'+ry.toFixed(2); if(repCache.has(k)) return repCache.get(k); const t=base.clone(); t.needsUpdate=true; t.repeat.set(rx,ry); repCache.set(k,t); return t;}

const winT = tex(makeCanvas(256,232,(g,w,h)=>{
  g.fillStyle='#ECE6D8'; g.fillRect(0,0,w,h);
  for(let i=0;i<900;i++){g.fillStyle='rgba(120,110,90,'+(R()*0.06)+')'; g.fillRect(R()*w,R()*h,2,2);}
  g.fillStyle='#D5CDBB'; g.fillRect(0,h-8,w,8);
  g.fillStyle='#F7F3EB'; g.fillRect(22,66,212,104);
  const gr=g.createLinearGradient(26,70,230,166); gr.addColorStop(0,'#5A6873'); gr.addColorStop(.45,'#232B32'); gr.addColorStop(1,'#181E24');
  g.fillStyle=gr; g.fillRect(28,72,200,92);
  g.fillStyle='#D9D4C8'; [94,161].forEach(x=>g.fillRect(x-2,72,4,92)); g.fillRect(28,104,200,3);
  g.fillStyle='rgba(0,0,0,.16)'; g.fillRect(22,170,212,4);
}));
const winEmT = tex(makeCanvas(256,232,(g,w,h)=>{
  g.fillStyle='#000'; g.fillRect(0,0,w,h);
  const gr=g.createLinearGradient(0,72,0,164); gr.addColorStop(0,'#FFD9A0'); gr.addColorStop(1,'#E39A4E');
  g.fillStyle=gr; g.fillRect(28,72,200,92);
  g.fillStyle='#000'; [94,161].forEach(x=>g.fillRect(x-2,72,4,92)); g.fillRect(28,104,200,3);
}));
// fachada de las alas del edificio principal: ventanal alto detrás de las columnas y ventana del piso alto (bahía de 3.3 m × 12 m)
function wingFront(em){ return makeCanvas(256,930,(g,w,h)=>{
  g.fillStyle=em?'#000':'#EFE6D2'; g.fillRect(0,0,w,h);
  if(!em){ for(let i=0;i<700;i++){g.fillStyle='rgba(120,100,70,'+(R()*0.05)+')'; g.fillRect(R()*w,R()*h,2,2);} }
  const glass=(x,y,ww,hh)=>{ if(em){ g.fillStyle='#FFCF8A'; g.fillRect(x,y,ww,hh); } else { const gr=g.createLinearGradient(x,y,x+ww,y+hh); gr.addColorStop(0,'#4B5A66'); gr.addColorStop(.5,'#1D252C'); gr.addColorStop(1,'#141A1F'); g.fillStyle=gr; g.fillRect(x,y,ww,hh);} };
  glass(58,364,140,543); glass(70,54,116,116);
  g.fillStyle=em?'#000':'#D8D0BE'; g.fillRect(126,364,4,543); g.fillRect(58,600,140,4); g.fillRect(126,54,4,116);
}); }
const wingFT=tex(wingFront(false)), wingFET=tex(wingFront(true));
function letterCanvas(text,em){ return makeCanvas(2048,132,(g,w,h)=>{
  if(em){ g.fillStyle='#000'; g.fillRect(0,0,w,h); }
  else { g.fillStyle='#EFE6D2'; g.fillRect(0,0,w,h); g.fillStyle='#E2D6BC'; g.fillRect(0,20,w,92); g.fillStyle='rgba(0,0,0,.10)'; g.fillRect(0,110,w,4); }
  g.font='bold 76px "Times New Roman", Georgia, serif'; g.textBaseline='middle';
  const sp=20, chars=Array.from(text), ws=chars.map(c=>g.measureText(c).width);
  let x=(w-(ws.reduce((a,b)=>a+b,0)+sp*(chars.length-1)))/2;
  chars.forEach((c,i)=>{
    if(em){ g.fillStyle='#FFD58A'; }
    else { const gr=g.createLinearGradient(0,34,0,100); gr.addColorStop(0,'#F2D57E'); gr.addColorStop(1,'#9A7228'); g.fillStyle=gr; g.strokeStyle='#4E3B16'; g.lineWidth=3; g.strokeText(c,x,68); }
    g.fillText(c,x,68); x+=ws[i]+sp;
  });
}); }
const stoneT = tex(makeCanvas(256,256,(g,w,h)=>{
  g.fillStyle='#2E3233'; g.fillRect(0,0,w,h);
  const pal=['#6B6A5C','#8A6A3E','#5C6B6B','#7D5A44','#4D5658','#9A7B4F','#62705F','#3E4547','#7A7462','#55606A'];
  let y=0; while(y<h){ const rh=16+Math.floor(R()*18); let x=-Math.floor(R()*30);
    while(x<w){ const rw=26+Math.floor(R()*46); g.fillStyle=pal[Math.floor(R()*pal.length)]; g.fillRect(x+1,y+1,rw-2,rh-2);
      for(let k=0;k<8;k++){g.fillStyle='rgba(255,255,255,'+(R()*0.06)+')'; g.fillRect(x+R()*rw,y+R()*rh,3,1);} x+=rw; }
    y+=rh; }
}));
const roofT = tex(makeCanvas(512,512,(g,w,h)=>{
  g.fillStyle='#6C7073'; g.fillRect(0,0,w,h);
  for(let i=0;i<260;i++){ const x=R()*w,y=R()*h,r=8+R()*46; const gr=g.createRadialGradient(x,y,0,x,y,r); const d=R()<.6; gr.addColorStop(0,d?'rgba(40,44,47,.35)':'rgba(170,174,176,.18)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2);}
  g.lineCap='round';
  for(let i=0;i<70;i++){ let x=R()*w,y=R()*h; g.strokeStyle='rgba(30,33,35,'+(.25+R()*.35)+')'; g.lineWidth=1+R()*2.5; g.beginPath(); g.moveTo(x,y);
    for(let k=0;k<10;k++){ x+=(R()-.5)*44; y+=(R()-.5)*44; g.lineTo(x,y);} g.stroke(); }
}));
const planT = tex(makeCanvas(256,256,(g,w,h)=>{
  g.fillStyle='#D9D5CC'; g.fillRect(0,0,w,h);
  g.strokeStyle='#8E897E'; g.lineWidth=5; g.strokeRect(0,0,w,h);
  g.lineWidth=2; g.beginPath(); g.moveTo(0,150); g.lineTo(w,150); g.moveTo(0,190); g.lineTo(w,190); g.moveTo(128,0); g.lineTo(128,150); g.stroke();
  g.fillStyle='#D9D5CC'; g.fillRect(40,146,26,8); g.fillRect(170,146,26,8);
  g.strokeStyle='#A9A397'; g.lineWidth=1; for(let x=20;x<w;x+=36){ for(let y=30;y<130;y+=30){ g.strokeRect(x+4,y,18,10);} }
}));
function paverCanvas(base,spread,tint){ return makeCanvas(256,256,(g,w,h)=>{
  g.fillStyle=base; g.fillRect(0,0,w,h);
  const s=16; for(let y=0;y<h;y+=s){ const off=(y/s)%2?s/2:0; for(let x=-s;x<w;x+=s){ const v=Math.floor(R()*spread); g.fillStyle='rgb('+(tint[0]+v)+','+(tint[1]+v)+','+(tint[2]+v)+')'; g.fillRect(x+off+1,y+1,s-2,s-2);} }
}); }
const paveT = tex(paverCanvas('#6E7376',40,[124,128,132]));
const redPaveT = tex(paverCanvas('#6E3A30',34,[150,72,58]));
const streetPaveT = tex(paverCanvas('#3A3D40',26,[70,72,76]));
const groundT = tex(makeCanvas(256,256,(g,w,h)=>{
  g.fillStyle='#7E8466'; g.fillRect(0,0,w,h);
  for(let i=0;i<3000;i++){ const v=R(); g.fillStyle=v<.5?'rgba(60,70,40,.18)':'rgba(170,160,120,.16)'; g.fillRect(R()*w,R()*h,3,3);}
}));
const grassT = tex(makeCanvas(256,256,(g,w,h)=>{
  g.fillStyle='#5F8A3A'; g.fillRect(0,0,w,h);
  for(let i=0;i<4000;i++){ const v=R(); g.fillStyle=v<.5?'rgba(40,80,20,.25)':'rgba(150,190,80,.18)'; g.fillRect(R()*w,R()*h,2,2);}
}));
const asphaltT = tex(makeCanvas(128,256,(g,w,h)=>{
  g.fillStyle='#3C3F42'; g.fillRect(0,0,w,h);
  for(let i=0;i<1500;i++){ g.fillStyle='rgba(255,255,255,'+(R()*0.05)+')'; g.fillRect(R()*w,R()*h,2,2);}
  g.fillStyle='#E9E6DA'; g.fillRect(w/2-2,20,4,90);
}));
const zebraT = tex(makeCanvas(64,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#F1EFE8'; for(let y=0;y<h;y+=32) g.fillRect(0,y,w,16); }));
const fieldT = tex(makeCanvas(340,512,(g,w,h)=>{
  for(let i=0;i<10;i++){ g.fillStyle=i%2?'#3E9A44':'#46A64C'; g.fillRect(0,i*h/10,w,h/10);}
  g.strokeStyle='#F2F2EC'; g.lineWidth=3; g.strokeRect(14,14,w-28,h-28);
  g.beginPath(); g.moveTo(14,h/2); g.lineTo(w-14,h/2); g.stroke();
  g.beginPath(); g.arc(w/2,h/2,40,0,Math.PI*2); g.stroke();
  g.strokeRect(w/2-70,14,140,60); g.strokeRect(w/2-70,h-74,140,60);
}));
const fountainT = tex(makeCanvas(512,512,(g,w,h)=>{
  const cx=256,cy=256,s=6;
  const bands=[[14,'hole'],[70,'b'],[80,'w'],[128,'b'],[140,'w'],[186,'b'],[200,'w'],[240,'b'],[256,'w']];
  for(let y=0;y<h;y+=s) for(let x=0;x<w;x+=s){
    const r=Math.hypot(x+s/2-cx,y+s/2-cy); if(r>256) continue;
    let band='w'; for(const b of bands){ if(r<=b[0]){band=b[1];break;} }
    if(band==='hole') g.fillStyle='#1B2B3F';
    else if(band==='w'){ const v=228+Math.floor(R()*20); g.fillStyle='rgb('+v+','+v+','+(v+4)+')'; }
    else { const v=R(); g.fillStyle=v<.15?'#7FB3E8':(v<.55?'#2A63B8':(v<.85?'#1F4F99':'#3C78C9')); }
    g.fillRect(x,y,s-1,s-1);
  }
}));
const cloudT = tex(makeCanvas(256,256,(g,w,h)=>{
  for(let i=0;i<14;i++){ const x=60+R()*136,y=90+R()*76,r=34+R()*46; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h);}
}));
// reja: barrotes verde grisáceo con puntas doradas (1 m × 2.4 m)
const fenceT = tex(makeCanvas(128,308,(g,w,h)=>{
  g.clearRect(0,0,w,h);
  g.fillStyle='#45605F';
  for(let x=14;x<w;x+=32){ g.fillRect(x,22,6,h-22); }
  g.fillRect(0,40,w,6); g.fillRect(0,h-26,w,6);
  g.fillStyle='#C9A54A';
  for(let x=14;x<w;x+=32){ g.beginPath(); g.moveTo(x-3,24); g.lineTo(x+3,2); g.lineTo(x+9,24); g.fill(); }
}));
const floorT = tex(makeCanvas(256,256,(g,w,h)=>{
  for(let y=0;y<4;y++) for(let x=0;x<4;x++){ g.fillStyle=(x+y)%2?'#E6E2DA':'#CFC9BE'; g.fillRect(x*64,y*64,64,64); }
  g.strokeStyle='rgba(0,0,0,.12)'; for(let k=0;k<=4;k++){ g.beginPath(); g.moveTo(k*64,0); g.lineTo(k*64,h); g.moveTo(0,k*64); g.lineTo(w,k*64); g.stroke(); }
}));
const ceilEmT = tex(makeCanvas(128,128,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); g.fillStyle='#FFE6BE'; g.fillRect(40,40,48,48); }));
function drawEscudo(g,cx,cy,s){
  g.save(); g.translate(cx,cy); g.scale(s/100,s/100); g.lineJoin='round'; g.lineCap='round';
  // banderas drapeadas a cada lado del óvalo
  [-1,1].forEach(side=>{
    ['#F7D117','#1E4FA0','#D1232A'].forEach((c,i)=>{ g.strokeStyle=c; g.lineWidth=8; g.beginPath(); g.moveTo(side*16,-34+i*8); g.bezierCurveTo(side*58,-50+i*8,side*70,0+i*6,side*44,46+i*4); g.stroke(); });
    g.strokeStyle='#6B4A1E'; g.lineWidth=3; g.beginPath(); g.moveTo(side*10,-46); g.lineTo(side*40,60); g.stroke();
  });
  // ramas de laurel y palma
  g.strokeStyle='#2E7D32'; g.lineWidth=5;
  [-1,1].forEach(side=>{ g.beginPath(); g.moveTo(side*4,62); g.quadraticCurveTo(side*36,60,side*44,26); g.stroke(); for(let k=0;k<5;k++){ const t=k/5; g.beginPath(); g.ellipse(side*(8+t*32),60-t*30,5,2.4,side*(.6+t),0,Math.PI*2); g.fillStyle='#3D8B3F'; g.fill(); } });
  // haz de lictores con hacha
  g.fillStyle='#9A6B34'; g.fillRect(-7,40,14,32); g.strokeStyle='#5A3A1A'; g.lineWidth=1.5; for(let k=-4;k<=4;k+=4){ g.beginPath(); g.moveTo(k,40); g.lineTo(k,72); g.stroke(); }
  g.fillStyle='#C9C9C9'; g.beginPath(); g.moveTo(7,46); g.quadraticCurveTo(18,50,7,58); g.fill();
  // óvalo con cielo, sol, Chimborazo, río y barco
  g.beginPath(); g.ellipse(0,0,31,43,0,0,Math.PI*2); g.fillStyle='#C9A24A'; g.fill();
  g.save(); g.beginPath(); g.ellipse(0,0,27,39,0,0,Math.PI*2); g.clip();
  const sky=g.createLinearGradient(0,-40,0,10); sky.addColorStop(0,'#5FA6DA'); sky.addColorStop(1,'#BFE0F2'); g.fillStyle=sky; g.fillRect(-31,-43,62,86);
  g.strokeStyle='#E7C24A'; g.lineWidth=3; g.beginPath(); g.arc(0,-6,24,Math.PI*1.15,Math.PI*1.85); g.stroke();
  g.fillStyle='#F6C531'; g.beginPath(); g.arc(0,-24,6.5,0,Math.PI*2); g.fill();
  g.fillStyle='#6E8A5A'; g.beginPath(); g.moveTo(-31,16); g.lineTo(-8,-12); g.lineTo(-1,-4); g.lineTo(6,-10); g.lineTo(31,16); g.fill();
  g.fillStyle='#FFFFFF'; g.beginPath(); g.moveTo(-14,-5); g.lineTo(-8,-12); g.lineTo(-3,-6); g.fill();
  g.fillStyle='#4F8A3C'; g.fillRect(-31,14,62,30);
  g.fillStyle='#2E7FC2'; g.fillRect(-31,22,62,11);
  g.fillStyle='#3A3A3A'; g.fillRect(2,19,16,4); g.fillRect(8,12,3,7); g.fillStyle='#EEE'; g.fillRect(12,9,2,4);
  g.restore();
  g.strokeStyle='#8A6B22'; g.lineWidth=2.5; g.beginPath(); g.ellipse(0,0,31,43,0,0,Math.PI*2); g.stroke();
  // cóndor con alas abiertas
  g.fillStyle='#262626';
  [-1,1].forEach(side=>{ g.beginPath(); g.moveTo(0,-42); g.bezierCurveTo(side*18,-66,side*44,-72,side*62,-58); g.bezierCurveTo(side*48,-56,side*44,-50,side*50,-44); g.bezierCurveTo(side*34,-46,side*20,-44,side*8,-38); g.closePath(); g.fill(); });
  g.beginPath(); g.ellipse(0,-46,8,10,0,0,Math.PI*2); g.fill();
  g.fillStyle='#F2F2F2'; g.beginPath(); g.ellipse(0,-50,6,3,0,0,Math.PI*2); g.fill();
  g.fillStyle='#262626'; g.beginPath(); g.arc(0,-58,4.5,0,Math.PI*2); g.fill();
  g.fillStyle='#E0B23A'; g.beginPath(); g.moveTo(3,-59); g.lineTo(9,-57); g.lineTo(3,-55); g.fill();
  g.restore();
}
function flagCanvas(stripes,escudo){ return makeCanvas(600,400,(g,w,h)=>{ let y=0; stripes.forEach(([c,f])=>{ g.fillStyle=c; g.fillRect(0,y,w,Math.ceil(h*f)); y+=h*f; }); if(escudo) drawEscudo(g,w/2,h/2,135); }); }
const flagTex = {
  ec: tex(flagCanvas([['#F7D117',.5],['#1E4FA0',.25],['#D1232A',.25]],true)),
  green: tex(flagCanvas([['#1F5A3A',1]])),
  tri: tex(flagCanvas([['#1E9A55',1/3],['#F2CF2A',1/3],['#E2483A',1/3]]))
};

/* ---------- registro de materiales por categoría ---------- */
const CATS=['wing','entrance','tower','roof','skylight','plaza','twin','infra','main','context'];
const catMats={ground:[]}; CATS.forEach(c=>catMats[c]=[]);
const glowMats=[];
const matCache=new Map();
function M(cat,opts,base){ const m=new THREE.MeshStandardMaterial(Object.assign({roughness:.85,metalness:0},opts)); m.userData.base=(base==null?1:base); if(m.userData.base<1){m.transparent=true;m.opacity=m.userData.base;m.depthWrite=false;} catMats[cat].push(m); return m; }
function glow(m,night,day){ m.userData.glow=night; m.userData.day=day||0; glowMats.push(m); return m; }
function cached(key,fn){ if(!matCache.has(key)) matCache.set(key,fn()); return matCache.get(key); }
function facadeMat(cat,len){ const r=Math.max(1,Math.round(len/4)); return cached('f'+cat+r,()=>glow(M(cat,{map:rep(winT,'w',r,1),emissiveMap:rep(winEmT,'we',r,1),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}),1.15)); }
function facadeMatH(cat,len,ry){ const r=Math.max(1,Math.round(len/4)); return cached('fh'+cat+r+'_'+ry,()=>glow(M(cat,{map:rep(winT,'w',r,ry),emissiveMap:rep(winEmT,'we',r,ry),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}),1.15)); }
function planMat(cat,lx,lz){ const rx=Math.max(1,Math.round(lx/8)), rz=Math.max(1,Math.round(lz/8)); return cached('p'+cat+rx+'_'+rz,()=>M(cat,{map:rep(planT,'pl',rx,rz)})); }
function creamMat(cat){ return cached('c'+cat,()=>M(cat,{color:C('#EAE4D6')})); }
function stoneMat(cat,lx,ly){ const rx=Math.max(1,Math.round(lx/4)), ry=Math.max(1,Math.round(ly/4)); return cached('s'+cat+rx+'_'+ry,()=>M(cat,{map:rep(stoneT,'st',rx,ry),roughness:.7})); }
function roofMat(cat,lx,lz){ const rx=Math.max(.5,lx/36), rz=Math.max(.5,lz/36); return cached('r'+cat+rx.toFixed(1)+rz.toFixed(1),()=>M(cat,{map:rep(roofT,'rf',rx,rz),roughness:.95})); }
function glassMat(cat){ return cached('g'+cat,()=>glow(M(cat,{color:C('#1C252C'),roughness:.18,metalness:.45,emissive:C('#E59C50'),emissiveIntensity:0}),.7)); }

const edgeMats={};
function edgeMat(cat){ if(!edgeMats[cat]) edgeMats[cat]=new THREE.LineBasicMaterial({color:0x2456A6,transparent:true,opacity:0,depthWrite:false}); return edgeMats[cat]; }

const parts=[];
let CUR_BLK=null;
function add(parent,mesh,level,cat,opt){
  opt=opt||{};
  mesh.castShadow=opt.cast!==false; mesh.receiveShadow=true;
  parent.add(mesh);
  if(level>=0) parts.push({obj:mesh,baseY:mesh.position.y,level,blk:CUR_BLK});
  if(opt.edges!==false){ const l=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,28),edgeMat(cat)); l.renderOrder=2; mesh.add(l); }
  return mesh;
}
function anchor(obj,x,y,z){ const o=new THREE.Object3D(); o.position.set(x,y,z); obj.add(o); return o; }
const dummy=new THREE.Object3D();

const ctx=new THREE.Group(); scene.add(ctx);
const groundG=new THREE.Group(); scene.add(groundG);
function flatIn(group,geo,mat,x,y,z,rotZ){ const m=new THREE.Mesh(geo,mat); m.rotation.x=-Math.PI/2; if(rotZ) m.rotation.z=rotZ; m.position.set(x,y,z); m.receiveShadow=true; group.add(m); return m; }

/* =========================================================
   PARTE 1 · EDIFICIO PRINCIPAL (fachada en z = 0, mira a +z)
   Proporciones tomadas de la foto aérea frontal (≈ 25 px por metro):
   frente de 60 m entre torres, pórticos laterales de 6 columnas (3.3 m entre ejes),
   pórtico central con columnas pareadas y frontón, volumen central alto, patios interiores
   y fachada posterior hacia la plaza de la estrella.
   ========================================================= */
const mainB=new THREE.Group(); scene.add(mainB);
const creamMain=glow(M('main',{color:C('#EFE6D2'),emissive:C('#FFB866'),emissiveIntensity:0}),.24);
const whiteMain=glow(M('main',{color:C('#F6F1E6'),emissive:C('#FFC985'),emissiveIntensity:0}),.42);
const greyMain=M('main',{color:C('#8E9194'),roughness:.8});
const atticMain=M('main',{color:C('#7C8086'),roughness:.8});
const goldMain=M('main',{color:C('#C9A24A'),metalness:.6,roughness:.35,emissive:C('#FFD27A'),emissiveIntensity:0}); glow(goldMain,.6);
const glassMain=glassMat('main');
const clearGlass=M('main',{color:C('#BFD3DD'),roughness:.05,metalness:.2,side:THREE.DoubleSide},.28);
const roofMainTop=roofMat('main',20,20);
function box(w,h,d,mat,x,y,z,opt){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); return add((opt&&opt.parent)||mainB,m,-1,'main',Object.assign({edges:false},opt)); }
function slab(w,h,d,x,y,z,side,top){ return box(w,h,d,[side,side,top||roofMainTop,creamMain,side,side],x,y,z); }
function column(x,z,h,r){
  box(r*2.6,.45,r*2.6,whiteMain,x,.22,z);
  const c=new THREE.Mesh(new THREE.CylinderGeometry(r*.92,r,h,20),whiteMain); c.position.set(x,.45+h/2,z); add(mainB,c,-1,'main',{edges:false});
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(r*1.5,r*.95,.7,20),whiteMain); cap.position.set(x,.45+h+.35,z); add(mainB,cap,-1,'main',{edges:false});
  box(r*3,.3,r*3,whiteMain,x,.45+h+.85,z);
  return c;
}
const H_W=12, H_C=12.6, D_B=27;
// --- bloque central con vestíbulo pasante (x ±3, alto 7.2) ---
const cbL=box(5.5,H_C,D_B,[creamMain,creamMain,roofMainTop,creamMain,creamMain,creamMain],-5.75,H_C/2,-D_B/2);
const cbR=box(5.5,H_C,D_B,[creamMain,creamMain,roofMainTop,creamMain,creamMain,creamMain],5.75,H_C/2,-D_B/2);
const cbTop=box(6,H_C-7.2,D_B,[creamMain,creamMain,roofMainTop,creamMain,glassMain,creamMain],0,7.2+(H_C-7.2)/2,-D_B/2);
// volumen alto detrás del frontón con ático gris y bóveda de luz
box(17,3.6,14,[creamMain,creamMain,roofMainTop,creamMain,atticMain,creamMain],0,H_C+1.8,-8);
box(17.4,.4,14.4,whiteMain,0,H_C+3.8,-8);
const vaultTop=new THREE.Mesh(new THREE.CylinderGeometry(3,3,10,24,1,false,0,Math.PI),M('main',{color:C('#F2F4F3'),roughness:.3,metalness:.1})); vaultTop.rotation.z=Math.PI/2; vaultTop.rotation.y=Math.PI/2; vaultTop.position.set(0,H_C+4,-8); add(mainB,vaultTop,-1,'main');
// vestíbulo
flatIn(mainB,new THREE.PlaneGeometry(6,D_B),M('main',{map:rep(floorT,'fl',1.5,7),roughness:.25,metalness:.05}),0,.03,-D_B/2);
const ceil=new THREE.Mesh(new THREE.PlaneGeometry(6,D_B),M('main',{color:C('#EDEAE3'),emissive:C('#FFFFFF'),emissiveMap:rep(ceilEmT,'ce',2,9),emissiveIntensity:.9}));
ceil.rotation.x=Math.PI/2; ceil.position.set(0,7.18,-D_B/2); mainB.add(ceil);
const lobbyLight=new THREE.PointLight(0xFFE2B8,30,50,1.6); lobbyLight.position.set(0,5.6,-12); mainB.add(lobbyLight);
const desk=box(1,1.1,4.5,M('main',{color:C('#5A4637'),roughness:.5}),2.2,.55,-9);
[-1,1].forEach(s=>{ box(.9,.25,16,whiteMain,s*2.55,3.6,-14); box(.06,1,16,clearGlass,s*2.12,4.2,-14); });
const bannerMat=M('main',{color:C('#1F5A3A'),emissive:C('#1F5A3A'),emissiveIntensity:.2});
box(.1,4,2.2,bannerMat,-2.95,4.6,-18); box(.1,4,2.2,bannerMat,2.95,4.6,-18);
// mampara frontal con puerta y marco posterior
box(1.3,7.2,.08,clearGlass,-2.35,3.6,-.05); box(1.3,7.2,.08,clearGlass,2.35,3.6,-.05); box(3.4,3.9,.08,clearGlass,0,5.25,-.05);
const frameMat=M('main',{color:C('#2B3236'),metalness:.5,roughness:.4});
[-3,-1.7,1.7,3].forEach(x=>box(.14,7.2,.16,frameMat,x,3.6,0));
box(6,.14,.16,frameMat,0,3.3,0); box(6,.14,.16,frameMat,0,7.13,0);
box(6,.5,.3,frameMat,0,6.95,-D_B+.1);
// --- pórtico central: columnas pareadas, entablamento y frontón con medallón ---
const centralCols=[-4.0,-3.1,3.1,4.0].map(x=>column(x,5.0,9.0,.42));
box(15.2,1.3,6.4,[whiteMain,whiteMain,greyMain,whiteMain,whiteMain,whiteMain],0,10.4+.65,2.6);
const lightStrip=glow(M('main',{color:C('#FFF6E2'),emissive:C('#FFF1D2'),emissiveIntensity:0}),1.2,.15);
box(14.6,.16,.1,lightStrip,0,10.55,5.82);
box(15.8,.3,6.8,whiteMain,0,11.85,2.6);
const tri=new THREE.Shape(); tri.moveTo(-7.9,0); tri.lineTo(7.9,0); tri.lineTo(0,3.4); tri.lineTo(-7.9,0);
const pediment=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:6.6,bevelEnabled:false}),[whiteMain,M('main',{color:C('#6B7075'),roughness:.8})]); pediment.position.set(0,12,-.7); add(mainB,pediment,-1,'main',{edges:false});
const tri2=new THREE.Shape(); tri2.moveTo(-6.9,0); tri2.lineTo(6.9,0); tri2.lineTo(0,2.75); tri2.lineTo(-6.9,0);
const tymp=new THREE.Mesh(new THREE.ShapeGeometry(tri2),atticMain); tymp.position.set(0,12.25,5.92); mainB.add(tymp);
const medal=new THREE.Mesh(new THREE.CircleGeometry(.85,40),goldMain); medal.position.set(0,13.25,5.96); mainB.add(medal);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.98,.1,8,40),goldMain); ring.position.set(0,13.25,5.96); mainB.add(ring);
// paños laterales del bloque central con ventanas pequeñas
[-1,1].forEach(s=>{ box(1.8,10.4,.4,creamMain,s*7.6,5.2,.2); box(1.1,1.6,.1,glassMain,s*7.6,7.6,.45); box(1.1,1.6,.1,glassMain,s*7.6,3.2,.45); });
// --- alas con pórtico de 6 columnas, nombre en letras doradas y piso alto ---
const letterL=M('main',{map:tex(letterCanvas('UNIVERSIDAD POLITÉCNICA',false)),emissiveMap:tex(letterCanvas('UNIVERSIDAD POLITÉCNICA',true)),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}); glow(letterL,.9);
const letterR=M('main',{map:tex(letterCanvas('ESTATAL DEL CARCHI',false)),emissiveMap:tex(letterCanvas('ESTATAL DEL CARCHI',true)),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}); glow(letterR,.9);
const wingFrontMat=glow(M('main',{map:rep(wingFT,'wf',5.4,1),emissiveMap:rep(wingFET,'wfe',5.4,1),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}),.9);
const wingCols={};
const COLX=[-23.5,-20.3,-17,-13.7,-10.5,-7.2];
[-1,1].forEach(s=>{
  const cx=s*14.6;   // ala entre |x| 6.7 y 22.5
  box(15.8,H_W,12,[facadeMatH('main',12,3),facadeMatH('main',12,3),roofMainTop,creamMain,wingFrontMat,creamMain],cx,H_W/2,-6);
  box(16.2,.5,.6,whiteMain,cx,H_W+.25,.1);
  box(15.8,.9,.3,creamMain,cx,H_W+.95,-.1);
  const ent=box(17.8,1.5,4.3,[whiteMain,whiteMain,greyMain,whiteMain,s<0?letterL:letterR,whiteMain],s*15.6,7.9+.75,2.15);
  box(18.2,.32,4.7,whiteMain,s*15.6,9.81,2.15);
  wingCols[s]=COLX.map(x=>column(s*-x,3.5,6.7,.42));
  box(17.8,.12,4.3,M('main',{color:C('#D9D0BC')}),s*15.6,.06,2.15,{cast:false});
  wingCols[s].ent=ent;
  // claraboyas a cuatro aguas y tanques azules sobre la cubierta del ala
  const hip=new THREE.ConeGeometry(.5,1.4,4,1,true); hip.rotateY(Math.PI/4); hip.scale(7*1.414,1,4.4*1.414);
  const sk=new THREE.Mesh(hip,M('main',{color:C('#E7EEF2'),roughness:.1,metalness:.1,transparent:true,opacity:.7,side:THREE.DoubleSide})); sk.position.set(s*16.5,H_W+.75,-6.5); mainB.add(sk);
  [0,1.5].forEach(o=>{ const tk=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,1.2,14),M('main',{color:C('#2A6FD1'),roughness:.5})); tk.position.set(s*(11.2+o),H_W+.6,-2.4); tk.castShadow=true; mainB.add(tk); });
});
// --- torres de pizarra en los extremos ---
const towersMain=[];
[-1,1].forEach(s=>{
  const cx=s*26.25;
  const t=box(7.5,12.8,12,[stoneMat('main',12,13),stoneMat('main',12,13),stoneMat('main',8,12),creamMain,stoneMat('main',8,13),stoneMat('main',8,13)],cx,6.4,-4);
  box(8.1,.45,12.6,whiteMain,cx,10.4,-4);
  box(8.3,.6,12.8,whiteMain,cx,12.9,-4);
  box(2.5,9.2,.14,whiteMain,cx,5.4,2.05);
  box(1.8,8.6,.2,glassMain,cx,5.4,2.12);
  const up=glow(M('main',{color:C('#F6E3BC'),emissive:C('#FFC870'),emissiveIntensity:0}),1.6);
  box(7.2,.25,.2,up,cx,12.5,2.12); box(7.2,.25,.2,up,cx,9.95,2.12);
  towersMain.push(t);
});
// --- cuerpo posterior (≈ 27 m de fondo según el mapa): patio interior y barra al noreste; al suroeste, arcada hacia el jardín ---
slab(5.8,11,8,25.4,5.5,-16,facadeMatH('main',8,3));                                     // conector lateral NE
slab(19.5,11,7,18.25,5.5,-23.5,facadeMatH('main',19,3));                                 // barra trasera NE
flatIn(mainB,new THREE.PlaneGeometry(14,8),M('main',{map:rep(grassT,'pc',2,1.2)}),15.5,.04,-16);
box(19.5,.9,.35,creamMain,18.25,11.45,-27.1);
const pyr=new THREE.ConeGeometry(.5,2.2,4,1,true); pyr.rotateY(Math.PI/4); pyr.scale(6*1.414,1,4*1.414);
const pyrM=new THREE.Mesh(pyr,M('main',{color:C('#E7EEF2'),roughness:.1,metalness:.1,transparent:true,opacity:.7,side:THREE.DoubleSide})); pyrM.position.set(18,12.1,-23.5); mainB.add(pyrM);
// lado suroeste: arcada de un piso con terraza verde mirando al jardín de la rosa de los vientos
box(4,3.8,13,[glassMain,creamMain,M('main',{map:rep(grassT,'gt',1,3)}),creamMain,creamMain,creamMain],-10.5,1.9,-20.5);
for(let k=0;k<6;k++) box(.6,3.8,.6,whiteMain,-12.6,1.9,-14.5-k*2.4);
// fachada posterior: marquesina curva de vidrio sobre el acceso, bóveda de luz y torres de pizarra hacia la plaza
const vault=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.4,16,24,1,true,0,Math.PI),M('main',{color:C('#DDE6EA'),roughness:.15,metalness:.2,transparent:true,opacity:.8,side:THREE.DoubleSide})); vault.rotation.z=Math.PI/2; vault.scale.set(1,1,.7); vault.position.set(0,4.6,-27.6); mainB.add(vault);
[-1,1].forEach(s=>{ box(4,12.4,4,[stoneMat('main',4,12),stoneMat('main',4,12),stoneMat('main',4,4),creamMain,stoneMat('main',4,12),stoneMat('main',4,12)],s*10.5,6.2,-26); box(1.4,8,.15,glassMain,s*10.5,6,-28.05); box(4.5,.45,4.5,whiteMain,s*10.5,12.6,-26); });
flatIn(mainB,new THREE.PlaneGeometry(9,3.5),M('main',{color:C('#B5563B'),roughness:.9}),0,.06,-28.9);
// astas con banderas sobre las alas, junto al bloque central
const flags=[];
const poleMatF=M('main',{color:C('#C9CCD0'),metalness:.6,roughness:.3});
function flagPole(group,x,y,z,k,h,fw,ph){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,h,8),poleMatF); pole.position.set(x,y+h/2,z); pole.castShadow=true; group.add(pole);
  const geo=new THREE.PlaneGeometry(fw,fw*.66,14,6); geo.translate(fw/2,0,0);
  const fl=new THREE.Mesh(geo,M(group===mainB?'main':'infra',{map:flagTex[k],side:THREE.DoubleSide,roughness:.9})); fl.position.set(x,y+h-fw*.36,z); fl.castShadow=true; group.add(fl);
  fl.userData.orig=Float32Array.from(geo.attributes.position.array); fl.userData.ph=ph; fl.userData.w=fw; flags.push(fl); return fl;
}
[[-14.9,'ec'],[-11.4,'ec'],[8.8,'green'],[12.4,'tri']].forEach(([x,k],i)=>flagPole(mainB,x,H_W,-1.6,k,7,3.4,i*1.3));
// vitrinas iluminadas entre la reja y el pórtico
const vitrineMat=glow(M('main',{color:C('#2E6B44'),roughness:.1,emissive:C('#5CFF95'),emissiveIntensity:.3},.75),1.1,.3);
const vitrines=[];
[-21,-12,12,21].forEach(x=>{ box(1.5,.4,1.1,whiteMain,x,.2,6.4); const v=box(1.3,2.3,.9,vitrineMat,x,1.55,6.4,{cast:false}); vitrines.push(v); box(.35,1.4,.35,M('main',{color:C('#C9C3B3')}),x,1.1,6.4); });

/* ---------- reja (a 2-3 m de las columnas, como en la foto), vereda y avenida Antisana ---------- */
const FZ=8;
const fenceRailMat=M('main',{map:fenceT,transparent:true,alphaTest:.5,side:THREE.DoubleSide,metalness:.4,roughness:.5});
const fenceRail=(x0,x1,z)=>{ const len=x1-x0; const t=fenceT.clone(); t.needsUpdate=true; t.repeat.set(len,1); const m=new THREE.Mesh(new THREE.PlaneGeometry(len,2.4),fenceRailMat.clone()); m.material.map=t; catMats.main.push(m.material); m.position.set((x0+x1)/2,.55+1.2,z); mainB.add(m); };
const capGeo=new THREE.ConeGeometry(.72,.75,4); capGeo.rotateY(Math.PI/4);
function pillar(x,z,h){ box(1,h,1,whiteMain,x,h/2,z); const c=new THREE.Mesh(capGeo,whiteMain); c.position.set(x,h+.37,z); add(mainB,c,-1,'main',{edges:false}); const b=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),goldMain); b.position.set(x,h+.85,z); mainB.add(b); }
const fx=[-38,-31.7,-25.4,-19.1,-12.8,-7,7,12.8,19.1,25.4,31.7,38];
fx.forEach(x=>pillar(x,FZ,Math.abs(x)===7?3.4:2.9));
for(let i=0;i<fx.length-1;i++){ const a=fx[i],b=fx[i+1]; if(a===-7) continue; box(b-a-1,.55,.5,creamMain,(a+b)/2,.27,FZ); fenceRail(a+.5,b-.5,FZ); }
const gateLeaves={};
[-1,1].forEach(s=>{ [0,1].forEach(j=>{ const g=new THREE.Group(); g.position.set(s*(6.5-j*3.3),0,FZ); g.rotation.y=s*-1.65; mainB.add(g);
  const t=fenceT.clone(); t.needsUpdate=true; t.repeat.set(3.2,1); const mm=fenceRailMat.clone(); mm.map=t; catMats.main.push(mm);
  const leaf=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.6),mm); leaf.position.set(-s*1.6,1.5,0); g.add(leaf); if(j===0) gateLeaves[s]=leaf; }); });
const lampMat=glow(M('context',{color:C('#E8ECEF'),emissive:C('#FFD08A'),emissiveIntensity:0}),2.2);
const poleMat=M('context',{color:C('#3F4549'),metalness:.5,roughness:.4});
[-34,-16,16,34].forEach(x=>{ const p=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,5,8),poleMat); p.position.set(x,2.5,9); p.castShadow=true; ctx.add(p); const l=new THREE.Mesh(new THREE.CylinderGeometry(.35,.22,.8,6),lampMat); l.position.set(x,5.3,9); ctx.add(l); });
const bolCols=['#E87B1E','#1E2328','#2B2F3A','#D93A26','#1E2328'];
[[-13,33],[-10.5,36],[-8,39],[-5.2,41.6],[-1.8,43.8]].forEach(([x,z],i)=>{
  const b=new THREE.Mesh(new THREE.BoxGeometry(.42,1.05,.42),M('context',{color:C(bolCols[i])})); b.position.set(x,.52,z); b.castShadow=true; ctx.add(b);
  const w=new THREE.Mesh(new THREE.BoxGeometry(.44,.14,.44),M('context',{color:C('#F2F2EE')})); w.position.set(x,.8,z); ctx.add(w);
  const c=new THREE.Mesh(capGeo,M('context',{color:C(i%2?'#B9312A':'#E9E6DE')})); c.scale.set(.32,.32,.32); c.position.set(x,1.17,z); ctx.add(c);
});
const AVZ=16.4;
flatIn(groundG,new THREE.PlaneGeometry(240,2.6),M('ground',{map:rep(paveT,'sw',60,.65)}),30,.045,8.6+.4);
flatIn(groundG,new THREE.PlaneGeometry(14,1200),M('ground',{map:rep(asphaltT,'av',1,75),roughness:.95}),0,.02,AVZ,Math.PI/2);
const zebraMat=(rx,ry)=>{ const t=zebraT.clone(); t.needsUpdate=true; t.repeat.set(rx,ry); return M('ground',{map:t,transparent:true,alphaTest:.5}); };
[-11,11].forEach(x=>flatIn(groundG,new THREE.PlaneGeometry(4,13),zebraMat(1,13/1.6),x,.05,AVZ));
flatIn(groundG,new THREE.PlaneGeometry(170,60),M('ground',{map:rep(streetPaveT,'cb',42,15),roughness:.95}),0,.03,23.4+30);
flatIn(groundG,new THREE.PlaneGeometry(78,6),M('ground',{map:rep(paveT,'pi',19.5,1.5)}),0,.035,4.8);
flatIn(groundG,new THREE.PlaneGeometry(30,4),M('ground',{map:rep(paveT,'pt',7.5,1)}),0,.035,-29);

/* =========================================================
   PARTE 2 · EDIFICIO DE AULAS (Aulas 4 = bloque B)
   Planta levantada de la foto cenital: dos bloques en espejo de planta romboidal
   que abrazan un patio octogonal con la fuente al centro. Pasos abiertos al oeste y al este.
   Coordenadas locales (X, Z) en metros con la fuente en el origen; el Aulas 2 ocupa Z < 0,
   Aulas 4 ocupa Z > 0. Ubicación según el mapa: a la derecha y detrás del edificio principal.
   ========================================================= */
const OX=68.4, OZ=-18.9, KS=0.66;   // escala en planta: contorno de la foto cenital ajustado a las medidas del mapa
const aulas=new THREE.Group(); aulas.position.set(OX,0,OZ); aulas.rotation.y=Math.PI/2-.065; aulas.scale.set(KS,1,KS); scene.add(aulas);
const trunkMat=M('context',{color:C('#5B4634')});
const leafMat=M('context',{color:C('#3F6A2C'),roughness:.9,flatShading:true});
const toV2=pts=>pts.map(([x,z])=>new THREE.Vector2(x,-z));
function extrudeY(shape,h){ const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:24}); g.rotateX(-Math.PI/2); return g; }
function worldTex(base,key,sx,sy){ const k='W'+key+sx+'_'+sy; if(repCache.has(k)) return repCache.get(k); const t=base.clone(); t.needsUpdate=true; t.repeat.set(1/sx,-1/sy); t.offset.set(0,1/sy); repCache.set(k,t); return t; }
function inset(pts,d){
  const n=pts.length; let A=0; for(let i=0;i<n;i++){ const a=pts[i],b=pts[(i+1)%n]; A+=a[0]*b[1]-b[0]*a[1]; }
  const s=A>0?1:-1, nrm=[];
  for(let i=0;i<n;i++){ const a=pts[i],b=pts[(i+1)%n]; let ex=b[0]-a[0], ez=b[1]-a[1]; const L=Math.hypot(ex,ez)||1; ex/=L; ez/=L; nrm.push([-ez*s,ex*s]); }
  return pts.map((p,i)=>{ const n1=nrm[(i-1+n)%n], n2=nrm[i]; const dd=Math.max(.3,1+n1[0]*n2[0]+n1[1]*n2[1]); return [p[0]+d*(n1[0]+n2[0])/dd, p[1]+d*(n1[1]+n2[1])/dd]; });
}
function fillet(P,Q,Rr,radius,seg){
  const a=[P[0]-Q[0],P[1]-Q[1]], b=[Rr[0]-Q[0],Rr[1]-Q[1]]; const la=Math.hypot(...a), lb=Math.hypot(...b);
  const ua=[a[0]/la,a[1]/la], ub=[b[0]/lb,b[1]/lb]; const ang=Math.acos(ua[0]*ub[0]+ua[1]*ub[1]); const t=radius/Math.tan(ang/2);
  const p1=[Q[0]+ua[0]*t,Q[1]+ua[1]*t], p2=[Q[0]+ub[0]*t,Q[1]+ub[1]*t];
  const bis=[ua[0]+ub[0],ua[1]+ub[1]]; const lbis=Math.hypot(...bis); const dc=radius/Math.sin(ang/2); const c=[Q[0]+bis[0]/lbis*dc,Q[1]+bis[1]/lbis*dc];
  const a1=Math.atan2(p1[1]-c[1],p1[0]-c[0]); let a2=Math.atan2(p2[1]-c[1],p2[0]-c[0]); let da=a2-a1; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
  const out=[]; for(let k=0;k<=seg;k++){ const aa=a1+da*k/seg; out.push([c[0]+radius*Math.cos(aa),c[1]+radius*Math.sin(aa)]); } return out;
}
function lerp2(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
function faceDir(obj,dx,dz){ obj.rotation.y=Math.atan2(dx,dz); }
function edgeNormal(a,b,towardCourt){
  let nx=-(b[1]-a[1]), nz=(b[0]-a[0]); const L=Math.hypot(nx,nz); nx/=L; nz/=L;
  const m=lerp2(a,b,.5); if(((0-m[0])*nx+(0-m[1])*nz)*(towardCourt?1:-1)<0){ nx=-nx; nz=-nz; } return [nx,nz];
}
// contorno del bloque (de la foto cenital)
const PA={A:[-32.2,-18],B:[-14.5,-36.1],C:[-11,-32.1],D:[4.5,-32.1],E:[9.3,-37],F:[28.3,-20.2],G:[16,-4],H:[6.5,-14],I:[-6.5,-14],J:[-16.5,-4]};
const BULGE=(()=>{ const out=[], F=PA.F, G=PA.G, n=[.796,.605]; for(let k=1;k<10;k++){ const t=k/10, b=Math.sin(Math.PI*clamp01((t-.18)/.64))*1.6*(t>.18&&t<.82?1:0); out.push([F[0]+(G[0]-F[0])*t+n[0]*b, F[1]+(G[1]-F[1])*t+n[1]*b]); } return out; })();
const OUTLINE_A=[PA.A,PA.B,PA.C,PA.D,PA.E,PA.F,...BULGE,PA.G,PA.H,PA.I,...fillet(PA.I,PA.J,PA.A,5.5,10)];
const SKY_POS=[[-3.6,-27.9],[-3.4,-19.3]];

/* ---- planos por planta de Aulas 4 (distribución estimada: aulas perimetrales, pasillo, núcleo) ---- */
function makePlans(pts,opts){
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9; pts.forEach(([x,z])=>{ minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); });
  minX-=.5; maxX+=.5; minZ-=.5; maxZ+=.5;
  const w=maxX-minX, h=maxZ-minZ, PPM=16, W=Math.ceil(w*PPM), H=Math.ceil(h*PPM), n=pts.length;
  const cum=[0]; for(let i=0;i<n;i++){ const a=pts[i],b=pts[(i+1)%n]; cum.push(cum[i]+Math.hypot(b[0]-a[0],b[1]-a[1])); }
  const D=new Float32Array(W*H), AL=new Float32Array(W*H), IN=new Uint8Array(W*H);
  for(let py=0;py<H;py++) for(let px=0;px<W;px++){
    const X=minX+(px+.5)/PPM, Z=minZ+(py+.5)/PPM; let inside=false, best=1e9, al=0;
    for(let i=0,j=n-1;i<n;j=i++){ const a=pts[i], b=pts[j];
      if(((a[1]>Z)!==(b[1]>Z)) && (X < (b[0]-a[0])*(Z-a[1])/(b[1]-a[1])+a[0])) inside=!inside; }
    for(let i=0;i<n;i++){ const a=pts[i], b=pts[(i+1)%n]; const ex=b[0]-a[0], ez=b[1]-a[1], L2=ex*ex+ez*ez; let t=((X-a[0])*ex+(Z-a[1])*ez)/L2; t=Math.max(0,Math.min(1,t));
      const dx=X-a[0]-t*ex, dz=Z-a[1]-t*ez, d=dx*dx+dz*dz; if(d<best){ best=d; al=cum[i]+t*Math.sqrt(L2); } }
    const k=py*W+px; D[k]=Math.sqrt(best); AL[k]=al; IN[k]=inside?1:0;
  }
  const mod=(a,m)=>((a%m)+m)%m;
  const col=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const P={room:col('#ECE5D6'),corr:col('#CFC8BA'),core:col('#DED4C1'),wall:col('#4A4F55'),glass:col('#8DB3CE'),desk:col('#C3B59C'),stair:col('#9AA0A6'),void:col('#BFE0F2'),door:col('#ECE5D6')};
  const texs=[];
  for(let lv=0;lv<3;lv++){
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d'); const img=g.createImageData(W,H), d=img.data;
    for(let py=0;py<H;py++) for(let px=0;px<W;px++){
      const k=py*W+px, X=minX+(px+.5)/PPM, Z=minZ+(py+.5)/PPM, dd=D[k], al=AL[k]; let c=P.room;
      if(!IN[k]) c=P.wall;
      else if(dd<.32){ c=(mod(al,4)>.7&&mod(al,4)<3.3)?P.glass:P.wall;
        if(lv===0) for(const dp of opts.doors){ if(Math.hypot(X-dp[0],Z-dp[1])<1.4) c=P.door; } }
      else if(dd<7){ const m=mod(al,7.2); c=m<.16?P.wall:P.room;
        if(c===P.room && dd>1.4 && dd<6.2 && m>.9 && m<6.3 && mod(dd-1.4,1.25)<.5 && mod(m-.9,1.35)<.9) c=P.desk; }
      else if(dd<7.18){ const m=mod(al,7.2); c=(m>3&&m<4.2)?P.corr:P.wall; }
      else if(dd<9.8) c=P.corr;
      else if(dd<9.98){ c=(mod(al,9)>4&&mod(al,9)<5.2)?P.corr:P.wall; }
      else { c=(mod(X,6)<.16||mod(Z,6)<.16)?P.wall:P.core; }
      const sc=opts.stair; if(IN[k]&&Math.abs(X-sc[0])<2.6&&Math.abs(Z-sc[1])<2.6){ c=(mod(X*3,1)<.45)?P.stair:P.corr; if(Math.abs(X-sc[0])>2.45||Math.abs(Z-sc[1])>2.45) c=P.wall; }
      if(lv===2) for(const s of opts.voids){ if(Math.abs(X-s[0])<4&&Math.abs(Z-s[1])<3){ c=P.void; const u=(X-s[0])/4, v=(Z-s[1])/3; if(Math.abs(Math.abs(u)-Math.abs(v))<.05||Math.abs(u)>.96||Math.abs(v)>.94) c=P.wall; } }
      d[k*4]=c[0]; d[k*4+1]=c[1]; d[k*4+2]=c[2]; d[k*4+3]=255;
    }
    g.putImageData(img,0,0);
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=aniso; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    t.repeat.set(1/w,1/h); t.offset.set(-minX/w,maxZ/h); texs.push(t);
  }
  return texs;
}

function sideMat(cat){ return cached('side'+cat,()=>glow(M(cat,{map:worldTex(winT,'w',4,FH),emissiveMap:worldTex(winEmT,'we',4,FH),emissive:new THREE.Color(1,1,1),emissiveIntensity:0}),1.15)); }
function capPlan(cat){ return cached('cap'+cat,()=>M(cat,{map:rep(planT,'plw',1/8,1/8)})); }
function roofCapM(cat){ return cached('rc'+cat,()=>M(cat,{map:rep(roofT,'rfw',1/36,1/36),roughness:.95})); }
function doorM(cat){ return cached('dr'+cat,()=>M(cat,{color:C('#11171C'),roughness:.3,metalness:.3})); }
function stepM(cat){ return cached('stp'+cat,()=>M(cat,{color:C('#9EA1A3')})); }
function skyGlassM(cat){ return cached('sg'+cat,()=>glow(M(cat,{color:C('#E9F1F6'),roughness:.1,metalness:.1,side:THREE.DoubleSide,emissive:C('#FFE1B0'),emissiveIntensity:0},.58),.5)); }
function tankM(cat){ return cached('tk'+cat,()=>M(cat,{color:C('#2A6FD1'),roughness:.5})); }
const ribMat=new THREE.LineBasicMaterial({color:0xF4F6F7});
const blocks={};
function buildBlock(sz,key,K,planTexs){
  CUR_BLK=key;
  const mz=p=>[p[0],p[1]*sz], g=new THREE.Group(); aulas.add(g);
  const pts=OUTLINE_A.map(mz);
  const B={floors:[],towers:[],skylights:[],doors:[],fins:[],pts};
  for(let i=0;i<3;i++){ const cap=planTexs?M(K.W,{map:planTexs[i],roughness:.9}):capPlan(K.W);
    const m=new THREE.Mesh(extrudeY(new THREE.Shape(toV2(pts)),FH),[cap,sideMat(K.W)]); m.position.y=i*FH; add(g,m,i,K.W); B.floors.push(m); }
  B.roof=new THREE.Mesh(extrudeY(new THREE.Shape(toV2(pts)),.3),[roofCapM(K.RF),creamMat(K.RF)]); B.roof.position.y=3*FH; add(g,B.roof,3,K.RF);
  const ps=new THREE.Shape(toV2(pts)); ps.holes.push(new THREE.Path(toV2(inset(pts,.45))));
  const par=new THREE.Mesh(extrudeY(ps,1.0),[creamMat(K.RF),creamMat(K.RF)]); par.position.y=3*FH+.3; add(g,par,3,K.RF);
  [PA.A,PA.B,PA.C,PA.D,PA.E,PA.F,PA.G,PA.H,PA.I].map(mz).forEach(([x,z])=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(1.1,.45,1.1),creamMat(K.RF)); b.position.set(x,3*FH+1.5,z); add(g,b,3,K.RF,{edges:false}); });
  const I=mz(PA.I), bay=new THREE.Group(); bay.position.set(I[0],0,I[1]); faceDir(bay,-I[0],-I[1]); g.add(bay);
  for(let i=0;i<3;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(8,FH,6),[creamMat(K.EN),creamMat(K.EN),planMat(K.EN,8,6),creamMat(K.EN),glassMat(K.EN),creamMat(K.EN)]); m.position.set(0,i*FH+FH/2,-1.2); add(bay,m,i,K.EN); }
  const crown=new THREE.Mesh(new THREE.BoxGeometry(8.4,1.9,6.4),[creamMat(K.EN),creamMat(K.EN),roofMat(K.RF,8,6),creamMat(K.EN),creamMat(K.EN),creamMat(K.EN)]); crown.position.set(0,3*FH+.95,-1.2); add(bay,crown,3,K.EN);
  for(let k=0;k<6;k++){ const x=-3.35+k*1.34; for(let i=0;i<4;i++){ const hh=i<3?FH:1.9; const f=new THREE.Mesh(new THREE.BoxGeometry(.4,hh,1.1),creamMat(K.EN)); f.position.set(x,i<3?i*FH+FH/2:3*FH+hh/2,2.35); add(bay,f,i,K.EN,{edges:i<3}); if(k===5&&i===2) B.fins.push(f); } }
  B.bay=bay;
  function door(a,b,t){ const p=lerp2(mz(a),mz(b),t), n=edgeNormal(mz(a),mz(b),true); const d=new THREE.Group(); d.position.set(p[0],0,p[1]); faceDir(d,n[0],n[1]); g.add(d);
    const dd=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.8,.3),doorM(K.EN)); dd.position.set(0,1.4,.05); add(d,dd,0,K.EN,{edges:false});
    const c=new THREE.Mesh(new THREE.BoxGeometry(3.4,.22,1.6),creamMat(K.EN)); c.position.set(0,3.05,.8); add(d,c,0,K.EN);
    const st=new THREE.Mesh(new THREE.BoxGeometry(3.4,.3,1.4),stepM(K.EN)); st.position.set(0,.15,.9); add(d,st,0,K.EN,{edges:false}); B.doors.push(dd); B.doorPts=(B.doorPts||[]).concat([p]); }
  door(PA.I,PA.H,.42); door(PA.I,PA.J,.42);
  function tower(a,b,t,w,dp,out){
    const p=lerp2(mz(a),mz(b),t), n=edgeNormal(mz(a),mz(b),true); const tg=new THREE.Group(); tg.position.set(p[0]+n[0]*(out-dp/2),0,p[1]+n[1]*(out-dp/2)); faceDir(tg,n[0],n[1]); g.add(tg);
    const frame=creamMat(K.TW), glass=glassMat(K.TW), segs=[];
    for(let i=0;i<4;i++){ const hh=i<3?FH:1.6, y=i<3?i*FH+FH/2:3*FH+hh/2;
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,hh,dp),stoneMat(K.TW,w,hh)); m.position.y=y; add(tg,m,i,K.TW); segs.push(m);
      if(i<3){ const fr=new THREE.Mesh(new THREE.BoxGeometry(2.5,i===0?hh-.6:hh,.2),frame); fr.position.set(0,i===0?y+.3:y,dp/2+.08); add(tg,fr,i,K.TW,{edges:false});
        const gl=new THREE.Mesh(new THREE.BoxGeometry(1.6,i===0?hh-1:hh,.26),glass); gl.position.set(0,i===0?y+.5:y,dp/2+.12); add(tg,gl,i,K.TW,{edges:false}); if(i===1) segs.win=gl; }
      else { const fr=new THREE.Mesh(new THREE.BoxGeometry(2.5,.5,.2),frame); fr.position.set(0,3*FH+.25,dp/2+.08); add(tg,fr,3,K.TW,{edges:false}); } }
    const cap=new THREE.Mesh(new THREE.BoxGeometry(w+.5,.45,dp+.5),frame); cap.position.y=3*FH+1.82; add(tg,cap,3,K.TW); segs.cap=cap;
    B.towers.push(segs); return segs; }
  tower(PA.I,PA.J,.8,8.5,8,1.2);
  tower(PA.I,PA.H,.93,8,8,1.2);
  tower(PA.H,PA.G,.86,8,8,1.2);
  for(let k=1;k<9;k++){ const p=mz(BULGE[k]); const f=new THREE.Mesh(new THREE.BoxGeometry(.35,3*FH,1),creamMat(K.W)); f.position.set(p[0]+.796*.4,3*FH/2,p[1]+.605*sz*.4); faceDir(f,.796,.605*sz); add(g,f,-1,K.W,{edges:false}); }
  SKY_POS.forEach(([x,z])=>{ const [px,pz]=mz([x,z]); const sx=8, sd=6;
    const b=new THREE.Mesh(new THREE.BoxGeometry(sx+.8,.9,sd+.8),creamMat(K.SK)); b.position.set(px,3*FH+.3+.45,pz); add(g,b,3,K.SK);
    const geo=new THREE.ConeGeometry(.5,2.6,4,1,true); geo.rotateY(Math.PI/4); geo.scale(sx*1.414,1,sd*1.414);
    const p=new THREE.Mesh(geo,skyGlassM(K.SK)); p.position.set(px,3*FH+.3+.9+1.3,pz); add(g,p,3,K.SK,{edges:false,cast:false});
    p.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,1),ribMat)); B.skylights.push(p); });
  const tk=mz([2.4,-15.8]); B.tank=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,1.4,16),tankM(K.RF)); B.tank.position.set(tk[0],3*FH+1,tk[1]); add(g,B.tank,3,K.RF,{edges:false});
  const hc=mz([5.8,-29.5]); const hatch=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.1,3.4),creamMat(K.RF)); hatch.position.set(hc[0],3*FH+.85,hc[1]); add(g,hatch,3,K.RF);
  const st=mz([-16,-30]); const vent=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,1.2),creamMat(K.RF)); vent.position.set(st[0],3*FH+.7,st[1]); add(g,vent,3,K.RF,{edges:false});
  B.group=g; blocks[key]=B; CUR_BLK=null; return B;
}
const TW_K={W:'twin',RF:'twin',EN:'twin',TW:'twin',SK:'twin'};
const B4_K={W:'wing',RF:'roof',EN:'entrance',TW:'tower',SK:'skylight'};
const BA=buildBlock(1,'A',TW_K,null);
const B4pts=OUTLINE_A.map(p=>[p[0],-p[1]]);
const B4doors=[lerp2([PA.I[0],-PA.I[1]],[PA.H[0],-PA.H[1]],.42),lerp2([PA.I[0],-PA.I[1]],[PA.J[0],-PA.J[1]],.42)];
const B4stair=(()=>{ const I=[PA.I[0],-PA.I[1]], L=Math.hypot(...I); return [I[0]+I[0]/L*4.2, I[1]+I[1]/L*4.2]; })();
const BB=buildBlock(-1,'B',B4_K,makePlans(B4pts,{doors:B4doors,stair:B4stair,voids:SKY_POS.map(([x,z])=>[x,-z])}));

/* ---------- patio octogonal ---------- */
const plazaGroup=new THREE.Group(); aulas.add(plazaGroup);
const pflat=(geo,mat,x,y,z)=>flatIn(plazaGroup,geo,mat,x,y,z);
pflat(new THREE.PlaneGeometry(96,96),M('plaza',{map:rep(paveT,'pv',24,24)}),-2,.03,0);
pflat(new THREE.RingGeometry(6.4,6.75,64),M('plaza',{color:C('#C9C4B8')}),0,.05,0);
const lawnMat=M('plaza',{map:rep(grassT,'gr',1/6,1/6)});
const hedgeMatY=M('plaza',{color:C('#D9B62A'),roughness:.9});
function shapeFlat(group,wp,mat,y){ const m=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(wp.map(([x,z])=>new THREE.Vector2(x,-z)))),mat); m.rotation.x=-Math.PI/2; m.position.y=y; m.receiveShadow=true; group.add(m); return m; }
const gardens=[], hedgePts=[];
function hedgeAlong(wp,step,ins){ const p=inset(wp,ins); for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length]; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const n=Math.max(1,Math.round(L/step)); for(let k=0;k<n;k++) hedgePts.push(lerp2(a,b,k/n)); } }
[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
  const r=6.75, w=1.6, arcA=Math.asin(w/r), pts=[];
  pts.push([w,Math.sqrt(r*r-w*w)],[w,11.5],[5.46,11.5],[15.36,w],[Math.sqrt(r*r-w*w),w]);
  for(let k=1;k<12;k++){ const a=arcA+(Math.PI/2-2*arcA)*k/12; pts.push([r*Math.sin(a),r*Math.cos(a)]); }
  const wp=pts.map(([x,z])=>[x*sx,z*sz]);
  gardens.push(shapeFlat(plazaGroup,wp,lawnMat,.07)); hedgeAlong(wp,.7,.45);
});
const shrubMat=M('plaza',{color:C('#3E6B2E'),roughness:.9,flatShading:true});
[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ [[5,8.6],[9.6,5]].forEach(([x,z])=>{ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,0),shrubMat); s.position.set(x*sx,.75,z*sz); s.castShadow=true; plazaGroup.add(s); }); });
const fBase=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.7,.45,48),M('plaza',{color:C('#E3E2DC'),roughness:.6}));
fBase.position.set(0,.23,0); fBase.scale.set(1/KS,1,1/KS); add(plazaGroup,fBase,-1,'plaza');
pflat(new THREE.CircleGeometry(2.35/KS,48),M('plaza',{map:fountainT,roughness:.25,metalness:.1}),0,.47,0);
const jetMat=glow(M('plaza',{color:C('#F2F7FB'),roughness:.1,emissive:C('#9CC4F0'),emissiveIntensity:0},.6),.6);
const jet=new THREE.Mesh(new THREE.CylinderGeometry(.05,.13,.9,10),jetMat); jet.position.set(0,.9,0); plazaGroup.add(jet);
const benchMat=M('plaza',{color:C('#B9B4A6')});
[45,135,225,315].forEach(d=>{ const a=d*Math.PI/180, r=5.6; const b=new THREE.Mesh(new THREE.BoxGeometry(2.4,.45,.6),benchMat); b.position.set(r*Math.cos(a),.23,r*Math.sin(a)); b.rotation.y=-a+Math.PI/2; b.scale.set(1/KS,1,1/KS); add(plazaGroup,b,-1,'plaza',{edges:false}); });
const pPole=M('plaza',{color:C('#5D6468'),metalness:.5,roughness:.4});
const pLamp=glow(M('plaza',{color:C('#E8ECEF'),emissive:C('#FFD08A'),emissiveIntensity:0}),2.2);
const panelMat=M('plaza',{color:C('#22324A'),metalness:.4,roughness:.3});
function solarLamp(group,x,z){ const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,5.5,8),pPole); p.position.set(x,2.75,z); p.castShadow=true; group.add(p);
  const h=new THREE.Mesh(new THREE.BoxGeometry(1,.15,.35),pLamp); h.position.set(x+.4,5.4,z); group.add(h);
  const sp=new THREE.Mesh(new THREE.BoxGeometry(1.1,.06,.7),panelMat); sp.position.set(x,5.8,z); sp.rotation.z=.35; group.add(sp); }
[[-7.5,-7.5],[7.5,-7.5],[-7.5,7.5],[7.5,7.5]].forEach(([x,z])=>solarLamp(plazaGroup,x,z));
const pplMat=M('plaza',{color:C('#2F3A44')});
[[-3,-9],[2,-12],[-9,1],[4,4],[-12,-3],[0,8]].forEach(([x,z])=>{ const p=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,1.7,8),pplMat); p.position.set(x,.85,z); p.scale.set(1/KS,1,1/KS); p.castShadow=true; plazaGroup.add(p); });

/* ---------- entorno de Aulas 2 y Aulas 4: jardineras, senderos con gradas y barandales, parqueaderos ---------- */
const envG=new THREE.Group(); aulas.add(envG);
const envLawn=M('context',{map:rep(grassT,'gl',1/6,1/6)});
const envShrub=M('context',{color:C('#3E6B2E'),roughness:.9,flatShading:true});
const brick=M('context',{color:C('#A9553E'),roughness:.9});
const envPave=M('context',{map:rep(paveT,'ep',1/4,1/4)});
const stepMatE=M('context',{color:C('#B9BBBC'),roughness:.85});
const railMat=M('context',{color:C('#E9EAE8'),metalness:.3,roughness:.4});
const flowerMats=['#E8C42A','#D9473A','#F2F2EE','#C23A6B'].map(c=>M('context',{color:C(c),roughness:.9}));
function planter(x,z,r){ const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.22,6,32),brick); ring.rotation.x=Math.PI/2; ring.position.set(x,.25,z); envG.add(ring);
  const soil=new THREE.Mesh(new THREE.CircleGeometry(r,32),M('context',{color:C('#5A4634')})); soil.rotation.x=-Math.PI/2; soil.position.set(x,.12,z); envG.add(soil);
  const n=Math.round(r*7); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, rr=r*.72; const f=new THREE.Mesh(new THREE.SphereGeometry(.32,6,5),flowerMats[k%4]); f.position.set(x+rr*Math.cos(a),.35,z+rr*Math.sin(a)); f.scale.set(1/KS,1,1/KS); envG.add(f); }
  const c=new THREE.Mesh(new THREE.IcosahedronGeometry(r*.45,0),envShrub); c.position.set(x,r*.45,z); c.castShadow=true; envG.add(c); }
// sendero: franja adoquinada entre dos puntos, con tramos de gradas y barandales a ambos lados
const railPosts=[], railBars=[];
function railLine(group,a,b,yOff){ const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz), n=Math.max(2,Math.round(L/2.5)); for(let k=0;k<=n;k++) railPosts.push([group,a[0]+dx*k/n,a[1]+dz*k/n,yOff||0]); railBars.push([group,(a[0]+b[0])/2,(a[1]+b[1])/2,L,Math.atan2(dx,dz),yOff||0]); }
function walkway(group,a,b,w,stairsAt,rails){
  const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz), ux=dx/L, uz=dz/L, ang=Math.atan2(dx,dz);
  const strip=new THREE.Mesh(new THREE.PlaneGeometry(w,L),envPave); strip.rotation.x=-Math.PI/2; strip.rotation.z=Math.atan2(-dx,-dz); strip.position.set((a[0]+b[0])/2,.1,(a[1]+b[1])/2); strip.receiveShadow=true; group.add(strip);
  (stairsAt||[]).forEach(t=>{ for(let k=0;k<5;k++){ const s=new THREE.Mesh(new THREE.BoxGeometry(w,.16*(5-k),.45),stepMatE); s.position.set(a[0]+ux*(t*L+k*.45),.08*(5-k)+.1,a[1]+uz*(t*L+k*.45)); s.rotation.y=ang; s.castShadow=s.receiveShadow=true; group.add(s); } });
  if(rails){ [-1,1].forEach(sd=>{ const ox=-uz*sd*(w/2+.15), oz=ux*sd*(w/2+.15); const n=Math.max(2,Math.round(L/2.5));
    for(let k=0;k<=n;k++){ railPosts.push([group,a[0]+dx*k/n+ox,a[1]+dz*k/n+oz,0]); }
    railBars.push([group,(a[0]+b[0])/2+ox,(a[1]+b[1])/2+oz,L,ang,0]); }); }
}
function flushRails(){ const byG=new Map(); railPosts.forEach(([g,x,z,y])=>{ if(!byG.has(g)) byG.set(g,[]); byG.get(g).push([x,z,y]); });
  byG.forEach((list,g)=>{ const im=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,1.05,6),railMat,list.length); list.forEach(([x,z,y],i)=>{ dummy.position.set(x,.62+y,z); dummy.rotation.set(0,0,0); dummy.scale.set(g===envG?1/KS:1,1,g===envG?1/KS:1); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); }); g.add(im); });
  railBars.forEach(([g,x,z,L,ang,yo])=>{ [1.12,.62].forEach(y=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,L),railMat); b.position.set(x,y+yo,z); b.rotation.y=ang; g.add(b); }); }); railPosts.length=0; railBars.length=0; }
// jardineras entre el edificio y el coliseo (según la vista satelital: mucho más amplias que el patio)
const LA=[[11,-39],[30.5,-21.5],[30.3,-18.7],[19.3,-3],[76,-3],[76,-44],[11,-44]];
const LB=[[11,39],[30.5,21.5],[30.3,18.7],[19.3,3],[76,3],[76,29.5],[24,29.5],[24,39]];
shapeFlat(envG,LA,envLawn,.06); shapeFlat(envG,LB,envLawn,.06);
// sendero central: del paso este del patio hasta el coliseo, con dos tramos de gradas y barandales
walkway(envG,[17,0],[78,0],3.4,[.22,.62],true);
// senderos diagonales junto a las fachadas exteriores, también con gradas y barandales
walkway(envG,[29,-22.5],[76,-33],3,[.45],true);
walkway(envG,[29,22.5],[76,27],3,[.45],true);
// paseo junto al coliseo
walkway(envG,[76,-44],[76,30],4.5,[],false);
planter(42,-14,2.4); planter(60,-20,2.2); planter(42,13,2.2); planter(60,17,2.0); planter(50,-36,1.8);
// arbolitos redondos sobre las jardineras, como se ven en el mapa
const smallTrees=[];
for(let k=0;k<70;k++){ const x=32+R()*42, z=(R()<.5?-1:1)*(5+R()*30); if(Math.abs(z+(-22.5-(x-29)*.22))<3.5||Math.abs(z-(22.5+(x-29)*.1))<3.5) continue; if(z>28&&x<30) continue; smallTrees.push([x,z]); }
const stG=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),envShrub,smallTrees.length);
smallTrees.forEach(([x,z],i)=>{ const s=.7+R()*.5; dummy.position.set(x,s*1.1,z); dummy.rotation.set(0,R()*3,0); dummy.scale.set(s/KS,s*1.1,s/KS); dummy.updateMatrix(); stG.setMatrixAt(i,dummy.matrix); });
stG.castShadow=true; envG.add(stG);
// jardín oeste con jardineras circulares, entre las esquinas curvas
shapeFlat(envG,[[-30,-6],[-20.5,-6],[-20.5,-2.2],[-30,-2.2]],envLawn,.06); shapeFlat(envG,[[-30,2.2],[-20.5,2.2],[-20.5,6],[-30,6]],envLawn,.06);
planter(-25,-4.2,1.4); planter(-25,4.2,1.4);
[[[-26,-39],[-13,-39],[-13,-37.4],[-24,-27]],[[-26,39],[-13,39],[-13,37.4],[-24,27]]].forEach(p=>shapeFlat(envG,p,envLawn,.06));
[-1,1].forEach(s=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(10.4,.55,2.8),brick); b.position.set(-2.2,.28,s*34.4); b.castShadow=true; envG.add(b);
  const top=new THREE.Mesh(new THREE.BoxGeometry(9.8,.2,2.2),envLawn); top.position.set(-2.2,.6,s*34.4); envG.add(top); });
function palm(group,x,z){ const t=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,8,6),trunkMat); t.position.set(x,4,z); t.scale.set(1/KS,1,1/KS); t.castShadow=true; group.add(t);
  for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; const f=new THREE.Mesh(new THREE.BoxGeometry(4.2,.08,.9),leafMat); f.position.set(x+Math.cos(a)*1.9/KS,7.6,z-Math.sin(a)*1.9/KS); f.rotation.set(0,a,-.35); f.scale.set(1/KS,1,1/KS); f.castShadow=true; group.add(f);} }
palm(envG,-28,-14); palm(envG,-28,14); palm(envG,27,-36);
// parqueaderos: oeste (Parqueadero UPEC 1, hacia la avenida Antisana) y norte junto a la calle Sumaco
const parkT=tex(makeCanvas(128,256,(g,w,h)=>{ g.fillStyle='#4A4D50'; g.fillRect(0,0,w,h); for(let i=0;i<900;i++){ g.fillStyle='rgba(255,255,255,'+(R()*0.05)+')'; g.fillRect(R()*w,R()*h,2,2);} g.fillStyle='#E2C341'; g.fillRect(0,0,w,5); g.fillRect(0,0,5,h); }));
shapeFlat(envG,[[-42,-30],[-30.5,-30],[-30.5,30],[-42,30]],M('context',{map:rep(parkT,'pkW',1,22),roughness:.95}),.05);
shapeFlat(envG,[[25,30.5],[68,30.5],[68,39],[25,39]],M('context',{map:rep(parkT,'pkE',17.2,1),roughness:.95}),.05);
const carCols=['#E8E8E6','#C9CDD1','#2C3238','#B5352D','#8E9499','#1F3E66','#E8E8E6','#2C3238','#D9D9D6','#5B6168'];
const carList=[];
[-27,-23,-19,-15,-11,-7,7,11,15,19,23,27].forEach((z,i)=>{ if(i%4!==3) carList.push([-37.5,z,0,4.2,1.8]); });
[[PA.A,PA.B],[[PA.A[0],-PA.A[1]],[PA.B[0],-PA.B[1]]]].forEach(([a,b])=>{ const n=edgeNormal(a,b,false); for(let k=0;k<6;k++){ const p=lerp2(a,b,.18+k*.12); carList.push([p[0]+n[0]*4.6,p[1]+n[1]*4.6,Math.atan2(n[0],n[1])+Math.PI/2,4.2,1.8]); } });
[27.5,31,34.5,38,41.5,45,48.5,52,55.5].forEach((x,i)=>{ if(i%3!==2) carList.push([x,36.6,Math.PI/2,4.2,1.8]); });
const cars=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),M('context',{color:0xffffff,roughness:.4,metalness:.3}),carList.length);
carList.forEach(([x,z,r,l,w],i)=>{ dummy.position.set(x,.05,z); dummy.rotation.set(0,r,0); dummy.scale.set(l/KS,1.45,w/KS); dummy.updateMatrix(); cars.setMatrixAt(i,dummy.matrix); cars.setColorAt(i,C(carCols[i%carCols.length])); });
cars.castShadow=true; envG.add(cars);
const busMat=M('context',{color:C('#2D3238'),roughness:.4,metalness:.3});
[33,35.8].forEach(z=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(11,3.1,2.5),busMat); b.position.set(62,1.65,z); b.scale.set(1/KS,1,1/KS); b.castShadow=true; envG.add(b); });
flushRails();

/* ---------- detrás del edificio principal: plaza de la estrella, canchas, altar de banderas y otros ----------
   Posiciones tomadas de la vista satelital (≈ 7.85 px por metro), alineadas con el eje de la avenida Universitaria. */
const infra=new THREE.Group(); scene.add(infra);
const infraCream=M('infra',{color:C('#EDE6D6')});
const infraPave=M('infra',{map:rep(paveT,'ip',8.5,6)});
function iflat(geo,mat,x,y,z,rz){ return flatIn(infra,geo,mat,x,y,z,rz); }
const starShape=(r1,r2,n)=>{ const s=new THREE.Shape(); for(let k=0;k<n*2;k++){ const a=k*Math.PI/n-Math.PI/2, r=k%2?r2:r1; const x=r*Math.cos(a), y=r*Math.sin(a); if(k) s.lineTo(x,y); else s.moveTo(x,y); } return s; };
const stepI=M('infra',{color:C('#B9BBBC'),roughness:.85});
function stairsBox(group,cx,cz,w,ang,n,H,run){ for(let k=0;k<n;k++){ const hh=H*(n-k)/(n+1); const s=new THREE.Mesh(new THREE.BoxGeometry(w,hh,run),stepI); s.position.set(cx+Math.sin(ang)*k*run,hh/2,cz+Math.cos(ang)*k*run); s.rotation.y=ang; s.castShadow=s.receiveShadow=true; group.add(s); } }
// plaza de la estrella: plataforma elevada 0.9 m con barandales y gradas hacia el edificio y hacia las canchas
const plazaMosaic=tex(makeCanvas(256,256,(g,w,h)=>{ const s=16; for(let y=0;y<h;y+=s) for(let x=0;x<w;x+=s){ const v=150+Math.floor(R()*70); g.fillStyle='rgb('+v+','+v+','+(v+3)+')'; g.fillRect(x+1,y+1,s-2,s-2);} }));
const PLZ={x:0,z:-40,w:28,d:21,h:.9};
const plazaTop=new THREE.Mesh(new THREE.BoxGeometry(PLZ.w,PLZ.h,PLZ.d),[infraCream,infraCream,M('infra',{map:rep(plazaMosaic,'pm',7,5.25)}),infraCream,infraCream,infraCream]); plazaTop.position.set(PLZ.x,PLZ.h/2,PLZ.z); plazaTop.receiveShadow=true; infra.add(plazaTop);
const orangeStar=new THREE.Mesh(new THREE.ShapeGeometry(starShape(5.5,1.5,8)),M('infra',{color:C('#D9703E'),roughness:.8})); orangeStar.rotation.x=-Math.PI/2; orangeStar.position.set(-2,PLZ.h+.02,-42); infra.add(orangeStar);
stairsBox(infra,0,-29.25,12,0,3,PLZ.h,.5);                    // gradas hacia el edificio principal
stairsBox(infra,0,-50.75,26,Math.PI,4,PLZ.h,.55);             // escalinata hacia las canchas
railLine(infra,[-14.1,-29.6],[-14.1,-50.4],PLZ.h); railLine(infra,[14.1,-29.6],[14.1,-50.4],PLZ.h);
railLine(infra,[-14.1,-29.6],[-6.3,-29.6],PLZ.h); railLine(infra,[6.3,-29.6],[14.1,-29.6],PLZ.h);
// explanada entre la plaza y las canchas
iflat(new THREE.PlaneGeometry(40,9),infraPave,2,.04,-57);
// canchas: cancha sintética, cerramiento de malla, arcos y graderío con cubierta celeste
const cancha=new THREE.Group(); cancha.position.set(2.5,0,-74); cancha.rotation.y=-.055; infra.add(cancha);
flatIn(cancha,new THREE.PlaneGeometry(40,23),M('infra',{color:C('#9AA0A4'),roughness:.9}),0,.04,0);
flatIn(cancha,new THREE.PlaneGeometry(19,35),M('infra',{map:fieldT,roughness:.8}),0,.06,0,Math.PI/2);
const meshM=M('infra',{color:C('#2F5B3C'),transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}); meshM.userData.base=.35;
[[0,-11,38,0],[0,11,38,0],[-19,0,22,Math.PI/2],[19,0,22,Math.PI/2]].forEach(([x,z,l,r])=>{ const f=new THREE.Mesh(new THREE.PlaneGeometry(l,4.5),meshM); f.position.set(x,2.25,z); f.rotation.y=r; cancha.add(f); });
const postM=M('infra',{color:C('#5D6468'),metalness:.5,roughness:.4});
for(let k=0;k<=6;k++){ [-11,11].forEach(z=>{ const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,4.5,6),postM); p.position.set(-19+k*38/6,2.25,z); cancha.add(p); }); }
const goalM=M('infra',{color:C('#F4F4F2')});
[-1,1].forEach(s=>{ const g=new THREE.Group(); g.position.set(s*17.2,0,0); cancha.add(g); [-2.5,2.5].forEach(z=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2,.12),goalM); p.position.set(0,1,z); g.add(p); }); const t=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,5.1),goalM); t.position.set(0,2,0); g.add(t); });
const stand=new THREE.Mesh(new THREE.BoxGeometry(30,1.6,3.5),M('infra',{color:C('#C9CCCF')})); stand.position.set(0,.8,-15); stand.castShadow=true; cancha.add(stand);
const canopy=new THREE.Mesh(new THREE.BoxGeometry(30,.25,5),M('infra',{color:C('#36B5C9'),roughness:.5})); canopy.position.set(0,4.4,-15); canopy.rotation.x=.08; canopy.castShadow=true; cancha.add(canopy);
for(let k=0;k<5;k++){ const p=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,4.4,6),postM); p.position.set(-14+k*7,2.2,-17.2); cancha.add(p); }
// paseo con gradas y barandales entre las canchas y el coliseo
walkway(infra,[28,-56],[28,-104],7,[.25,.62],true);
// senderos: plaza → altar, edificio principal → Aulas 2 y Aulas 4
walkway(infra,[15,-40],[20.5,-42],3,[],false);
walkway(infra,[31,-21],[50,4],3.2,[.5],true);
// altar de las banderas: plataforma circular escalonada con gradas en media luna y astas
const altar=new THREE.Group(); altar.position.set(26.6,0,-43.2); infra.add(altar);
const altarM=M('infra',{color:C('#E4E0D6'),roughness:.8});
[[6.3,.4],[5.6,.8],[4.9,1.2]].forEach(([r,h])=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.4,48),altarM); c.position.y=h-.2; c.castShadow=c.receiveShadow=true; altar.add(c); });
const ringHedge=new THREE.Mesh(new THREE.TorusGeometry(6.6,.35,6,48),M('infra',{color:C('#3E6B2E'),roughness:.9})); ringHedge.rotation.x=Math.PI/2; ringHedge.position.y=.35; altar.add(ringHedge);
for(let k=0;k<3;k++){ const t=new THREE.Mesh(new THREE.CylinderGeometry(4.4-k*.55,4.4-k*.55,.45,40,1,false,Math.PI*.15,Math.PI*.7),M('infra',{color:C('#B88A4E'),roughness:.8})); t.position.y=1.2+.22+k*.45; altar.add(t); }
['ec','green','tri'].forEach((k,i)=>flagPole(infra,26.6+2.6,1.2,-43.2+(i-1)*1.6,k,11,3.2,i*.9));
const flagPal=[[['#C8102E',.5],['#FFFFFF',.5]],[['#0033A0',1/3],['#FFFFFF',1/3],['#0033A0',1/3]],[['#009B3A',.5],['#FEDF00',.5]],[['#FFFFFF',1/3],['#D52B1E',1/3],['#FFFFFF',1/3]],[['#74ACDF',1/3],['#FFFFFF',1/3],['#74ACDF',1/3]],[['#FCD116',.5],['#003893',.25],['#CE1126',.25]],[['#006847',1/3],['#FFFFFF',1/3],['#CE1126',1/3]],[['#D91023',1/3],['#FFFFFF',1/3],['#D91023',1/3]],[['#00247D',.5],['#CF142B',.5]]];
flagPal.forEach((st,i)=>{ const key='alt'+i; flagTex[key]=tex(flagCanvas(st)); const a=Math.PI*(-.42+i*.105); flagPole(infra,26.6+5.3*Math.cos(a),1.2,-43.2-5.3*Math.sin(a),key,7.5,1.9,i*.7); });
// coliseo 05 de Abril: cuerpo perimetral, explanada y cubierta roja a cuatro aguas
const coliG=new THREE.Group(); coliG.position.set(66,0,-88); infra.add(coliG);
const coliCream=M('infra',{color:C('#E9E3D6')});
flatIn(coliG,new THREE.PlaneGeometry(44,34),M('infra',{map:rep(paveT,'cpv',11,8.5)}),0,.05,0);
const coliBody=new THREE.Mesh(new THREE.BoxGeometry(34,9,26),coliCream); coliBody.position.y=4.5; coliBody.castShadow=coliBody.receiveShadow=true; coliG.add(coliBody);
for(let k=0;k<8;k++){ [-1,1].forEach(s=>{ const st=new THREE.Mesh(new THREE.BoxGeometry(1.2,9.4,.5),M('infra',{color:C('#F6F2EA')})); st.position.set(-14+k*4,4.7,s*13.3); coliG.add(st); }); }
const roofGeo=(()=>{ const hw=13.6, hl=17.6, h=5, r=hl-hw; const v=[-hl,0,-hw, hl,0,-hw, hl,0,hw, -hl,0,hw, -r,h,0, r,h,0];
  const idx=[0,4,5, 0,5,1, 1,5,2, 2,5,4, 2,4,3, 3,4,0]; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
const coliRoof=new THREE.Mesh(roofGeo,M('infra',{color:C('#D9654A'),roughness:.7,side:THREE.DoubleSide,flatShading:true})); coliRoof.position.y=9; coliRoof.castShadow=true; coliG.add(coliRoof);
// anfiteatro con concha acústica
const amphi=new THREE.Group(); amphi.position.set(-29.3,0,-43.1); infra.add(amphi);
const tierMat=M('infra',{color:C('#E1DED6'),roughness:.8});
for(let k=0;k<6;k++){ const r=7.6-k*.85, h=2.1-k*.33; const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40,1,false,Math.PI,Math.PI),tierMat); t.position.y=h/2; t.castShadow=t.receiveShadow=true; amphi.add(t); }
const stage=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,.35,40),M('infra',{color:C('#B5563B'),roughness:.9})); stage.position.set(0,.18,0); amphi.add(stage);
const shell=new THREE.Mesh(new THREE.SphereGeometry(4.2,32,12,Math.PI/2,Math.PI,0,Math.PI/2),M('infra',{color:C('#F4F3EF'),roughness:.4,side:THREE.DoubleSide})); shell.scale.set(.7,.75,1); shell.position.set(.8,0,0); shell.castShadow=true; amphi.add(shell);
walkway(infra,[-21.5,-43],[-14.2,-43],2.4,[],false);
// jardín de la rosa de los vientos con palmeras, entre el edificio principal y el edificio con pórtico
iflat(new THREE.PlaneGeometry(12,13),M('infra',{map:rep(grassT,'rv',1.5,1.6)}),-18.5,.05,-21);
iflat(new THREE.PlaneGeometry(12,1.6),infraPave,-18.5,.06,-21); iflat(new THREE.PlaneGeometry(1.6,13),infraPave,-18.5,.06,-21);
const compass=new THREE.Mesh(new THREE.ShapeGeometry(starShape(2.6,.7,8)),M('infra',{color:C('#F4F3EF')})); compass.rotation.x=-Math.PI/2; compass.position.set(-20.5,.08,-18.5); infra.add(compass);
const trunkMatW=M('infra',{color:C('#5B4634')}), leafMatW=M('infra',{color:C('#3F6A2C'),roughness:.9,flatShading:true});
function palmW(group,x,z){ const t=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,8,6),trunkMatW); t.position.set(x,4,z); t.castShadow=true; group.add(t);
  for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; const f=new THREE.Mesh(new THREE.BoxGeometry(4.2,.08,.9),leafMatW); f.position.set(x+Math.cos(a)*1.9,7.6,z-Math.sin(a)*1.9); f.rotation.set(0,a,-.35); f.castShadow=true; group.add(f);} }
[[-23,-16],[-13,-16],[-23,-26],[-13,-26]].forEach(([x,z])=>palmW(infra,x,z));
// edificio con pórtico de dos columnas (frente al jardín)
function simpleBlock(cx,cz,w,d,floors,cat){ const h=floors*FH;
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),[facadeMatH(cat,d,floors),facadeMatH(cat,d,floors),roofMat(cat,w,d),infraCream,facadeMatH(cat,w,floors),facadeMatH(cat,w,floors)]); b.position.set(cx,h/2,cz); b.castShadow=b.receiveShadow=true; infra.add(b);
  const p=new THREE.Mesh(new THREE.BoxGeometry(w+.3,1,d+.3),infraCream); p.position.set(cx,h+.5,cz); infra.add(p); const top=new THREE.Mesh(new THREE.BoxGeometry(w-.6,.2,d-.6),roofMat(cat,w,d)); top.position.set(cx,h+.95,cz); infra.add(top); return b; }
const porchB=simpleBlock(-35.5,-22,10,18,3,'infra');
[-1,1].forEach(s=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,3.6,14),infraCream); c.position.set(-28.9,1.8,-22+s*1.6); c.castShadow=true; infra.add(c); });
const porchRoof=new THREE.Mesh(new THREE.BoxGeometry(3,.4,5),M('infra',{color:C('#C46A4E')})); porchRoof.position.set(-29.4,3.8,-22); infra.add(porchRoof);
const ptw=new THREE.Mesh(new THREE.BoxGeometry(6,12.4,6),stoneMat('infra',6,12)); ptw.position.set(-33.5,6.2,-12); ptw.castShadow=true; infra.add(ptw);
flushRails();

/* ---------- terreno de la UPEC: polígono irregular tomado del mapa, cerramientos y calles que lo rodean ---------- */
function tree(x,z,s){ const t=new THREE.Mesh(new THREE.CylinderGeometry(.2*s,.3*s,3*s,6),trunkMat); t.position.set(x,1.5*s,z); t.castShadow=true; ctx.add(t); const c=new THREE.Mesh(new THREE.IcosahedronGeometry(2.4*s,0),leafMat); c.position.set(x,3.6*s,z); c.castShadow=true; ctx.add(c); }
const CX=35, CZ=-45;
const LOT=[[110.8,9],[110.8,-11],[110.6,-41.4],[106.7,-76],[106,-111.4],[76.8,-114.3],[46.5,-114.2],[11.6,-106.3],[-22.2,-84.2],[-33.1,-70.8],[-40.6,-49],[-41.9,-28.8],[-32.2,-7],[-32.6,9]];
flatIn(groundG,new THREE.PlaneGeometry(4000,4000),M('ground',{map:rep(groundT,'gd',220,220),roughness:1}),CX,-.06,CZ);
shapeFlat(groundG,LOT,M('ground',{map:rep(grassT,'gc',1/8,1/8)}),.01);
const wallMat=M('context',{color:C('#ECE8DE')});
const wallPosts=[];
for(let i=0;i<LOT.length-1;i++){ const a=LOT[i], b=LOT[i+1]; const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz);
  const w=new THREE.Mesh(new THREE.BoxGeometry(.35,.7,L),wallMat); w.position.set((a[0]+b[0])/2,.35,(a[1]+b[1])/2); w.rotation.y=Math.atan2(dx,dz); w.castShadow=w.receiveShadow=true; ctx.add(w);
  const r=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,L),railMat); r.position.set((a[0]+b[0])/2,2.1,(a[1]+b[1])/2); r.rotation.y=Math.atan2(dx,dz); ctx.add(r);
  const n=Math.max(1,Math.round(L/3.5)); for(let k=0;k<n;k++) wallPosts.push([a[0]+dx*k/n,a[1]+dz*k/n]); }
[[38.5,62],[66,110.8],[-38.5,-32.6]].forEach(([x0,x1])=>{ const L=x1-x0; const w=new THREE.Mesh(new THREE.BoxGeometry(L,.7,.35),wallMat); w.position.set((x0+x1)/2,.35,8.6); ctx.add(w); for(let x=x0;x<=x1;x+=3.5) wallPosts.push([x,8.6]); });
const wp=new THREE.InstancedMesh(new THREE.BoxGeometry(.45,2.3,.45),wallMat,wallPosts.length);
wallPosts.forEach(([x,z],i)=>{ dummy.position.set(x,1.15,z); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); wp.setMatrixAt(i,dummy.matrix); }); wp.castShadow=true; ctx.add(wp);
// calles: Sumaco (noreste) y avenida Julio Robles (oeste, con parterre central)
function roadAlong(pts,off,w,mat){ for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz); let nx=-dz/L, nz=dx/L; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2; if((mx+nx-CX)**2+(mz+nz-CZ)**2<(mx-CX)**2+(mz-CZ)**2){ nx=-nx; nz=-nz; }
  const r=new THREE.Mesh(new THREE.PlaneGeometry(w,L+w*.6),mat); r.rotation.x=-Math.PI/2; r.rotation.z=Math.atan2(-dx,-dz); r.position.set(mx+nx*off,.025,mz+nz*off); r.receiveShadow=true; groundG.add(r); } }
const roadMat=M('ground',{map:rep(asphaltT,'rd',1,8),roughness:.95});
roadAlong([[110.8,22],[110.8,-11],[110.6,-41.4],[106.7,-76],[106,-125]],7,12,roadMat);
roadAlong([[-60,-40],[-33.1,-70.8],[-22.2,-84.2],[11.6,-106.3],[46.5,-114.2],[76.8,-114.3],[120,-111]],10,10,roadMat);
roadAlong([[-60,-40],[-33.1,-70.8],[-22.2,-84.2],[11.6,-106.3],[46.5,-114.2],[76.8,-114.3],[120,-111]],24,10,roadMat);
flatIn(groundG,new THREE.PlaneGeometry(12,300),M('ground',{map:rep(asphaltT,'au',1,19),roughness:.95}),0,.035,23.4+150);
[[-28,-62],[-36,-30],[-30,-2],[-6,-98],[30,-110],[60,-110],[95,-108],[104,-60],[104,-30],[100,-5],[40,-62],[38,-64]].forEach(([x,z])=>tree(x,z,.9+R()*.4));

/* ---------- nubes ---------- */
const cloudMats=[.55,.75,.95].map(o=>new THREE.SpriteMaterial({map:cloudT,transparent:true,depthWrite:false,opacity:o,fog:false}));
cloudMats.forEach(m=>m.userData.base=m.opacity);
const clouds=[];
for(let k=0;k<64;k++){ const s=new THREE.Sprite(cloudMats[k%3]); const sc=90+R()*160; s.scale.set(sc,sc*.6,1); s.position.set(CX+(R()-.5)*900,150+R()*260,CZ+(R()-.5)*900); s.userData.v=1.5+R()*2.5; scene.add(s); clouds.push(s); }

/* ---------- luces ---------- */
const hemi=new THREE.HemisphereLight(0xffffff,0x6f6a58,.9*Math.PI); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.05*Math.PI); sun.position.set(-70,200,60); sun.target.position.set(35,0,-50);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-170,right:170,top:170,bottom:-170,near:20,far:520}); sun.shadow.bias=-.0006; sun.shadow.normalBias=.4;
scene.add(sun); scene.add(sun.target);
scene.fog=new THREE.Fog(0xffffff,600,4800);

/* ---------- tema día / noche ---------- */
let skyTex=null, night=false;
function readVar(n){ return getComputedStyle(root).getPropertyValue(n).trim(); }
function applyTheme(){
  night = readVar('--campus-mode')==='night';
  const top=readVar('--campus-sky-top')||'#6F92BE', bot=readVar('--campus-sky-bottom')||'#E1E7EC', fog=readVar('--campus-fog')||'#D3DCE3', acc=readVar('--campus-edge')||'#0EA5E9';
  if(skyTex) skyTex.dispose();
  skyTex=new THREE.CanvasTexture(makeCanvas(4,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,top); gr.addColorStop(.75,bot); gr.addColorStop(1,bot); g.fillStyle=gr; g.fillRect(0,0,w,h); }));
  skyTex.colorSpace=THREE.SRGBColorSpace; scene.background=skyTex;
  scene.fog.color.copy(C(fog));
  Object.values(edgeMats).forEach(m=>m.color.copy(C(acc)));
  glowMats.forEach(m=>m.emissiveIntensity=night?m.userData.glow:m.userData.day);
  hemi.intensity=(night?.36:.9)*Math.PI; hemi.color.copy(night?C('#8296BC'):C('#FFFFFF')); hemi.groundColor.copy(night?C('#2A2620'):C('#6F6A58'));
  sun.intensity=(night?.3:1.05)*Math.PI; sun.color.copy(night?C('#9DB4DA'):C('#FFF6EA'));
  lobbyLight.intensity=night?50:28;
  cloudMats.forEach(m=>m.color.copy(night?C('#56677D'):C('#FFFFFF')));
}
applyTheme();
const themeObserver=new MutationObserver(applyTheme); themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
disposers.push(()=>themeObserver.disconnect());

/* ---------- etiquetas HTML ancladas al modelo ---------- */
const labelsEl=q('labels');
const labels=[];
function label(ch,obj,code,text){ const el=document.createElement('div'); el.className='campus-tag'; el.innerHTML='<i></i><span>'+(code?'<b>'+code+'</b>':'')+text+'</span>'; labelsEl.appendChild(el); labels.push({ch,obj,el}); }
const B4=(x,y,z)=>anchor(aulas,x,y,z);
const FLR=(i,x,z)=>anchor(BB.floors[i],x,FH+.25,z);
label(1,anchor(medal,0,0,.1),'','Frontón con medallón');
label(1,anchor(centralCols[3],0,1,.5),'×4','Columnas pareadas');
label(1,anchor(wingCols[1].ent,5,1,2.3),'','Pórtico · Estatal del Carchi');
label(1,anchor(wingCols[-1].ent,-3,1,2.3),'','Pórtico · Universidad Politécnica');
label(1,anchor(towersMain[1],0,4,6.2),'','Torre de pizarra');
label(1,anchor(flags[1],2.1,1.4,0),'','Bandera del Ecuador con escudo');
label(1,anchor(vitrines[2],0,1.3,.6),'','Vitrinas iluminadas');
label(2,anchor(gateLeaves[1],0,1.3,0),'','Reja con puntas doradas');
label(2,anchor(mainB,0,3.4,.2),'','Mampara de vidrio');
label(3,anchor(desk,0,.8,0),'','Recepción');
label(3,anchor(orangeStar,0,0,.3),'','Plaza de la estrella');
label(5,B4(-6,14,24),'4','Aulas 4');
label(5,B4(-6,14,-24),'','Aulas 2');
label(5,B4(-25,1.6,0),'','Jardín oeste');
label(5,B4(-36,1.8,-14),'P','Parqueadero UPEC 1');
label(5,anchor(infra,40,1.5,-9),'','Sendero con gradas');
label(6,B4(-6,14,24),'4','Aulas 4');
label(6,B4(-6,14,-24),'','Aulas 2');
label(6,anchor(fBase,0,.5,0),'','Patio octogonal');
label(6,B4(-36,1.8,9),'P','Parqueadero UPEC 1');
label(6,B4(45,1.2,13),'','Jardineras');
label(6,B4(50,1.6,0),'','Sendero con gradas y barandales');
label(6,anchor(infra,28,1.6,-80),'','Paseo con gradas');
label(6,anchor(coliRoof,0,5.4,0),'','Coliseo 05 de Abril');
label(6,B4(46,1.8,35),'P','Parqueadero');
label(7,anchor(BB.skylights[0],0,1.3,0),'L-1','Lucernario piramidal');
label(7,anchor(BB.skylights[1],0,1.3,0),'L-2','Lucernario piramidal');
label(7,anchor(BB.tank,0,.8,0),'','Tanque de agua');
label(7,anchor(BB.roof,14,.4,24),'','Losa plana con antepecho');
label(8,FLR(2,-3.6,27.9),'','Vacío bajo lucernario');
label(8,FLR(2,-3.4,19.3),'','Vacío bajo lucernario');
label(8,FLR(2,10,17.4),'','Aulas');
label(8,FLR(2,-24,20),'','Pasillo');
label(8,FLR(2,B4stair[0],B4stair[1]),'','Escaleras');
label(9,FLR(1,0,17.4),'','Aulas');
label(9,FLR(1,4,22.6),'','Pasillo perimetral');
label(9,FLR(1,-21,23),'','Núcleo de servicios');
label(9,FLR(1,B4stair[0],B4stair[1]),'','Escaleras');
label(10,FLR(0,B4doors[0][0],B4doors[0][1]),'','Acceso desde el patio');
label(10,FLR(0,B4doors[1][0],B4doors[1][1]),'','Acceso desde el patio');
label(10,FLR(0,10,17.4),'','Aulas');
label(10,FLR(0,B4stair[0],B4stair[1]),'','Escaleras');
label(11,anchor(BB.towers[0].cap,0,.4,0),'T-1','Torre del tramo diagonal');
label(11,anchor(BB.towers[1].cap,0,.4,0),'T-2','Torre del tramo recto');
label(11,anchor(BB.fins[0],0,1.2,.6),'×6','Parasoles verticales');
label(11,anchor(BB.doors[0],0,1.7,.2),'','Puerta');
label(11,anchor(BB.doors[1],0,1.7,.2),'','Puerta');
label(12,anchor(fBase,0,.5,0),'Ø 5 m','Fuente de mosaico');
label(12,anchor(gardens[2],-9,0,6),'×4','Jardines con borde de flores');
label(12,anchor(BB.towers[1].cap,0,.4,0),'4','Aulas 4');
label(13,B4(-6,14,24),'4','Aulas 4');
label(13,anchor(coliRoof,0,5.4,0),'','Coliseo 05 de Abril');
label(13,anchor(pediment,0,4.4,7),'','Edificio principal');
label(13,anchor(amphi,0,3,0),'','Anfiteatro');
label(13,anchor(compass,0,.3,0),'','Jardín de la rosa de los vientos');
label(13,anchor(porchB,0,6.4,0),'','Edificio con pórtico');
label(13,B4(46,1.8,35),'P','Parqueadero');
label(13,anchor(groundG,118,.5,-45),'','Calle Sumaco');
label(13,anchor(groundG,-30,.5,-95),'','Av. Julio Robles');
label(13,anchor(groundG,60,.5,16.4),'','Av. Antisana');

label(1,anchor(vaultTop,0,0,0),'','Volumen central con bóveda de luz');
label(4,anchor(orangeStar,0,0,.3),'','Estrella en el piso');
label(4,anchor(cancha,0,2.4,0),'','Canchas');
label(4,anchor(canopy,0,.4,0),'','Graderío cubierto');
label(4,anchor(altar,0,12.4,0),'','Altar de las banderas');
label(4,anchor(amphi,0,3,0),'','Anfiteatro');
label(4,anchor(plazaTop,14.1,1.6,-6),'','Barandales');
label(4,anchor(infra,0,.6,-52.5),'','Escalinata');
label(4,anchor(infra,28,1.6,-66),'','Paseo con gradas');
label(13,anchor(cancha,0,2.4,0),'','Canchas');
label(13,anchor(altar,0,12.4,0),'','Altar de las banderas');
label(13,anchor(orangeStar,0,0,.3),'','Plaza de la estrella');

/* ---------- guion de cámara por capítulo ---------- */
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const VA=(X,y,Z)=>V(OX+KS*Z,y,OZ-KS*X);        // punto del edificio de Aulas (alturas reales)
const VAs=(X,y,Z)=>V(OX+KS*Z,y*KS,OZ-KS*X);    // cámara relativa al edificio de Aulas, escalada
const DB={twin:.35,plaza:.6,main:.5,context:.55,infra:.5};
const S=[
  {pos:V(3,1.6,54),     tgt:V(0,8.5,0),       fov:56, pk:4, rf:0, dim:{}, hi:[]},
  {pos:V(30,3,20),      tgt:V(-6,8,0),        fov:46, pk:4, rf:0, dim:{}, hi:[]},
  {pos:V(0,2.2,21),     tgt:V(0,4.6,0),       fov:54, pk:4, rf:0, dim:{}, hi:[]},
  {pos:V(0,2.3,-10),    tgt:V(0,3,-70),       fov:64, pk:4, rf:0, dim:{}, hi:[]},
  {pos:V(-3,9,-31),     tgt:V(2,0,-74),       fov:58, pk:4, rf:0, dim:{}, hi:[], via:V(0,2.3,-33)},
  {pos:V(6,28,-56),     tgt:V(64,2,-14),      fov:52, pk:4, rf:0, dim:{}, hi:[]},
  {pos:V(34,62,20),     tgt:V(71,0,-19),      fov:46, pk:4, rf:0, dim:{twin:.6,main:.8}, hi:['wing','entrance','tower']},
  {pos:VAs(-40,44,-2),  tgt:VA(-2,9,22),      fov:46, pk:4, rf:1, dim:Object.assign({},DB,{wing:.45,entrance:.45,tower:.45}), hi:['roof','skylight']},
  {pos:VAs(-8,64,2),    tgt:VA(-3,10.8,22),   fov:50, pk:3, rf:1, dim:DB, hi:['wing']},
  {pos:VAs(-8,62,2),    tgt:VA(-3,7.2,22),    fov:50, pk:2, rf:1, dim:DB, hi:['wing']},
  {pos:VAs(-8,60,2),    tgt:VA(-3,3.6,22),    fov:50, pk:1, rf:1, dim:DB, hi:['wing','entrance']},
  {pos:VAs(-2,18,-7),   tgt:VA(-5,6,13),      fov:58, pk:4, rf:0, dim:Object.assign({},DB,{roof:.5,skylight:.5,wing:.6}), hi:['tower','entrance']},
  {pos:VAs(-15,46,-19), tgt:VA(-1,2,6),       fov:50, pk:4, rf:0, dim:{twin:.5,main:.6,context:.7,infra:.6}, hi:['plaza']},
  {pos:V(-110,140,100), tgt:V(35,0,-50),       fov:42, pk:4, rf:0, dim:{}, hi:[]}
];
const curDim={}; CATS.forEach(c=>curDim[c]=-1);
function setCat(c,d){
  if(Math.abs(curDim[c]-d)<.002) return; curDim[c]=d;
  catMats[c].forEach(m=>{ const o=m.userData.base*d; m.opacity=o; const tr=o<.995; if(m.transparent!==tr){ m.transparent=tr; m.needsUpdate=true; } m.depthWrite=m.userData.base<1?false:o>.6; });
}
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const camPos=new THREE.Vector3(), camTgt=new THREE.Vector3(), tmp=new THREE.Vector3(), WORLD_UP=new THREE.Vector3(0,1,0);
const isMobile=()=>window.innerWidth<720;

const hudAlt=q('hud-alt'), hudHdg=q('hud-hdg'), hudSec=q('hud-sec');
let lastActive=-1, lastAlt='', lastHdg='', lastFov=0;
function apply(p,time){
  const i=Math.min(N-2,Math.floor(p)), f=ease(Math.min(1,Math.max(0,p-i))), A=S[i], B=S[i+1];
  if(B.via){ const u=1-f; camPos.copy(A.pos).multiplyScalar(u*u).addScaledVector(B.via,2*u*f).addScaledVector(B.pos,f*f); } else camPos.lerpVectors(A.pos,B.pos,f);
  if(B.tvia){ const u=1-f; camTgt.copy(A.tgt).multiplyScalar(u*u).addScaledVector(B.tvia,2*u*f).addScaledVector(B.tgt,f*f); } else camTgt.lerpVectors(A.tgt,B.tgt,f);
  if(!reduce){ const w=Math.max(0,1-p); const a=Math.sin(time*.08)*.14*w; tmp.subVectors(camPos,camTgt); tmp.applyAxisAngle(WORLD_UP,a); camPos.copy(camTgt).add(tmp); }
  camera.position.copy(camPos); camera.lookAt(camTgt);
  const fov=lerp(A.fov,B.fov,f)+(isMobile()?10:0);
  if(Math.abs(fov-lastFov)>.01){ camera.fov=fov; camera.updateProjectionMatrix(); lastFov=fov; }
  const pk=lerp(A.pk,B.pk,f), rf=lerp(A.rf,B.rf,f);
  for(const pt of parts){ if(pt.blk!=='B') continue; pt.obj.position.y=pt.baseY+(pt.level===3?rf*9:0)+75*clamp01(pt.level+1-pk); }
  CATS.forEach(c=>{ const a=A.dim[c]!=null?A.dim[c]:1, b=B.dim[c]!=null?B.dim[c]:1; setCat(c,lerp(a,b,f)); const h=lerp(A.hi.indexOf(c)>=0?1:0,B.hi.indexOf(c)>=0?1:0,f); if(edgeMats[c]){ edgeMats[c].opacity=h*.9; edgeMats[c].visible=h>.01; } });
  const cf=clamp01((camPos.y-100)/170); cloudMats.forEach(m=>m.opacity=m.userData.base*cf);
  const alt='ALT '+String(Math.max(0,Math.round(camPos.y))).padStart(3,'0')+' m';
  tmp.subVectors(camTgt,camPos); const hdg=(Math.round(Math.atan2(tmp.x,-tmp.z)*180/Math.PI)+360)%360;
  const hs='RUMBO '+String(hdg).padStart(3,'0')+'°';
  if(alt!==lastAlt){hudAlt.textContent=alt;lastAlt=alt;} if(hs!==lastHdg){hudHdg.textContent=hs;lastHdg=hs;}
  const act=Math.round(p); if(act!==lastActive){ lastActive=act; hudSec.textContent='CORTE '+String(act).padStart(2,'0')+'/'+String(N-1).padStart(2,'0'); onChapter&&onChapter(act); railBtns.forEach((b,k)=>{ if(k===act) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current'); }); }
}
function updateLabels(p){
  scene.updateMatrixWorld();
  const w=canvas.clientWidth, h=canvas.clientHeight;
  for(const L of labels){
    const o=Math.max(0,1-Math.abs(p-L.ch)*1.8);
    if(o<=0){ if(L.el.style.opacity!=='0') L.el.style.opacity='0'; continue; }
    L.obj.getWorldPosition(tmp); tmp.project(camera);
    if(tmp.z>1||tmp.z<-1||Math.abs(tmp.x)>1.1||Math.abs(tmp.y)>1.1){ L.el.style.opacity='0'; continue; }
    const x=(tmp.x*.5+.5)*w, y=(-tmp.y*.5+.5)*h;
    L.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)'; L.el.style.opacity=o.toFixed(3);
  }
}
function waveFlags(t){
  for(const fl of flags){ const pa=fl.geometry.attributes.position, o=fl.userData.orig;
    for(let i=0;i<pa.count;i++){ const x=o[i*3], y=o[i*3+1]; pa.array[i*3+2]=Math.sin(x*1.35*4.2/fl.userData.w-t*3.4+fl.userData.ph+y*.3)*.34*(fl.userData.w/4.2)*(x/fl.userData.w); }
    pa.needsUpdate=true; fl.geometry.computeVertexNormals(); }
}


function resize() { const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; lastFov = 0; camera.updateProjectionMatrix(); }
const ro = new ResizeObserver(() => { resize(); computeTarget(); }); ro.observe(canvas); disposers.push(() => ro.disconnect());
resize();

// El render solo corre mientras la sección está en pantalla y la pestaña visible.
let cur = target, last = performance.now(), raf = 0, visible = false;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  cur = reduce ? target : cur + (target - cur) * (1 - Math.exp(-dt * 3.2));
  if (Math.abs(target - cur) < .0005) cur = target;
  if (!reduce) { clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > CX + 450) c.position.x = CX - 450; }); waveFlags(now / 1000); }
  apply(cur, now / 1000);
  updateLabels(cur);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}
function setRunning() {
  const run = visible && !document.hidden;
  if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
}
const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(); });
io.observe(root); disposers.push(() => io.disconnect());
on(document, 'visibilitychange', setRunning);
apply(cur, 0); updateLabels(cur); renderer.render(scene, camera);

return {
  ok: true,
  dispose() {
    if (raf) cancelAnimationFrame(raf);
    disposers.forEach(f => f());
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
    });
    if (skyTex) skyTex.dispose();
    renderer.dispose();
    labelsEl.textContent = '';
  },
};
}
