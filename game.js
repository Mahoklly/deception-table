// The Deception Table — solo social deduction at a tavern table.
// three.js scene + HTML overlay UI. Fixed-timestep sim, seeded RNG, command-object input.
import * as THREE from "three";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { STR, fmt } from "./strings.js";
import { DECK, NPCS, RULES } from "./data.js";
import { ASSET_URLS } from "./assets_urls.js";
const assetSrc = (key, rel) => ASSET_URLS[key] || ("./assets/"+rel);

/* ---------------- seeded RNG (determinism §12.1) ---------------- */
const SEED = (new URLSearchParams(location.search).get("seed")|0) || (Date.now() & 0x7fffffff);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const rng = mulberry32(SEED);
const pick = arr => arr[Math.floor(rng()*arr.length)];
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}

/* ---------------- game clock + cooperative scheduler ---------------- */
const clock = { t:0 };                    // advances only while unpaused
const waiters = [];
function sleep(ms){ return new Promise(res=>waiters.push({at:clock.t+ms,res})); }
function pumpWaiters(){ for(let i=waiters.length-1;i>=0;i--){ if(clock.t>=waiters[i].at){ waiters[i].res(); waiters.splice(i,1);} } }

/* ---------------- audio ---------------- */
const SND = {};
const audioUnlocked = { v:false };
function loadAudio(id, file, {loop=false, vol=1}={}){
  const a = new Audio(assetSrc(id==="music"?"music_tavern":id==="shot"?"sfx_gunshot":id==="click"?"sfx_click":id==="card"?"sfx_card":"sfx_drum", file)); a.crossOrigin="anonymous"; a.preload="auto"; a.loop=loop; a.volume=vol;
  a.addEventListener("error", ()=>{ SND[id]=null; });
  SND[id]=a;
}
loadAudio("music","music_tavern.mp3",{loop:true,vol:0.28});
loadAudio("shot","sfx_gunshot.mp3",{vol:0.9});
loadAudio("click","sfx_click.mp3",{vol:0.8});
loadAudio("card","sfx_card.mp3",{vol:0.6});
loadAudio("drum","sfx_drum.mp3",{vol:0.65});
function play(id){ const a=SND[id]; if(!a) return; try{ if(!a.loop){a.currentTime=0;} a.play().catch(()=>{});}catch(e){} }
function unlockAudio(){ if(audioUnlocked.v) return; audioUnlocked.v=true; play("music"); }

/* ---------------- input: everything becomes a command object ---------------- */
const BIND = { Digit1:"w1", Digit2:"w2", Digit3:"w3", Digit4:"w4", KeyV:"vote", Space:"confirm", Enter:"confirm" };
const commandQueue = [];
addEventListener("keydown", e=>{ const c=BIND[e.code]; if(c){ commandQueue.push(c); e.preventDefault(); } unlockAudio(); });
addEventListener("pointerdown", unlockAudio, {once:false});

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const DPR_CAP = 1.5;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070503, 0.055);
const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
const CAM_BASE = new THREE.Vector3(0, 1.48, 1.28);
const CAM_LOOK = new THREE.Vector3(0, 0.9, -0.6);
let camYaw=0, camPitch=0, camYawT=0, camPitchT=0;
addEventListener("pointermove", e=>{
  if(e.pointerType && e.pointerType!=="mouse") return;
  camYawT   = -((e.clientX/innerWidth)-0.5)*2*0.6;
  camPitchT = -((e.clientY/innerHeight)-0.5)*2*0.3;
});
const _camDir = new THREE.Vector3(), _camTgt = new THREE.Vector3(), _Y = new THREE.Vector3(0,1,0);
camera.position.copy(CAM_BASE);

function resize(){
  const dpr = Math.min(devicePixelRatio||1, DPR_CAP);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.fov = innerWidth < innerHeight ? 72 : 58;   // wider on portrait phones
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); addEventListener("orientationchange", resize); resize();

/* lights: one warm candle cutting through cold darkness (style blocks 3-4) */
scene.add(new THREE.AmbientLight(0x3a4048, 0.9));
const fill = new THREE.PointLight(0x9aa6b8, 0.8, 11, 1.4); fill.position.set(0,1.7,2.3); scene.add(fill);
const candle = new THREE.PointLight(0xffb457, 3.4, 13, 1.4); candle.position.set(0,1.15,0); scene.add(candle);
const lantern = new THREE.SpotLight(0xe08a2e, 55, 14, 0.7, 0.55, 1.8);
lantern.position.set(0,3.4,0.4); lantern.target.position.set(0,0.9,-0.4); scene.add(lantern, lantern.target);
const rim = new THREE.DirectionalLight(0x24343e, 0.7); rim.position.set(-3,2.5,-4); scene.add(rim);

