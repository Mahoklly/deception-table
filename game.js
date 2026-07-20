// The Deception Table — solo social deduction at a tavern table.
// three.js scene + HTML overlay UI. Fixed-timestep sim, seeded RNG, command-object input.
import * as THREE from "three";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/addons/libs/meshopt_decoder.module.js";
import { STR, fmt, getLang, setLang, LANG_LABELS } from "./strings.js?v=20260720a";
import { DECK, NPCS, RULES } from "./data.js?v=20260720a";
import { ASSET_URLS } from "./assets_urls.js?v=20260720a";
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
function loadAudio(id, file, {loop=false, vol=1, key}={}){
  const assetKey = key || (id==="music"?"music_tavern":id==="shot"?"sfx_gunshot":id==="click"?"sfx_click":id==="card"?"sfx_card":"sfx_drum");
  const a = new Audio(assetSrc(assetKey, file));
  a.crossOrigin="anonymous";
  a.preload="auto";
  a.loop=loop;
  a.volume = vol;
  a.addEventListener("error", ()=>{ SND[id]=null; });
  SND[id]=a;
}
/* ---------------- radio: swappable background music stations ----
   "The Usual" is the original track; the other three are empty slots
   (falls back silently until real mp3 URLs are hooked up in
   assets_urls.js) reserved for chill roadhouse-bar station music. */
const RADIO_STATIONS = [
  { id:"usual",  key:"music_tavern",       file:"music_tavern.mp3" },
  { id:"dust",   key:"music_radio_dust",   file:"music_radio_dust.mp3" },
  { id:"porch",  key:"music_radio_porch",  file:"music_radio_porch.mp3" },
  { id:"static", key:"music_radio_static", file:"music_radio_static.mp3" },
];
function currentRadioId(){
  try{ const s = localStorage.getItem("radio_station"); return RADIO_STATIONS.some(r=>r.id===s) ? s : "usual"; }catch(e){ return "usual"; }
}
function radioStation(id){ return RADIO_STATIONS.find(r=>r.id===id) || RADIO_STATIONS[0]; }
{
  const st = radioStation(currentRadioId());
  loadAudio("music", st.file, {loop:true, vol:0.28, key:st.key});
}
loadAudio("shot","sfx_gunshot.mp3",{vol:0.9});
loadAudio("click","sfx_click.mp3",{vol:0.8});
loadAudio("card","sfx_card.mp3",{vol:0.6});
loadAudio("drum","sfx_drum.mp3",{vol:0.65});
function play(id){ const a=SND[id]; if(!a) return; try{ if(!a.loop){a.currentTime=0;} a.play().catch(()=>{});}catch(e){} }
function unlockAudio(){ if(audioUnlocked.v) return; audioUnlocked.v=true; play("music"); }
function setRadioStation(id){
  const st = radioStation(id);
  try{ localStorage.setItem("radio_station", id); }catch(e){}
  const wasPlaying = !!(SND.music && !SND.music.paused);
  const vol = SND.music ? SND.music.volume : 0.28;
  if(SND.music) SND.music.pause();
  loadAudio("music", st.file, {loop:true, vol, key:st.key});
  if(wasPlaying || audioUnlocked.v) play("music");
  updateRadioButtons();
}

/* ---------------- input: everything becomes a command object ---------------- */
const BIND = { Digit1:"w1", Digit2:"w2", Digit3:"w3", Digit4:"w4", KeyV:"vote", Space:"confirm", Enter:"confirm" };
const commandQueue = [];
addEventListener("keydown", e=>{
  const c=BIND[e.code];
  if(c){ commandQueue.push(c); e.preventDefault(); unlockAudio(); }
  // --- NEW: ESC to open/close settings ---
  if(e.code === "Escape"){
    toggleSettings();
    e.preventDefault();
  }
});

/* ---------------- Settings Menu ---------------- */
let settingsOpen = false;
const settingsEl = document.getElementById("settingsMenu");
const volumeSlider = document.getElementById("volumeSlider");
const volumeLabel = document.getElementById("volumeLabel");

function toggleSettings(){
  settingsOpen = !settingsOpen;
  if(settingsOpen){
    settingsEl.style.display = "flex";
    // Sync slider with current volume
    const currentVol = SND.music ? Math.round(SND.music.volume * 100) : 28;
    volumeSlider.value = currentVol;
    volumeLabel.textContent = currentVol + "%";
  } else {
    settingsEl.style.display = "none";
  }
}

// Volume slider event
volumeSlider.addEventListener("input", function(){
  const val = parseInt(this.value);
  volumeLabel.textContent = val + "%";
  if(SND.music){
    SND.music.volume = val / 100;
    // If music isn't playing, start it
    if(!SND.music.paused === false){
      SND.music.play().catch(()=>{});
    }
  }
});

document.getElementById("settingsBtn").addEventListener("click", toggleSettings);

// Close button
document.getElementById("closeSettingsBtn").addEventListener("click", toggleSettings);

/* ---------------- Radio station buttons ---------------- */
const radioBtns = RADIO_STATIONS.map((st,i)=>document.getElementById("radioBtn"+i));
function updateRadioButtons(){
  const cur = currentRadioId();
  RADIO_STATIONS.forEach((st,i)=>{
    const b = radioBtns[i];
    const active = st.id===cur;
    b.style.background = active ? "#7a2e22" : "#2a1d10";
    b.style.color      = active ? "#efe3c0" : "#c6b184";
  });
}
radioBtns.forEach((b,i)=> b.addEventListener("click", ()=>setRadioStation(RADIO_STATIONS[i].id)));
updateRadioButtons();

/* ---------------- Shop Menu ---------------- */
let shopOpen = false;
const shopEl = document.getElementById("shopMenu");
function toggleShop(){
  shopOpen = !shopOpen;
  shopEl.style.display = shopOpen ? "flex" : "none";
  if(shopOpen) renderShop();
}
document.getElementById("shopBtn").addEventListener("click", toggleShop);
document.getElementById("closeShopBtn").addEventListener("click", toggleShop);
function renderShop(){
  document.getElementById("shopTitle").textContent = STR.shop_title;
  document.getElementById("shopBalance").textContent = fmt(STR.shop_balance,{n:coins});
  document.getElementById("closeShopBtn").textContent = STR.shop_close;
  const body = document.getElementById("shopBody");
  body.innerHTML = "";
  const cats = [["felt",STR.shop_cat_felt],["chips",STR.shop_cat_chips],["trim",STR.shop_cat_trim]];
  for(const [cat,label] of cats){
    const wrap = document.createElement("div"); wrap.className="shopCat";
    const h = document.createElement("h3"); h.textContent = label; wrap.appendChild(h);
    const row = document.createElement("div"); row.className="shopRow";
    for(const item of SHOP_CATALOG[cat]){
      const owned = shopOwned[cat].includes(item.id);
      const equipped = shopEquipped[cat]===item.id;
      const affordable = owned || coins>=item.price;
      const b = document.createElement("button");
      b.className = "shopItem" + (equipped?" equipped":"") + (affordable?"":" locked");
      const swatch = document.createElement("div"); swatch.className="shopSwatch";
      if(cat==="chips"){
        const cs = item.colors.map(c=>"#"+c.toString(16).padStart(6,"0"));
        const n = cs.length;
        swatch.style.background = `conic-gradient(${cs.map((c,i)=>c+" "+Math.round(i*100/n)+"% "+Math.round((i+1)*100/n)+"%").join(",")})`;
      } else if(cat==="trim"){
        swatch.style.background = "#"+item.color.toString(16).padStart(6,"0");
      } else {
        swatch.style.background = item.a;
      }
      const nm = document.createElement("div"); nm.className="shopName"; nm.textContent = item.name;
      const price = document.createElement("div"); price.className="shopPrice"+(owned?" owned":"");
      price.textContent = equipped ? STR.shop_equipped : owned ? STR.shop_owned : (item.price+" 🪙");
      b.appendChild(swatch); b.appendChild(nm); b.appendChild(price);
      b.onclick = ()=> buyOrEquip(cat, item.id);
      row.appendChild(b);
    }
    wrap.appendChild(row);
    body.appendChild(wrap);
  }
}

/* ---------------- language switch (English default, Kurdish Sorani secondary) ---------------- */
// Re-applies every *static* piece of chrome text that was set once at boot
// (title screen, settings labels) — dynamic prompts/banners read STR live
// at call time already, so they don't need a refresh here.
function applyStaticStrings(){
  document.getElementById("titleBlurb").textContent = STR.title_blurb;
  document.getElementById("startBtn").textContent = G.over ? STR.play_again : STR.start;
  document.getElementById("title").querySelector("h1").innerHTML = STR.game_title_html;
  document.getElementById("settingsTitle").textContent = STR.settings_title;
  document.getElementById("settingsVolumeLabel").textContent = STR.settings_volume_label;
  document.getElementById("settingsRadioLabel").textContent = STR.settings_radio_label;
  RADIO_STATIONS.forEach((st,i)=>{ radioBtns[i].textContent = STR["radio_station_"+st.id]; });
  document.getElementById("settingsLanguageLabel").textContent = STR.settings_language_label;
  document.getElementById("closeSettingsBtn").textContent = STR.settings_close;
  document.getElementById("settingsModeLabel").textContent = STR.settings_mode_label;
  document.getElementById("modeClassicBtn").textContent = STR.mode_classic;
  document.getElementById("modeFullBtn").textContent = STR.mode_fullhouse;
  document.getElementById("newGameBtn").textContent = STR.settings_newgame;
  document.getElementById("quitGameBtn").textContent = STR.settings_quit;
  document.getElementById("quitTitle").textContent = STR.quit_title;
  document.getElementById("quitBody").textContent = STR.quit_body;
  if(!worldReady) document.getElementById("loadNote").textContent = STR.loading;
  updateCoinTag();
  if(shopOpen) renderShop();
}
const langEnBtn = document.getElementById("langEnBtn");
const langKuBtn = document.getElementById("langKuBtn");
function updateLangButtons(){
  const l = getLang();
  langEnBtn.style.background = l==="en" ? "#7a2e22" : "#2a1d10";
  langEnBtn.style.color      = l==="en" ? "#efe3c0" : "#c6b184";
  langKuBtn.style.background = l==="ku" ? "#7a2e22" : "#2a1d10";
  langKuBtn.style.color      = l==="ku" ? "#efe3c0" : "#c6b184";
}
function changeLang(l){
  if(l===getLang()) return;
  setLang(l);
  updateLangButtons();
  applyStaticStrings();
  // nameplates are cached DOM elements — retext them in place, they won't
  // otherwise pick up the swap until they're first created
  for(let i=1;i<SEAT_COUNT;i++){
    const p = plateEls[i];
    if(p && actors[i] && actors[i].npc) p.querySelector(".nm").textContent = npcName(actors[i].npc);
  }
}
langEnBtn.addEventListener("click", ()=>changeLang("en"));
langKuBtn.addEventListener("click", ()=>changeLang("ku"));
updateLangButtons();

/* ---------------- game mode (Classic 4-seat vs Full House 6-seat) ----------
   Reshapes the whole scene (seat layout, table scale, NPC roster), so unlike
   language this isn't a live swap — picking a different mode reloads. */
const modeClassicBtn = document.getElementById("modeClassicBtn");
const modeFullBtn = document.getElementById("modeFullBtn");
function currentMode(){ try{ return localStorage.getItem("game_mode")==="fullhouse" ? "fullhouse" : "classic"; }catch(e){ return "classic"; } }
function updateModeButtons(){
  const m = currentMode();
  modeClassicBtn.style.background = m==="classic" ? "#7a2e22" : "#2a1d10";
  modeClassicBtn.style.color      = m==="classic" ? "#efe3c0" : "#c6b184";
  modeFullBtn.style.background    = m==="fullhouse" ? "#7a2e22" : "#2a1d10";
  modeFullBtn.style.color         = m==="fullhouse" ? "#efe3c0" : "#c6b184";
}
function changeMode(m){
  if(m===currentMode()) return;
  if(!confirm(STR.mode_change_note)) return;
  try{ localStorage.setItem("game_mode", m); }catch(e){}
  location.reload();
}
modeClassicBtn.addEventListener("click", ()=>changeMode("classic"));
modeFullBtn.addEventListener("click", ()=>changeMode("fullhouse"));
updateModeButtons();

/* ---------------- New Game / Quit (Settings) ---------------- */
document.getElementById("newGameBtn").addEventListener("click", ()=>{
  // no confirm() here on purpose — a blocking native dialog for every
  // restart was worse than the risk it guarded against (nothing valuable
  // is lost; coins/shop/mode all persist through the reload regardless)
  location.reload();
});
document.getElementById("quitGameBtn").addEventListener("click", ()=>{
  if(!confirm(STR.quit_confirm)) return;
  paused = true;
  try{ for(const k in SND){ if(SND[k]) SND[k].pause(); } }catch(e){}
  window.close();
  // most browsers refuse to let a script close a tab it didn't open itself —
  // if we're still here a moment later, show a clean goodbye screen instead
  setTimeout(()=>{
    document.getElementById("settingsMenu").style.display = "none";
    document.getElementById("quitScreen").style.display = "flex";
  }, 150);
});

