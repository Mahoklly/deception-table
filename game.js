// The Deception Table — solo social deduction at a tavern table.
// three.js scene + HTML overlay UI. Fixed-timestep sim, seeded RNG, command-object input.
import * as THREE from "three";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { STR, fmt, getLang, setLang, LANG_LABELS } from "./strings.js";
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
  const a = new Audio(assetSrc(id==="music"?"music_tavern":id==="shot"?"sfx_gunshot":id==="click"?"sfx_click":id==="card"?"sfx_card":"sfx_drum", file));
  a.crossOrigin="anonymous";
  a.preload="auto";
  a.loop=loop;
  a.volume = vol;
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
  document.getElementById("settingsLanguageLabel").textContent = STR.settings_language_label;
  document.getElementById("closeSettingsBtn").textContent = STR.settings_close;
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
  for(const i of [1,2,3]){
    const p = plateEls[i];
    if(p && actors[i] && actors[i].npc) p.querySelector(".nm").textContent = npcName(actors[i].npc);
  }
}
langEnBtn.addEventListener("click", ()=>changeLang("en"));
langKuBtn.addEventListener("click", ()=>changeLang("ku"));
updateLangButtons();

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
lantern.castShadow = true;
lantern.shadow.mapSize.set(1024,1024);
lantern.shadow.camera.near = 0.3; lantern.shadow.camera.far = 14; lantern.shadow.bias = -0.0025;
const rim = new THREE.DirectionalLight(0x5a3c22, 0.9); rim.position.set(-3,2.5,-4); scene.add(rim);
/* generic helper: flag every mesh in a subtree to cast/receive real-time shadows */
function enableShadow(obj, cast=true, recv=true){
  obj.traverse(m=>{ if(m.isMesh){ m.castShadow = cast; m.receiveShadow = recv; } });
  return obj;
}

/* floor: real ground-plane geometry, physically lit and shadow-receiving */
const ROOM_R = 6.6, WALL_H = 4.3;
const texLoader = new THREE.TextureLoader();
/* Higgsfield-generated seamless material photos, tiled with real UV repeat
   onto real geometry — not baked into a flat backdrop image. `material`
   keeps its flat fallback color (and no map) until the photo actually
   loads, so a slow/broken fetch never leaves the surface unlit black. */