/* floor + backdrop */
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 40),
  new THREE.MeshStandardMaterial({color:0x120c07, roughness:0.95}));
floor.rotation.x = -Math.PI/2; scene.add(floor);
const texLoader = new THREE.TextureLoader();
let backdrop = null;
texLoader.load(assetSrc("bg_tavern","bg_tavern.jpg"), tex=>{
  tex.colorSpace = THREE.SRGBColorSpace;
  const h = 7, w = h*16/9;
  backdrop = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, h, 48, 1, true, Math.PI*0.6, Math.PI*1.8),
    new THREE.MeshBasicMaterial({map:tex, side:THREE.BackSide, fog:false}));
  backdrop.position.y = h/2 - 0.4;
  backdrop.material.color = new THREE.Color(0.82,0.8,0.78);
  scene.add(backdrop);
}, undefined, ()=>{ /* missing backdrop: fog + darkness carries the mood */ });

/* ---------------- seats & actors ---------------- */
// Seat 0 = player (camera). 1=left, 2=front, 3=right.
const SEATS = [
  { pos:new THREE.Vector3(0,0, 1.55),     rotY: Math.PI },
  { pos:new THREE.Vector3(-1.18,0,-0.42), rotY: Math.atan2(1.18, 0.42) },
  { pos:new THREE.Vector3(0,0,-1.5),      rotY: 0 },
  { pos:new THREE.Vector3(1.18,0,-0.42),  rotY: -Math.atan2(1.18, 0.42) },
];
const loader = new GLTFLoader();
function loadGLB(key, file){ return new Promise(res=>loader.load(assetSrc(key,file), g=>res(g.scene), undefined, ()=>res(null))); }
function normalize(obj, targetH, groundY=0){
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = targetH / Math.max(size.y, 1e-4);
  obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y += groundY - box2.min.y;
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z;
  obj.traverse(m=>{ if(m.isMesh){ m.material && (m.material.side = THREE.FrontSide); } });
  return obj;
}
function placeholderChar(color){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26,0.6,6,14),
    new THREE.MeshStandardMaterial({color, roughness:0.85}));
  body.position.y=0.75; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19,16,14),
    new THREE.MeshStandardMaterial({color:0xcfae87, roughness:0.8}));
  head.position.y=1.32; g.add(head);
  return g;
}
const actors = [];   // {seat, group, inner, npc?, alive, breathe, lean, slump, glanceAt}
function makeActorShell(seatIdx){
  const group = new THREE.Group();
  const seat = SEATS[seatIdx];
  group.position.copy(seat.pos); group.rotation.y = seat.rotY;
  scene.add(group);
  return { seat:seatIdx, group, inner:null, alive:true, breathe:rng()*6.28, lean:0, slump:0, glance:0, glanceDir:0 };
}

let table=null, revolver=null, tableTopY=0.95, worldReady=false, cardBackTex=null;
const cards=[];
const revolverHome = new THREE.Vector3(0.28, 0, 0.15);
async function loadWorld(){
  const [gTable, gBrute, gWidow, gFox, gGun] = await Promise.all([
    loadGLB("table_tavern","table_tavern.glb"), loadGLB("char_brute","char_brute.glb"),
    loadGLB("char_widow","char_widow.glb"), loadGLB("char_fox","char_fox.glb"), loadGLB("revolver","revolver.glb"),
  ]);
  table = gTable ? normalize(gTable, 0.95) :
    (()=>{ const t=new THREE.Group();
      const top=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,0.09,28), new THREE.MeshStandardMaterial({color:0x3a2a16,roughness:0.8})); top.position.y=0.92; t.add(top);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.92,10), new THREE.MeshStandardMaterial({color:0x2a1d10,roughness:0.9})); leg.position.y=0.46; t.add(leg);
      return t; })();
  scene.add(table);
  // table top height for props
  const tb = new THREE.Box3().setFromObject(table);
  tableTopY = tb.max.y;
  revolverHome.y = tableTopY + 0.005;
  candle.position.y = tableTopY + 0.26;

  const models = [null, gBrute, gWidow, gFox];
  for(let i=1;i<4;i++){
    const a = makeActorShell(i);
    const npc = NPCS[i-1];
    a.npc = npc;
    a.inner = models[i] ? normalize(models[i], 1.5) : placeholderChar(npc.chip);
    { const cb = new THREE.Box3().setFromObject(a.inner);
      a.baseY = a.inner.position.y + ((tableTopY + 0.85) - cb.max.y);
      a.inner.position.y = a.baseY; }
    { const st = SEATS[i];
      const ch = makeChair();
      const out = st.pos.clone().setY(0).normalize().multiplyScalar(0.12);
      ch.position.copy(st.pos).add(out); ch.rotation.y = st.rotY; scene.add(ch); }
    a.group.add(a.inner);
    actors[i] = a;
  }
  actors[0] = { seat:0, group:null, alive:true, npc:null }; // the player

  const gunMesh = gGun ? normalize(gGun, 0.2) :
    new THREE.Mesh(new THREE.BoxGeometry(0.22,0.08,0.05), new THREE.MeshStandardMaterial({color:0x5a5a5f,roughness:0.4,metalness:0.7}));
  revolver = new THREE.Group(); revolver.add(gunMesh);
  revolver.position.copy(revolverHome); revolver.rotation.y = rng()*6.28;
  scene.add(revolver);
  buildTableCards();
  worldReady = true;
}