addEventListener("pointerdown", unlockAudio, {once:false});

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const DPR_CAP = 1.5;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0e0803, 0.062);   // warm, gritty roadhouse haze
const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
const CAM_BASE = new THREE.Vector3(0, 1.5, 1.3);
const CAM_LOOK = new THREE.Vector3(0, 1.0, -0.55);
let camYaw=0, camPitch=0, camYawT=0, camPitchT=0;
addEventListener("pointermove", e=>{
  if(e.pointerType && e.pointerType!=="mouse") return;
  // only steer the camera while the cursor is over the bare 3D viewport —
  // otherwise moving toward a button (settings, shop, hand/vote/bet) drags
  // the whole view around right as you're trying to click it
  if(e.target !== canvas) return;
  camYawT   = -((e.clientX/innerWidth)-0.5)*2*0.85;   // wider — the room is populated now, worth looking around
  camPitchT = -((e.clientY/innerHeight)-0.5)*2*0.32;
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

/* lights: warm candle at the table, the whole room bathed in amber/orange —
   gritty roadhouse grade: dense strings of warm bulbs do most of the work,
   one small red neon accent and one blue-violet glow (the tank) break it up.
   Brighter/more visible overall than earlier passes — this is meant to be
   readable, not a screen you have to squint at. */
scene.add(new THREE.AmbientLight(0x3a2c1c, 1.1));
// distance-independent sky/ground wash so the walls read as lit even where
// the point lights fall off — without this, MeshStandardMaterial walls at
// the room's edge render as flat black regardless of geometry.
scene.add(new THREE.HemisphereLight(0x9a7c52, 0x1c130c, 2.7));
const fill = new THREE.PointLight(0xffab6a, 0.85, 12, 1.3); fill.position.set(0,1.7,2.3); scene.add(fill);
const candle = new THREE.PointLight(0xffb457, 3.8, 14, 1.3); candle.position.set(0,1.15,0); scene.add(candle);
candle.castShadow = true;
candle.shadow.mapSize.set(1024,1024);
candle.shadow.camera.near = 0.05; candle.shadow.camera.far = 12; candle.shadow.bias = -0.003;
const lantern = new THREE.SpotLight(0xe08a2e, 65, 15, 0.7, 0.55, 1.7);
lantern.position.set(0,3.4,0.4); lantern.target.position.set(0,0.9,-0.4); scene.add(lantern, lantern.target);
// no castShadow here on purpose: this light rakes across the table at a low
// angle, so small props (the revolver) threw a second, badly-stretched
// "rifle-like" shadow alongside the candle's — the candle alone (near-
// overhead, close to the table) already casts the correct compact one.
const rim = new THREE.DirectionalLight(0x5a3c22, 0.9); rim.position.set(-3,2.5,-4); scene.add(rim);
/* ambient life without patrons: a slowly turning ceiling fan and a
   realistically flickering neon sign — both set inside buildRoom() below */
let ceilingFan = null, neonSignMat = null;
/* generic helper: flag every mesh in a subtree to cast/receive real-time shadows */
function enableShadow(obj, cast=true, recv=true){
  obj.traverse(m=>{ if(m.isMesh){ m.castShadow = cast; m.receiveShadow = recv; } });
  return obj;
}

/* floor: real ground-plane geometry, physically lit and shadow-receiving */
const WALL_H = 4.3;
const texLoader = new THREE.TextureLoader();
/* Higgsfield-generated seamless material photos, tiled with real UV repeat
   onto real geometry — not baked into a flat backdrop image. `material`
   keeps its flat fallback color (and no map) until the photo actually
   loads, so a slow/broken fetch never leaves the surface unlit black. */
function applyRepeatTex(material, key, file, rx, ry, tint=0xffffff, rot=0){
  texLoader.load(assetSrc(key, file), tex=>{
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    if(rot){ tex.center.set(0.5,0.5); tex.rotation = rot; }  // e.g. turn horizontal planks vertical
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.color.setHex(tint);   // tint multiplies the map — red-shifts the same texture for free
    material.needsUpdate = true;
  }, undefined, ()=>{ /* keep the flat fallback color already on the material */ });
}
/* one-shot (non-tiling) version for a single mounted photo — a neon sign,
   a mural, a poster wall — that also self-illuminates via emissiveMap.
   `glow` scales the self-illumination: ~1 for real neon, ~0.3 for artwork
   that should merely stay readable in the dim room. The emissive color
   must be set to white here — a black emissive (the default) multiplies
   the emissiveMap to zero and the texture never glows at all. */
function applyOnceTex(material, key, file, glow=1){
  texLoader.load(assetSrc(key, file), tex=>{
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.emissiveMap = tex;
    material.emissive.setHex(0xffffff);
    material.emissiveIntensity = glow;
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
  }, undefined, ()=>{ /* keep the flat dark fallback plaque */ });
}
/* like applyOnceTex, but for photos with a dark background around the
   glowing subject (a neon sign shot at night) that would otherwise show
   up as a flat dark rectangle stuck in front of the wall behind it. Runs
   the image through a canvas and makes near-black pixels transparent, so
   only the lit sign itself is visible and the real wall shows through
   around it. Needs the CDN to allow cross-origin pixel reads — if it
   doesn't, this quietly falls back to the plain opaque version instead
   of breaking. */
function applyOnceTexKeyed(material, key, file, glow=1, threshold=42){
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = ()=>{
    try{
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const cx = cv.getContext("2d");
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, cv.width, cv.height);
      const px = data.data;
      for(let i=0;i<px.length;i+=4){
        const lum = 0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2];
        if(lum < threshold) px[i+3] = 0;
      }
      cx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex;
      material.emissiveMap = tex;
      material.emissive.setHex(0xffffff);
      material.emissiveIntensity = glow;
      material.color.setHex(0xffffff);
      material.transparent = true;
      material.needsUpdate = true;
    }catch(e){ applyOnceTex(material, key, file, glow); } // tainted canvas (CORS) — fall back to opaque
  };
  img.onerror = ()=>{ /* keep the flat dark fallback plaque */ };
  img.src = assetSrc(key, file);
}
// where the bar station goes on the back wall (also anchors the board + shelf)
const BAR_ANGLE = Math.PI;   // dead-center on the back wall, facing the player across the table
/* ---- room footprint: a hard-cornered rectangular den, not a cylinder ----
   The old wrap-around polygon read as an artificial circular arena no
   matter how it was dressed. Real rooms have corners: one straight back
   wall behind the bar, side walls meeting it at true 90° corners, and a
   wall behind the player closing the box. wallHit() raycasts from the
   room center so anything still placed "by angle" lands on the correct
   flat wall with the correct facing. */
const ROOM_XH = 6.8;    // half-width — left/right walls at x = ±ROOM_XH
const ROOM_ZB = -7.6;   // back wall (behind the bar)
const ROOM_ZF = 5.4;    // wall behind the player
function wallHit(ang){
  const dx = Math.sin(ang), dz = Math.cos(ang);
  const cand = [];
  if(dz < 0) cand.push({t: ROOM_ZB/dz, rotY: 0});             // back wall — faces +z
  if(dz > 0) cand.push({t: ROOM_ZF/dz, rotY: Math.PI});       // front wall — faces -z
  if(dx > 0) cand.push({t: ROOM_XH/dx, rotY: -Math.PI/2});    // right wall — faces -x
  if(dx < 0) cand.push({t: -ROOM_XH/dx, rotY: Math.PI/2});    // left wall — faces +x
  let best = cand[0];
  for(const c of cand) if(c.t > 0 && (best.t <= 0 || c.t < best.t)) best = c;
  return {x: dx*best.t, z: dz*best.t, rotY: best.rotY};
}
function wallPoint(ang, inset=0){
  const h = wallHit(ang);
  return new THREE.Vector3(h.x + Math.sin(h.rotY)*inset, 0, h.z + Math.cos(h.rotY)*inset);
}
function wallRot(ang){ return wallHit(ang).rotY; }
const floorMat = new THREE.MeshStandardMaterial({color:0x2a1a10, roughness:0.9});
applyRepeatTex(floorMat, "tex_wood_floor","tex_wood_floor.jpg", 6, 6);   // no tint — let the real photo read as-is
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_XH*2, ROOM_ZF-ROOM_ZB), floorMat);
floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, (ROOM_ZB+ROOM_ZF)/2);
floor.receiveShadow = true; scene.add(floor);
let roomGroup = null;

/* ---- true 3D bar room: four flat walls with real 90° corners, beamed
   ceiling, timber pillars — real box geometry with physical X/Y/Z
   coordinates, no flat backdrop image or skybox trick. */
/* grimy, mottled peeling-wallpaper texture — canvas-generated, no asset
   needed. Alternated with the real wood-wall photo across segments so the
   room isn't one clean, uniform material all the way around. */
function makeGrimeTex(){
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 256;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#3a2c1e"; cx.fillRect(0,0,256,256);
  for(let i=0;i<420;i++){
    const x=Math.random()*256, y=Math.random()*256, r=6+Math.random()*22;
    const shade = 20+Math.random()*40;
    cx.fillStyle = `rgba(${shade+10},${shade},${shade-6},${0.12+Math.random()*0.2})`;
    cx.beginPath(); cx.ellipse(x,y,r,r*(0.5+Math.random()*0.7),Math.random()*Math.PI,0,Math.PI*2); cx.fill();
  }
  // a few peeling-paper streaks
  for(let i=0;i<10;i++){
    const x=Math.random()*256, y=Math.random()*256;
    cx.fillStyle = "rgba(70,55,40,0.35)";
    cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x+18+Math.random()*30, y+6); cx.lineTo(x+10, y+40+Math.random()*30); cx.closePath(); cx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildRoom(){
  const g = new THREE.Group();

  // a faint baseline emissive keeps the walls from ever reading as pure black
  // when they're far from every point light, without faking flat unlit color
  const plaster = new THREE.MeshStandardMaterial({color:0x362a1c, roughness:0.95, emissive:0x0f0a05, emissiveIntensity:0.6});
  const trim    = new THREE.MeshStandardMaterial({color:0x2a1d10, roughness:0.9, emissive:0x0c0704, emissiveIntensity:0.6});
  const beamMat = new THREE.MeshStandardMaterial({color:0x241708, roughness:0.85, emissive:0x0a0603, emissiveIntensity:0.6});
  // weathered wood photo, rotated 90° so the planks read as dark vertical paneling
  applyRepeatTex(plaster, "tex_wood_wall","tex_wood_wall.jpg", 5, 2, 0xb09a80, Math.PI/2);
  const grimeMat = new THREE.MeshStandardMaterial({color:0x453626, roughness:1, emissive:0x0c0805, emissiveIntensity:0.5});
  grimeMat.map = makeGrimeTex(); grimeMat.map.repeat.set(4, 1.6); grimeMat.needsUpdate = true;

  // four flat walls meeting at true 90° corners: dark vertical wood on the
  // back and right walls, peeling grimy wallpaper on the left and behind
  // the player — a mix, not one uniform clean material wrapped around
  const W = ROOM_XH*2, D = ROOM_ZF-ROOM_ZB, zMid = (ROOM_ZB+ROOM_ZF)/2;
  const mkWall = (mat, w, cx, cz, rotY)=>{
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, 0.28), mat);
    wall.position.set(cx, WALL_H/2, cz); wall.rotation.y = rotY; g.add(wall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, 0.34), trim);
    base.position.set(cx, 0.12, cz); base.rotation.y = rotY; g.add(base);
  };
  mkWall(plaster,  W+0.56, 0, ROOM_ZB-0.14, 0);               // straight back wall, behind the bar
  mkWall(grimeMat, W+0.56, 0, ROOM_ZF+0.14, 0);               // wall behind the player
  mkWall(grimeMat, D+0.56, -ROOM_XH-0.14, zMid, Math.PI/2);   // left wall
  mkWall(plaster,  D+0.56,  ROOM_XH+0.14, zMid, Math.PI/2);   // right wall — meets the back at 90°
  // flat plank ceiling with parallel joists spanning the room's width
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W+0.6, 0.22, D+0.6),
    new THREE.MeshStandardMaterial({color:0x120b06, roughness:0.95}));
  ceiling.position.set(0, WALL_H+0.11, zMid);
  g.add(ceiling);
  for(let z=ROOM_ZB+1.2; z<ROOM_ZF; z+=2.0){
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, 0.18), beamMat);
    beam.position.set(0, WALL_H-0.16, z);
    g.add(beam);
  }
  // structural timber pillars along the walls — the back corners, a pair
  // flanking the liquor shelf, and one on each side wall
  {
    const postMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.9});
    const capMat = new THREE.MeshStandardMaterial({color:0x1c130a, roughness:0.8});
    const spots = [
      {x:-ROOM_XH+0.24, z:ROOM_ZB+0.24}, {x:ROOM_XH-0.24, z:ROOM_ZB+0.24},  // back corners
      {x:-3.7, z:ROOM_ZB+0.2}, {x:3.7, z:ROOM_ZB+0.2},                       // flanking the shelf
      {x:-ROOM_XH+0.2, z:0.2}, {x:ROOM_XH-0.2, z:0.2},                       // side walls
    ];
    for(const s of spots){
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34,WALL_H,0.34), postMat);
      post.position.set(s.x, WALL_H/2, s.z);
      g.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.14,0.5), capMat);
      cap.position.set(s.x, WALL_H-0.07, s.z);
      g.add(cap);
    }
  }
  // old ceiling fan, slowly turning — cheap ambient motion overhead so the
  // room doesn't feel frozen, without putting any more people in it
  {
    const fan = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({color:0x1c1c1e, roughness:0.4, metalness:0.7});
    const bladeMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.7});
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.4,8), ironMat);
    rod.position.y = 0.2; fan.add(rod);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.1,12), ironMat);
    fan.add(hub);
    for(let i=0;i<4;i++){
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.02,0.16), bladeMat);
      blade.position.x = 0.5;
      const holder = new THREE.Group(); holder.add(blade); holder.rotation.y = (Math.PI/2)*i;
      fan.add(holder);
    }
    fan.position.set(0, WALL_H-0.24, 0);
    g.add(fan);
    ceilingFan = fan;
  }
  // small brass wall lamps — dome shade + warm bulb, reclaimed-industrial
  // touch; each throws its own soft amber pool on the wood. Two per side
  // wall plus one either side of the bar shelf on the back wall, so the
  // side stretches never fall into a dead black void.
  const lampSpots = [
    {x:-ROOM_XH+0.18, z:-4.8, rotY: Math.PI/2},
    {x:-ROOM_XH+0.18, z:-0.4, rotY: Math.PI/2},
    {x: ROOM_XH-0.18, z:-4.8, rotY:-Math.PI/2},
    {x: ROOM_XH-0.18, z:-0.4, rotY:-Math.PI/2},
    {x:-5.1, z:ROOM_ZB+0.18, rotY:0},
    {x: 5.1, z:ROOM_ZB+0.18, rotY:0},
  ];
  for(const s of lampSpots){
    const wx = s.x, wz = s.z;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,0.1), trim);
    bracket.position.set(wx, 2.1, wz); bracket.rotation.y = s.rotY; g.add(bracket);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 12, 1, true),
      new THREE.MeshStandardMaterial({color:0x6a4a20, roughness:0.4, metalness:0.6, side:THREE.DoubleSide}));
    shade.position.set(wx, 2.32, wz); shade.rotation.x = Math.PI; shade.rotation.y = s.rotY;
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05,10,8),
      new THREE.MeshStandardMaterial({color:0xffcf8a, emissive:0xffa030, emissiveIntensity:2.4}));
    bulb.position.set(wx, 2.24, wz); g.add(bulb);
    const wash = new THREE.PointLight(0xffa855, 1.3, 6, 1.8);
    wash.position.set(wx, 2.2, wz); g.add(wash);
  }
  // hand-chalked menu board — a dirty, hung wooden-framed chalkboard over
  // the bar instead of a clean printed neon sign; canvas-drawn, no asset
  // dependency, and it reads as "someone actually runs this place" rather
  // than a polished storefront logo
  {
    const cv = document.createElement("canvas"); cv.width = 384; cv.height = 384;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#1a2420"; cx.fillRect(0,0,384,384);
    // chalky mottling so the board doesn't read as a flat green rectangle
    for(let i=0;i<160;i++){
      cx.fillStyle = `rgba(200,205,190,${0.02+Math.random()*0.05})`;
      cx.beginPath(); cx.arc(Math.random()*384, Math.random()*384, 4+Math.random()*14, 0, Math.PI*2); cx.fill();
    }
    cx.strokeStyle = "#dcd8c8"; cx.textAlign = "center";
    cx.font = "italic 52px Georgia"; cx.fillStyle = "#e8e4d0";
    cx.save(); cx.translate(192,90); cx.rotate(-0.02); cx.fillText("The Bar", 0, 0); cx.restore();
    cx.strokeStyle = "rgba(220,216,200,.6)"; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(60,120); cx.lineTo(324,120); cx.stroke();
    cx.font = "28px Georgia"; cx.fillStyle = "#d8d4c0";
    const items = ["Whiskey — neat", "House Red", "Something Stronger", "Ask No Questions"];
    items.forEach((t,i)=> cx.fillText(t, 192, 175 + i*48));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.15),
      new THREE.MeshStandardMaterial({map:tex, roughness:0.85, emissive:0x1a2420, emissiveIntensity:0.15}));
    const sp = wallPoint(BAR_ANGLE, 0.22);
    board.position.set(sp.x, 3.62, sp.z);   // sits above the liquor shelf's cornice (~3.05)
    board.rotation.y = wallRot(BAR_ANGLE);
    g.add(board);
    // a rough wood frame, slightly askew — nothing here is perfectly square
    const frameMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.9});
    for(const [fw,fh,fx,fy,rz] of [[1.28,0.08,0,0.6,0.01],[1.28,0.08,0,-0.6,-0.008],[0.08,1.28,-0.6,0,0.006],[0.08,1.28,0.6,0,0]]){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,0.05), frameMat);
      bar.position.set(fx,fy,0.02); bar.rotation.z = rz;
      board.add(bar);
    }
    const boardLight = new THREE.SpotLight(0xffcf9a, 1.8, 3, 0.6, 0.5);
    boardLight.position.set(sp.x, 3.9, sp.z*0.7);
    boardLight.target = board;
    g.add(boardLight); g.add(boardLight.target);
  }
  scene.add(g);
  enableShadow(g);
  return g;
}
roomGroup = buildRoom();

