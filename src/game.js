import * as THREE from 'three';
// ---------- utils ----------
let seed=1337;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const R=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
function noise(x,z){return Math.sin(x*.013)*Math.cos(z*.011)*9+Math.sin(x*.041+z*.03)*3+Math.cos(z*.05-x*.02)*2}
const TOWN={x:0,z:0,r:70};
function H(x,z){const d=Math.hypot(x-TOWN.x,z-TOWN.z);const f=Math.min(1,Math.max(0,(d-TOWN.r)/60));return noise(x,z)*f}
const $=id=>document.getElementById(id);
// ---------- audio ----------
let AC;function snd(type){try{AC=AC||new AudioContext();const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);
const P={hit:[120,.3,'square',.15],shot:[80,.5,'sawtooth',.2],bow:[600,.2,'triangle',.12],pick:[880,.15,'sine',.1],groan:[70,.25,'sawtooth',.6],craft:[440,.2,'square',.2],hurt:[200,.4,'square',.25],neigh:[500,.2,'triangle',.5]}[type]||[300,.2,'sine',.1];
o.type=P[2];o.frequency.setValueAtTime(P[0],t);o.frequency.exponentialRampToValueAtTime(P[0]*.5,t+P[3]);g.gain.setValueAtTime(P[1],t);g.gain.exponentialRampToValueAtTime(.001,t+P[3]);o.start(t);o.stop(t+P[3]);}catch(e){}}
let engOsc,engGain;function engine(on,rpm){try{AC=AC||new AudioContext();if(!engOsc){engOsc=AC.createOscillator();engOsc.type='sawtooth';engGain=AC.createGain();engGain.gain.value=0;engOsc.connect(engGain);engGain.connect(AC.destination);engOsc.start()}
engGain.gain.value=on?.06:0;engOsc.frequency.value=40+rpm*6}catch(e){}}
// ---------- scene ----------
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x9cc,40,260);
const cam=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1000);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()});
const hemi=new THREE.HemisphereLight(0xbbddff,0x445522,.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffeecc,1);scene.add(sun);
const M=c=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
const SIZE=700;
{const g=new THREE.PlaneGeometry(SIZE,SIZE,140,140);g.rotateX(-Math.PI/2);const p=g.attributes.position,cols=[];
for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);const c=new THREE.Color(Math.hypot(x,z)<TOWN.r?0x666655:(y>8?0x7a7a60:0x4a7a30));c.offsetHSL(0,0,R(-.03,.03));cols.push(c.r,c.g,c.b)}
g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true})))}
const solids=[];// {x,z,r}
const harvest=[];// trees/rocks {mesh,kind,hp}
function tree(x,z){const g=new THREE.Group();const t=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,3,6),M(0x5a3a1a));t.position.y=1.5;g.add(t);
const l=new THREE.Mesh(new THREE.ConeGeometry(2,5,7),M(0x2d5a27));l.position.y=5;g.add(l);g.position.set(x,H(x,z),z);scene.add(g);solids.push({x,z,r:.6});harvest.push({mesh:g,kind:'wood',hp:4,x,z})}
function rock(x,z){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(R(.8,1.8)),M(0x888888));m.position.set(x,H(x,z)+.4,z);m.rotation.set(R(0,3),R(0,3),0);scene.add(m);solids.push({x,z,r:1.2});harvest.push({mesh:m,kind:'stone',hp:5,x,z})}
for(let i=0;i<420;i++){const x=R(-330,330),z=R(-330,330);if(Math.hypot(x,z)>TOWN.r+5)(Math.random()<.75?tree:rock)(x,z)}
// ---------- items ----------
const IT={food:'Canned Food',water:'Water Bottle',cloth:'Cloth',wood:'Wood',metal:'Scrap Metal',stone:'Stone',ammo:'Ammo',arrow:'Arrow',bandage:'Bandage',rawmeat:'Raw Meat',meat:'Cooked Meat',hide:'Hide',gas:'Gas Can',
 knife:'Knife',bat:'Bat',spear:'Wooden Spear',bow:'Bow',pistol:'Pistol',rifle:'Rifle',campfire:'Campfire',wall:'Wood Wall',door:'Wood Door',foundation:'Foundation',box:'Storage Box',horsefeed:'Oats'};