/* ---------------- overlay DOM helpers ---------------- */
const $ = id => document.getElementById(id);
const bubblesL = $("bubbles"), platesL = $("plates");
const bubbleEls = {}, plateEls = {};
function mkBubble(i){
  const d=document.createElement("div"); d.className="bubble";
  d.innerHTML = `<span class="who"></span><span class="txt"></span>`;
  bubblesL.appendChild(d); bubbleEls[i]=d; return d;
}
function mkPlate(i,name){
  const d=document.createElement("div"); d.className="plate";
  d.innerHTML=`${name}<span class="sus"></span>`;
  platesL.appendChild(d); plateEls[i]=d; return d;
}
function headScreenPos(i, yOff=1.62){
  const a = actors[i]; if(!a || !a.group) return null;
  const v = new THREE.Vector3(0, yOff*(a.slump>0.5?0.55:1), 0).applyMatrix4(a.group.matrixWorld);
  v.project(camera);
  return { x:(v.x*0.5+0.5)*innerWidth, y:(-v.y*0.5+0.5)*innerHeight, behind:v.z>1 };
}
function clampBubblePos(p){
  let x = Math.min(Math.max(p.x, 150), innerWidth-150);
  let y = Math.max(p.y, 96);
  const cardEl = $("myCard");
  if (cardEl && cardEl.style.display !== "none"){
    const c = cardEl.getBoundingClientRect();
    // bubble occupies roughly x±150 horizontally and up to ~110px above y
    if (x + 150 > c.left - 12 && y - 100 < c.bottom + 12){
      x = c.left - 170;
      if (x < 150){ x = 150; y = Math.max(y, c.bottom + 110); }
    }
  }
  return {x, y};
}
function showBubble(i, who, text, ms){
  const d = bubbleEls[i] || mkBubble(i);
  d.querySelector(".who").textContent = who;
  d.querySelector(".txt").textContent = text;
  d.classList.add("show");
  d.dataset.hideAt = clock.t + ms;
}
function setBanner(text, ms=1800){
  const b=$("banner"); b.textContent=text; b.classList.add("show");
  b.dataset.hideAt = clock.t+ms;
}
function flash(){ const f=$("flash"); f.style.transition="none"; f.style.opacity=0.9;
  requestAnimationFrame(()=>{ f.style.transition="opacity .5s"; f.style.opacity=0; }); }

/* ---------------- game state ---------------- */
const G = {
  phase:"title", card:null, imposterSeat:-1, round:1, maxRounds:RULES.maxRounds,
  usedWords:new Set(), spoken:[[],[],[],[]], suspicion:null, heat:[0,0,0,0],
  heardCrewWords:0, voteCalled:false, extraRound:false, over:false,
};
const aliveSeats = ()=> [0,1,2,3].filter(i=>actors[i] && actors[i].alive);
const nameOf = i => i===0 ? STR.you : actors[i].npc.name;

function newMatch(){
  G.card = pick(DECK);
  G.imposterSeat = Math.floor(rng()*4);
  G.round = 1; G.maxRounds = RULES.maxRounds;
  G.usedWords = new Set(); G.spoken=[[],[],[],[]];
  G.heat=[0,0,0,0]; G.heardCrewWords=0; G.voteCalled=false; G.extraRound=false; G.over=false;
  // per-observer suspicion matrix (crew NPCs only use their own row)
  G.suspicion = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for(const a of actors) if(a){ a.alive=true; a.slump=0; a.lean=0; }
  for(const i of [1,2,3]){ const p=plateEls[i]; if(p){ p.classList.remove("dead"); p.querySelector(".sus").textContent=""; } }
  // word map for scoring
  G.wordWeight = {};
  for(const w of G.card.obvious) G.wordWeight[w]=RULES.weights.obvious;
  for(const w of G.card.medium)  G.wordWeight[w]=RULES.weights.medium;
  for(const w of G.card.subtle)  G.wordWeight[w]=RULES.weights.subtle;
}