/* ---- 3D midground props: real geometry between the table and the walls ---- */
{
  const wood = new THREE.MeshStandardMaterial({color:0x4a2f18, roughness:0.85});
  const dark = new THREE.MeshStandardMaterial({color:0x2e1c0d, roughness:0.9});
  const iron = new THREE.MeshStandardMaterial({color:0x3a3a3e, roughness:0.6, metalness:0.5});
  const barrel = (x,z,s=1)=>{
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32*s,0.28*s,0.78*s,14), wood);
    b.position.y = 0.39*s; g.add(b);
    for(const hy of [0.18,0.6]){
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.315*s,0.02,6,18), iron);
      r.rotation.x = Math.PI/2; r.position.y = hy*s; g.add(r);
    }
    g.position.set(x,0,z); g.rotation.y = Math.random()*6.28; enableShadow(g); scene.add(g);
  };
  const crate = (x,z,s=1)=>{
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.62*s,0.62*s,0.62*s), dark);
    c.position.set(x,0.31*s,z); c.rotation.y = Math.random()*1.2; c.castShadow=true; c.receiveShadow=true; scene.add(c);
  };
  // clusters behind/beside the NPCs, between table (r≈1) and the walls (r=6.6)
  barrel(-3.4,-2.6,1.15); barrel(-2.8,-3.2); barrel(-3.7,-1.9,0.8);
  crate(-4.3, 0.5, 1.0);  crate(-3.9,-0.3, 0.85);
  barrel( 3.2,-3.0,0.95); crate( 3.4,-2.2, 1.1); crate( 3.9,-1.3, 0.9);
  barrel( 4.3, 0.4);
}

/* ---- gritty roadhouse dive-bar dressing: warm amber, wood, and clutter ----
   Everything here is procedural geometry (zero generation cost); the two
   Higgsfield wall artworks (graffiti mural + poster collage) and the bar
   shelf/sign assets are reused, just repositioned: a warm wooden bar with
   a backlit shelf dead ahead of the player, a wagon-wheel light fixture
   overhead, string lights strung everywhere, a dartboard, crossed wood
   beams, bunting, and a glowing tank on the counter for a cool accent. */
function buildRoadhouseBar(){
  const g = new THREE.Group();
  const steel   = new THREE.MeshStandardMaterial({color:0x201a16, roughness:0.5, metalness:0.55});
  const leather = new THREE.MeshStandardMaterial({color:0x3a2418, roughness:0.6});
  const wood    = new THREE.MeshStandardMaterial({color:0x3a2412, roughness:0.85});
  const darkTop = new THREE.MeshStandardMaterial({color:0x1c140c, roughness:0.6});
  const brass   = new THREE.MeshStandardMaterial({color:0x8a6a30, roughness:0.35, metalness:0.75});

  // mounts a flat artwork plane flush on a wall, with a black steel frame —
  // placement is now explicit (x, z, facing) since the walls are flat planes
  const wallArt = (x, z, rotY, w, h, y, key, file, glow)=>{
    const mat = new THREE.MeshStandardMaterial({color:0x2e2a24, roughness:0.9});
    applyOnceTex(mat, key, file, glow);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat);
    art.position.set(x, y, z); art.rotation.y = rotY;
    g.add(art);
    for(const [fw,fh,fx,fy] of [[w+0.08,0.05,0,h/2+0.02],[w+0.08,0.05,0,-h/2-0.02],[0.05,h+0.08,-w/2-0.02,0],[0.05,h+0.08,w/2+0.02,0]]){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,0.04), steel);
      bar.position.set(fx,fy,0.01);
      art.add(bar);
    }
  };
  // street-art mural on the left wall, poster collage on the right — the
  // room's "environmental storytelling", one big piece per side wall
  wallArt(-ROOM_XH+0.16, -3.2, Math.PI/2, 2.0, 2.0, 1.95, "tex_graffiti_mural","tex_graffiti_mural.jpg", 0.3);
  wallArt(ROOM_XH-0.16, -2.9, -Math.PI/2, 1.3, 1.3, 1.85, "tex_posters","tex_posters.jpg", 0.28);

  // one small red neon accent — a simple diamond outline, the single
  // cool-colored sign against an otherwise all-warm room; left wall
  {
    const m = new THREE.MeshStandardMaterial({color:0xff2020, emissive:0xff2020, emissiveIntensity:2.2, roughness:0.4});
    const grp = new THREE.Group();
    grp.position.set(-ROOM_XH+0.15, 2.1, -0.9); grp.rotation.y = Math.PI/2;
    for(const rot of [0.78, -0.78]){
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.55, 0.035), m);
      b.rotation.z = rot; b.position.x = rot>0 ? -0.19 : 0.19;
      grp.add(b);
    }
    g.add(grp);
    const wash = new THREE.PointLight(0xff2020, 0.8, 3.5, 2);
    wash.position.copy(grp.position); g.add(wash);
  }

  // procedural glass bottle — body + shoulder + neck + cap, quick to vary
  // by color/height so a shelf full of them doesn't read as one mesh copy-
  // pasted a dozen times. A soft per-color emissive makes each one glow
  // faintly against the backlit shelf.
  const makeBottle = (hex, h=1)=>{
    const glassMat = new THREE.MeshPhysicalMaterial({color:hex, roughness:0.15, metalness:0, transmission:0.55, transparent:true, opacity:0.92,
      emissive:hex, emissiveIntensity:0.35});
    const bg = new THREE.Group();
    bg.name = "bottle";
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.22*h,10), glassMat);
    body.position.y = 0.11*h; bg.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.032,0.14*h,8), glassMat);
    neck.position.y = 0.22*h+0.07*h; bg.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.017,0.03,8),
      new THREE.MeshStandardMaterial({color:0x1a1a1a, roughness:0.4, metalness:0.5}));
    cap.position.y = 0.22*h+0.14*h+0.015; bg.add(cap);
    return bg;
  };
  const bottleColors = [0x8a3a1e, 0x2a5a2a, 0x6a1a1a, 0xc99a3a, 0x1a3a5a, 0x3a2a1a, 0x8a8a3a];

  // ---- the bar station, dead-center on the straight back wall, directly
  // behind Madame Vey's seat: a long continuous wooden counter, and behind
  // it a massive floor-standing liquor display unit — three full shelf rows
  // packed with glowing bottles. Built in wall-local coordinates (x along
  // the wall, +z into the room). ----
  {
    const bar = new THREE.Group();
    bar.name = "barStation";
    bar.position.copy(wallPoint(BAR_ANGLE, 0));
    bar.rotation.y = wallRot(BAR_ANGLE);
    const BAR_W = 6.6;
    // the shelving unit: dark case with side cheeks and a cornice, a
    // backlit photo panel inside, and three loaded bottle rows
    const shelfUnit = new THREE.Group();
    shelfUnit.name = "liquorShelf";
    const caseMat = new THREE.MeshStandardMaterial({color:0x241708, roughness:0.85});
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(BAR_W-0.3, 3.0, 0.1),
      new THREE.MeshStandardMaterial({color:0x180f08, roughness:0.9}));
    backPanel.position.set(0, 1.55, 0.1); shelfUnit.add(backPanel);
    const glowPanelMat = new THREE.MeshStandardMaterial({color:0xaa7a40, emissive:0xaa6a30, emissiveIntensity:0.5});
    applyOnceTex(glowPanelMat, "tex_backlit_shelf","tex_backlit_shelf.jpg", 0.5);
    const glowPanel = new THREE.Mesh(new THREE.PlaneGeometry(BAR_W-0.5, 2.5), glowPanelMat);
    glowPanel.position.set(0, 1.6, 0.16); shelfUnit.add(glowPanel);
    for(const sx of [-(BAR_W-0.3)/2, (BAR_W-0.3)/2]){
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.0, 0.55), caseMat);
      cheek.position.set(sx, 1.55, 0.3); shelfUnit.add(cheek);
    }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(BAR_W, 0.14, 0.65), caseMat);
    cornice.position.set(0, 3.05, 0.3); shelfUnit.add(cornice);
    for(const sy of [0.75, 1.5, 2.25]){
      const boardShelf = new THREE.Mesh(new THREE.BoxGeometry(BAR_W-0.4, 0.05, 0.4), caseMat);
      boardShelf.position.set(0, sy, 0.32); shelfUnit.add(boardShelf);
      const n = 15;
      for(let i=0;i<n;i++){
        const bx = -((BAR_W-0.9)/2) + i*((BAR_W-0.9)/(n-1)) + (Math.random()-0.5)*0.06;
        const hgt = 0.75 + Math.random()*0.55;
        const bottle = makeBottle(bottleColors[(i + (sy*7|0))%bottleColors.length], hgt);
        bottle.position.set(bx, sy+0.025, 0.3 + (Math.random()-0.5)*0.08);
        bottle.rotation.y = Math.random()*0.4;
        shelfUnit.add(bottle);
      }
      const strip = new THREE.PointLight(0xffc070, 0.55, 2.2, 2);
      strip.position.set(0, sy+0.35, 0.55); shelfUnit.add(strip);
    }
    bar.add(shelfUnit);
    // reclaimed-wood canopy over the counter, hung with a row of bare bulbs
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(BAR_W,0.1,1.6), wood);
    canopy.position.set(0, 2.78, 1.1); bar.add(canopy);
    const bulbCount = 15;
    for(let i=0;i<bulbCount;i++){
      const bx = -BAR_W/2+0.2 + i*((BAR_W-0.4)/(bulbCount-1));
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.14,4), new THREE.MeshBasicMaterial({color:0x0a0a0a}));
      cord.position.set(bx, 2.66, 1.9); bar.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),
        new THREE.MeshStandardMaterial({color:0xffd898, emissive:0xffb050, emissiveIntensity:2.8}));
      bulb.position.set(bx, 2.58, 1.9); bar.add(bulb);
    }
    // the counter itself: a heavy, continuous wooden bar with a polished
    // brass trim along its front edge
    const counter = new THREE.Mesh(new THREE.BoxGeometry(BAR_W,1.0,0.6), wood);
    counter.name = "barCounter";
    counter.position.set(0, 0.5, 1.6); bar.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(BAR_W+0.2,0.05,0.8), darkTop);
    top.position.set(0, 1.03, 1.6); bar.add(top);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(BAR_W+0.2,0.04,0.04), brass);
    trim.position.set(0, 1.0, 2.02); bar.add(trim);
    for(const lx of [-BAR_W/2+1, 0, BAR_W/2-1]){
      const warmGlow = new THREE.PointLight(0xffab5a, 1.7, 6.5, 1.7);
      warmGlow.position.set(lx, 1.4, 2.1); bar.add(warmGlow);
    }
    // a row of worn bar stools pulled up to the front of the counter
    for(const sx of [-2.3, -0.8, 0.8, 2.3]){
      const st = makeStool(0x4a1f1a);
      st.position.set(sx + (Math.random()-0.5)*0.1, 0, 2.4 + (Math.random()-0.5)*0.15);
      st.rotation.y = Math.random()*6.28;
      bar.add(st);
    }
    // glowing tank on the counter — one cool blue-violet accent against all
    // the warm amber
    const tank = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.36,0.32),
      new THREE.MeshPhysicalMaterial({color:0x2a5aff, transparent:true, opacity:0.35, roughness:0.1, metalness:0, transmission:0.4}));
    glass.position.set(BAR_W/2-1.2, 1.24, 1.7); tank.add(glass);
    const tankLight = new THREE.PointLight(0x6a4aff, 1.3, 2.4, 2);
    tankLight.position.set(BAR_W/2-1.2, 1.24, 1.7); tank.add(tankLight);
    bar.add(tank);
    g.add(bar);
  }

  // wagon wheel — wood rim + spokes, hung flat overhead near the bar, with
  // a small bulb at every spoke tip, a classic roadhouse ceiling fixture
  {
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 20), wood);
    rim.rotation.x = Math.PI/2; wheel.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.12,10), wood);
    wheel.add(hub);
    for(let i=0;i<8;i++){
      const a = (Math.PI*2/8)*i;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.75,6), wood);
      spoke.position.set(Math.sin(a)*0.375, 0, Math.cos(a)*0.375);
      spoke.rotation.x = Math.PI/2; spoke.rotation.z = a;
      wheel.add(spoke);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8),
        new THREE.MeshStandardMaterial({color:0xffd090, emissive:0xffa030, emissiveIntensity:2.5}));
      bulb.position.set(Math.sin(a)*0.75, 0, Math.cos(a)*0.75);
      wheel.add(bulb);
    }
    const wp = wallPoint(BAR_ANGLE, 2.4);
    wheel.position.set(wp.x, WALL_H-0.35, wp.z);
    g.add(wheel);
    const wheelGlow = new THREE.PointLight(0xffb060, 1.0, 4, 1.8);
    wheelGlow.position.copy(wheel.position); g.add(wheelGlow);
  }

  // dartboard — canvas-drawn concentric rings on a disc, mounted on a wall
  {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 256;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#1c1108"; cx.fillRect(0,0,256,256);
    const rings = [[118,"#2a1a10"],[100,"#e8dcc0"],[82,"#1a3a1e"],[64,"#8a1414"],[46,"#e8dcc0"],[28,"#1a3a1e"],[10,"#8a1414"]];
    for(const [r,c] of rings){ cx.fillStyle=c; cx.beginPath(); cx.arc(128,128,r,0,Math.PI*2); cx.fill(); }
    cx.strokeStyle = "rgba(0,0,0,.4)"; cx.lineWidth = 2;
    for(let i=0;i<20;i++){ const a=(Math.PI*2/20)*i; cx.beginPath(); cx.moveTo(128,128);
      cx.lineTo(128+Math.cos(a)*118, 128+Math.sin(a)*118); cx.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.04,24),
      new THREE.MeshStandardMaterial({map:tex, roughness:0.7}));
    board.position.set(-ROOM_XH+0.13, 1.7, -5.4); board.rotation.z = Math.PI/2;
    g.add(board);
  }

  // crossed reclaimed-wood beams — simple wall ornament, right side wall
  {
    const grp = new THREE.Group();
    grp.position.set(ROOM_XH-0.12, 2.6, 1.4); grp.rotation.y = -Math.PI/2;
    for(const rot of [0.7, -0.7]){
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.06), wood);
      beam.rotation.z = rot; grp.add(beam);
    }
    g.add(grp);
  }

  // pennant bunting — small triangular flags strung along a slack curve,
  // generic red/white/blue stripes (no real flag or logo), festive clutter
  // draped across the back-left corner
  {
    const colors = [0xb02020, 0xd8d0c0, 0x20408a];
    const p0 = new THREE.Vector3(-ROOM_XH+0.3, WALL_H-0.55, -5.7);
    const p1 = new THREE.Vector3(-4.0, WALL_H-0.75, ROOM_ZB+0.3);
    const mid = p0.clone().lerp(p1,0.5); mid.y -= 0.35;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    for(let i=0;i<14;i++){
      const t = i/13, pos = curve.getPoint(t);
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 3),
        new THREE.MeshStandardMaterial({color: colors[i%3], roughness:0.75}));
      flag.position.copy(pos); flag.rotation.z = Math.PI; flag.rotation.y = t*3;
      g.add(flag);
    }
  }

  // a couple of small, shady framed pictures — cheap canvas-drawn silhouette
  // portraits in mismatched frames, exactly the kind of thing nobody in the
  // room could actually explain if you asked about them
  const framedPicture = (x, z, rotY, y, tint)=>{
    const cv = document.createElement("canvas"); cv.width = 96; cv.height = 128;
    const cx = cv.getContext("2d");
    cx.fillStyle = `#${tint.toString(16).padStart(6,"0")}`; cx.fillRect(0,0,96,128);
    cx.fillStyle = "rgba(0,0,0,.55)";
    cx.beginPath(); cx.ellipse(48,50,22,28,0,0,Math.PI*2); cx.fill(); // head silhouette
    cx.beginPath(); cx.ellipse(48,118,38,34,0,Math.PI,0); cx.fill(); // shoulders
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.42),
      new THREE.MeshStandardMaterial({map:tex, roughness:0.85}));
    pic.position.set(x, y, z); pic.rotation.y = rotY; pic.rotation.z = (Math.random()-0.5)*0.1;
    const frameMat = new THREE.MeshStandardMaterial({color:0x1c130a, roughness:0.8});
    for(const [fw,fh,fx,fy] of [[0.38,0.05,0,0.235],[0.38,0.05,0,-0.235],[0.05,0.5,-0.185,0],[0.05,0.5,0.185,0]]){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,0.03), frameMat);
      bar.position.set(fx,fy,0.015); pic.add(bar);
    }
    g.add(pic);
  };
  framedPicture(-4.9, ROOM_ZB+0.15, 0, 2.15, 0x4a3828);           // back wall, left of the shelf
  framedPicture(ROOM_XH-0.15, -1.4, -Math.PI/2, 2.05, 0x2e3a2e);  // right wall
  framedPicture(-ROOM_XH+0.15, 1.1, Math.PI/2, 2.1, 0x3a3226);    // left wall

  // leather booth against the right wall
  {
    const booth = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.14), leather);
    back.position.y = 0.75; booth.add(back);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.6), leather);
    seat.position.set(0, 0.42, 0.3); booth.add(seat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.55), wood);
    base.position.set(0, 0.17, 0.3); booth.add(base);
    booth.position.set(ROOM_XH-0.55, 0, 2.0); booth.rotation.y = -Math.PI/2;
    g.add(booth);
  }

  // scattered high-top tables, each with a worn stool — one of them tipped
  // over, because a real dive bar's furniture doesn't all stand up straight
  const cocktailSpots = [];
  const cocktailTables = [];
  const cocktail = (x, z, toppleStool=false)=>{
    const grp = new THREE.Group();
    grp.name = "cocktailTable";
    cocktailTables.push(grp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 14), steel);
    base.position.y = 0.02; grp.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 8), steel);
    stem.position.y = 0.5; grp.add(stem);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 16), wood);
    top.position.y = 1.0; grp.add(top);
    grp.position.set(x, 0, z);
    g.add(grp);
    const stool = makeStool(0x241812);
    const sx = x + 0.55*(x>0?-1:1), sz = z + 0.35;
    if(toppleStool){
      stool.position.set(sx, 0.19, sz);
      stool.rotation.z = Math.PI/2 - 0.15;
      stool.rotation.y = Math.random()*6.28;
    } else {
      stool.position.set(sx, 0, sz);
    }
    g.add(stool);
    cocktailSpots.push({x, z});
  };
  cocktail(-5.35, -4.5);
  cocktail(-5.25, -0.5, true);
  cocktail(5.3, -4.3);
  cocktail(5.1, -1.6);

  // hanging pendant lamps — a big warm cone shade near the player (the
  // reference's foreground lamp) plus smaller ones scattered over seating
  const pendant = (x, z, y, radius, withLight)=>{
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008, WALL_H-0.15-y, 4),
      new THREE.MeshBasicMaterial({color:0x0a0a0a}));
    cord.position.set(x, (WALL_H-0.15+y)/2, z); g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(radius, radius*0.85, 18, 1, true),
      new THREE.MeshStandardMaterial({color:0xc06a1e, emissive:0x4a2408, emissiveIntensity:0.6, roughness:0.5, side:THREE.DoubleSide}));
    shade.position.set(x, y, z); g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(radius*0.22, 10, 8),
      new THREE.MeshStandardMaterial({color:0xffc070, emissive:0xffa040, emissiveIntensity:3}));
    bulb.position.set(x, y-radius*0.22, z); g.add(bulb);
    if(withLight){
      const l = new THREE.PointLight(0xff9a40, 1.5, 5, 1.8);
      l.position.set(x, y-radius*0.5, z); g.add(l);
    }
  };
  {
    // large foreground lamp, low and close, front-left — echoes the
    // reference's big cropped orange shade in the near corner
    pendant(-4.6, 2.4, 2.0, 0.42, true);
    // pair over the bar counter
    pendant(-1.3, -5.4, 2.55, 0.28, true);
    pendant(1.3, -5.4, 2.55, 0.28, false);
    // one over each high-top
    pendant(-5.35, -4.5, 2.45, 0.26, false);
    pendant(-5.25, -0.5, 2.5, 0.26, false);
    pendant(5.3, -4.3, 2.45, 0.26, true);
    pendant(5.1, -1.6, 2.4, 0.26, false);
  }

  scene.add(g);
  enableShadow(g);
  return { group:g, cocktailSpots, cocktailTables, makeBottle, bottleColors };
}
const roadhouse = buildRoadhouseBar();