function applyRepeatTex(material, key, file, rx, ry, tint=0xffffff){
  texLoader.load(assetSrc(key, file), tex=>{
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
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
// where the bar station goes on the wall polygon (also anchors the sign + shelf)
const BAR_ANGLE = Math.PI;   // dead-center on the back wall, facing the player across the table
function wallPoint(ang, inset=0){
  const r = ROOM_R - inset;
  return new THREE.Vector3(Math.sin(ang)*r, 0, Math.cos(ang)*r);
}
const floorMat = new THREE.MeshStandardMaterial({color:0x2a1a10, roughness:0.9});
applyRepeatTex(floorMat, "tex_wood_floor","tex_wood_floor.jpg", 6, 6);   // no tint — let the real photo read as-is
const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 48), floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
let roomGroup = null;

/* ---- true 3D bar room: walled polygon, beamed ceiling, neon sconces ----
   Real box/cylinder geometry with physical X/Y/Z coordinates — no flat
   backdrop image or skybox trick. Replaced at runtime if a Higgsfield-
   generated room_tavern.glb is hooked up (see loadWorld()). */
function buildRoom(){
  const g = new THREE.Group();
  const SIDES = 10, segAngle = (Math.PI*2)/SIDES;
  const segW = 2*ROOM_R*Math.tan(segAngle/2)*1.03;

  // a faint baseline emissive keeps the walls from ever reading as pure black
  // when they're far from every point light, without faking flat unlit color
  const plaster = new THREE.MeshStandardMaterial({color:0x4a3a26, roughness:0.95, emissive:0x140d06, emissiveIntensity:0.7});
  const trim    = new THREE.MeshStandardMaterial({color:0x2a1d10, roughness:0.9, emissive:0x0c0704, emissiveIntensity:0.6});
  const beamMat = new THREE.MeshStandardMaterial({color:0x241708, roughness:0.85, emissive:0x0a0603, emissiveIntensity:0.6});
  applyRepeatTex(plaster, "tex_wood_wall","tex_wood_wall.jpg", segW/2.1, WALL_H/2.1);   // no tint — let the real photo read as-is

  for(let i=0;i<SIDES;i++){
    const ang = segAngle*i;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segW, WALL_H, 0.28), plaster);
    wall.position.set(Math.sin(ang)*ROOM_R, WALL_H/2, Math.cos(ang)*ROOM_R);
    wall.rotation.y = ang;
    g.add(wall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.24, 0.34), trim);
    base.position.set(Math.sin(ang)*ROOM_R, 0.12, Math.cos(ang)*ROOM_R);
    base.rotation.y = ang;
    g.add(base);
  }
  // beamed ceiling — a real cap mesh plus radiating box beams above the lantern
  const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_R*1.02, ROOM_R*1.02, 0.22, SIDES),
    new THREE.MeshStandardMaterial({color:0x120b06, roughness:0.95, side:THREE.DoubleSide}));
  ceiling.position.y = WALL_H;
  g.add(ceiling);
  for(let i=0;i<6;i++){
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2, ROOM_R*1.9), beamMat);
    beam.position.y = WALL_H - 0.16;
    beam.rotation.y = (Math.PI/6)*i;
    g.add(beam);
  }
  // small brass wall lamps — dome shade + warm bulb, reclaimed-industrial
  // touch instead of neon; each throws its own soft amber pool on the wood
  for(const ang of [segAngle*1.5, segAngle*3.5, segAngle*6.5, segAngle*8.5]){
    const wx = Math.sin(ang)*(ROOM_R-0.18), wz = Math.cos(ang)*(ROOM_R-0.18);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,0.1), trim);
    bracket.position.set(wx, 2.1, wz); bracket.rotation.y = ang; g.add(bracket);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 12, 1, true),
      new THREE.MeshStandardMaterial({color:0x6a4a20, roughness:0.4, metalness:0.6, side:THREE.DoubleSide}));
    shade.position.set(wx, 2.32, wz); shade.rotation.x = Math.PI; shade.rotation.y = ang;
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05,10,8),
      new THREE.MeshStandardMaterial({color:0xffcf8a, emissive:0xffa030, emissiveIntensity:2.4}));
    bulb.position.set(wx, 2.24, wz); g.add(bulb);
    const wash = new THREE.PointLight(0xffa855, 1.3, 6, 1.8);
    wash.position.set(wx, 2.2, wz); g.add(wash);
  }
  // neon "BAR" sign — a real plane mounted flush on the wall, above the
  // bar canopy: it only reads from nearby, exactly like a real hung sign
  {
    const signMat = new THREE.MeshStandardMaterial({color:0x0a0705, roughness:0.6, emissive:0x000000});
    applyOnceTex(signMat, "tex_neon_bar","tex_neon_bar.jpg");
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1), signMat);
    const sp = wallPoint(BAR_ANGLE, 0.14);
    sign.position.set(sp.x, 3.4, sp.z);
    sign.rotation.y = BAR_ANGLE + Math.PI;
    g.add(sign);
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
  const SEG = (Math.PI*2)/10;
  const steel   = new THREE.MeshStandardMaterial({color:0x201a16, roughness:0.5, metalness:0.55});
  const leather = new THREE.MeshStandardMaterial({color:0x3a2418, roughness:0.6});
  const wood    = new THREE.MeshStandardMaterial({color:0x3a2412, roughness:0.85});
  const darkTop = new THREE.MeshStandardMaterial({color:0x1c140c, roughness:0.6});
  const brass   = new THREE.MeshStandardMaterial({color:0x8a6a30, roughness:0.35, metalness:0.75});

  // mounts a flat artwork plane flush on a wall, with a black steel frame
  const wallArt = (ang, w, h, y, key, file, glow)=>{
    const mat = new THREE.MeshStandardMaterial({color:0x2e2a24, roughness:0.9});
    applyOnceTex(mat, key, file, glow);
    const p = wallPoint(ang, 0.16);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat);
    art.position.set(p.x, y, p.z); art.rotation.y = ang + Math.PI;
    g.add(art);
    for(const [fw,fh,fx,fy] of [[w+0.08,0.05,0,h/2+0.02],[w+0.08,0.05,0,-h/2-0.02],[0.05,h,-w/2-0.02,0],[0.05,h,w/2+0.02,0]]){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,0.04), steel);
      bar.position.set(fx,fy,0.01);
      art.add(bar);
    }
  };
  // street-art mural and poster/sticker collage read fine as cluttered bar
  // wall art either way — kept as the room's "environmental storytelling"
  wallArt(1.85, 2.0, 2.0, 1.95, "tex_graffiti_mural","tex_graffiti_mural.jpg", 0.3);
  wallArt(4.78, 1.3, 1.3, 1.85, "tex_posters","tex_posters.jpg", 0.28);

  // reclaimed black-steel columns on the wall joints the lamps don't occupy
  for(const i of [0.5, 2.5, 4.5, 5.5, 7.5, 9.5]){
    const p = wallPoint(SEG*i, 0.1);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.1, WALL_H, 0.1), steel);
    col.position.set(p.x, WALL_H/2, p.z); col.rotation.y = SEG*i;
    g.add(col);
  }

  // one small red neon accent — a simple diamond outline, the reference's
  // single cool-colored sign against an otherwise all-warm room
  {
    const m = new THREE.MeshStandardMaterial({color:0xff2020, emissive:0xff2020, emissiveIntensity:2.2, roughness:0.4});
    const p = wallPoint(2.15, 0.15), grp = new THREE.Group();
    grp.position.set(p.x, 2.1, p.z); grp.rotation.y = 2.15 + Math.PI;
    for(const rot of [0.78, -0.78]){
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.55, 0.035), m);
      b.rotation.z = rot; b.position.x = rot>0 ? -0.19 : 0.19;
      grp.add(b);
    }
    g.add(grp);
    const wash = new THREE.PointLight(0xff2020, 0.8, 3.5, 2);
    wash.position.copy(grp.position); g.add(wash);
  }

  // ---- the bar station: warm wooden counter with a backlit liquor shelf ----
  // built in wall-local coordinates (x along the wall, +z into the room)
  {
    const bar = new THREE.Group();
    bar.position.copy(wallPoint(BAR_ANGLE, 0));
    bar.rotation.y = BAR_ANGLE + Math.PI;
    // real backlit-shelf photo (rows of bottles against a lit mirror) instead
    // of a flat emissive color card — falls back to a plain amber panel only
    // until/unless the photo loads
    const glowPanelMat = new THREE.MeshStandardMaterial({color:0xffb060, emissive:0xffa040, emissiveIntensity:0.55});
    applyOnceTex(glowPanelMat, "tex_backlit_shelf","tex_backlit_shelf.jpg", 0.65);
    const glowPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.7), glowPanelMat);
    glowPanel.position.set(0, 1.35, 0.3); bar.add(glowPanel);
    // reclaimed-wood canopy over the counter, hung with a row of bare bulbs
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.1,1.6), wood);
    canopy.position.set(0, 2.78, 1.1); bar.add(canopy);
    for(let i=0;i<9;i++){
      const bx = -1.75 + i*0.44;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.14,4), new THREE.MeshBasicMaterial({color:0x0a0a0a}));
      cord.position.set(bx, 2.66, 1.9); bar.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),
        new THREE.MeshStandardMaterial({color:0xffd898, emissive:0xffb050, emissiveIntensity:2.8}));
      bulb.position.set(bx, 2.58, 1.9); bar.add(bulb);
    }
    // long wooden counter with a polished brass trim along its front edge
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4,1.0,0.5), wood);
    counter.position.set(0, 0.5, 1.45); bar.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.05,0.66), darkTop);
    top.position.set(0, 1.03, 1.45); bar.add(top);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.04,0.04), brass);
    trim.position.set(0, 1.0, 1.79); bar.add(trim);
    const warmGlow = new THREE.PointLight(0xffab5a, 2.0, 7, 1.6);
    warmGlow.position.set(0, 1.4, 1.9); bar.add(warmGlow);
    // glowing tank on the counter — the reference's one cool blue-violet
    // accent against all the warm amber; a translucent box + inner light
    const tank = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.36,0.32),
      new THREE.MeshPhysicalMaterial({color:0x2a5aff, transparent:true, opacity:0.35, roughness:0.1, metalness:0, transmission:0.4}));
    glass.position.set(1.35, 1.24, 1.55); tank.add(glass);
    const tankLight = new THREE.PointLight(0x6a4aff, 1.3, 2.4, 2);
    tankLight.position.set(1.35, 1.24, 1.55); tank.add(tankLight);
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
    const dp = wallPoint(2.85, 0.13);
    board.position.set(dp.x, 1.7, dp.z); board.rotation.z = Math.PI/2; board.rotation.y = 2.85;
    g.add(board);
  }

  // crossed reclaimed-wood beams — simple wall ornament, right side wall
  {
    const cp = wallPoint(1.5, 0.12), grp = new THREE.Group();
    grp.position.set(cp.x, 2.5, cp.z); grp.rotation.y = 1.5 + Math.PI;
    for(const rot of [0.7, -0.7]){
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.06), wood);
      beam.rotation.z = rot; grp.add(beam);
    }
    g.add(grp);
  }

  // pennant bunting — small triangular flags strung along a slack curve,
  // generic red/white/blue stripes (no real flag or logo), festive clutter
  {
    const colors = [0xb02020, 0xd8d0c0, 0x20408a];
    const p0 = wallPoint(0.15, 0.3); p0.y = WALL_H - 0.55;
    const p1 = wallPoint(1.05, 0.3); p1.y = WALL_H - 0.75;
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

  // leather booth against the right wall
  {
    const ang = 1.2, p = wallPoint(ang, 0.55);
    const booth = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.14), leather);
    back.position.y = 0.75; booth.add(back);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.6), leather);
    seat.position.set(0, 0.42, 0.3); booth.add(seat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.55), wood);
    base.position.set(0, 0.17, 0.3); booth.add(base);
    booth.position.set(p.x, 0, p.z); booth.rotation.y = ang + Math.PI;
    g.add(booth);
  }

  // low wooden cocktail tables with a worn stool each
  const cocktail = (ang, inset)=>{
    const p = wallPoint(ang, inset), grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 14), steel);
    base.position.y = 0.02; grp.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 8), steel);
    stem.position.y = 0.5; grp.add(stem);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 16), wood);
    top.position.y = 1.0; grp.add(top);
    grp.position.set(p.x, 0, p.z);
    g.add(grp);
    const stool = makeStool(0x241812);
    const sp = wallPoint(ang + 0.09, inset - 0.35);
    stool.position.copy(sp);
    g.add(stool);
  };
  cocktail(2.55, 1.9);
  cocktail(3.9, 1.9);

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
    // large foreground lamp, low and close over a seat — echoes the
    // reference's big cropped orange shade in the near corner
    const pf = wallPoint(BAR_ANGLE-1.6, 2.6);
    pendant(pf.x, pf.z, 2.0, 0.42, true);
    const pl = wallPoint(BAR_ANGLE-0.18, 2.3), pr = wallPoint(BAR_ANGLE+0.18, 2.3);
    pendant(pl.x, pl.z, 2.55, 0.28, true);
    pendant(pr.x, pr.z, 2.55, 0.28, false);
    const pb = wallPoint(1.2, 1.0);
    pendant(pb.x, pb.z, 2.5, 0.26, false);
    const pc = wallPoint(2.55, 1.9);
    pendant(pc.x, pc.z, 2.45, 0.26, false);
    const pd = wallPoint(3.9, 1.9);
    pendant(pd.x, pd.z, 2.45, 0.26, true);
  }

  scene.add(g);
  enableShadow(g);
  return g;
}
buildRoadhouseBar();

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
/* some source GLBs (this revolver included) are authored standing upright
   rather than lying on their side — whatever axis came out tallest after
   normalize() is presumably the barrel-to-grip length, not real height, so
   tip it onto its side and re-ground/re-center against the fresh box. */