/* ---------- card HUD ---------- */
function setupCardHUD(){
  const c=$("myCard");
  c.style.backgroundImage="url("+assetSrc("card_back","card_back.png")+"), linear-gradient(160deg,#4a2418,#241208)";
  const face=c.querySelector(".face");
  const isImp = G.imposterSeat===0;
  face.classList.toggle("imposter", isImp);
  face.querySelector(".lbl").textContent = STR.your_card_label;
  face.querySelector(".word").textContent = isImp ? STR.imposter_card : G.card.secret;
  face.querySelector(".hint").textContent = isImp ? fmt(STR.imposter_hint,{h:G.card.hint}) : "";
  c.title = STR.hold_to_peek;
  const peek=on=>c.classList.toggle("peek",on);
  c.onpointerdown=()=>peek(true); c.onpointerup=c.onpointerleave=()=>peek(false);
}

/* ---------- word AI ---------- */
function unused(list){ return list.filter(w=>!G.usedWords.has(w)); }
function crewHand(){
  const o=shuffle(unused(G.card.obvious)), m=shuffle(unused(G.card.medium)), s=shuffle(unused(G.card.subtle));
  const hand=[];
  if(o[0]) hand.push({w:o[0],tier:"obvious"});
  if(m[0]) hand.push({w:m[0],tier:"medium"});
  for(const w of s){ if(hand.length>=RULES.handSize) break; hand.push({w,tier:"subtle"}); }
  let i=1; while(hand.length<RULES.handSize && (m[i]||o[i])){ const w=m[i]||o[i]; hand.push({w,tier:m[i]?"medium":"obvious"}); i++; }
  return shuffle(hand).slice(0,RULES.handSize);
}
function imposterHand(){
  const b=shuffle(unused(G.card.bluff)).map(w=>({w,tier:"bluff"}));
  const learnedUnlocked = Math.floor(G.heardCrewWords/3);
  const learned = shuffle(unused(G.card.subtle.concat(G.card.medium))).slice(0,learnedUnlocked)
    .map(w=>({w,tier:"bluff"}));
  return shuffle(learned.concat(b)).slice(0,RULES.handSize);
}
function npcPickWord(seat){
  const a=actors[seat], npc=a.npc;
  if(seat===G.imposterSeat){
    const hand=imposterHand();
    return hand[0] || {w:pick(G.card.bluff), tier:"bluff"};
  }
  const beingSuspected = G.heat[seat] > Math.max(...aliveSeats().filter(s=>s!==seat).map(s=>G.heat[s]), 0.01);
  const push = (G.round-1)*0.22 + (beingSuspected?0.35:0) - npc.caution*0.35 + rng()*0.3;
  const tier = push>0.75 ? "obvious" : push>0.35 ? "medium" : "subtle";
  const poolNames = tier==="obvious"?["obvious","medium","subtle"]:tier==="medium"?["medium","subtle","obvious"]:["subtle","medium","obvious"];
  for(const p of poolNames){ const u=unused(G.card[p]); if(u.length) return {w:pick(u), tier:p}; }
  return {w:pick(G.card.subtle), tier:"subtle"};
}
function registerWord(seat, w){
  G.usedWords.add(w); G.spoken[seat].push(w);
  if(seat!==G.imposterSeat) G.heardCrewWords++;
  // every alive crew NPC updates its suspicion of `seat`
  const weight = G.wordWeight[w];
  for(const o of aliveSeats()){
    if(o===0 || o===seat) continue;
    if(o===G.imposterSeat){
      // imposter can't score relatedness; it tracks table heat instead
      continue;
    }
    let d;
    if(weight===undefined) d = 1.7;            // unknown word — smells like a bluff
    else if(weight===3)    d = -1.2;           // proves knowledge (and leaks it)
    else if(weight===2)    d = -0.4;
    else                   d = 0.35;           // safe but slippery
    d += (rng()-0.5)*0.4;
    G.suspicion[o][seat] += d;
  }
  // public heat: rough table-wide read (drives glances + imposter votes)
  if(weight===undefined) G.heat[seat]+=1.4; else G.heat[seat]+= weight===1?0.35:weight===2?-0.3:-0.9;
}

/* ---------- voting AI ---------- */
function npcVote(o){
  const targets = aliveSeats().filter(s=>s!==o);
  if(o===G.imposterSeat){
    let best=targets[0], bh=-1e9;
    for(const t of targets){ const h=G.heat[t]+rng()*0.6 - (t===0?0.1:0); if(h>bh){bh=h;best=t;} }
    return best;
  }
  const npc=actors[o].npc;
  let best=targets[0], bs=-1e9;
  for(const t of targets){
    const s = G.suspicion[o][t] + G.heat[t]*npc.aggression*0.4 + rng()*0.5;
    if(s>bs){bs=s;best=t;}
  }
  return best;
}