/* ---- background life: a bartender actually working the bar, and a couple
   of silhouette patrons occupying the tables scattered through the room —
   the space read as empty before because nobody was ever in it besides the
   four seats at the game's own table. These are pure atmosphere: no AI, no
   interaction, just idle motion so the room doesn't feel frozen. */
const bgFigures = [];
function buildBackgroundLife(){
  // the bartender: stands roughly centered behind the long counter, given
  // a slightly taller/broader placeholder build to read as "on duty"
  {
    const bt = placeholderChar(0x5a4432);
    bt.name = "bartender";
    bt.scale.set(1.05, 1.1, 1.05);
    const bp = wallPoint(BAR_ANGLE, 0.95); // in the aisle between the shelf unit and the counter
    const BAR_TENDER_X_OFFSET = -1.7; // dead-center (x=0) sits directly behind Madame Vey's seat on the
      // player's own sightline across the table — she fully blocks him from the player's view. Off to
      // one side he's clear of her and still well inside the counter/shelf span.
    bt.position.set(bp.x + BAR_TENDER_X_OFFSET, 0, bp.z);
    bt.rotation.y = wallRot(BAR_ANGLE) + (Math.random()-0.5)*0.2; // facing the game table
    scene.add(bt);
    enableShadow(bt);
    // the counter's own front-facing lights don't reach behind it — without
    // a light of its own the bartender was correctly positioned but totally
    // unlit, invisible against the shelf shadow
    const btLight = new THREE.PointLight(0xffb060, 1.4, 3, 1.8);
    btLight.position.set(bp.x + BAR_TENDER_X_OFFSET, 1.6, bp.z);
    scene.add(btLight);
    bgFigures.push({ obj:bt, phase:Math.random()*6.28, bob:0.012, baseY:0 });
  }
  // silhouette patrons seated at the cocktail tables and the booth — dim,
  // low-detail figures that read as "someone's there" without competing
  // for attention with the actual players at the game table
  for(const spot of roadhouse.cocktailSpots){
    const p = placeholderChar(0x201812);
    p.scale.set(0.92, 0.78, 0.92); // seated proportions — squashed a bit
    const dx = -spot.x*0.12, dz = -spot.z*0.12; // sit slightly off-center from the table
    p.position.set(spot.x+dx, 0.42, spot.z+dz);
    p.rotation.y = Math.atan2(-spot.x, -spot.z) + (Math.random()-0.5)*1.2;
    scene.add(p);
    enableShadow(p);
    bgFigures.push({ obj:p, phase:Math.random()*6.28, bob:0.006, baseY:0.42 });
  }
}
buildBackgroundLife();

/* ---------------- game mode: how many chairs at the table ----------------
   Classic = you + 3 NPCs (the original, tightly-tuned layout). Full House =
   you + 5 NPCs on a bigger table. Persisted in localStorage; switching modes
   reloads the page since it reshapes the whole scene, not just UI text. */
function initialSeatCount(){
  try{ return localStorage.getItem("game_mode")==="fullhouse" ? 6 : 4; }catch(e){ return 4; }
}
const SEAT_COUNT = initialSeatCount();
const ALL_SEATS = Array.from({length:SEAT_COUNT}, (_,i)=>i);

/* ---------------- seats & actors ---------------- */
// Seat 0 = player (camera). Rest are NPCs, arranged so every seat stays
// inside the reachable mouse-look cone (yaw ±0.85rad + half the camera FOV).
function seatAt(x,z){ return { pos:new THREE.Vector3(x,0,z), rotY: Math.atan2(-x,-z) }; }
const SEATS_CLASSIC = [
  seatAt(0, 1.55),
  seatAt(-1.18, -0.42),
  seatAt(0, -1.5),
  seatAt(1.18, -0.42),
];
const SEATS_FULLHOUSE = [
  seatAt(0, 1.7),
  seatAt(1.503, -0.547),
  seatAt(0.918, -1.311),
  seatAt(0, -1.6),
  seatAt(-0.918, -1.311),
  seatAt(-1.503, -0.547),
];
const SEATS = SEAT_COUNT===6 ? SEATS_FULLHOUSE : SEATS_CLASSIC;
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // Meshy exports are meshopt-compressed (57MB → <1MB total)
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
/* some source GLBs (this revolver included) are authored standing upright
   rather than lying on their side. The old version of this only checked
   "is Y the tallest axis" — if the real model's thin (thickness) axis
   wasn't Z, that check could pass while it was still left standing on an
   edge. This instead finds whichever axis is genuinely the THINNEST one —
   a real gun's thickness is always its smallest dimension no matter which
   axis the source model happened to be authored along — and rotates so
   that thin axis ends up vertical, covering every starting orientation.
   Also records where the barrel-to-grip (longest) axis ends up, in
   obj.userData.barrelAxis, so aiming code can point the muzzle correctly
   without re-guessing the model's local axis convention. */
function layFlat(obj, groundY=0){
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const dims = [
    {axis:"x", v:size.x, vec:new THREE.Vector3(1,0,0)},
    {axis:"y", v:size.y, vec:new THREE.Vector3(0,1,0)},
    {axis:"z", v:size.z, vec:new THREE.Vector3(0,0,1)},
  ].sort((a,b)=>a.v-b.v);
  const thin = dims[0].axis;
  const long = dims[2].vec.clone();
  if(thin === "z") obj.rotation.x = -Math.PI/2;       // bring local Z (thin) up to +Y
  else if(thin === "x") obj.rotation.z = Math.PI/2;   // bring local X (thin) up to +Y
  // thin === "y": already lying flat, no rotation needed
  long.applyEuler(obj.rotation).round();              // carry the barrel axis through the same rotation
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z;
  obj.position.y += groundY - box2.min.y;
  obj.userData.barrelAxis = long;
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

/* real-geometry poker table: dark wood rim, a canvas-drawn green felt
   inlay, brass rivets around the edge, wrought-iron banded pedestal leg —
   used until/unless a Meshy-generated table_tavern.glb is hooked up */
function makePokerTableTopTex(felt){
  felt = felt || {a:"#256b3c", b:"#1c522e", c:"#0f3a1f", edge:"#0a2814"};
  const cv = document.createElement("canvas"); cv.width=1024; cv.height=1024;
  const cx = cv.getContext("2d");
  const C = 512;
  // dark wood rim with real grain streaks, not a flat color
  const woodGrad = cx.createRadialGradient(C,C,300,C,C,512);
  woodGrad.addColorStop(0,"#33210f"); woodGrad.addColorStop(1,"#1c1108");
  cx.fillStyle = woodGrad; cx.fillRect(0,0,1024,1024);
  cx.globalAlpha = 0.18;
  for(let i=0;i<70;i++){
    cx.strokeStyle = i%3===0 ? "#0d0704" : "#40280f";
    cx.lineWidth = 1+rng()*1.5;
    cx.beginPath(); cx.arc(C,C,120+i*5.6,0,Math.PI*2); cx.stroke();
  }
  cx.globalAlpha = 1;
  // felt: richer gradient, faint fabric weave, subtle center emblem
  const feltR = 400;
  const grad = cx.createRadialGradient(C,C,20,C,C,feltR);
  grad.addColorStop(0,felt.a); grad.addColorStop(0.75,felt.b); grad.addColorStop(1,felt.c);
  cx.fillStyle = grad; cx.beginPath(); cx.arc(C,C,feltR,0,Math.PI*2); cx.fill();
  cx.globalAlpha = 0.05;
  cx.strokeStyle = "#000";
  for(let i=-feltR;i<feltR;i+=4){ cx.beginPath(); cx.moveTo(C-feltR,C+i); cx.lineTo(C+feltR,C+i); cx.stroke(); }
  cx.globalAlpha = 1;
  cx.strokeStyle = felt.edge; cx.lineWidth = 14;
  cx.beginPath(); cx.arc(C,C,feltR,0,Math.PI*2); cx.stroke();
  cx.strokeStyle = "rgba(224,178,110,.55)"; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(C,C,feltR-22,0,Math.PI*2); cx.stroke();
  // faint suit emblem dead center — the "cool" detail
  cx.globalAlpha = 0.16; cx.fillStyle = "#e0b26e";
  cx.beginPath();
  cx.arc(C-18,C-10,20,0,Math.PI*2); cx.arc(C+18,C-10,20,0,Math.PI*2);
  cx.moveTo(C-36,C+4); cx.lineTo(C,C+46); cx.lineTo(C+36,C+4); cx.fill();
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function makeWoodGrainTex(base, dark){
  const cv = document.createElement("canvas"); cv.width=256; cv.height=256;
  const cx = cv.getContext("2d");
  cx.fillStyle = base; cx.fillRect(0,0,256,256);
  cx.globalAlpha = 0.25;
  for(let i=0;i<40;i++){
    cx.strokeStyle = dark; cx.lineWidth = 1+rng()*2;
    const y = rng()*256;
    cx.beginPath(); cx.moveTo(0,y); cx.bezierCurveTo(80,y+rng()*10-5,160,y+rng()*10-5,256,y); cx.stroke();
  }
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1,3);
  return tex;
}
function makePokerTable(){
  const t = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({map: makePokerTableTopTex(equippedItem("felt")), roughness:0.7});
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,0.09,64), topMat);
  top.position.y = 0.92; t.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05,0.038,12,64),
    new THREE.MeshPhysicalMaterial({map: makeWoodGrainTex("#2a190c","#160d05"), roughness:0.32, clearcoat:0.5, clearcoatRoughness:0.3}));
  rim.rotation.x = Math.PI/2; rim.position.y = 0.94; t.add(rim);
  const brass = new THREE.MeshStandardMaterial({color:equippedItem("trim").color, roughness:0.28, metalness:0.85});
  for(let i=0;i<24;i++){
    const a = (Math.PI*2/24)*i;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.017,10,8), brass);
    rivet.position.set(Math.sin(a)*1.02, 0.958, Math.cos(a)*1.02);
    t.add(rivet);
  }
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.92,20),
    new THREE.MeshStandardMaterial({map: makeWoodGrainTex("#231708","#120b04"), roughness:0.75}));
  leg.position.y = 0.46; t.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.03,20),
    new THREE.MeshStandardMaterial({color:0x1c1108, roughness:0.8}));
  foot.position.y = 0.015; t.add(foot);
  const iron = new THREE.MeshStandardMaterial({color:0x1c1c1e, roughness:0.35, metalness:0.75});
  for(const hy of [0.18, 0.72]){
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.165,0.018,8,24), iron);
    band.rotation.x = Math.PI/2; band.position.y = hy; t.add(band);
  }
  t.userData.topMat = topMat;
  t.userData.rivetMat = brass;
  return t;
}
/* ---------------- cosmetics shop: a pure coin sink ----------------
   Three cosmetic slots — felt color, chip theme, table-rivet trim — each
   with a free starter item plus paid alternates. Ownership + equipped
   choice persist in localStorage; buying/equipping re-renders the live
   table/chips immediately (no reload needed). */