function layFlat(obj, groundY=0){
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if(size.y > size.x && size.y > size.z){
    obj.rotation.x = Math.PI/2;
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z;
    obj.position.y += groundY - box2.min.y;
  }
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
  for(let i=0;i<4;i++) if(chipStacks[i]) rebuildChipStack(i);
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
const chipCounts = [0,0,0,0];
const chipStacks = [null,null,null,null];
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
  for(let i=0;i<4;i++){ chipCounts[i]=STARTING_STAKE; rebuildChipStack(i); }
}
/* animate `amount` chips flying from one seat's stack to another's, then land */
async function flyChips(fromSeat, toSeat, amount){
  if(amount<=0) return;
  const fromBase = chipSlotBase(fromSeat), toBase = chipSlotBase(toSeat);
  const flyers=[];
  for(let k=0;k<amount;k++){
    const chip = makeChip(CHIP_PALETTE[k%CHIP_PALETTE.length]);
    chip.position.copy(fromBase); chip.position.y += 0.02 + k*0.003;
    scene.add(chip); flyers.push(chip);
  }
  const steps=26;
  for(let s=1;s<=steps;s++){
    const t=s/steps;
    for(let k=0;k<flyers.length;k++){
      const delay=k*0.05;
      const lt=Math.max(0,Math.min(1,(t-delay)/(1-delay+0.0001)));
      const e=lt*lt*(3-2*lt);
      flyers[k].position.lerpVectors(fromBase,toBase,e);
      flyers[k].position.y += Math.sin(e*Math.PI)*0.16;
      flyers[k].rotation.x += 0.3;
    }
    await sleep(16);
  }
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
async function loadWorld(){
  const [gRoom, gTable, gBrute, gWidow, gFox, gGun, gBarShelf] = await Promise.all([
    loadGLB("room_tavern","room_tavern.glb"),
    loadGLB("table_tavern","table_tavern.glb"), loadGLB("char_brute","char_brute.glb"),
    loadGLB("char_widow","char_widow.glb"), loadGLB("char_fox","char_fox.glb"), loadGLB("revolver","revolver.glb"),
    loadGLB("room_bar_shelf","room_bar_shelf.glb"),
  ]);
  // swap the procedural box/beam room for a Higgsfield-generated one, if hooked up
  if(gRoom){
    if(roomGroup) scene.remove(roomGroup);
    scene.add(enableShadow(gRoom));
    roomGroup = gRoom;
  }
  // back-bar station centered behind the green-neon counter: a shelf of
  // bottles + mirror (real Higgsfield-generated prop, boxes+bottles if not
  // hooked up) plus a row of red-topped stools along the counter front
  {
    const barShelf = gBarShelf ? normalize(gBarShelf, 1.6) : (()=>{
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({color:0x3a2610, roughness:0.8});
      const mirror = new THREE.MeshStandardMaterial({color:0x223038, roughness:0.15, metalness:0.6});
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.95,0.5), wood);
      counter.position.y = 0.475; g.add(counter);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.6,0.06), mirror);
      back.position.set(0,1.2,-0.2); g.add(back);
      const bottleColors = [0x2a5a3a,0x7a2e22,0x1c3a4a,0xc7a23a];
      for(let row=0; row<2; row++) for(let i=0;i<6;i++){
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,0.22,8),
          new THREE.MeshStandardMaterial({color:bottleColors[i%4], roughness:0.25, metalness:0.05, transparent:true, opacity:0.9}));
        bottle.position.set(-0.75+i*0.28, 0.6+row*0.35, -0.15);
        g.add(bottle);
      }
      return g;
    })();
    const shelfPos = wallPoint(BAR_ANGLE, 0.35);
    barShelf.position.x = shelfPos.x; barShelf.position.z = shelfPos.z;
    barShelf.rotation.y = BAR_ANGLE + Math.PI;
    enableShadow(barShelf);
    scene.add(barShelf);
    for(const off of [-0.19, -0.065, 0.065, 0.19]){
      const stool = makeStool(0x7a1616);
      const sp = wallPoint(BAR_ANGLE + off, 2.05);
      stool.position.copy(sp);
      enableShadow(stool);
      scene.add(stool);
    }
  }
  table = gTable ? normalize(gTable, 0.95) : makePokerTable();
  enableShadow(table);
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
  enableShadow(revolver);
  revolver.position.copy(revolverHome); revolver.rotation.y = rng()*6.28;
  scene.add(revolver);
  // hard-drop the revolver onto the real table surface (measured, not guessed)
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