/* ---------- UI: prompt / hand / vote ---------- */
function setPrompt(t){ $("prompt").textContent=t; }
function clearTray(){ $("hand").innerHTML=""; $("voteRow").style.display="none"; $("voteRow").innerHTML=""; $("actions").innerHTML=""; }
function offerHand(hand){
  return new Promise(res=>{
    const done=h=>{ $("hand").innerHTML=""; G._handResolver=null; G._handCancel=null; res(h); };
    const hd=$("hand"); hd.innerHTML="";
    hand.forEach((h,idx)=>{
      const b=document.createElement("button"); b.className="wordBtn";
      const tierLbl = STR["tier_"+(h.tier==="obvious"?"obvious":h.tier==="medium"?"medium":h.tier==="bluff"?"bluff":"subtle")];
      b.innerHTML=`${h.w}<small>${tierLbl}</small>`;
      b.onclick=()=>done(h);
      hd.appendChild(b);
    });
    G._handResolver = k=>{ const h=hand[k]; if(h) done(h); };
    G._handCancel = ()=>done(null);
  });
}
function offerCallVote(){
  const act=$("actions"); act.innerHTML="";
  if(G.round>=RULES.voteUnlockRound && !G.voteCalled){
    const b=document.createElement("button"); b.className="ghostBtn"; b.textContent=STR.call_vote;
    b.onclick=()=>{ G.voteCalled=true; act.innerHTML=""; if(G._handCancel) G._handCancel(); };
    act.appendChild(b);
  }
}
function offerVote(){
  return new Promise(res=>{
    const row=$("voteRow"); row.innerHTML=""; row.style.display="flex";
    for(const s of aliveSeats()){
      if(s===0) continue;
      const b=document.createElement("button"); b.className="voteBtn"; b.dataset.seat=s;
      b.innerHTML=`<span class="chip" style="background:${actors[s].npc.chip}">${actors[s].npc.name[0]}</span>
        <span class="nm">${actors[s].npc.name}</span><span class="tally"></span>`;
      b.onclick=()=>res(s);
      row.appendChild(b);
    }
  });
}

/* ---------- actor animation cues ---------- */
async function npcSpeak(seat, text, extraThink=0){
  const a=actors[seat], npc=a.npc;
  setPrompt(fmt(STR.prompt_waiting,{n:npc.name}));
  const think = npc.thinkMs[0] + rng()*(npc.thinkMs[1]-npc.thinkMs[0]) + extraThink;
  a.lean = 1;
  await sleep(think);
  showBubble(seat, npc.name, text, 2400);
  await sleep(2400);
  a.lean = 0;
}
function glanceAt(observer, target){
  const a=actors[observer]; if(!a||!a.group) return;
  const to = target===0 ? CAM_BASE : SEATS[target].pos;
  const dx = to.x - a.group.position.x, dz = to.z - a.group.position.z;
  a.glanceDir = Math.atan2(dx,dz) - a.group.rotation.y;
  a.glance = 1;
}
async function executeSeat(victim){
  play("drum");
  // revolver rises and aims
  const target = victim===0 ? new THREE.Vector3(0,1.25,1.3) : SEATS[victim].pos.clone().setY(1.25);
  const start = revolver.position.clone();
  const up = new THREE.Vector3(0, revolverHome.y+0.55, 0);
  for(let t=0;t<=1;t+=0.05){ revolver.position.lerpVectors(start,up,t); await sleep(16); }
  revolver.lookAt(target);
  await sleep(900);
  play("shot"); flash();
  if(victim!==0){ actors[victim].alive=false; }
  await sleep(300);
  // settle back
  for(let t=0;t<=1;t+=0.05){ revolver.position.lerpVectors(up,start,t); await sleep(16); }
  revolver.rotation.set(0,rng()*6.28,0);
}

/* ---------------- chairs ---------------- */
function makeChair(){
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({color:0x4a2f1b, roughness:0.85});
  const dark = new THREE.MeshStandardMaterial({color:0x33200f, roughness:0.9});
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54,0.06,0.52), wood);
  seat.position.y = 0.5; g.add(seat);
  for(const [lx,lz] of [[-0.23,-0.21],[0.23,-0.21],[-0.23,0.21],[0.23,0.21]]){
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.038,0.5,8), dark);
    leg.position.set(lx,0.25,lz); g.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.54,0.66,0.06), wood);
  back.position.set(0,0.88,-0.27); g.add(back);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.54,0.08,0.07), dark);
  rail.position.set(0,1.18,-0.27); g.add(rail);
  return g;
}