const SHOP_CATALOG = {
  felt: [
    { id:"classic", name:"Classic Green", price:0,   a:"#256b3c", b:"#1c522e", c:"#0f3a1f", edge:"#0a2814" },
    { id:"oxblood", name:"Oxblood",        price:80,  a:"#7a2e22", b:"#5c2018", c:"#38130d", edge:"#210b07" },
    { id:"royal",   name:"Royal Blue",     price:80,  a:"#204d78", b:"#173a5c", c:"#0d2338", edge:"#081627" },
    { id:"noir",    name:"Charcoal Noir",  price:120, a:"#3a3a3d", b:"#2a2a2c", c:"#161617", edge:"#0a0a0b" },
    { id:"gold",    name:"Gold Rush",      price:200, a:"#8a7226", b:"#6b5818", c:"#3d3009", edge:"#241c05" },
  ],
  chips: [
    { id:"classic", name:"Classic",     price:0,   colors:[0xe9e2d0, 0xb9312a, 0x1f4fa0, 0x267a3e, 0x6b2f8a] },
    { id:"neon",    name:"Neon Nights", price:80,  colors:[0x1affe0, 0xff2fd0, 0x2f6bff, 0xccff33, 0xff8a1f] },
    { id:"noir",    name:"Noir",        price:80,  colors:[0xe6e6e6, 0xa0a0a0, 0x606060, 0x2c2c2c, 0x0e0e0e] },
    { id:"gold",    name:"Gold Rush",   price:150, colors:[0xf1e0a8, 0xd4af37, 0xb08d3f, 0x6b5218, 0x2a2416] },
  ],
  trim: [
    { id:"classic", name:"Brass",  price:0,   color:0x9a7a30 },
    { id:"silver",  name:"Silver", price:60,  color:0xb8bec4 },
    { id:"copper",  name:"Copper", price:60,  color:0xb5651d },
    { id:"gold",    name:"Gold",   price:150, color:0xd4af37 },
  ],
};
let shopOwned = { felt:["classic"], chips:["classic"], trim:["classic"] };
let shopEquipped = { felt:"classic", chips:"classic", trim:"classic" };
try{
  const o = JSON.parse(localStorage.getItem("shop_owned"));
  if(o) for(const k in shopOwned) if(Array.isArray(o[k])) shopOwned[k]=o[k];
  const e = JSON.parse(localStorage.getItem("shop_equipped"));
  if(e) for(const k in shopEquipped) if(typeof e[k]==="string") shopEquipped[k]=e[k];
}catch(err){}
function saveShop(){
  try{
    localStorage.setItem("shop_owned", JSON.stringify(shopOwned));
    localStorage.setItem("shop_equipped", JSON.stringify(shopEquipped));
  }catch(e){}
}
function equippedItem(cat){
  return SHOP_CATALOG[cat].find(i=>i.id===shopEquipped[cat]) || SHOP_CATALOG[cat][0];
}
function applyFeltCosmetic(){
  if(!table || !table.userData.topMat) return;
  table.userData.topMat.map = makePokerTableTopTex(equippedItem("felt"));
  table.userData.topMat.needsUpdate = true;
}
function applyTrimCosmetic(){
  if(!table || !table.userData.rivetMat) return;
  table.userData.rivetMat.color.setHex(equippedItem("trim").color);
}
function applyChipCosmetic(){
  CHIP_PALETTE = equippedItem("chips").colors;
  for(let i=0;i<SEAT_COUNT;i++) if(chipStacks[i]) rebuildChipStack(i);
}
function buyOrEquip(cat, id){
  const item = SHOP_CATALOG[cat].find(i=>i.id===id);
  if(!item) return;
  if(shopOwned[cat].includes(id)){
    shopEquipped[cat] = id;
  } else {
    if(coins < item.price) return;
    coins -= item.price;
    try{ localStorage.setItem("coins", String(coins)); }catch(e){}
    updateCoinTag();
    shopOwned[cat].push(id);
    shopEquipped[cat] = id;
  }
  saveShop();
  if(cat==="felt") applyFeltCosmetic();
  if(cat==="trim") applyTrimCosmetic();
  if(cat==="chips") applyChipCosmetic();
  renderShop();
}

/* ---------------- casino chip stacks (one per seat, live on the felt) ----
   Real-looking poker chips: banded colors every 4 chips like a real casino
   stack (quick to count at a glance), stacked in columns of 10. Each seat's
   stack sits beside their card. Chips physically fly across the table from
   loser to survivors whenever someone is shot — the table itself keeps score. */
let CHIP_PALETTE = equippedItem("chips").colors;
const chipTexCache = {};
function makeChipTex(hex){
  if(chipTexCache[hex]) return chipTexCache[hex];
  const cv=document.createElement("canvas"); cv.width=cv.height=128;
  const g=cv.getContext("2d");
  const col = "#"+hex.toString(16).padStart(6,"0");
  const dark = hex===0xe9e2d0;
  const trim = dark ? "#3a3226" : "#ece4d2";
  g.fillStyle=col; g.beginPath(); g.arc(64,64,62,0,Math.PI*2); g.fill();
  g.save(); g.translate(64,64); g.fillStyle=trim;
  for(let i=0;i<10;i++){ g.rotate(Math.PI/5); g.fillRect(-4,-61,8,15); }
  g.restore();
  g.strokeStyle=trim; g.lineWidth=4; g.beginPath(); g.arc(64,64,40,0,Math.PI*2); g.stroke();
  g.fillStyle=col; g.beginPath(); g.arc(64,64,36,0,Math.PI*2); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  chipTexCache[hex] = t;
  return t;
}
function makeChip(hex){
  const face = new THREE.MeshStandardMaterial({map: makeChipTex(hex), roughness:0.35});
  const side = new THREE.MeshStandardMaterial({color:hex, roughness:0.45});
  const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.046,0.046,0.013,22,1), [side, face, face]);
  return chip;
}
const STARTING_STAKE = 30;
const CLUE_COST = 8;
let clueBought = new Array(SEAT_COUNT).fill(false);
let betPileChips = []; // the side bet's chips currently sitting in the middle of the table, if any
const chipCounts = new Array(SEAT_COUNT).fill(0);
const chipStacks = new Array(SEAT_COUNT).fill(null);
function chipSlotBase(seatIdx){
  const dir = SEATS[seatIdx].pos.clone().setY(0).normalize();
  const perp = new THREE.Vector3(-dir.z,0,dir.x);
  return dir.multiplyScalar(0.72).add(perp.multiplyScalar(0.22)).setY(tableTopY+0.006);
}
function rebuildChipStack(seatIdx){
  if(chipStacks[seatIdx]) scene.remove(chipStacks[seatIdx]);
  const n = chipCounts[seatIdx];
  const g = new THREE.Group();
  const base = chipSlotBase(seatIdx);
  const dir = SEATS[seatIdx].pos.clone().setY(0).normalize();
  const perp = new THREE.Vector3(-dir.z,0,dir.x);
  for(let i=0;i<n;i++){
    const col = Math.floor(i/10), row = i%10;
    const chip = makeChip(CHIP_PALETTE[Math.floor(i/4)%CHIP_PALETTE.length]);
    chip.position.set(
      base.x + perp.x*col*0.11 + (rng()-0.5)*0.003,
      base.y + row*0.0135 + 0.0068,
      base.z + perp.z*col*0.11 + (rng()-0.5)*0.003
    );
    chip.rotation.y = rng()*6.28;
    enableShadow(chip);
    g.add(chip);
  }
  scene.add(g);
  chipStacks[seatIdx] = g;
}
function resetChipStakes(){
  for(let i=0;i<SEAT_COUNT;i++){ chipCounts[i]=STARTING_STAKE; rebuildChipStack(i); }
}
function tableCenterPos(){ return new THREE.Vector3(0, tableTopY+0.012, 0); }
/* animate `amount` chips flying between two world positions; returns the
   flyer meshes still parked at `toPos` so a caller can hold them there
   (e.g. a bet's pot pile) instead of always cleaning them up immediately */
async function flyChipsBetween(fromPos, toPos, amount, colorOffset=0){
  if(amount<=0) return [];
  const flyers=[];
  for(let k=0;k<amount;k++){
    const chip = makeChip(CHIP_PALETTE[(k+colorOffset)%CHIP_PALETTE.length]);
    chip.position.copy(fromPos); chip.position.y += 0.02 + k*0.003;
    chip.rotation.y = rng()*6.28;
    scene.add(chip); flyers.push(chip);
  }
  const steps=26;
  for(let s=1;s<=steps;s++){
    const t=s/steps;
    for(let k=0;k<flyers.length;k++){
      const delay=k*0.05;
      const lt=Math.max(0,Math.min(1,(t-delay)/(1-delay+0.0001)));
      const e=lt*lt*(3-2*lt);
      flyers[k].position.lerpVectors(fromPos,toPos,e);
      flyers[k].position.y += Math.sin(e*Math.PI)*0.16;
      flyers[k].rotation.x += 0.3;
    }
    await sleep(16);
  }
  // the tumble above accumulates ~7.8rad of rotation.x by the last step —
  // fine for chips that get removed the instant they land (see flyChips
  // below), but these ones are handed back to the caller and can stay
  // parked and visible (e.g. a bet's pot pile), where that leftover tumble
  // reads as the chip standing up on its edge instead of resting flat.
  for(const c of flyers) c.rotation.x = 0;
  return flyers;
}
/* animate already-existing chip meshes (e.g. a bet's pot pile) on to a new
   world position, then remove them — used instead of flyChipsBetween when
   the chips are already sitting on the table rather than starting fresh */
async function flyExistingTo(meshes, toPos){
  if(!meshes || !meshes.length) return;
  const froms = meshes.map(c=>c.position.clone());
  const steps=26;
  for(let s=1;s<=steps;s++){
    const t=s/steps;
    for(let k=0;k<meshes.length;k++){
      const delay=k*0.05;
      const lt=Math.max(0,Math.min(1,(t-delay)/(1-delay+0.0001)));
      const e=lt*lt*(3-2*lt);
      meshes[k].position.lerpVectors(froms[k], toPos, e);
      meshes[k].position.y += Math.sin(e*Math.PI)*0.16;
      meshes[k].rotation.x += 0.3;
    }
    await sleep(16);
  }
  for(const c of meshes) scene.remove(c);
}
/* shrink chips down into the felt and remove them — the "swept away" look
   for a lost bet, rather than flying them anywhere in particular */
async function sweepAwayChips(pile){
  if(!pile || !pile.length) return;
  const steps=20;
  for(let s=1;s<=steps;s++){
    const t=s/steps, e=t*t;
    for(const c of pile){ c.position.y -= 0.016*e; c.scale.setScalar(Math.max(0.001,1-e)); }
    await sleep(16);
  }
  for(const c of pile) scene.remove(c);
}
/* animate `amount` chips flying from one seat's stack to another's, then land */
async function flyChips(fromSeat, toSeat, amount){
  const flyers = await flyChipsBetween(chipSlotBase(fromSeat), chipSlotBase(toSeat), amount);
  for(const c of flyers) scene.remove(c);
}
/* a seat just lost the gun draw — they forfeit half their stake (min 4),
   split across the survivors and animated flying across the table to them */
async function loseChipsToTable(seat){
  const total = chipCounts[seat];
  const forfeited = Math.min(total, Math.max(4, Math.ceil(total*0.5)));
  if(forfeited<=0) return;
  chipCounts[seat] -= forfeited;
  rebuildChipStack(seat);
  const survivors = aliveSeats().filter(s=>s!==seat);
  if(survivors.length===0) return;
  const each = Math.floor(forfeited/survivors.length);
  let remainder = forfeited - each*survivors.length;
  const amounts = survivors.map((_,idx)=> each + (idx<remainder?1:0));
  await Promise.all(survivors.map((s,idx)=> flyChips(seat, s, amounts[idx])));
  survivors.forEach((s,idx)=>{ chipCounts[s]+=amounts[idx]; rebuildChipStack(s); });
}
/* the table wrongly executed an innocent seat this round — every voter who
   picked them pays a flat, modest fine straight to the seat they wrongly
   killed (not spread across the table). Table chips can go negative here;
   that's fine, it's just a per-match number that nets against the bank at
   match end (see bankTableResult) — a small, regular cost rather than
   something that wipes a seat out. */
const WRONG_VOTE_FINE = 5;
async function punishWrongVoters(wrongVoters, victim){
  const flights = [];
  let total = 0;
  for(const w of wrongVoters){
    chipCounts[w] -= WRONG_VOTE_FINE;
    rebuildChipStack(w);
    total += WRONG_VOTE_FINE;
    flights.push(flyChips(w, victim, WRONG_VOTE_FINE));
  }
  await Promise.all(flights);
  chipCounts[victim] += total;
  rebuildChipStack(victim);
  setBanner(STR.wrong_vote_penalty, 2000);
  await sleep(1200);
}
/* real-geometry western revolver: barrel, cylinder drum, frame, wood grip,
   hammer and trigger guard — used until a Meshy-generated revolver.glb
   is hooked up */
