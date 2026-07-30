// episodes (8 movies)
const episodes = [
  { title:"Tu.Yaa.Main", desc:"The Spirit of the Beehive", time:"1h31m", src:"/movie1.mp4", cc:"/movie1.vtt" },
  { title:"John Wick 2014", desc:"Bhagyalakshmi", time:"1h57m", src:"/movie2.mp4", cc:"/movie2.vtt" },
  { title:"Sadak1991", desc:"", time:"1h49m", src:"/movie3.mp4", cc:"/movie3.vtt" },
  { title:"The Chronicles of Narnia", desc:"The Lion the Witch and the Wardrobe", time:"1h26m", src:"/movie4.mp4", cc:"/movie4.vtt" },
  { title:"ABCD (2013)", desc:"La Haine", time:"1h38m", src:"/movie5.mp4", cc:"/movie5.vtt" },
  { title:"Harry Potter and the Deathly Hallows Part 2", desc:"Fallen Angels", time:"1h39m", src:"/movie6.mp4", cc:"/movie6.vtt" },
  { title:"Jugnuma.The.Fable.2025", desc:"Oldboy", time:"2h00m", src:"/movie7.mp4", cc:"/movie7.vtt" },
  { title:"Harry Potter and the Deathly Hallows - Part II", desc:"Children of Men", time:"1h49m", src:"/movie8.mp4", cc:"/movie8.vtt" }
];

const K_EP="st5_current_episode";
const K_TIME="st5_current_time";
const K_PROGRESS="st5_progress_map";
const K_AUDIO="st5_audio_map";
const K_SUB_SIZE="st5_sub_size";
const K_SUB_POS="st5_sub_pos";
const K_SUB_GAP="st5_sub_gap"; // New storage key for line gap

const player=videojs("my-video");
const episodesList=document.getElementById("episodesList");
const toast=document.getElementById("toast");
const syncDisplay=document.getElementById("syncDisplay");
const tvOsd=document.getElementById("tvOsd");

let currentEpisode=parseInt(localStorage.getItem(K_EP),10);
if(isNaN(currentEpisode)||currentEpisode<0||currentEpisode>=episodes.length)currentEpisode=0;
let savedTime=parseFloat(localStorage.getItem(K_TIME))||0;
let progressMap=JSON.parse(localStorage.getItem(K_PROGRESS)||"{}");
let audioMap=JSON.parse(localStorage.getItem(K_AUDIO)||"{}");

// Subtitle Tracking
let subtitleOffsetMs = 0;
let subSize = parseFloat(localStorage.getItem(K_SUB_SIZE)) || 1.2;
let subPos = parseInt(localStorage.getItem(K_SUB_POS)) || 0;
let subGap = parseFloat(localStorage.getItem(K_SUB_GAP)) || 1.15; // Initialize gap
let tvOsdTimeout;

function showToast(text,ms=1200){
  toast.textContent=text;
  toast.classList.add("show");
  toast.setAttribute("aria-hidden","false");
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>{
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden","true");
  },ms);
}

function showTvOsd(text, ms=2000) {
  tvOsd.textContent = text;
  tvOsd.classList.add("show");
  clearTimeout(tvOsdTimeout);
  tvOsdTimeout = setTimeout(() => {
    tvOsd.classList.remove("show");
  }, ms);
}

function buildList(){
  episodes.forEach((ep,i)=>{
    const pct=progressMap[i]||0;
    const row=document.createElement("div");
    row.className="episode";
    row.innerHTML=`
      <div class="ep-index">${i+1}</div>
      <div class="ep-thumb"><video class="ep-thumb-video" src="${ep.src}" muted preload="metadata"></video></div>
      <div class="ep-main">
        <div class="ep-title">${ep.title}</div>
        <div class="ep-meta">${ep.desc}</div>
        <div class="ep-progress"><div class="ep-progress-fill" data-i="${i}" style="width:${pct}%"></div></div>
      </div>
      <div style="min-width:56px;color:var(--text-muted);text-align:right">${ep.time}</div>
    `;
    row.addEventListener("click",()=>{savedTime=0;localStorage.setItem(K_TIME,"0");loadEpisode(i,false);});
    episodesList.appendChild(row);
  });
  const thumbs=document.querySelectorAll(".ep-thumb-video");
  thumbs.forEach(v=>v.addEventListener("loadedmetadata",()=>{try{v.currentTime=Math.min(5,v.duration||0);}catch(e){};}));
}

// --- SUBTITLE CUSTOMIZATION LOGIC ---
function applySubtitleStyle() {
  document.documentElement.style.setProperty('--sub-size', `${subSize}em`);
  document.documentElement.style.setProperty('--sub-pos', `${subPos}px`);
  document.documentElement.style.setProperty('--sub-gap', `${subGap}`);
}