/* ---------------- physical cards on the table ---------------- */
function cardFaceTexture(isImp){
  const cv=document.createElement("canvas"); cv.width=256; cv.height=384;
  const g=cv.getContext("2d");
  const grad=g.createLinearGradient(0,0,256,384);
  grad.addColorStop(0,"#efe3c0"); grad.addColorStop(1,"#c6b184");
  g.fillStyle=grad; g.fillRect(0,0,256,384);
  g.strokeStyle="#7a2e22"; g.lineWidth=8; g.strokeRect(10,10,236,364);
  g.textAlign="center"; g.fillStyle="#6b5537";
  g.font="18px Georgia"; g.fillText(STR.your_card_label.toUpperCase(),128,86);
  const word = isImp ? STR.imposter_card : G.card.secret;
  g.fillStyle = isImp ? "#a92a1c" : "#241708";
  g.font="bold 40px Georgia";
  if(g.measureText(word).width>210) g.font="bold 30px Georgia";
  g.fillText(word,128,200);
  if(isImp){ g.fillStyle="#7a2e22"; g.font="italic 20px Georgia";
    g.fillText(fmt(STR.imposter_hint,{h:G.card.hint}),128,258); }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function buildTableCards(){
  const backTex = cardBackTex = texLoader.load(assetSrc("card_back","card_back.png"));
  backTex.colorSpace = THREE.SRGBColorSpace;
  for(let i=0;i<4;i++){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.22),
      new THREE.MeshStandardMaterial({map:backTex, side:THREE.DoubleSide, roughness:0.7}));
    const grp = new THREE.Group(); grp.add(m);
    const dir = SEATS[i].pos.clone().setY(0).normalize();
    grp.position.set(dir.x*0.66, tableTopY+0.006, dir.z*0.66);
    grp.rotation.set(-Math.PI/2, 0, (rng()-0.5)*0.5);
    grp.userData.home = { p:grp.position.clone(), r:grp.rotation.clone() };
    grp.userData.mesh = m;
    scene.add(grp); cards[i]=grp;
  }
}
async function tweenTo(obj, p, r, ms){
  const p0=obj.position.clone(), r0={x:obj.rotation.x,y:obj.rotation.y,z:obj.rotation.z};
  const steps=Math.max(2,Math.round(ms/16));
  for(let s=1;s<=steps;s++){
    const t=s/steps, e=t*t*(3-2*t); // smoothstep
    obj.position.lerpVectors(p0,p,e);
    obj.rotation.set(r0.x+(r.x-r0.x)*e, r0.y+(r.y-r0.y)*e, r0.z+(r.z-r0.z)*e);
    await sleep(16);
  }
}
function waitTap(maxMs){
  return new Promise(res=>{
    let done=false;
    const fin=()=>{ if(done) return; done=true; removeEventListener("pointerdown",fin); res(); };
    addEventListener("pointerdown",fin);
    sleep(maxMs).then(fin);
  });
}
async function dealCardsSequence(){
  while(!worldReady) await sleep(120);
  play("card");
  // reset cards to their table spots (back design up)
  for(const c of cards){
    c.position.copy(c.userData.home.p); c.rotation.copy(c.userData.home.r);
    c.userData.mesh.material.map = cardBackTex; c.userData.mesh.material.needsUpdate = true;
  }
  setPrompt(STR.deal_prompt);
  // NPCs lift their cards to read them (faces tilted away from you)
  const npcPeeks = [1,2,3].map(async (i, k)=>{
    await sleep(350*k + 250);
    const c=cards[i], seat=SEATS[i];
    const up = new THREE.Vector3(seat.pos.x*0.8, tableTopY+0.45, seat.pos.z*0.8);
    const outY = Math.atan2(seat.pos.x, seat.pos.z);
    await tweenTo(c, up, {x:-0.4, y:outY, z:0}, 550);
    await sleep(900+rng()*500);
    await tweenTo(c, c.userData.home.p, c.userData.home.r, 500);
  });
  // your card comes up to your face
  const mine = cards[0];
  const face = cardFaceTexture(G.imposterSeat===0);
  await sleep(200);
  const holdP = new THREE.Vector3(0.08, 1.26, 0.72);
  const dummy = new THREE.Object3D(); dummy.position.copy(holdP); dummy.lookAt(CAM_BASE);
  await tweenTo(mine, holdP, {x:dummy.rotation.x, y:dummy.rotation.y, z:dummy.rotation.z+0.05}, 650);
  mine.userData.mesh.material.map = face; mine.userData.mesh.material.needsUpdate = true;
  setPrompt(STR.tap_to_place);
  await waitTap(8000);
  mine.userData.mesh.material.map = cardBackTex; mine.userData.mesh.material.needsUpdate = true;
  await tweenTo(mine, mine.userData.home.p, mine.userData.home.r, 550);
  await Promise.all(npcPeeks);
  setPrompt("");
}