function makeRevolverModel(){
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({color:0x2a2a2e, roughness:0.32, metalness:0.85});
  const wood  = new THREE.MeshStandardMaterial({color:0x3a2414, roughness:0.6});
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.16,10), steel);
  barrel.rotation.z = Math.PI/2; barrel.position.set(0.06,0.03,0); g.add(barrel);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.045,10), steel);
  cyl.rotation.z = Math.PI/2; cyl.position.set(-0.02,0.03,0); g.add(cyl);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.03,0.02), steel);
  frame.position.set(-0.005,0.03,0); g.add(frame);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.07,0.022), wood);
  grip.position.set(-0.05,-0.01,0); grip.rotation.z = -0.35; g.add(grip);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.02,0.014), steel);
  hammer.position.set(-0.035,0.05,0); g.add(hammer);
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.014,0.004,6,10,Math.PI), steel);
  trigger.position.set(-0.02,0.005,0); trigger.rotation.z = Math.PI; g.add(trigger);
  return g;
}
let table=null, revolver=null, tableTopY=0.95, worldReady=false, cardBackTex=null;
const cards=[];
const revolverHome = new THREE.Vector3(0.28, 0, 0.15);

/* ---- per-seat sidearms: every seat keeps their own iron on the felt ----
   Each player (you included) has a revolver lying within hand's reach on
   the table in front of them. During the vote, as each voter's choice is
   revealed, their gun lifts and swings to point at whoever they voted for
   — the whole table ends up in a standoff until the shot resolves. The
   center revolver stays the execution piece; these are the threat props. */
const seatGuns = [];
// flat (pitch-free) aim: same roll-safe lookAt + fixed axis-remap approach
// as executeSeat, but the target is projected to the gun's own height so
// the gun swivels on the felt instead of tilting up off it
function gunFlatAimEuler(gun, target){
  const dummy = new THREE.Object3D();
  dummy.position.copy(gun.position);
  dummy.up.set(0,1,0);
  dummy.lookAt(target.x, gun.position.y, target.z);
  const barrelLocal = (revolver.userData.barrelAxis || new THREE.Vector3(0,0,1)).clone().multiplyScalar(GUN_BARREL_SIGN);
  const remap = new THREE.Quaternion().setFromUnitVectors(barrelLocal, new THREE.Vector3(0,0,-1));
  const q = dummy.quaternion.clone().multiply(remap);
  return new THREE.Euler().setFromQuaternion(q, "XYZ");
}
function buildSeatGuns(){
  for(const gun of seatGuns) if(gun) scene.remove(gun);
  seatGuns.length = 0;
  for(const i of ALL_SEATS){
    const gun = revolver.clone(true);
    const dir = SEATS[i].pos.clone().setY(0).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const base = dir.multiplyScalar(0.82).add(perp.multiplyScalar(-0.26));
    gun.position.set(base.x, revolverHome.y, base.z);
    // resting: flat on the felt, barrel loosely toward the middle with a
    // careless off-angle so the table doesn't look like a synchronized drill
    const e = gunFlatAimEuler(gun, new THREE.Vector3(0,0,0));
    gun.rotation.set(e.x, e.y + (rng()-0.5)*0.7, e.z);
    gun.userData.rest = { pos: gun.position.clone(), rot: {x:gun.rotation.x, y:gun.rotation.y, z:gun.rotation.z} };
    enableShadow(gun);
    scene.add(gun);
    seatGuns[i] = gun;
  }
}
async function aimSeatGun(voter, target){
  const gun = seatGuns[voter]; if(!gun) return;
  const tpos = target===0 ? new THREE.Vector3(0,0,1.3) : SEATS[target].pos.clone();
  const e = gunFlatAimEuler(gun, tpos);
  const up = gun.position.clone().setY(gun.userData.rest.pos.y + 0.05);
  await tweenTo(gun, up, {x:e.x, y:e.y, z:e.z}, 340);
}
function restAllGuns(){
  for(const gun of seatGuns){
    if(!gun) continue;
    tweenTo(gun, gun.userData.rest.pos, gun.userData.rest.rot, 550);
  }
}
async function loadWorld(){
  const [gRoom, gTable, gBrute, gWidow, gFox, gHawk, gCrow, gGun, gShelf, gBartender, gBgTable, gBarStool] = await Promise.all([
    loadGLB("room_tavern","room_tavern.glb"),
    loadGLB("table_tavern","table_tavern.glb"), loadGLB("char_brute","char_brute.glb"),
    loadGLB("char_widow","char_widow.glb"), loadGLB("char_fox","char_fox.glb"),
    SEAT_COUNT>4 ? loadGLB("char_hawk","char_hawk.glb") : Promise.resolve(null),
    SEAT_COUNT>4 ? loadGLB("char_crow","char_crow.glb") : Promise.resolve(null),
    loadGLB("revolver","revolver.glb"),
    loadGLB("liquor_shelf","liquor_shelf.glb"),
    loadGLB("bartender","bartender.glb"),
    loadGLB("bg_table","bg_table.glb"),
    loadGLB("bar_stool","bar_stool.glb"),
  ]);
  // ---- Meshy-generated set dressing: each of these swaps out a procedural
  // stand-in built in buildRoadhouseBar()/buildBackgroundLife(). The
  // procedural versions stay as the fallback if a file is missing. ----
  if(gShelf){
    // the real carved-wood back-bar unit: four copies side by side spanning
    // the counter, then the glowing bottles re-shelved onto its actual
    // boards (measured from the model: board tops at y ≈ -0.47 / 0.00 /
    // +0.30 in its -0.95..0.95 local space)
    const unit = scene.getObjectByName("liquorShelf");
    if(unit){
      unit.clear();
      const S = 1.42; // model is 1.9 units tall → 2.7m, cornice under the ceiling joists
      for(const ux of [-2.26, -0.755, 0.755, 2.26]){
        const inst = gShelf.clone(true);
        inst.scale.setScalar(S);
        inst.position.set(ux, 0.95*S, 0.26);
        unit.add(inst);
      }
      const rows = [[-0.47, 0.55], [0.0, 0.35], [0.30, 0.35]]; // [board y, bottle height variance] — upper cavities are shorter
      for(const [my, hv] of rows){
        const wy = (my + 0.95) * S;
        for(const ux of [-2.26, -0.755, 0.755, 2.26]){
          const n = 6;
          for(let i=0;i<n;i++){
            const bx = ux - 0.55 + i*(1.1/(n-1)) + (Math.random()-0.5)*0.05;
            const bottle = roadhouse.makeBottle(
              roadhouse.bottleColors[(i + ((wy*7)|0)) % roadhouse.bottleColors.length],
              0.7 + Math.random()*hv);
            bottle.position.set(bx, wy + 0.02, 0.34);
            bottle.rotation.y = Math.random()*0.4;
            unit.add(bottle);
          }
        }
        const strip = new THREE.PointLight(0xffc070, 0.55, 2.2, 2);
        strip.position.set(0, wy + 0.45, 0.6); unit.add(strip);
      }
      enableShadow(unit);
    }
  }
  if(gBartender){
    // the real bartender model replaces the placeholder capsule, same spot
    // in the aisle behind the counter, same idle bob
    const old = scene.getObjectByName("bartender");
    if(old){
      const sc = 0.96; // model is 1.9 units tall, centered at origin → ~1.82m on his feet
      gBartender.name = "bartender";
      gBartender.scale.setScalar(sc);
      gBartender.position.copy(old.position);
      gBartender.position.y = 0.95*sc;
      gBartender.rotation.y = old.rotation.y;
      scene.remove(old);
      scene.add(enableShadow(gBartender));
      const f = bgFigures.find(f=>f.obj===old);
      if(f){ f.obj = gBartender; f.baseY = 0.95*sc; }
    }
  }
  if(gBgTable){
    // the real pub table replaces each procedural high-top. The export came
    // through untextured, so it gets a dark-wood material in code — reads
    // fine in the dim room, and the wrought-iron base just goes near-black.
    const tblMat = new THREE.MeshStandardMaterial({color:0x4a2c16, roughness:0.75, metalness:0.15});
    gBgTable.traverse(o=>{ if(o.isMesh) o.material = tblMat; });
    for(const tbl of roadhouse.cocktailTables){
      tbl.clear();
      const inst = gBgTable.clone(true);
      inst.scale.set(0.45, 0.81, 0.45); // squeeze the 1.9-wide model to high-top proportions; top lands at y≈1.0 like the old one
      inst.position.y = 0.62*0.81;
      tbl.add(inst);
      enableShadow(tbl);
    }
  }
  if(gBarStool){
    // real bar stool replaces every procedural one — at the counter and at
    // each cocktail table. Also shipped untextured, so a dark leather/wood
    // tint in code, matching the old procedural stool colors.
    const stoolMat = new THREE.MeshStandardMaterial({color:0x33200f, roughness:0.7, metalness:0.1});
    gBarStool.traverse(o=>{ if(o.isMesh) o.material = stoolMat; });
    const S = 0.68/1.9; // model is 1.9 units tall, centered at origin → scale to a real stool's ~0.68m seat height
    const stoolTargets = [];
    scene.traverse(o=>{ if(o.name==="barStool") stoolTargets.push(o); });
    for(const st of stoolTargets){
      st.clear();
      const inst = gBarStool.clone(true);
      inst.scale.setScalar(S);
      inst.position.y = 0.95*S;
      st.add(inst);
      enableShadow(st);
    }
  }
  // NPC characters — Gruff Halloran, Madame Vey and Silky Marlowe now come
  // in from Meshy fully textured with real normals, so they render as-is,
  // no tinting needed. Deacon Rourke and Old Ma Kessler (Full House mode,
  // deprioritized for now) are still the older untextured exports, which
  // need the flat chip-color tint + computed normals fallback below or
  // they render as solid black silhouettes (see the fix history: without
  // normal data, MeshStandardMaterial's N·L term degenerates to ~0 against
  // this room's point lights, leaving only the flat ambient term).
  const charTint = (g, hex, rough=0.75)=>{
    if(!g) return;
    const mat = new THREE.MeshStandardMaterial({color:hex, roughness:rough, metalness:0.05});
    g.traverse(o=>{
      if(!o.isMesh) return;
      if(!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.material = mat;
    });
  };
  charTint(gHawk, 0x5c6b78);  // Deacon Rourke
  charTint(gCrow, 0x4a3a52);  // Old Ma Kessler

  // swap the procedural box/beam room for a Higgsfield-generated one, if hooked up
  if(gRoom){
    if(roomGroup) scene.remove(roomGroup);
    scene.add(enableShadow(gRoom));
    roomGroup = gRoom;
  }
  // NOTE: the old secondary "back-bar station" that used to be planted here
  // (a tiny 1.8-wide counter + mini bottle rack + red stools) is gone — it
  // sat directly in front of the real bar and was exactly the "tiny,
  // blocked-off bar" the room kept reading as. The full-size counter,
  // liquor shelf, bottles and stools are all built in buildRoadhouseBar().
  table = gTable ? normalize(gTable, 0.95) : makePokerTable();
  if(SEAT_COUNT>4) table.scale.multiplyScalar(1.3); // Full House: bigger table for the extra chairs
  enableShadow(table);
  scene.add(table);
  // table top height for props
  const tb = new THREE.Box3().setFromObject(table);
  tableTopY = tb.max.y;
  revolverHome.y = tableTopY + 0.005;
  candle.position.y = tableTopY + 0.26;

const models = [null, gBrute, gWidow, gFox, gHawk, gCrow];
for(let i=1;i<SEAT_COUNT;i++){
  const a = makeActorShell(i);
  const npc = NPCS[i-1];
  a.npc = npc;
  a.inner = models[i] ? normalize(models[i], tableTopY + 0.82) : placeholderChar(npc.chip);
  enableShadow(a.inner);
  // grounded on the floor by normalize; remember that offset for the idle anim
  a.baseY = a.inner.position.y;

  // Add chair
  const st = SEATS[i];
const ch = makeChair();
const out = st.pos.clone().setY(0).normalize().multiplyScalar(0.34);
ch.position.copy(st.pos).add(out);
ch.position.y = 0;
ch.rotation.y = st.rotY;
enableShadow(ch);
scene.add(ch);

  a.group.add(a.inner);
  actors[i] = a;
}
  actors[0] = { seat:0, group:null, alive:true, npc:null }; // the player

  const gunMesh = gGun ? layFlat(normalize(gGun, 0.2)) : makeRevolverModel();
  revolver = new THREE.Group(); revolver.add(gunMesh);
  // the fallback procedural model's own barrel is built pointing along +X
  // (see makeRevolverModel: barrel offset to +X, grip to -X); the real GLB's
  // barrel axis was just detected by layFlat above.
  revolver.userData.barrelAxis = gGun ? (gunMesh.userData.barrelAxis || new THREE.Vector3(0,0,1)) : new THREE.Vector3(1,0,0);
  enableShadow(revolver);
  revolver.position.copy(revolverHome); revolver.rotation.y = rng()*6.28;
  // NOTE: the center revolver is no longer added to the scene — each seat
  // has its own gun now (see buildSeatGuns) and executions use the
  // condemned seat's own iron. This object stays as the clone source and
  // for the surface-height measurement below (which sets the guns' rest y).
  revolver.updateMatrixWorld(true);
  {
    let surfY = tableTopY;
    if (table) {
      const rc = new THREE.Raycaster(
        new THREE.Vector3(revolverHome.x, tableTopY + 2, revolverHome.z),
        new THREE.Vector3(0, -1, 0)
      );
      const hit = rc.intersectObject(table, true)[0];
      if (hit) surfY = hit.point.y;
    }
    const gb = new THREE.Box3().setFromObject(revolver);
    revolver.position.y += (surfY + 0.004) - gb.min.y;
    revolverHome.copy(revolver.position);
  }
  buildSeatGuns();
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
  d.innerHTML=`<span class="nm">${name}</span><span class="sus"></span>`;
  platesL.appendChild(d); plateEls[i]=d; return d;
}
function headScreenPos(i, yOff=1.62){
  const a = actors[i]; if(!a || !a.group) return null;
  const v = new THREE.Vector3(0, yOff*(a.slump>0.5?0.55:1), 0).applyMatrix4(a.group.matrixWorld);
  v.project(camera);
  return { x:(v.x*0.5+0.5)*innerWidth, y:(-v.y*0.5+0.5)*innerHeight, behind:v.z>1 };
}
function clampBubblePos(p){
  const x = Math.min(Math.max(p.x, 150), innerWidth-150);
  const y = Math.max(p.y, 96);
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
  usedWords:new Set(), spoken:ALL_SEATS.map(()=>[]), suspicion:null, heat:new Array(SEAT_COUNT).fill(0),
  heardCrewWords:0, extraRound:false, over:false,
};

/* ---------------- casino coins: the player's persistent bank ----
   Persisted in localStorage so it survives reloads/new matches. Every
   match all four seats stake STARTING_STAKE chips on the felt (see the
   chip-stack system above the revolver code) and physically win/lose
   chips off each other round by round as seats get shot. At match end
   whatever the player nets at the table — up or down — settles here. */
let coins = 0;
try{ coins = parseInt(localStorage.getItem("coins"),10) || 0; }catch(e){}
function updateCoinTag(){ const t=$("coinTag"); if(t) t.textContent = fmt(STR.coin_tag,{n:coins}); }
function bankTableResult(){
  const net = chipCounts[0] - STARTING_STAKE;
  coins = Math.max(0, coins + net);
  try{ localStorage.setItem("coins", String(coins)); }catch(e){}
  updateCoinTag();
  const t = $("coinTag");
  if(t){ t.classList.add("bump"); setTimeout(()=>t.classList.remove("bump"), 260); }
  return net;
}
const aliveSeats = ()=> ALL_SEATS.filter(i=>actors[i] && actors[i].alive);
const npcName = npc => getLang()==="ku" ? npc.name_ku : npc.name;
const nameOf = i => i===0 ? STR.you : npcName(actors[i].npc);

function newMatch(){
  G.card = pick(DECK[getLang()]);
  G.imposterSeat = Math.floor(rng()*SEAT_COUNT);
  G.round = 1; G.maxRounds = RULES.maxRounds;
  G.usedWords = new Set(); G.spoken=ALL_SEATS.map(()=>[]);
  G.heat=new Array(SEAT_COUNT).fill(0); G.heardCrewWords=0; G.extraRound=false; G.over=false;
  clueBought = new Array(SEAT_COUNT).fill(false);
  // escalating difficulty from wrong votes: every voter who picked the
  // wrongly-executed seat permanently loses two word options, and the
  // imposter banks a free real word — see doVote()
  G.handPenalty = new Array(SEAT_COUNT).fill(0);
  G.impBonusClues = 0;
  // per-observer suspicion matrix (crew NPCs only use their own row)
  G.suspicion = ALL_SEATS.map(()=>new Array(SEAT_COUNT).fill(0));
  for(const a of actors) if(a){ a.alive=true; a.slump=0; a.lean=0; a.talk=0; a.fidgetT=0; }
  // every seat's sidearm snaps back to its resting spot for the fresh deal
  for(const gun of seatGuns){
    if(!gun) continue;
    const r = gun.userData.rest;
    gun.position.copy(r.pos);
    gun.rotation.set(r.rot.x, r.rot.y, r.rot.z);
  }
  for(let i=1;i<SEAT_COUNT;i++){ const p=plateEls[i]; if(p){ p.classList.remove("dead"); p.querySelector(".sus").textContent=""; } }
  // word map for scoring
  G.wordWeight = {};
  for(const w of G.card.obvious) G.wordWeight[w]=RULES.weights.obvious;
  for(const w of G.card.medium)  G.wordWeight[w]=RULES.weights.medium;
  for(const w of G.card.subtle)  G.wordWeight[w]=RULES.weights.subtle;
}

/* ---------- word AI ---------- */
function unused(list){ return list.filter(w=>!G.usedWords.has(w)); }
function handSizeFor(seat){
  const penalty = (G.handPenalty && G.handPenalty[seat]) || 0;
  return Math.max(1, RULES.handSize - penalty);
}
function crewHand(seat=0){
  const size = handSizeFor(seat);
  const o=shuffle(unused(G.card.obvious)), m=shuffle(unused(G.card.medium)), s=shuffle(unused(G.card.subtle));
  const hand=[];
  if(o[0]) hand.push({w:o[0],tier:"obvious"});
  if(m[0]) hand.push({w:m[0],tier:"medium"});
  for(const w of s){ if(hand.length>=size) break; hand.push({w,tier:"subtle"}); }
  let i=1; while(hand.length<size && (m[i]||o[i])){ const w=m[i]||o[i]; hand.push({w,tier:m[i]?"medium":"obvious"}); i++; }
  // a long match (several vote cycles, no early-out) can run the card's
  // word pool dry — once nothing unused is left, fall back to reusing
  // already-spoken words instead of leaving the hand empty with nothing
  // to click (that was a real soft-lock)
  if(!hand.length){
    const pool = shuffle(G.card.obvious.concat(G.card.medium, G.card.subtle));
    for(const w of pool){ if(hand.length>=size) break;
      hand.push({w, tier: G.card.obvious.includes(w)?"obvious":G.card.medium.includes(w)?"medium":"subtle"}); }
  }
  return shuffle(hand).slice(0,size);
}
function imposterHand(seat=0){
  const size = handSizeFor(seat);
  const b=shuffle(unused(G.card.bluff)).map(w=>({w,tier:"bluff"}));
  const learnedUnlocked = Math.floor(G.heardCrewWords/2) + (G.impBonusClues||0);
  const learned = shuffle(unused(G.card.subtle.concat(G.card.medium))).slice(0,learnedUnlocked)
    .map(w=>({w,tier:"bluff"}));
  let hand = shuffle(learned.concat(b)).slice(0,size);
  if(!hand.length){
    const pool = shuffle(G.card.bluff.concat(G.card.subtle, G.card.medium));
    hand = pool.slice(0,size).map(w=>({w,tier:"bluff"}));
  }
  return hand;
}
function npcShouldBuyClue(seat){
  const npc = actors[seat].npc;
  const isTopSuspect = G.heat[seat] >= Math.max(...aliveSeats().filter(s=>s!==seat).map(s=>G.heat[s]), 0);
  const chance = (isTopSuspect ? 0.55 : 0.12) * (0.4 + npc.caution);
  return rng() < chance;
}
function npcPickWord(seat){
  const a=actors[seat], npc=a.npc;
  if(seat===G.imposterSeat){
    if(!clueBought[seat] && chipCounts[seat]>=CLUE_COST && npcShouldBuyClue(seat)){
      const pool = unused(G.card.subtle.concat(G.card.medium));
      if(pool.length){
        clueBought[seat]=true;
        chipCounts[seat]-=CLUE_COST; rebuildChipStack(seat);
        return {w:pick(pool), tier:"bluff"};
      }
    }
    const hand=imposterHand(seat);
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
  // every alive crew NPC updates its suspicion of `seat`. These constants
  // were tuned down from a simulated baseline where a bluff word was such
  // a strong, near-noiseless signal that the imposter's cumulative
  // suspicion/heat over 4 rounds made them identifiable ~99.8% of the time
  // on the very first vote — the deduction barely mattered. Softened so a
  // bluff is still risky but not an automatic tell.
  const weight = G.wordWeight[w];
  for(const o of aliveSeats()){
    if(o===0 || o===seat) continue;
    if(o===G.imposterSeat){
      // imposter can't score relatedness; it tracks table heat instead
      continue;
    }
    let d;
    if(weight===undefined) d = 0.55;           // unknown word — smells like a bluff
    else if(weight===3)    d = -1.2;           // proves knowledge (and leaks it)
    else if(weight===2)    d = -0.4;
    else                   d = 0.35;           // safe but slippery
    d += (rng()-0.5)*0.5;
    G.suspicion[o][seat] += d;
  }
  // public heat: rough table-wide read (drives glances + imposter votes)
  if(weight===undefined) G.heat[seat]+=0.8; else G.heat[seat]+= weight===1?0.35:weight===2?-0.3:-0.9;
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
    const s = G.suspicion[o][t] + G.heat[t]*npc.aggression*0.3 + rng()*0.5;
    if(s>bs){bs=s;best=t;}
  }
  return best;
}

/* ---------- UI: prompt / hand / vote ---------- */
function setPrompt(t){ $("prompt").textContent=t; }
function clearTray(){ $("hand").innerHTML=""; $("voteRow").style.display="none"; $("voteRow").innerHTML=""; $("actions").innerHTML="";
  const br=$("betRow"); br.classList.remove("show"); br.innerHTML=""; }
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
    G._handInject = h=>done(h);
  });
}
/* imposter-only: spend table chips for a guaranteed real word, on demand,
   instead of waiting on the passive heardCrewWords-based unlock. */