const WEAP={fists:{dmg:8,rng:2},knife:{dmg:18,rng:2.2},bat:{dmg:25,rng:2.6},spear:{dmg:30,rng:3.2},bow:{dmg:45,rng:60,ammo:'arrow'},pistol:{dmg:40,rng:80,ammo:'ammo'},rifle:{dmg:90,rng:150,ammo:'ammo'}};
const BUILD=['campfire','wall','door','foundation','box'];
const RECIPES=[['bandage',{cloth:2}],['campfire',{wood:4,stone:2}],['spear',{wood:3}],['bow',{wood:4,cloth:2}],['arrow',{wood:1,stone:1},3],['wall',{wood:6}],['door',{wood:5,metal:1}],['foundation',{wood:8,stone:4}],['box',{wood:6,metal:2}],['knife',{metal:2,cloth:1}]];
// ---------- world: town ----------
const containers=[];// {mesh,items:{},name}
const lootTable=['food','food','water','water','cloth','cloth','wood','metal','metal','ammo','arrow','bandage','gas','gas','knife','bat','pistol','rifle','horsefeed'];
function rollLoot(){const o={};const n=1+Math.floor(R(0,4));for(let i=0;i<n;i++){const k=pick(lootTable);o[k]=(o[k]||0)+(k=='ammo'?6:k=='arrow'?4:1)}return o}
function crate(x,z,name='Crate',items){const m=new THREE.Mesh(new THREE.BoxGeometry(1,.8,.7),M(name=='Loot Bag'?0x332211:0x8a6a3a));m.position.set(x,H(x,z)+.4,z);scene.add(m);const c={mesh:m,items:items||rollLoot(),name,x,z};containers.push(c);return c}
function house(x,z,rot){const g=new THREE.Group(),w=8,d=7,h=3.2,col=pick([0xa89a80,0x8a9aa0,0xa07060,0x9a9a70]),wm=M(col);
const wall=(W,D,px,pz)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(W,h,D),wm);m.position.set(px,h/2,pz);g.add(m)};
wall(w,.3,0,-d/2);wall(.3,d,-w/2,0);wall(.3,d,w/2,0);wall(3,.3,-2.5,d/2);wall(3,.3,2.5,d/2);
const roof=new THREE.Mesh(new THREE.ConeGeometry(6.4,2.5,4),M(0x553322));roof.position.y=h+1.2;roof.rotation.y=Math.PI/4;roof.scale.set(1,1,.9);g.add(roof);
g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
const c=Math.cos(rot),s=Math.sin(rot),loc=(lx,lz)=>[x+lx*c+lz*s,z-lx*s+lz*c];
for(const [lx,lz] of [[-w/2,0],[w/2,0],[0,-d/2],[-2.5,d/2],[2.5,d/2],[-w/4,-d/2],[w/4,-d/2],[-w/2,-d/4],[w/2,d/4]]){const [px,pz]=loc(lx,lz);solids.push({x:px,z:pz,r:1.4})}
for(let i=0;i<2;i++){const [px,pz]=loc(R(-2.5,2.5),R(-2.2,1));crate(px,pz,pick(['Cabinet','Fridge','Crate','Dresser']))}}
for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=i%2?28:50;house(Math.cos(a)*r,Math.sin(a)*r,-a+Math.PI/2)}
for(let i=0;i<10;i++){const a=R(0,6.28),r=R(120,300),x=Math.cos(a)*r,z=Math.sin(a)*r;house(x,z,R(0,6))}// farmhouses
for(let i=0;i<25;i++){const a=R(0,6.28),r=R(80,320);crate(Math.cos(a)*r,Math.sin(a)*r,'Supply Crate')}
// ---------- entities ----------
function body(col,w,h,d){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(col))}
function humanoid(skin,shirt){const g=new THREE.Group();const b=body(shirt,.6,.8,.35);b.position.y=1.1;const hd=body(skin,.4,.4,.4);hd.position.y=1.75;
const l1=body(0x333344,.22,.7,.22),l2=l1.clone();l1.position.set(-.15,.35,0);l2.position.set(.15,.35,0);const a1=body(skin,.18,.7,.18),a2=a1.clone();a1.position.set(-.4,1.2,.25);a2.position.set(.4,1.2,.25);a1.rotation.x=a2.rotation.x=-1.3;
const e=body(0xff0000,.3,.06,.05);e.position.set(0,1.8,.21);g.add(b,hd,l1,l2,a1,a2,e);g.userData.legs=[l1,l2];return g}
function quad(col,len,hgt,neck){const g=new THREE.Group();const b=body(col,.7,.7,len);b.position.y=hgt;g.add(b);const hd=body(col,.4,.4,.6);hd.position.set(0,hgt+(neck?.7:.3),len/2+.2);g.add(hd);const legs=[];
for(const [x,z] of [[-.25,len/2-.2],[.25,len/2-.2],[-.25,-len/2+.2],[.25,-len/2+.2]]){const l=body(col,.15,hgt,.15);l.position.set(x,hgt/2,z);g.add(l);legs.push(l)}g.userData.legs=legs;return g}
const zombies=[],animals=[],horses=[],vehicles=[],builds=[];
function spawnZombie(x,z){const m=humanoid(0x6a8a5a,pick([0x553333,0x334455,0x555533]));m.position.set(x,H(x,z),z);scene.add(m);zombies.push({m,hp:60,state:'wander',t:0,dir:R(0,6.28),atk:0,x,z})}
function spawnAnimal(kind,x,z){const m=kind=='deer'?quad(0x9a6a3a,1.4,.9,1):quad(0x666666,1.1,.55,0);m.position.set(x,H(x,z),z);scene.add(m);animals.push({m,kind,hp:kind=='deer'?40:50,dir:R(0,6.28),t:0,atk:0,x,z})}
function spawnHorse(x,z){const m=quad(pick([0x6b4226,0x2a1a10,0xddd0c0,0x8b5a2b]),2,1.2,1);const mane=body(0x111111,.15,.5,.8);mane.position.set(0,1.9,.9);m.add(mane);m.position.set(x,H(x,z),z);scene.add(m);
horses.push({m,hp:120,stam:100,tamed:false,dir:R(0,6.28),t:0,x,z,yaw:0})}
function spawnVehicle(kind,x,z){const g=new THREE.Group();const spec={truck:[0x3a5a8a,2.2,1.2,4.6,26,0.8],buggy:[0xcc7722,1.8,.6,3,32,1],police:[0x111111,2,1,4.4,30,.9]}[kind];
const b=body(spec[0],spec[1],spec[2],spec[3]);b.position.y=.9;g.add(b);const cab=body(kind=='police'?0xeeeeee:0x223344,spec[1]*.9,.8,spec[3]*.4);cab.position.set(0,1.7,-.1);if(kind!='buggy')g.add(cab);else{const bar=body(0x222222,1.7,.1,.1);bar.position.set(0,2,0);g.add(bar)}
if(kind=='police'){const lb=body(0xff0000,.5,.15,.3),bb=body(0x0000ff,.5,.15,.3);lb.position.set(-.3,2.2,0);bb.position.set(.3,2.2,0);g.add(lb,bb)}
for(const [wx,wz] of [[-1,1],[1,1],[-1,-1],[1,-1]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.35,10),M(0x111111));w.rotation.z=Math.PI/2;w.position.set(wx*spec[1]/2,.45,wz*spec[3]*.33);g.add(w)}
const hl=new THREE.SpotLight(0xffffcc,0,60,.5,.5);hl.position.set(0,1,spec[3]/2);hl.target.position.set(0,0,20);g.add(hl,hl.target);
g.position.set(x,H(x,z),z);scene.add(g);vehicles.push({m:g,kind,hp:100,fuel:R(10,40),speed:0,yaw:R(0,6),max:spec[4],grip:spec[5],hl,x,z})}
for(let i=0;i<40;i++){const a=R(0,6.28),r=R(20,300);spawnZombie(Math.cos(a)*r,Math.sin(a)*r)}
for(let i=0;i<14;i++)spawnAnimal('deer',R(-300,300),R(-300,300));for(let i=0;i<7;i++)spawnAnimal('wolf',R(-300,300),R(-300,300));
for(let i=0;i<8;i++){const a=R(0,6.28),r=R(90,250);spawnHorse(Math.cos(a)*r,Math.sin(a)*r)}
[['truck',12,8],['buggy',-10,15],['police',5,-14],['truck',150,-90],['buggy',-200,120],['police',-60,-180]].forEach(v=>spawnVehicle(...v));
// ---------- player ----------
const P={x:4,z:4,y:0,vy:0,yaw:0,pitch:0,hp:100,food:100,water:100,stam:100,inv:{food:2,water:2,bandage:1},eq:'fists',mag:0,ride:null,drive:null,place:null,dead:false,kills:0};
let time=8*60;// minutes of day
const keys={};let ui=null,started=false;
function msg(t,ms=2000){$('msg').textContent=t;clearTimeout(msg.h);msg.h=setTimeout(()=>$('msg').textContent='',ms)}
function add(k,n=1){P.inv[k]=(P.inv[k]||0)+n}function has(k,n=1){return (P.inv[k]||0)>=n}function take(k,n=1){P.inv[k]-=n;if(P.inv[k]<=0)delete P.inv[k]}
function useItem(k){if(k in WEAP){P.eq=k;msg('Equipped '+IT[k])}else if(BUILD.includes(k)){P.place=k;msg('F to place '+IT[k]);toggle(null)}
else if(k=='food'||k=='meat'){take(k);P.food=Math.min(100,P.food+(k=='meat'?40:30));P.hp=Math.min(100,P.hp+5);snd('pick')}else if(k=='rawmeat'){take(k);P.food=Math.min(100,P.food+10);P.hp-=8;msg('Raw meat made you sick')}
else if(k=='water'){take(k);P.water=Math.min(100,P.water+40);snd('pick')}else if(k=='bandage'){take(k);P.hp=Math.min(100,P.hp+25);snd('pick')}else msg(IT[k]+': crafting material');drawUI()}
function drawUI(){if(ui=='inv'){$('ig').innerHTML='';for(const k in P.inv){const d=document.createElement('div');d.className='slot';d.innerHTML=`<b>${IT[k]}</b><br>x${P.inv[k]}`;d.onclick=()=>useItem(k);$('ig').appendChild(d)}$('eq').textContent=IT[P.eq]||'Fists'}
if(ui=='craft'){$('cl').innerHTML='';for(const [k,req,n] of RECIPES){const ok=Object.entries(req).every(([a,b])=>has(a,b));const d=document.createElement('div');d.className='rec'+(ok?'':' no');
d.textContent=`${IT[k]}${n?' x'+n:''}  <=  `+Object.entries(req).map(([a,b])=>`${b} ${IT[a]}`).join(', ');d.onclick=()=>{if(!ok)return;for(const a in req)take(a,req[a]);add(k,n||1);snd('craft');msg('Crafted '+IT[k]);drawUI()};$('cl').appendChild(d)}}}
function toggle(p){for(const id of ['inv','craft','help'])$(id).style.display='none';ui=(ui==p)?null:p;if(ui){$(ui).style.display='block';document.exitPointerLock?.()}drawUI()}
addEventListener('keydown',e=>{keys[e.code]=true;if(!started)return;if(e.code=='Tab'){e.preventDefault();toggle('inv')}if(e.code=='KeyC')toggle('craft');if(e.code=='KeyH')toggle('help');
if(e.code=='KeyE')interact();if(e.code=='KeyF')place();if(e.code=='KeyR')reload();if(e.code=='KeyX')whistle();if(e.code=='F5'){e.preventDefault();save()}if(e.code=='F9'){e.preventDefault();load()}
const q={Digit1:'fists',Digit2:'spear',Digit3:'bow',Digit4:'pistol'}[e.code];if(q&&(q=='fists'||has(q)||has('rifle')&&q=='pistol')){P.eq=q=='pistol'&&!has('pistol')?'rifle':q;msg('Equipped '+(IT[P.eq]||'Fists'))}});
addEventListener('keyup',e=>keys[e.code]=false);
renderer.domElement.addEventListener('click',()=>{if(started&&!ui)renderer.domElement.requestPointerLock?.()});
addEventListener('mousemove',e=>{if(document.pointerLockElement){P.yaw-=e.movementX*.0025;P.pitch=Math.max(-1.4,Math.min(1.4,P.pitch-e.movementY*.0025))}});
addEventListener('mousedown',e=>{if(started&&!ui&&e.button==0&&document.pointerLockElement)attack()});
const fwd=()=>new THREE.Vector3(-Math.sin(P.yaw)*Math.cos(P.pitch),Math.sin(P.pitch),-Math.cos(P.yaw)*Math.cos(P.pitch));
function reload(){const w=WEAP[P.eq];if(!w.ammo)return;const cap=P.eq=='bow'?1:P.eq=='pistol'?8:5;const n=Math.min(cap-P.mag,P.inv[w.ammo]||0);if(n>0){take(w.ammo,n);P.mag+=n;msg('Reloaded')}}
let lastAtk=0;function attack(){const now=performance.now();if(now-lastAtk<450||P.drive)return;lastAtk=now;const w=WEAP[P.eq];
if(w.ammo){if(P.mag<=0){reload();if(P.mag<=0){msg('No '+IT[w.ammo]);return}}P.mag--;snd(P.eq=='bow'?'bow':'shot');if(P.eq!='bow')zombies.forEach(z=>{if(Math.hypot(z.x-P.x,z.z-P.z)<60)z.state='chase'})}else snd('hit');
const o=new THREE.Vector3(P.x,P.y+1.6,P.z),d=fwd();let best=null,bd=w.rng;
for(const e of [...zombies,...animals,...horses]){const v=new THREE.Vector3(e.x-o.x,P.y+1-o.y+(e.m.position.y-P.y),e.z-o.z);const t=v.dot(d);if(t<0||t>bd)continue;if(v.clone().sub(d.clone().multiplyScalar(t)).length()<1.1){bd=t;best=e}}
if(best){best.hp-=w.dmg*R(.85,1.15);best.state='chase';best.flee=5;flash(best.m);if(best.hp<=0)kill(best)}
else if(!w.ammo){for(const h of harvest){if(h.hp>0&&Math.hypot(h.x-P.x,h.z-P.z)<3){h.hp--;add(h.kind);msg('+1 '+IT[h.kind]);if(h.hp<=0){scene.remove(h.mesh);const i=solids.findIndex(s=>s.x==h.x&&s.z==h.z);if(i>=0)solids.splice(i,1)}break}}}}
function flash(m){m.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.emissive=new THREE.Color(0x880000);setTimeout(()=>o.material.emissive.set(0),120)}})}
function kill(e){scene.remove(e.m);let a=zombies.indexOf(e);if(a>=0){zombies.splice(a,1);P.kills++;if(Math.random()<.4)crate(e.x,e.z,'Zombie Remains');return}
a=animals.indexOf(e);if(a>=0){animals.splice(a,1);crate(e.x,e.z,'Carcass',{rawmeat:e.kind=='deer'?3:2,hide:1});return}a=horses.indexOf(e);if(a>=0){horses.splice(a,1);crate(e.x,e.z,'Carcass',{rawmeat:4,hide:2});if(P.ride==e)P.ride=null}}
function near(list,r){let b=null,bd=r;for(const e of list){const d=Math.hypot(e.x-P.x,e.z-P.z);if(d<bd){bd=d;b=e}}return b}
function interact(){if(P.drive){const v=P.drive;P.drive=null;engine(false,0);P.x=v.x+Math.cos(v.yaw)*2.5;P.z=v.z-Math.sin(v.yaw)*2.5;msg('Exited vehicle');return}
if(P.ride){const h=P.ride;P.ride=null;P.x+=Math.cos(P.yaw)*1.5;P.z-=Math.sin(P.yaw)*1.5;h.hitched=true;msg('Dismounted - horse hitched (X to whistle)');return}
const fire=builds.find(b=>b.k=='campfire'&&Math.hypot(b.x-P.x,b.z-P.z)<3);if(fire&&has('rawmeat')){const n=P.inv.rawmeat;take('rawmeat',n);add('meat',n);snd('craft');msg(`Cooked ${n} meat`);return}
const v=near(vehicles,4);if(v){if(v.hp<40&&has('metal')){take('metal');v.hp=Math.min(100,v.hp+30);msg('Repaired vehicle +30');snd('craft');return}
if(v.fuel<20&&has('gas')){take('gas');v.fuel=Math.min(100,v.fuel+40);msg('Refueled +40');return}if(v.hp<=0){msg('Wrecked - needs metal');return}P.drive=v;msg(`Driving ${v.kind.toUpperCase()}  fuel ${v.fuel|0}%`);return}
const h=near(horses,3.5);if(h){if(!h.tamed){if(has('horsefeed')||Math.random()<.45){if(has('horsefeed'))take('horsefeed');h.tamed=true;snd('neigh');msg('Horse tamed!')}else{h.flee=4;snd('neigh');msg('The horse bolts - try again or bring Oats');return}}
P.ride=h;h.hitched=false;P.yaw=h.yaw;msg('Riding - Shift to gallop');return}
const c=near(containers,2.5);if(c){const ks=Object.keys(c.items);if(!ks.length){msg(c.name+' is empty');return}for(const k of ks)add(k,c.items[k]);msg(c.name+': '+ks.map(k=>`${c.items[k]} ${IT[k]}`).join(', '),3000);c.items={};snd('pick');
if(c.name=='Loot Bag'||c.name=='Zombie Remains'||c.name=='Carcass'){scene.remove(c.mesh);containers.splice(containers.indexOf(c),1)}drawUI();return}
const sb=builds.find(b=>b.k=='box'&&Math.hypot(b.x-P.x,b.z-P.z)<2.5);if(sb){sb.store=sb.store||{};for(const k of ['wood','stone','metal','cloth','hide'])if(P.inv[k]){sb.store[k]=(sb.store[k]||0)+P.inv[k];delete P.inv[k]}msg('Stored materials. Box: '+JSON.stringify(sb.store));return}
const d=builds.find(b=>b.k=='door'&&Math.hypot(b.x-P.x,b.z-P.z)<3);if(d){d.open=!d.open;d.m.rotation.y=d.yaw+(d.open?1.5:0);d.solid.r=d.open?0:1.2;return}}
function whistle(){const h=horses.find(h=>h.tamed);if(!h)return msg('No tamed horse');h.hitched=false;h.called=true;snd('neigh');msg('Whistled for your horse')}
function mkBuild(k,x,z,yaw){const geo={campfire:[1,.4,1],wall:[4,3,.3],door:[2,2.6,.2],foundation:[4,.3,4],box:[1.2,.8,.8]}[k];
const m=body({campfire:0x553311,wall:0x8a6a3a,door:0x6a4a2a,foundation:0x777766,box:0x6a5030}[k],...geo);const y=H(x,z);m.position.set(x,y+geo[1]/2,z);m.rotation.y=yaw;scene.add(m);
const b={k,x,z,yaw,m};if(k=='campfire'){const f=new THREE.PointLight(0xff8833,3,18);f.position.y=1;m.add(f);const fl=new THREE.Mesh(new THREE.ConeGeometry(.4,1,6),new THREE.MeshBasicMaterial({color:0xff6600}));fl.position.y=.6;m.add(fl);b.fl=fl}
if(k=='wall'||k=='door'){b.solid={x,z,r:k=='wall'?2:1.2};solids.push(b.solid)}builds.push(b);return b}
function place(){if(!P.place||!has(P.place))return;const x=P.x-Math.sin(P.yaw)*3,z=P.z-Math.cos(P.yaw)*3;mkBuild(P.place,x,z,P.yaw);take(P.place);snd('craft');if(!has(P.place))P.place=null}
// ---------- save/load ----------
function save(){const s={P:{...P,ride:null,drive:null},time,builds:builds.map(b=>({k:b.k,x:b.x,z:b.z,yaw:b.yaw,store:b.store}))};localStorage.zday=JSON.stringify(s);msg('Game saved')}
function load(){if(!localStorage.zday)return msg('No save found');const s=JSON.parse(localStorage.zday);Object.assign(P,s.P);time=s.time;builds.splice(0).forEach(b=>scene.remove(b.m));s.builds.forEach(b=>{mkBuild(b.k,b.x,b.z,b.yaw).store=b.store});msg('Game loaded')}
// ---------- death ----------
function die(){P.dead=true;P.drive=P.ride=null;engine(false,0);crate(P.x,P.z,'Loot Bag',{...P.inv});P.inv={food:1,water:1};P.eq='fists';P.mag=0;msg('YOU DIED - your loot bag stays where you fell. Respawning...',4000);
setTimeout(()=>{const a=R(0,6.28);P.x=Math.cos(a)*150;P.z=Math.sin(a)*150;P.hp=100;P.food=P.water=80;P.stam=100;P.dead=false},3000)}
// ---------- update ----------
function hurt(n){P.hp-=n;snd('hurt');if(P.hp<=0&&!P.dead)die()}
function collide(o,r=.5){for(const s of solids){const dx=o.x-s.x,dz=o.z-s.z,d=Math.hypot(dx,dz),m=s.r+r;if(d<m&&d>0){o.x=s.x+dx/d*m;o.z=s.z+dz/d*m}}const L=SIZE/2-5;o.x=Math.max(-L,Math.min(L,o.x));o.z=Math.max(-L,Math.min(L,o.z))}
function walkAnim(e,sp,t){(e.m.userData.legs||[]).forEach((l,i)=>l.rotation.x=Math.sin(t*sp*2+i*Math.PI)*.6*Math.min(1,sp))}
function setPos(e){e.m.position.set(e.x,H(e.x,e.z),e.z)}
let last=performance.now(),T=0,spawnT=0;
function update(dt){T+=dt;time=(time+dt*2)%1440;// 1 real sec = 2 game min (12 min day)
const day=Math.max(0,Math.sin((time/1440-.25)*Math.PI*2)),night=day<.15;
sun.intensity=day*1.1;hemi.intensity=.25+day*.4;const sky=new THREE.Color(0x0a0a1a).lerp(new THREE.Color(0x88bbdd),day);scene.background=sky;scene.fog.color=sky;scene.fog.far=night?120:260;
sun.position.set(Math.cos(time/1440*6.28)*100,Math.sin((time/1440-.25)*6.28)*100,50);
if(P.dead)return;
P.food-=dt*.12;P.water-=dt*.18;if(P.food<=0||P.water<=0)hurt(dt*2);if(P.food>60&&P.water>60)P.hp=Math.min(100,P.hp+dt*.3);P.food=Math.max(0,P.food);P.water=Math.max(0,P.water);
let ix=(keys.KeyD?1:0)-(keys.KeyA?1:0),iz=(keys.KeyW?1:0)-(keys.KeyS?1:0);if(ui)ix=iz=0;
if(P.drive){const v=P.drive;const acc=v.fuel>0&&v.hp>0?iz*18:0;v.speed+=acc*dt;v.speed*=1-dt*(iz?0.3:1.2);v.speed=Math.max(-8,Math.min(v.max*(v.hp>30?1:.5),v.speed));
v.yaw-=ix*dt*1.6*Math.min(1,Math.abs(v.speed)/6)*Math.sign(v.speed||1)*v.grip;v.fuel=Math.max(0,v.fuel-Math.abs(v.speed)*dt*.02);
v.x+=Math.sin(v.yaw)*v.speed*dt;v.z+=Math.cos(v.yaw)*v.speed*dt;const ox=v.x,oz=v.z;collide(v,1.6);if(Math.hypot(ox-v.x,oz-v.z)>.01&&Math.abs(v.speed)>6){v.hp-=Math.abs(v.speed)*.6;v.speed*=-.3;snd('hit')}
for(const z of [...zombies]){if(Math.hypot(z.x-v.x,z.z-v.z)<2.2&&Math.abs(v.speed)>5){z.hp-=Math.abs(v.speed)*4;v.hp-=2;snd('hit');if(z.hp<=0)kill(z)}}
v.hp=Math.max(0,v.hp);P.x=v.x;P.z=v.z;P.yaw=v.yaw+Math.PI;engine(true,Math.abs(v.speed))}
else if(P.ride){const h=P.ride,gallop=keys.ShiftLeft&&h.stam>0;const sp=iz*(gallop?20:8);h.stam=gallop&&iz?h.stam-dt*12:Math.min(100,h.stam+dt*6);h.yaw=P.yaw;
h.x+=-Math.sin(P.yaw)*sp*dt;h.z+=-Math.cos(P.yaw)*sp*dt;collide(h,1);walkAnim(h,Math.abs(sp)/5,T);P.x=h.x;P.z=h.z;
for(const z of zombies)if(Math.hypot(z.x-h.x,z.z-h.z)<1.8&&gallop){z.hp-=dt*80;if(z.hp<=0){kill(z);break}}}
else{const sprint=keys.ShiftLeft&&P.stam>0&&iz>0;const sp=sprint?8:4.5;if(sprint)P.stam-=dt*20;else P.stam=Math.min(100,P.stam+dt*12);
const s=Math.sin(P.yaw),c=Math.cos(P.yaw);P.x+=(-s*iz+c*ix)*sp*dt;P.z+=(-c*iz-s*ix)*sp*dt;collide(P,.4);
const g=H(P.x,P.z);const fnd=builds.find(b=>b.k=='foundation'&&Math.abs(b.x-P.x)<2&&Math.abs(b.z-P.z)<2);const ground=g+(fnd?.3:0);
if(keys.Space&&P.y<=ground+.01){P.vy=5}P.vy-=15*dt;P.y+=P.vy*dt;if(P.y<ground){P.y=ground;P.vy=0}}
if(P.drive||P.ride)P.y=H(P.x,P.z)+(P.ride?1.3:.6);
// camera
if(P.drive){const v=P.drive;cam.position.set(v.x-Math.sin(v.yaw)*9,H(v.x,v.z)+4.5,v.z-Math.cos(v.yaw)*9);cam.lookAt(v.x,H(v.x,v.z)+1.5,v.z)}
else{cam.position.set(P.x,P.y+1.65,P.z);cam.rotation.set(P.pitch,P.yaw,0,'YXZ')}
// vehicles
for(const v of vehicles){v.m.position.set(v.x,H(v.x,v.z),v.z);v.m.rotation.y=v.yaw;v.hl.intensity=(P.drive==v&&night)?40:0;if(v.hp<=0)v.m.children[0].material.color.set(0x222222)}
// horses
for(const h of horses){if(h==P.ride){setPos(h);h.m.rotation.y=P.yaw+Math.PI;continue}h.t-=dt;let sp=0;
if(h.called){const dx=P.x-h.x,dz=P.z-h.z,d=Math.hypot(dx,dz);if(d<3)h.called=false;else{h.dir=Math.atan2(dx,dz);sp=14}}
else if(h.flee>0){h.flee-=dt;const dx=h.x-P.x,dz=h.z-P.z;h.dir=Math.atan2(dx,dz);sp=12}
else if(!h.hitched&&!h.tamed){if(h.t<0){h.t=R(3,8);h.dir=R(0,6.28);h.mv=Math.random()<.5}sp=h.mv?2:0}
h.x+=Math.sin(h.dir)*sp*dt;h.z+=Math.cos(h.dir)*sp*dt;collide(h,1);setPos(h);h.m.rotation.y=h.dir;walkAnim(h,sp/5,T)}
// animals
for(const a of [...animals]){a.t-=dt;const dp=Math.hypot(P.x-a.x,P.z-a.z);let sp=1.5;
if(a.kind=='deer'){if(dp<15||a.flee>0){a.flee=(a.flee||0)-dt;a.dir=Math.atan2(a.x-P.x,a.z-P.z);sp=9}else if(a.t<0){a.t=R(2,6);a.dir=R(0,6.28)}}
else{if(dp<(night?35:20)){a.dir=Math.atan2(P.x-a.x,P.z-a.z);sp=7.5;a.atk-=dt;if(dp<1.8&&a.atk<=0&&!P.drive){a.atk=1;hurt(P.ride?4:9);if(P.ride)P.ride.hp-=6}}else if(a.t<0){a.t=R(2,6);a.dir=R(0,6.28)}}
a.x+=Math.sin(a.dir)*sp*dt;a.z+=Math.cos(a.dir)*sp*dt;collide(a,.6);setPos(a);a.m.rotation.y=a.dir;walkAnim(a,sp/4,T)}
// zombies
spawnT-=dt;const cap=night?80:40;if(spawnT<0&&zombies.length<cap){spawnT=night?1.5:5;const a=R(0,6.28),r=R(50,90);spawnZombie(P.x+Math.cos(a)*r,P.z+Math.sin(a)*r)}
for(const z of zombies){const dx=P.x-z.x,dz=P.z-z.z,d=Math.hypot(dx,dz);const sense=night?28:18;
if(d<sense&&!P.dead)z.state='chase';else if(d>sense*2.5)z.state='wander';let sp;
if(z.state=='chase'){z.dir=Math.atan2(dx,dz);sp=night?4.2:3.2;if(Math.random()<dt*.3)snd('groan');z.atk-=dt;if(d<1.5&&z.atk<=0){z.atk=1.2;if(P.drive){P.drive.hp-=3}else{hurt(R(8,14));if(P.ride)P.ride.hp-=5}}}
else{z.t-=dt;if(z.t<0){z.t=R(3,9);z.dir=R(0,6.28)}sp=.8}
if(d>1.2||z.state!='chase'){z.x+=Math.sin(z.dir)*sp*dt;z.z+=Math.cos(z.dir)*sp*dt}collide(z,.4);setPos(z);z.m.rotation.y=z.dir;walkAnim(z,sp/3,T)}
for(const h of [...horses])if(h.hp<=0)kill(h);
for(const b of builds)if(b.fl)b.fl.scale.y=1+Math.sin(T*15)*.2;
// hud
const bar=(n,v,c)=>`${n}<div class="bar"><div style="width:${Math.max(0,v)}%;background:${c}"></div></div>`;
let h=bar('HEALTH',P.hp,'#e33')+bar('HUNGER',P.food,'#e93')+bar('THIRST',P.water,'#39f')+bar('STAMINA',P.stam,'#ee3');
if(P.drive)h+=bar(`${P.drive.kind.toUpperCase()} HP`,P.drive.hp,'#aaa')+bar(`FUEL ${Math.abs(P.drive.speed*3.6)|0} km/h`,P.drive.fuel,'#c6f');
if(P.ride)h+=bar('HORSE HP',P.ride.hp/1.2,'#a63')+bar('HORSE STAMINA',P.ride.stam,'#fc6');$('hud').innerHTML=h;
const hh=Math.floor(time/60),mm=Math.floor(time%60);const w=WEAP[P.eq];
$('info').innerHTML=`Z-DAY SURVIVE &nbsp; ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${night?'<span style="color:#f44">NIGHT - THEY HUNT</span>':''}<br>Weapon: ${IT[P.eq]||'Fists'}${w.ammo?` [${P.mag}/${P.inv[w.ammo]||0}]`:''} &nbsp; Kills: ${P.kills} &nbsp; Zombies: ${zombies.length}${P.place?'<br>F: place '+IT[P.place]:''}`}
function loop(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;if(started)update(dt);renderer.render(scene,cam);requestAnimationFrame(loop)}
function start(l){$('title').style.display='none';started=true;if(l)load();msg('Scavenge the town. Survive. (H for help)',3000)}
$('bNew').onclick=()=>start(false);$('bLoad').onclick=()=>start(true);
cam.position.set(0,40,90);cam.lookAt(0,0,0);loop();
window.G={P,zombies,horses,vehicles,containers,keys,start,interact,attack,toggle,add,setTime:t=>time=t,update,mkBuild,get time(){return time}};