/* ---------------- match flow ---------------- */
async function runMatch(){
  newMatch();
  setupCardHUD();
  await dealCardsSequence();
  setBanner("", 1);
  $("myCard").style.display="block";
  let order = aliveSeats();

  matchLoop:
  while(!G.over){
    $("roundTag").textContent = fmt(STR.round_tag,{r:G.round,max:G.maxRounds});
    // ---- word round ----
    for(const seat of aliveSeats()){
      if(G.voteCalled) break;
      if(seat===0){
        setPrompt(STR.prompt_your_turn);
        offerCallVote();
        const isImp = G.imposterSeat===0;
        const h = await offerHand(isImp ? imposterHand() : crewHand());
        $("actions").innerHTML="";
        if(h){
          showBubble(0, STR.you, h.w, 2000);
          registerWord(0,h.w);
          await sleep(1400);
        }
      } else {
        const a = actors[seat];
        const isImp = seat===G.imposterSeat;
        const hesitates = isImp && rng()<a.npc.tell;
        const choice = npcPickWord(seat);
        await npcSpeak(seat, choice.w, hesitates? 1300 : 0);
        registerWord(seat, choice.w);
        // aggressive npcs glance at their current top suspect
        if(rng()<a.npc.aggression*0.7){
          const targets=aliveSeats().filter(s=>s!==seat);
          let top=targets[0],ts=-1e9;
          for(const t of targets){ const s=(isImp?G.heat[t]:G.suspicion[seat][t]); if(s>ts){ts=s;top=t;} }
          glanceAt(seat, top);
        }
      }
    }
    // ---- vote? ----
    const forced = G.round>=G.maxRounds;
    if(forced || G.voteCalled){
      const result = await doVote();
      if(G.over) break matchLoop;
      G.voteCalled=false;
      if(result==="tie"){ G.round = G.maxRounds; }      // one more word round, then re-vote
      else { G.round=1; G.maxRounds=3; }                // survivors play shorter cycles
    } else {
      G.round++;
    }
  }
}
async function doVote(){
  clearTray();
  $("roundTag").textContent = STR.vote_tag;
  setPrompt(STR.prompt_vote);
  play("drum");
  const votes = {};
  // player votes via UI
  const myPick = await offerVote();
  votes[myPick]=(votes[myPick]||0)+1;
  updateTallies(votes);
  await sleep(500);
  // npcs vote with reveal bubbles
  for(const o of aliveSeats()){
    if(o===0) continue;
    const t = npcVote(o);
    glanceAt(o,t);
    await sleep(500+rng()*600);
    showBubble(o, actors[o].npc.name, nameOf(t), 1500);
    votes[t]=(votes[t]||0)+1;
    updateTallies(votes);
    await sleep(900);
  }
  // resolve
  let max=0; for(const k in votes) max=Math.max(max,votes[k]);
  const top=Object.keys(votes).filter(k=>votes[k]===max).map(Number);
  await sleep(700);
  if(top.length>1){
    play("click");
    setBanner(STR.banner_tie, 2300);
    setPrompt(STR.prompt_revote);
    clearTray();
    await sleep(2100);
    return "tie";
  }
  const victim=top[0];
  clearTray();
  setBanner(victim===0?STR.banner_you_shot:fmt(STR.banner_shot,{n:nameOf(victim)}), 2400);
  await executeSeat(victim);
  const wasImp = victim===G.imposterSeat;
  setBanner(fmt(wasImp?STR.banner_was_imposter:STR.banner_was_innocent,{n:nameOf(victim)}), 2200);
  if(victim!==0){ const p=plateEls[victim]; if(p) p.classList.add("dead"); }
  await sleep(2300);
  // outcomes
  if(wasImp){ endMatch(victim===0 ? "lose_imp" : "win_crew"); return; }
  if(victim===0){ endMatch("lose_shot"); return; }
  if(aliveSeats().length<=2){ endMatch(G.imposterSeat===0 ? "win_you_imp" : "win_imp"); return; }
}
function updateTallies(votes){
  document.querySelectorAll(".voteBtn").forEach(b=>{
    const c=votes[b.dataset.seat]||0;
    b.querySelector(".tally").textContent = c? fmt(STR.votes_for,{c, s:c>1?"s":""}) : "";
  });
}
function endMatch(kind){
  G.over=true;
  clearTray(); setPrompt("");
  const t=$("title"), h=t.querySelector("h1"), p=$("titleBlurb");
  const vars={ n: G.imposterSeat===0? STR.you : nameOf(G.imposterSeat), w:G.card.secret, h:G.card.hint };
  const map={
    win_crew:[STR.win_crew_title,STR.win_crew_body],
    win_imp:[STR.win_imp_title,STR.win_imp_body],
    win_you_imp:[STR.win_you_imp_title,STR.win_you_imp_body],
    lose_shot:[STR.lose_you_shot_title,STR.lose_you_shot_body],
    lose_imp:[STR.lose_you_imp_title,STR.lose_you_imp_body],
  };
  h.innerHTML=map[kind][0]; p.textContent=fmt(map[kind][1],vars);
  $("startBtn").textContent=STR.play_again;
  $("loadNote").textContent="";
  t.classList.remove("hidden");
  $("myCard").style.display="none";
}