function changeSubGap(delta) {
  subGap = Math.max(0.6, Math.min(2.5, subGap + delta));
  subGap = parseFloat(subGap.toFixed(2));
  localStorage.setItem(K_SUB_GAP, subGap);
  applySubtitleStyle();
  showTvOsd(`Line Gap: ${subGap}`);
}

function changeSubSize(delta) {
  subSize = Math.max(0.5, Math.min(3.0, subSize + delta));
  subSize = parseFloat(subSize.toFixed(1));
  localStorage.setItem(K_SUB_SIZE, subSize);
  applySubtitleStyle();
  showTvOsd(`Text Size: ${Math.round(subSize * 100)}%`);
}

function changeSubPos(delta) {
  subPos += delta;
  localStorage.setItem(K_SUB_POS, subPos);
  applySubtitleStyle();
  
  const dir = subPos > 0 ? "Down" : (subPos < 0 ? "Up" : "Center");
  showTvOsd(`Position: ${dir} (${Math.abs(subPos)}px)`);
}

function updateSyncDisplay() {
  if (syncDisplay) {
    syncDisplay.textContent = subtitleOffsetMs > 0 ? `+${subtitleOffsetMs} ms` : `${subtitleOffsetMs} ms`;
  }
}

function shiftSubtitles(deltaMs) {
  const tracks = player.textTracks();
  let cuesFound = false;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.kind === "subtitles" || track.kind === "captions") {
      const cues = track.cues;
      if (cues && cues.length > 0) {
        cuesFound = true;
        const deltaSec = deltaMs / 1000;
        for (let j = 0; j < cues.length; j++) {
          cues[j].startTime += deltaSec;
          cues[j].endTime += deltaSec;
        }
      }
    }
  }

  if (cuesFound) {
    subtitleOffsetMs += deltaMs;
    updateSyncDisplay();
    const sign = subtitleOffsetMs > 0 ? '+' : '';
    showTvOsd(`Delay: ${sign}${subtitleOffsetMs} ms`);
  } else {
    showTvOsd("Subtitles loading...");
  }
}
// ---------------------------

function getAudioTracks(){
  try{if(typeof player.audioTracks==="function"){const at=player.audioTracks();if(at&&at.length)return at;}}catch(e){}
  try{const tech=player.tech&&player.tech();if(tech&&tech.el&&tech.el().audioTracks)return tech.el().audioTracks;}catch(e){}
  try{const media=player.el();if(media&&media.audioTracks)return media.audioTracks;}catch(e){}
  return null;
}

function waitAudioTracks(timeout=2500){
  return new Promise((resolve,reject)=>{
    const start=Date.now();
    (function check(){
      const at=getAudioTracks();
      if(at&&at.length)return resolve(at);
      if(Date.now()-start>timeout)return reject(new Error("no-audio-tracks"));
      setTimeout(check,120);
    })();
  });
}

async function setAudioIndex(index){
  try{
    const at=await waitAudioTracks(2500);
    const idx=Math.max(0,Math.min(index,at.length-1));
    for(let i=0;i<at.length;i++){try{at[i].enabled=(i===idx);}catch(e){}}
    audioMap[currentEpisode]=idx;
    localStorage.setItem(K_AUDIO,JSON.stringify(audioMap));
    const label=(at[idx]&&(at[idx].label||at[idx].language))||("Track "+(idx+1));
    showToast(label);
  }catch(e){showToast("Audio tracks unavailable");}
}

async function toggleAudio(){
  try{
    const at=await waitAudioTracks(2500);
    const cur=(audioMap[currentEpisode]!=null)?audioMap[currentEpisode]:0;
    const nxt=(cur+1)%at.length;
    await setAudioIndex(nxt);
  }catch(e){showToast("No audio tracks");}
}

function clearRemoteTextTracks(){
  try{
    const remote=player.remoteTextTracks();
    const toRemove=[];
    for(let i=0;i<remote.length;i++)toRemove.push(remote[i]);
    toRemove.forEach(t=>player.removeRemoteTextTrack(t));
  }catch(e){}
}

function addSubtitles(src){
  clearRemoteTextTracks();
  if(!src)return;
  player.addRemoteTextTrack({kind:"subtitles",src,srclang:"en",label:"English"},false);
  const forceOn=()=>{
    const tt=player.textTracks();
    if(tt&&tt.length)for(let i=0;i<tt.length;i++)if(tt[i].kind==="subtitles"||tt[i].kind==="captions")tt[i].mode="showing";
  };
  setTimeout(forceOn,220);
  player.one("loadedmetadata",forceOn);
}