function offerClueButton(){
  if(clueBought[0] || chipCounts[0] < CLUE_COST) return;
  if(!unused(G.card.subtle.concat(G.card.medium)).length) return;
  const act=$("actions");
  const b=document.createElement("button"); b.className="ghostBtn"; b.textContent=fmt(STR.buy_clue,{n:CLUE_COST});
  b.onclick=()=>{
    const pool = unused(G.card.subtle.concat(G.card.medium));
    if(clueBought[0] || chipCounts[0]<CLUE_COST || !pool.length) return;
    clueBought[0]=true;
    chipCounts[0]-=CLUE_COST; rebuildChipStack(0);
    if(G._handInject) G._handInject({w:pick(pool), tier:"subtle"});
  };
  act.appendChild(b);
}
function offerVote(){
  return new Promise(res=>{
    const row=$("voteRow"); row.innerHTML=""; row.style.display="flex";
    for(const s of aliveSeats()){
      if(s===0) continue;
      const b=document.createElement("button"); b.className="voteBtn"; b.dataset.seat=s;
      const nm = npcName(actors[s].npc);
      b.innerHTML=`<span class="chip" style="background:${actors[s].npc.chip}">${nm[0]}</span>
        <span class="nm">${nm}</span><span class="tally"></span>`;
      b.onclick=()=>res(s);
      row.appendChild(b);
    }
  });
}

/* ---------------- side bets: an extra, optional wager on TOP of the
   automatic table-chip redistribution — the player predicts which seat
   dies this round, staking coins from their persistent bank. Fair odds:
   win pays stake×(seats alive at bet time − 1), a wrong guess or a seat
   that survives loses the stake outright, and a round where nobody dies
   (tie / proved innocent) refunds it in full. ---------------- */
const MIN_STAKE = 5;
function offerBet(){
  if(coins < MIN_STAKE) return Promise.resolve(null);
  const alive = aliveSeats();
  if(alive.length < 2) return Promise.resolve(null);
  return new Promise(res=>{
    const row=$("betRow"); row.innerHTML=""; row.classList.add("show");
    const seatsWrap=document.createElement("div"); seatsWrap.className="betSeats"; row.appendChild(seatsWrap);
    setPrompt(STR.bet_prompt);
    let resolved=false;
    const finish=(bet)=>{ if(resolved) return; resolved=true; row.classList.remove("show"); row.innerHTML=""; setPrompt(""); res(bet); };
    const skip=document.createElement("button"); skip.className="ghostBtn"; skip.textContent=STR.bet_skip;
    skip.onclick=()=>finish(null);
    for(const s of alive){
      const b=document.createElement("button"); b.className="betBtn"; b.dataset.seat=s;
      const nm = nameOf(s);
      const chipColor = s===0 ? "#e08a2e" : actors[s].npc.chip;
      b.innerHTML=`<span class="chip" style="background:${chipColor}">${nm[0]}</span><span class="nm">${nm}</span>`;
      b.onclick=()=>{
        seatsWrap.querySelectorAll(".betBtn").forEach(x=>x.classList.toggle("picked", x===b));
        showStakeStep(s);
      };
      seatsWrap.appendChild(b);
    }
    row.appendChild(skip);
    function showStakeStep(seat){
      const old = row.querySelector(".stakeRow"); if(old) old.remove();
      const stakeWrap=document.createElement("div"); stakeWrap.className="stakeRow";
      const small = Math.min(coins, Math.max(MIN_STAKE, Math.round(coins*0.1)));
      const medium = Math.min(coins, Math.max(MIN_STAKE, Math.round(coins*0.25)));
      const seen = new Set();
      for(const [amt,lbl] of [[small,STR.bet_stake_small],[medium,STR.bet_stake_medium],[coins,STR.bet_stake_allin]]){
        if(amt < MIN_STAKE || seen.has(amt)) continue;
        seen.add(amt);
        const b=document.createElement("button"); b.className="ghostBtn"; b.textContent=fmt(lbl,{n:amt});
        b.onclick=()=>{
          const pileCount = Math.min(14, Math.max(2, Math.round(amt/5)));
          play("click");
          flyChipsBetween(chipSlotBase(0), tableCenterPos(), pileCount).then(flyers=>{ betPileChips = flyers; });
          finish({seat, amount:amt, aliveCount:alive.length, pileCount});
        };
        stakeWrap.appendChild(b);
      }
      row.appendChild(stakeWrap);
    }
  });
}
function resolveBet(bet, victim, died){
  if(!bet) return;
  const pile = betPileChips; betPileChips = [];
  if(!died){
    play("click");
    flyExistingTo(pile, chipSlotBase(0));
    setBanner(STR.bet_push, 1800);
    return;
  }
  if(victim===bet.seat){
    const profit = bet.amount * (bet.aliveCount - 1);
    coins += profit;
    try{ localStorage.setItem("coins", String(coins)); }catch(e){}
    updateCoinTag();
    play("click");
    flyExistingTo(pile, chipSlotBase(0));
    const bonus = Math.min(10, Math.max(0, Math.round(profit/10) - pile.length));
    if(bonus>0) flyChipsBetween(tableCenterPos(), chipSlotBase(0), bonus).then(flyers=>{ for(const c of flyers) scene.remove(c); });
    setBanner(fmt(STR.bet_win,{a:profit}), 2000);
  } else {
    coins = Math.max(0, coins - bet.amount);
    try{ localStorage.setItem("coins", String(coins)); }catch(e){}
    updateCoinTag();
    play("click");
    sweepAwayChips(pile);
    setBanner(fmt(STR.bet_lose,{a:bet.amount}), 2000);
  }
}