/* ---------------- fixed-timestep loop ---------------- */
const STEP = 1000/60;
let acc=0, last=performance.now(), paused=false, frames=0, fpsAt=last;
addEventListener("blur", ()=>paused=true);
addEventListener("focus", ()=>{paused=false; last=performance.now();});
const dev = new URLSearchParams(location.search).has("dev");
if(dev){ $("dev").style.display="block"; }

function update(dt){
  clock.t += dt;
  pumpWaiters();
  // commands
  while(commandQueue.length){
    const c=commandQueue.shift();
    if(c.startsWith("w") && G._handResolver) G._handResolver(+c[1]-1);
    if(c==="vote"){ const b=$("actions").querySelector("button"); if(b) b.click(); }
  }
  // actor idle / lean / glance / slump
  for(let i=1;i<4;i++){
    const a=actors[i]; if(!a||!a.inner) continue;
    a.breathe += dt*0.0016;
    const breatheAmt = a.alive ? Math.sin(a.breathe)*0.012 : 0;
    const targetLean = a.alive ? (a.lean?0.12:0) : 0;
    a._leanCur = (a._leanCur??0) + ((targetLean)-(a._leanCur??0))*0.08;
    const targetSlump = a.alive?0:1;
    a.slump += (targetSlump-a.slump)*0.03;
    a.glance = Math.max(0, a.glance - dt*0.0007);
    const g = a.glance>0 ? Math.sin(Math.min(1,a.glance)*Math.PI)*a.glanceDir*0.55 : 0;
    a.inner.rotation.x = a._leanCur + a.slump*1.15 + breatheAmt*0.4;
    a.inner.rotation.y = g;
    a.inner.position.y = (a.baseY||0) - a.slump*0.35;
    a.inner.scale.y = a.inner.scale.x * (1+breatheAmt); // uses normalize's uniform scale as base
  }
  // candle flicker
  candle.intensity = 3.4 + Math.sin(clock.t*0.011)*0.3 + Math.sin(clock.t*0.037)*0.2;
  // fixed camera with smooth mouse-look
  camYaw += (camYawT - camYaw)*0.07;
  camPitch += (camPitchT - camPitch)*0.07;
  camera.position.copy(CAM_BASE);
  _camDir.copy(CAM_LOOK).sub(CAM_BASE).applyAxisAngle(_Y, camYaw);
  _camDir.y += camPitch * 1.1;
  _camTgt.copy(CAM_BASE).add(_camDir);
  camera.lookAt(_camTgt);
}
function render(){
  renderer.render(scene, camera);
  // project bubbles + plates
  for(const i of [0,1,2,3]){
    const b=bubbleEls[i];
    if(b){
      if(+b.dataset.hideAt < clock.t) b.classList.remove("show");
      let p = i===0 ? {x:innerWidth/2, y:innerHeight*0.72} : headScreenPos(i,2.05);
      if(p && !p.behind){ if(i>0) p = clampBubblePos(p); b.style.left=p.x+"px"; b.style.top=p.y+"px"; }
    }
    if(i>0 && actors[i] && actors[i].group){
      const pl = plateEls[i] || mkPlate(i, actors[i].npc.name);
      const p = headScreenPos(i, 2.2);
      if(p){ pl.style.left=p.x+"px"; pl.style.top=p.y+"px"; }
    }
  }
  const bn=$("banner"); if(bn.dataset.hideAt && +bn.dataset.hideAt<clock.t) bn.classList.remove("show");
}
function frame(now){
  requestAnimationFrame(frame);
  if(paused){ last=now; return; }
  acc += now-last; last=now;
  acc = Math.min(acc, 250);
  while(acc>=STEP){ update(STEP); acc-=STEP; }
  render();
  if(dev){ frames++; if(now-fpsAt>=500){ $("dev").textContent = Math.round(frames*1000/(now-fpsAt))+" fps · seed "+SEED; frames=0; fpsAt=now; } }
}

/* ---------------- boot ---------------- */
$("titleBlurb").textContent = STR.title_blurb;
$("startBtn").textContent = STR.start;
$("loadNote").textContent = STR.loading;
$("myCard").style.display="none";
$("roundTag").textContent="";
loadWorld().then(()=>{ $("loadNote").textContent=""; });
$("startBtn").onclick = ()=>{
  unlockAudio();
  $("title").classList.add("hidden");
  runMatch();
};
requestAnimationFrame(frame);