/* ---------------- casino coins: the player's persistent bank ----
   Persisted in localStorage so it survives reloads/new matches. Every
   match all four seats stake STARTING_STAKE chips on the felt (see the
   chip-stack system above the revolver code) and physically win/lose
   chips off each other round by round as seats get shot. At match end
   whatever the player nets at the table — up or down — settles here. */
let coins = 80;
try{ coins = parseInt(localStorage.getItem("coins"),80) || 0; }catch(e){}
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
const aliveSeats = ()=> [0,1,2,3].filter(i=>actors[i] && actors[i].alive);
const npcName = npc => getLang()==="ku" ? npc.name_ku : npc.name;
const nameOf = i => i===0 ? STR.you : npcName(actors[i].npc);

function newMatch(){
  G.card = pick(DECK[getLang()]);
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
function setupCardHUD(){ const c=$("myCard"); if(c) c.style.display="none"; }

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
        b.onclick=()=>finish({seat, amount:amt, aliveCount:alive.length});
        stakeWrap.appendChild(b);
      }
      row.appendChild(stakeWrap);
    }
  });
}
function resolveBet(bet, victim, died){
  if(!bet) return;
  if(!died){ setBanner(STR.bet_push, 1800); return; }
  if(victim===bet.seat){
    const profit = bet.amount * (bet.aliveCount - 1);
    coins += profit;
    try{ localStorage.setItem("coins", String(coins)); }catch(e){}
    updateCoinTag();
    setBanner(fmt(STR.bet_win,{a:profit}), 2000);
  } else {
    coins = Math.max(0, coins - bet.amount);
    try{ localStorage.setItem("coins", String(coins)); }catch(e){}
    updateCoinTag();
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
  const up = new THREE.Vector3(0, revolverHome.y+0.55, 0);
  const aimYaw = Math.atan2(target.x - up.x, target.z - up.z);
  const aimPitch = -Math.atan2(target.y - up.y, Math.hypot(target.x-up.x, target.z-up.z));
  await tweenTo(revolver, up, {x:0, y:revolver.rotation.y, z:0}, 1000); // slow level lift
  await tweenTo(revolver, up, {x:aimPitch, y:aimYaw, z:0}, 700);        // swing onto the target
  await sleep(900);                                                      // the dramatic pause
  
  // ----- NEW: PROVE INNOCENCE BY TYPING -----
  const isPlayer = victim === 0;
  const secretWord = G.card.secret;
  let attempts = 0;
  const maxAttempts = 2;
  let provedInnocent = false;
  
  if (isPlayer) {
    // Player was voted out — they must type the secret word
    setPrompt(STR.proveword_prompt);

    // Create input field
    const input = document.createElement("input");
    input.type = "text";
    input.id = "wordInput";
    input.placeholder = STR.proveword_placeholder;
    input.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); padding:12px 20px; font-size:24px; border:2px solid #7a2e22; border-radius:8px; background:#1a100a; color:#efe3c0; text-align:center; z-index:100; width:300px;";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = STR.confirm_btn;
    confirmBtn.style.cssText = "position:absolute; top:calc(50% + 60px); left:50%; transform:translateX(-50%); padding:10px 40px; font-size:20px; background:#7a2e22; color:#efe3c0; border:none; border-radius:8px; cursor:pointer; z-index:100;";
    
    document.body.appendChild(input);
    document.body.appendChild(confirmBtn);
    input.focus();
    
    const checkWord = async () => {
      const typed = input.value.trim().toLowerCase();
      const correct = secretWord.toLowerCase();
      const isClose = (a, b) => {
        // Simple fuzzy match: check if typed contains correct or vice versa
        if (a.includes(b) || b.includes(a)) return true;
        // Levenshtein-like: check if 80% similar
        let matches = 0;
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] === b[i]) matches++;
        }
        return (matches / maxLen) > 0.7;
      };
      
      if (typed === correct || isClose(typed, correct)) {
        provedInnocent = true;
        input.remove();
        confirmBtn.remove();
        setBanner(STR.banner_proved_innocent_you, 2000);
        setPrompt(STR.prompt_proved_innocent_you);
        play("click");
        // Player survives — keep them alive
        actors[victim].alive = true;
        resolveVote("innocent");
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          input.remove();
          confirmBtn.remove();
          setBanner(fmt(STR.banner_proved_wrong_final,{w:secretWord}), 3000);
          setPrompt(STR.prompt_proved_failed_you);
          play("shot");
          flash();
          gunKick();
          actors[victim].alive = false;
          await loseChipsToTable(victim);
          resolveVote("guilty");
        } else {
          setPrompt(fmt(STR.prompt_proved_wrong_retry,{n:maxAttempts-attempts}));
          input.value = "";
          input.focus();
          play("click");
        }
      }
    };

    confirmBtn.onclick = checkWord;
    input.onkeydown = (e) => { if (e.key === "Enter") checkWord(); };

    // Wait for resolution (the resolveVote function will continue)
    await new Promise(res => window._resolveVote = res);
  } else {
    // NPC was voted out — they must type the secret word (simulated)
    setPrompt(fmt(STR.prompt_proving_npc,{n:nameOf(victim)}));
    await sleep(1000);

    const npc = actors[victim];
    const isImp = victim === G.imposterSeat;
    let guessedCorrect = false;

    if (isImp) {
      // Imposter has a small chance to guess correctly (based on how many crew words they've heard)
      const chance = Math.min(0.15 + G.heardCrewWords * 0.05, 0.5);
      if (rng() < chance) {
        guessedCorrect = true;
      }
    } else {
      // Crew always knows the word
      guessedCorrect = true;
    }

    if (guessedCorrect) {
      setBanner(fmt(STR.banner_proved_innocent_npc,{n:nameOf(victim)}), 2500);
      setPrompt(fmt(STR.prompt_proved_innocent_npc,{n:nameOf(victim)}));
      actors[victim].alive = true;
      await sleep(2500);
    } else {
      setBanner(fmt(STR.banner_proved_imposter_npc,{n:nameOf(victim)}), 3000);
      setPrompt(fmt(STR.prompt_proved_failed_npc,{n:nameOf(victim)}));
      play("shot");
      flash();
      gunKick();
      actors[victim].alive = false;
      await loseChipsToTable(victim);
      await sleep(3000);
    }
  }
  
  // settle back down to the table, flat
  await tweenTo(revolver, up, {x:0, y:revolver.rotation.y, z:0}, 450);
  await tweenTo(revolver, revolverHome, {x:0, y:rng()*6.28, z:0}, 800);
}
async function gunKick(){
  const r0={x:revolver.rotation.x, y:revolver.rotation.y, z:revolver.rotation.z};
  const p0=revolver.position.clone();
  await tweenTo(revolver, p0.clone().add(new THREE.Vector3(0,0.07,0)), {x:r0.x-0.4, y:r0.y, z:r0.z}, 70);
  await tweenTo(revolver, p0, r0, 280);
}

// Helper function to resolve vote
function resolveVote(result) {
  if (window._resolveVote) {
    window._resolveVote();
    window._resolveVote = null;
  }
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
  const bet = await offerBet();
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
    await sleep(2100);
    resolveBet(bet, null, false);
    return "tie";
  }
  const victim=top[0];
  clearTray();
  setBanner(victim===0?STR.banner_you_shot:fmt(STR.banner_shot,{n:nameOf(victim)}), 2400);
  await executeSeat(victim);
  const died = !actors[victim].alive;
  const wasImp = victim===G.imposterSeat;
  setBanner(fmt(wasImp?STR.banner_was_imposter:STR.banner_was_innocent,{n:nameOf(victim)}), 2200);
  if(victim!==0){ const p=plateEls[victim]; if(p) p.classList.add("dead"); }
  await sleep(2300);
  resolveBet(bet, victim, died);
  if(bet) await sleep(2000);
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
$("myCard").style.display="none";
$("roundTag").textContent="";
loadWorld().then(()=>{ $("loadNote").textContent=""; });
$("startBtn").onclick = ()=>{
  unlockAudio();
  $("title").classList.add("hidden");
  runMatch();
};
requestAnimationFrame(frame);