function loadEpisode(index,resume=true){
  currentEpisode=index;
  localStorage.setItem(K_EP,String(index));
  
  subtitleOffsetMs = 0;
  updateSyncDisplay();

  document.querySelectorAll(".episode").forEach(e=>e.classList.remove("active"));
  const rows=document.querySelectorAll(".episode");
  if(rows[index])rows[index].classList.add("active");
  const ep=episodes[index];
  player.pause();
  player.src({type:"video/mp4",src:ep.src});
  addSubtitles(ep.cc);

  player.one("loadedmetadata",()=>{
    const tt=player.textTracks();
    if(tt&&tt.length)for(let i=0;i<tt.length;i++)if(tt[i].kind==="subtitles"||tt[i].kind==="captions")tt[i].mode="showing";
    try{const r=(resume?savedTime:0)||0;if(r>0)player.currentTime(r);}catch(e){}
    setTimeout(()=>{
      const saved=(audioMap[currentEpisode]!=null)?audioMap[currentEpisode]:0;
      setAudioIndex(saved);
    },250);
    player.play();
  });
}

player.on("timeupdate",()=>{
  const t=player.currentTime();
  const d=player.duration()||0;
  localStorage.setItem(K_TIME,String(t));
  savedTime=t;
  if(d>0){
    const pct=Math.min(100,(t/d)*100);
    progressMap[currentEpisode]=pct;
    localStorage.setItem(K_PROGRESS,JSON.stringify(progressMap));
    const el=document.querySelector(`.ep-progress-fill[data-i="${currentEpisode}"]`);
    if(el)el.style.width=pct+"%";
  }
});

player.ready(()=>{
  if(player.tech&&player.tech().el)player.tech().el().style.objectFit="contain";
  setTimeout(()=>{
    const tt=player.textTracks();
    if(tt&&tt.length)for(let i=0;i<tt.length;i++)if(tt[i].kind==="subtitles"||tt[i].kind==="captions")tt[i].mode="showing";
  },300);
});

function handleKey(e){
  const code=e.keyCode||e.which||0;
  const key=(e.key||"").toString();
  const codeStr=(e.code||"").toString();

  // Sync Hotkeys mapped to 0 and 8
  if(key === "8" || code === 56){ e.preventDefault(); shiftSubtitles(100); return; }
  if(key === "0" || code === 48){ e.preventDefault(); shiftSubtitles(-100); return; }

  // Gap Hotkeys mapped to 1 and 3
  if(key === "1" || code === 49){ e.preventDefault(); changeSubGap(-0.05); return; } // Gap -
  if(key === "3" || code === 51){ e.preventDefault(); changeSubGap(0.05); return; }  // Gap +

  // Size Hotkeys mapped to 4 and 6
  if(key === "4" || code === 52){ e.preventDefault(); changeSubSize(-0.1); return; } // Size -
  if(key === "6" || code === 54){ e.preventDefault(); changeSubSize(0.1); return; }  // Size +

  // Position Hotkeys mapped to 2 and 5
  if(key === "2" || code === 50){ e.preventDefault(); changeSubPos(-15); return; }   // Move Up
  if(key === "5" || code === 53){ e.preventDefault(); changeSubPos(15); return; }    // Move Down

  const isGreen=(code===404)||(code===71)||(code===103)||key.toLowerCase()==="g"||codeStr==="KeyG"||key.toLowerCase().includes("green")||code===407;
  if(isGreen){e.preventDefault();showToast("Green pressed",700);toggleAudio();return;}

  if(code===403||key.toLowerCase()==="r"||codeStr==="KeyR"){e.preventDefault();if(player.isFullscreen&&player.isFullscreen())player.exitFullscreen();else if(player.requestFullscreen)player.requestFullscreen();return;}
  if(code===405||key.toLowerCase()==="y"||codeStr==="KeyY"){e.preventDefault();player.currentTime(0);progressMap[currentEpisode]=0;localStorage.setItem(K_PROGRESS,JSON.stringify(progressMap));const el=document.querySelector(`.ep-progress-fill[data-i="${currentEpisode}"]`);if(el)el.style.width="0%";player.play();return;}
  if(code===406||key.toLowerCase()==="b"||codeStr==="KeyB"){e.preventDefault();document.body.classList.toggle("sub-bold");return;}
}

window.addEventListener("keydown",handleKey);

window.addEventListener("load",()=>{
  applySubtitleStyle(); // Load saved preferences immediately
  buildList();
  const rows=document.querySelectorAll(".episode");
  if(rows[currentEpisode])rows[currentEpisode].classList.add("active");
  loadEpisode(currentEpisode,true);
});

window.__toggleAudio=toggleAudio;
window.__setAudioIndex=setAudioIndex;