/* ---------- actor animation cues ---------- */
async function npcSpeak(seat, text, extraThink=0){
  const a=actors[seat], npc=a.npc;
  setPrompt(fmt(STR.prompt_waiting,{n:npcName(npc)}));
  const think = npc.thinkMs[0] + rng()*(npc.thinkMs[1]-npc.thinkMs[0]) + extraThink;
  a.lean = 1;
  await sleep(think);
  showBubble(seat, npcName(npc), text, 2400);
  a.talk = 2400;   // drives the talking head-bob in the update loop
  // the rest of the table turns to look at whoever's speaking
  for(const o of aliveSeats()){
    if(o===seat || o===0 || !actors[o] || rng()<0.4) continue;
    glanceAt(o, seat);
  }
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
// flips which end of the detected barrel axis is the actual muzzle (the
// axis-detection in layFlat can't tell barrel from grip on its own). If
// the gun ever aims exactly backward again, this is the one thing to flip.
const GUN_BARREL_SIGN = 1;
/* the execution now uses the condemned seat's OWN revolver — the one lying
   in front of them on the felt. It rises off the table in front of them,
   turns back on its owner, holds the beat, and fires. No shared center
   gun anymore; the sentence arrives from your own iron, roulette-style. */
async function executeSeat(victim, wasImp){
  play("drum");
  const gun = seatGuns[victim] || revolver;
  const headY = 1.25;
  const target = victim===0 ? new THREE.Vector3(0, headY, 1.45) : SEATS[victim].pos.clone().setY(headY);
  // hover point: pulled in toward the table center from the victim's seat,
  // raised near head height, so the muzzle faces back at its owner
  const up = victim===0
    ? new THREE.Vector3(0.12, headY-0.1, 0.75)
    : SEATS[victim].pos.clone().multiplyScalar(0.55).setY(headY-0.1);
  // aim via quaternion, built the roll-safe way: lookAt() gives a roll-free
  // rotation pointing local -Z at the target; compose it with the fixed
  // correction that maps the detected barrel axis onto -Z (see the vote
  // guns' gunFlatAimEuler for the same approach, minus the pitch).
  const _dummy = new THREE.Object3D();
  _dummy.position.copy(up);
  _dummy.up.set(0,1,0);
  _dummy.lookAt(target);
  const barrelLocal = (revolver.userData.barrelAxis || new THREE.Vector3(0,0,1)).clone().multiplyScalar(GUN_BARREL_SIGN);
  const axisRemap = new THREE.Quaternion().setFromUnitVectors(barrelLocal, new THREE.Vector3(0,0,-1));
  const aimQuat = _dummy.quaternion.clone().multiply(axisRemap);
  const aimEuler = new THREE.Euler().setFromQuaternion(aimQuat, "XYZ");
  await tweenTo(gun, gun.position.clone().add(new THREE.Vector3(0,0.3,0)), {x:0, y:gun.rotation.y, z:0}, 900); // slow level lift off the felt
  await tweenTo(gun, up, {x:aimEuler.x, y:aimEuler.y, z:aimEuler.z}, 700);   // turns back on its owner
  await sleep(900);                                                          // the dramatic pause

  // the majority vote is final — whoever's picked is out, guilty or not.
  play("shot");
  flash();
  gunKick(gun);
  actors[victim].alive = false;
  await loseChipsToTable(victim);
  await sleep(wasImp ? 3000 : 2000);

  // the gun drops back onto the felt where it always sat
  const rest = gun.userData.rest || { pos: revolverHome, rot: {x:0, y:rng()*6.28, z:0} };
  await tweenTo(gun, rest.pos, rest.rot, 700);
}
async function gunKick(gun){
  const r0={x:gun.rotation.x, y:gun.rotation.y, z:gun.rotation.z};
  const p0=gun.position.clone();
  await tweenTo(gun, p0.clone().add(new THREE.Vector3(0,0.07,0)), {x:r0.x-0.4, y:r0.y, z:r0.z}, 70);
  await tweenTo(gun, p0, r0, 280);
}

/* ---------------- chairs ---------------- */
function makeChair(){
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({color:0x301e0f, roughness:0.9});
  const dark = new THREE.MeshStandardMaterial({color:0x211307, roughness:0.95});
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
/* a plain bar stool — real geometry, no backrest; seatColor picks the top
   (default worn wood, or red vinyl for the cyberpunk-bar rows) */
function makeStool(seatColor=0x3a2818){
  const g = new THREE.Group();
  g.name = "barStool";
  const seatMat = new THREE.MeshStandardMaterial({color:seatColor, roughness:0.6});
  const iron = new THREE.MeshStandardMaterial({color:0x2c2c2e, roughness:0.5, metalness:0.6});
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,0.05,16), seatMat);
  seat.position.y = 0.62; g.add(seat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,8), iron);
  pole.position.y = 0.32; g.add(pole);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.015,6,16), iron);
  ring.rotation.x = Math.PI/2; ring.position.y = 0.22; g.add(ring);
  for(const a of [0,2.1,4.2]){
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.35,6), iron);
    leg.position.set(Math.sin(a)*0.14, 0.05, Math.cos(a)*0.14);
    leg.rotation.z = Math.sin(a)*0.25; leg.rotation.x = -Math.cos(a)*0.25;
    g.add(leg);
  }
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
  for(let i=0;i<SEAT_COUNT;i++){
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
  resetChipStakes();
  cardBusy = true; cardFlipped = false;
  play("card");
  // reset cards to their table spots (back design up)
  for(const c of cards){
    c.position.copy(c.userData.home.p); c.rotation.copy(c.userData.home.r);
    c.userData.mesh.material.map = cardBackTex; c.userData.mesh.material.needsUpdate = true;
  }
  setPrompt(STR.deal_prompt);
  // NPCs lift their cards to read them (faces tilted away from you)
  const npcPeeks = ALL_SEATS.slice(1).map(async (i, k)=>{
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
  myFaceTex = cardFaceTexture(G.imposterSeat===0);
  await sleep(200);
  const holdP = new THREE.Vector3(0.08, 1.26, 0.72);
  const dummy = new THREE.Object3D(); dummy.position.copy(holdP); dummy.lookAt(CAM_BASE);
  await tweenTo(mine, holdP, {x:dummy.rotation.x, y:dummy.rotation.y, z:dummy.rotation.z+0.05}, 650);
  mine.userData.mesh.material.map = myFaceTex; mine.userData.mesh.material.needsUpdate = true;
  setPrompt(STR.tap_to_place);
  await waitTap(8000);
  mine.userData.mesh.material.map = cardBackTex; mine.userData.mesh.material.needsUpdate = true;
  await tweenTo(mine, mine.userData.home.p, mine.userData.home.r, 550);
  await Promise.all(npcPeeks);
  setPrompt("");
  cardBusy = false;
}

/* ---- your table card: click it to flip and read, click again to flip back ---- */
let myFaceTex=null, cardFlipped=false, cardBusy=false;
async function flipMyCard(){
  if(cardBusy || !worldReady || !myFaceTex || !cards[0]) return;
  cardBusy = true;
  const mine = cards[0], h = mine.userData.home;
  play("card");
  if(!cardFlipped){
    await tweenTo(mine, h.p.clone().add(new THREE.Vector3(0,0.1,0)), {x:-1.05, y:0, z:0}, 240);
    mine.userData.mesh.material.map = myFaceTex; mine.userData.mesh.material.needsUpdate = true;
    await tweenTo(mine, h.p.clone().add(new THREE.Vector3(0,0.15,0)), {x:-0.5, y:0, z:0}, 240);
    cardFlipped = true;
  } else {
    await tweenTo(mine, h.p.clone().add(new THREE.Vector3(0,0.1,0)), {x:-1.05, y:0, z:0}, 200);
    mine.userData.mesh.material.map = cardBackTex; mine.userData.mesh.material.needsUpdate = true;
    await tweenTo(mine, h.p, h.r, 260);
    cardFlipped = false;
  }
  cardBusy = false;
}
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown", e=>{
  if(!worldReady || !myFaceTex || !cards[0]) return;
  const r = renderer.domElement.getBoundingClientRect();
  _ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  _ray.setFromCamera(_ndc, camera);
  if(_ray.intersectObject(cards[0], true).length) flipMyCard();
});

/* ---------------- match flow ---------------- */
async function runMatch(){
  newMatch();
  await dealCardsSequence();
  setBanner("", 1);
  let order = aliveSeats();

  matchLoop:
  while(!G.over){
    $("roundTag").textContent = fmt(STR.round_tag,{r:G.round,max:G.maxRounds});
    // ---- word round: everyone speaks every round, no early vote — the
    // table always plays out the full RULES.maxRounds before deciding ----
    for(const seat of aliveSeats()){
      if(seat===0){
        setPrompt(STR.prompt_your_turn);
        $("actions").innerHTML="";
        const isImp = G.imposterSeat===0;
        if(isImp) offerClueButton();
        const h = await offerHand(isImp ? imposterHand() : crewHand());
        $("actions").innerHTML="";
        if(h){
          showBubble(0, STR.you, h.w, 2000);
          registerWord(0,h.w);
          // the table looks over when you speak, same as for anyone else
          for(const o of aliveSeats()){
            if(o!==0 && actors[o] && rng()<0.6) glanceAt(o, 0);
          }
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
    // ---- vote: only once the full round count is played ----
    if(G.round>=G.maxRounds){
      const result = await doVote();
      if(G.over) break matchLoop;
      if(result==="tie"){ G.round = G.maxRounds; }      // one more word round, then re-vote
      else { G.round=1; G.maxRounds=3; }                // a seat is out — shorter cycles from here on
    } else {
      G.round++;
    }
  }
}
async function doVote(){
  clearTray();
  $("roundTag").textContent = STR.vote_tag;
  const bet = await offerBet();
  setPrompt(STR.prompt_vote);
  play("drum");
  const votes = {};
  const chosenBy = {}; // seat -> who they voted for, so a wrong majority can be penalized afterward
  // player votes via UI
  const myPick = await offerVote();
  votes[myPick]=(votes[myPick]||0)+1; chosenBy[0]=myPick;
  aimSeatGun(0, myPick);   // your own iron comes up and points at your pick
  updateTallies(votes);
  await sleep(500);
  // npcs vote with reveal bubbles
  for(const o of aliveSeats()){
    if(o===0) continue;
    const t = npcVote(o);
    chosenBy[o]=t;
    glanceAt(o,t);
    aimSeatGun(o, t);      // their revolver swings onto whoever they named
    await sleep(500+rng()*600);
    showBubble(o, npcName(actors[o].npc), nameOf(t), 1500);
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
    restAllGuns();          // dead even — everyone lowers their iron
    await sleep(2100);
    resolveBet(bet, null, false);
    return "tie";
  }
  const victim=top[0];
  const wasImp = victim===G.imposterSeat;
  clearTray();
  setBanner(victim===0?STR.banner_you_shot:fmt(STR.banner_shot,{n:nameOf(victim)}), 2400);
  // the majority vote is final now — whoever's picked is out, guilty or
  // not. No more "prove innocence" chance: being wrongly accused is a
  // real, permanent cost, not something you can roll your way out of.
  await executeSeat(victim, wasImp);
  restAllGuns();            // the shot's fired — the standoff breaks
  setBanner(fmt(wasImp?STR.banner_was_imposter:STR.banner_was_innocent,{n:nameOf(victim)}), 2200);
  if(victim!==0){ const p=plateEls[victim]; if(p) p.classList.add("dead"); }
  await sleep(2300);
  resolveBet(bet, victim, true);
  if(bet) await sleep(2000);
  // the table just wrongly executed an innocent seat. Every voter who
  // picked them permanently loses two word options, and the chips they're
  // fined go entirely to the seat they wrongly killed — small, regular
  // compensation, not spread out to the rest of the table. The imposter
  // also walks away from the table's mistake with a free real word.
  if(!wasImp){
    const wrongVoters = Object.keys(chosenBy).filter(s=>+chosenBy[s]===victim).map(Number);
    if(wrongVoters.length){
      for(const w of wrongVoters) G.handPenalty[w]+=2;
      await punishWrongVoters(wrongVoters, victim);
    }
    G.impBonusClues = (G.impBonusClues||0) + 1;
  }
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
  h.innerHTML=map[kind][0];
  const net = bankTableResult();
  p.textContent = fmt(map[kind][1],vars) + (net>0 ? "  "+fmt(STR.coins_earned,{n:net}) : net<0 ? "  "+fmt(STR.coins_lost,{n:-net}) : "");
  $("startBtn").textContent=STR.play_again;
  $("loadNote").textContent="";
  t.classList.remove("hidden");
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
  for(let i=1;i<SEAT_COUNT;i++){
    const a=actors[i]; if(!a||!a.inner) continue;
    a.breathe += dt*0.0016;
    const breatheAmt = a.alive ? Math.sin(a.breathe)*0.012 : 0;
    const targetLean = a.alive ? (a.lean?0.12:0) : 0;
    a._leanCur = (a._leanCur??0) + ((targetLean)-(a._leanCur??0))*0.08;
    const targetSlump = a.alive?0:1;
    a.slump += (targetSlump-a.slump)*0.03;
    a.glance = Math.max(0, a.glance - dt*0.0007);
    const g = a.glance>0 ? Math.sin(Math.min(1,a.glance)*Math.PI)*a.glanceDir*0.55 : 0;
    // talking: while their speech bubble is up, a quick head-bob and a
    // slight side tilt — reads as actually saying the word, not freezing
    let talkNod = 0, talkTilt = 0;
    if(a.talk>0 && a.alive){
      a.talk -= dt;
      talkNod  = Math.sin(clock.t*0.024)*0.028;
      talkTilt = Math.sin(clock.t*0.017)*0.02;
    }
    // idle fidget: every few seconds a brief weight-shift in the chair, so
    // nobody sits perfectly still like a mannequin between turns
    if(a.alive){
      if(a.nextFidget===undefined) a.nextFidget = clock.t + 2000 + rng()*5000;
      if(clock.t >= a.nextFidget){
        a.fidgetT = 700; a.fidgetDir = rng()<0.5?-1:1;
        a.nextFidget = clock.t + 3500 + rng()*6000;
      }
    }
    let fidget = 0;
    if(a.fidgetT>0){
      a.fidgetT -= dt;
      fidget = Math.sin((1 - Math.max(0,a.fidgetT)/700)*Math.PI) * 0.045 * (a.fidgetDir||1);
    }
    // a dead seat's "slump" used to pitch forward 1.15rad (~66°) and sink
    // 0.35 units — enough to rotate/drop the body down into (and behind)
    // the table geometry from most camera angles instead of reading as
    // "gone limp in their chair". Toned down to a believable head-down
    // slump that stays above the tabletop.
    a.inner.rotation.x = a._leanCur + a.slump*0.45 + breatheAmt*0.4 + talkNod;
    a.inner.rotation.y = g;
    a.inner.rotation.z = talkTilt + fidget;
    a.inner.position.y = (a.baseY||0) - a.slump*0.1;
    a.inner.scale.y = a.inner.scale.x * (1+breatheAmt); // uses normalize's uniform scale as base
  }
  // candle flicker
  candle.intensity = 3.4 + Math.sin(clock.t*0.011)*0.3 + Math.sin(clock.t*0.037)*0.2;
  // ambient life: the ceiling fan turns lazily, the neon sign mostly holds
  // steady but occasionally stutters like a real tube running low
  if(ceilingFan) ceilingFan.rotation.y += dt*0.0011;
  // background bartender/patrons: a slow idle bob, nothing more — pure
  // ambient life, not part of the game's own actor/AI system
  for(const f of bgFigures){
    f.phase += dt*0.0011;
    f.obj.position.y = f.baseY + Math.sin(f.phase)*f.bob;
  }
  if(neonSignMat){
    const stutter = (Math.sin(clock.t*0.0027)>0.982) ? 0.15+rng()*0.3 : 1;
    neonSignMat.emissiveIntensity = stutter;
  }
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
  for(const i of ALL_SEATS){
    const b=bubbleEls[i];
    if(b){
      if(+b.dataset.hideAt < clock.t) b.classList.remove("show");
      let p = i===0 ? {x:innerWidth/2, y:innerHeight*0.72} : headScreenPos(i,2.05);
      if(p && !p.behind){ if(i>0) p = clampBubblePos(p); b.style.left=p.x+"px"; b.style.top=p.y+"px"; }
    }
    if(i>0 && actors[i] && actors[i].group){
      const pl = plateEls[i] || mkPlate(i, npcName(actors[i].npc));
     const p = headScreenPos(i, 1.9);
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
applyStaticStrings();
$("roundTag").textContent="";
loadWorld().then(()=>{ $("loadNote").textContent=""; });
$("startBtn").onclick = ()=>{
  unlockAudio();
  $("title").classList.add("hidden");
  runMatch();
};
requestAnimationFrame(frame);
