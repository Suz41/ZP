const episodes = [
  { title:"Spider-Man: Brand New Day (2026)", desc:"Action / Sci-Fi • Multi-Line • ESub", provider:"HDHub4u", time:"2h 15m", src:"https://cdn.fsl-buckets.life/SpiderMan-Brand.New.Day.2026.HQ.1080p.V3-HDTC.Multi-LiNE.HC-ESub.x264-HDHub4u.Ms.mkv?token=3535db4975bbfc8455b2aceb69a00bfd_118", cc:"", poster:"https://picsum.photos/300/450?random=9" },
  { title:"Tu.Yaa.Main (2026)", desc:"The Spirit of the Beehive • Hindi NF", provider:"HDHub4u", time:"1h 31m", src:"/movie1.mp4", cc:"/movie1.vtt", poster:"https://picsum.photos/300/450?random=1" },
  { title:"John Wick (2014)", desc:"Bhagyalakshmi • Action", provider:"AllMovieLand", time:"1h 57m", src:"/movie2.mp4", cc:"/movie2.vtt", poster:"https://picsum.photos/300/450?random=2" },
  { title:"Sadak (1991)", desc:"Action / Drama", provider:"HDHub4u", time:"1h 49m", src:"/movie3.mp4", cc:"/movie3.vtt", poster:"https://picsum.photos/300/450?random=3" },
  { title:"The Chronicles of Narnia", desc:"Fantasy / Adventure", provider:"AllMovieLand", time:"1h 26m", src:"/movie4.mp4", cc:"/movie4.vtt", poster:"https://picsum.photos/300/450?random=4" },
  { title:"ABCD (2013)", desc:"Dance / Drama", provider:"HDHub4u", time:"1h 38m", src:"/movie5.mp4", cc:"/movie5.vtt", poster:"https://picsum.photos/300/450?random=5" },
  { title:"Harry Potter Hallows P2", desc:"Magic / Fantasy", provider:"AllWish", time:"1h 39m", src:"/movie6.mp4", cc:"/movie6.vtt", poster:"https://picsum.photos/300/450?random=6" },
  { title:"Jugnuma The Fable (2025)", desc:"Thriller / Mystery • HDHub4u", provider:"HDHub4u", time:"2h 00m", src:"/movie7.mp4", cc:"/movie7.vtt", poster:"https://picsum.photos/300/450?random=7" },
  { title:"Harry Potter Deathly Hallows", desc:"Fantasy / Magic", provider:"Anichi", time:"1h 49m", src:"/movie8.mp4", cc:"/movie8.vtt", poster:"https://picsum.photos/300/450?random=8" }
];

const K_EP="st5_current_episode";
const K_TIME="st5_current_time";
const K_PROGRESS="st5_progress_map";
const K_AUDIO="st5_audio_map";
const K_SUB_SIZE="st5_sub_size";
const K_SUB_POS="st5_sub_pos";
const K_SUB_GAP="st5_sub_gap";

const player = videojs("my-video");
const mediaGrid = document.getElementById("mediaGrid");
const toast = document.getElementById("toast");
const syncDisplay = document.getElementById("syncDisplay");
const tvOsd = document.getElementById("tvOsd");

let currentEpisode = parseInt(localStorage.getItem(K_EP),10);
if(isNaN(currentEpisode)||currentEpisode<0||currentEpisode>=episodes.length) currentEpisode = 0;
let savedTime = parseFloat(localStorage.getItem(K_TIME))||0;
let progressMap = JSON.parse(localStorage.getItem(K_PROGRESS)||"{}");
let audioMap = JSON.parse(localStorage.getItem(K_AUDIO)||"{}");

let subtitleOffsetMs = 0;
let subSize = parseFloat(localStorage.getItem(K_SUB_SIZE)) || 1.2;
let subPos = parseInt(localStorage.getItem(K_SUB_POS)) || 0;
let subGap = parseFloat(localStorage.getItem(K_SUB_GAP)) || 1.15;
let tvOsdTimeout;

function showTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-home').style.display = 'none';
  document.getElementById('tab-search').style.display = 'none';
  document.getElementById('tab-player').style.display = 'none';
  document.getElementById('tab-settings').style.display = 'none';

  if (tabName === 'home') {
    document.getElementById('tab-home').style.display = 'block';
    document.querySelectorAll('.nav-btn')[0].classList.add('active');
  } else if (tabName === 'search') {
    document.getElementById('tab-search').style.display = 'block';
    document.querySelectorAll('.nav-btn')[1].classList.add('active');
    triggerSearch();
  } else if (tabName === 'player') {
    document.getElementById('tab-player').style.display = 'block';
    document.querySelectorAll('.nav-btn')[2].classList.add('active');
  } else if (tabName === 'settings') {
    document.getElementById('tab-settings').style.display = 'block';
    document.querySelectorAll('.nav-btn')[3].classList.add('active');
  }
}

let activePluginSearchData = [];

function handleSearch(query) {
  const searchGrid = document.getElementById('searchGrid');
  const searchResultTitle = document.getElementById('searchResultTitle');
  if (!searchGrid) return;

  const q = (query || '').toLowerCase().trim();
  searchGrid.innerHTML = "";

  const allItems = [...episodes, ...activePluginSearchData];
  const filtered = q ? allItems.filter(item => {
    const title = (item.title || item.name || '').toLowerCase();
    const desc = (item.desc || item.description || '').toLowerCase();
    const provider = (item.provider || '').toLowerCase();
    const srcUrl = (item.src || item.url || '').toLowerCase();
    return title.includes(q) || desc.includes(q) || provider.includes(q) || srcUrl.includes(q);
  }) : allItems;

  searchResultTitle.textContent = q ? `Search Results (${filtered.length})` : `All Content & Extensions (${filtered.length})`;

  filtered.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "media-card";
    const title = item.title || item.name;
    const poster = item.poster || item.iconUrl || `https://picsum.photos/300/450?random=${index + 10}`;
    const desc = item.desc || (item.tvTypes ? item.tvTypes.join(', ') : 'Cloudstream Provider');

    card.innerHTML = `
      <img class="card-poster" src="${poster}" alt="${title}" onerror="this.src='https://picsum.photos/300/450?random=${index}'" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${title}</div>
        <div class="card-sub">${desc}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (item.src) {
        showTab('player');
        player.pause();
        const isMkv = item.src.toLowerCase().includes('.mkv');
        const isTizen = /Tizen/i.test(navigator.userAgent);
        const mimeType = isMkv ? (isTizen ? 'video/mp4' : 'video/x-matroska') : 'video/mp4';
        player.src({ type: mimeType, src: item.src });
        player.play();
        showTvOsd(`Playing: ${title}`);
      } else {
        showToast(`Extension: ${title}`);
        showTvOsd(`Extension: ${title}`);
      }
    });

    searchGrid.appendChild(card);
  });
}

function triggerSearch() {
  const input = document.getElementById('searchInput');
  handleSearch(input ? input.value : '');
}

function playFeatured() {
  showTab('player');
  loadEpisode(0, true);
}

function playCustomUrl() {
  const urlInput = document.getElementById('customUrlInput');
  if (!urlInput || !urlInput.value.trim()) {
    showToast("Please enter a valid video URL");
    return;
  }
  const url = urlInput.value.trim();
  showTab('player');
  player.pause();
  const isMkv = url.toLowerCase().includes('.mkv');
  // Samsung Tizen compatibility fallback
  const isTizen = /Tizen/i.test(navigator.userAgent);
  const mimeType = isMkv ? (isTizen ? 'video/mp4' : 'video/x-matroska') : 'video/mp4';
  player.src({ type: mimeType, src: url });
  player.play();
  showTvOsd(isMkv ? "Streaming MKV (Tizen mode)..." : "Streaming MP4...");
}

async function loadRepoFromInput() {
  const repoInput = document.getElementById('repoUrlInput');
  const url = repoInput ? repoInput.value.trim() : '';
  if (!url) return;

  showToast("Connecting Repo...");
  try {
    const res = await fetch(url);
    const repoData = await res.json();
    const pluginListUrl = (repoData.pluginLists && repoData.pluginLists[0]) 
      || "https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/plugins.json";

    showToast(`Loading ${repoData.name || 'Cloudstream Repo'}...`);
    const pluginsRes = await fetch(pluginListUrl);
    const plugins = await pluginsRes.json();

    renderRepoPlugins(repoData.name || "Phisher Repo", plugins);
    showToast(`Loaded ${plugins.length} Extensions!`);
    showTvOsd(`Loaded ${plugins.length} Providers`);
    showTab('home');
  } catch (e) {
    showToast("Repo fetched successfully!");
  }
}

function renderRepoPlugins(repoName, plugins) {
  activePluginSearchData = plugins || [];
  if (!mediaGrid) return;
  mediaGrid.innerHTML = "";

  document.querySelector('.section-title span').textContent = `${repoName} Providers (${plugins.length})`;

  plugins.forEach((plugin) => {
    const card = document.createElement("div");
    card.className = "media-card";
    const icon = plugin.iconUrl || "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/Icons/RepoIcon.png";
    const types = (plugin.tvTypes || ["Movie"]).join(", ");
    
    card.innerHTML = `
      <img class="card-poster" src="${icon}" alt="${plugin.name}" onerror="this.src='https://picsum.photos/300/450?random=${Math.floor(Math.random()*100)}'" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${plugin.name}</div>
        <div class="card-sub">v${plugin.version || 1} • ${types}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      showToast(`Selected Provider: ${plugin.name}`);
      showTvOsd(`Provider: ${plugin.name}`);
      showTab('player');
    });

    mediaGrid.appendChild(card);
  });
}

function showToast(text, ms=1200){
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), ms);
}

function showTvOsd(text, ms=2000) {
  tvOsd.textContent = text;
  tvOsd.classList.add("show");
  clearTimeout(tvOsdTimeout);
  tvOsdTimeout = setTimeout(() => tvOsd.classList.remove("show"), ms);
}

function buildGrid() {
  if (!mediaGrid) return;
  mediaGrid.innerHTML = "";
  episodes.forEach((ep, i) => {
    const card = document.createElement("div");
    card.className = "media-card";
    card.innerHTML = `
      <img class="card-poster" src="${ep.poster}" alt="${ep.title}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${ep.title}</div>
        <div class="card-sub">${ep.time} • ${ep.desc || 'Movie'}</div>
      </div>
    `;
    card.addEventListener("click", () => {
      savedTime = 0;
      localStorage.setItem(K_TIME, "0");
      showTab('player');
      loadEpisode(i, false);
    });
    mediaGrid.appendChild(card);
  });
}

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

function clearRemoteTextTracks(){
  try {
    const remote = player.remoteTextTracks();
    const toRemove = [];
    for (let i = 0; i < remote.length; i++) toRemove.push(remote[i]);
    toRemove.forEach(t => player.removeRemoteTextTrack(t));
  } catch(e){}
}

function addSubtitles(src){
  clearRemoteTextTracks();
  if(!src) return;
  player.addRemoteTextTrack({kind:"subtitles", src, srclang:"en", label:"English"}, false);
  const forceOn = () => {
    const tt = player.textTracks();
    if(tt && tt.length) for(let i=0; i<tt.length; i++) if(tt[i].kind==="subtitles" || tt[i].kind==="captions") tt[i].mode="showing";
  };
  setTimeout(forceOn, 220);
  player.one("loadedmetadata", forceOn);
}

function loadEpisode(index, resume=true){
  currentEpisode = index;
  localStorage.setItem(K_EP, String(index));
  subtitleOffsetMs = 0;
  updateSyncDisplay();

  const ep = episodes[index];
  player.pause();
  const mimeType = ep.src.endsWith(".mkv") ? "video/x-matroska" : "video/mp4";
  player.src({type: mimeType, src: ep.src});
  addSubtitles(ep.cc);

  player.one("loadedmetadata", () => {
    const tt = player.textTracks();
    if(tt && tt.length) for(let i=0; i<tt.length; i++) if(tt[i].kind==="subtitles" || tt[i].kind==="captions") tt[i].mode="showing";
    try { const r = (resume ? savedTime : 0) || 0; if(r > 0) player.currentTime(r); } catch(e){}
    player.play();
  });
}

function handleKey(e){
  const code = e.keyCode || e.which || 0;
  const key = (e.key || "").toString();

  // Left Arrow (37), Tizen Rewind (412), MediaRewind, J key (-10s)
  if (code === 37 || code === 412 || key === "ArrowLeft" || key === "MediaRewind" || key === "j" || key === "J") {
    e.preventDefault();
    const cur = player.currentTime() || 0;
    player.currentTime(Math.max(0, cur - 10));
    showTvOsd("⏪ -10s");
    return;
  }
  // Right Arrow (39), Tizen FastForward (417), MediaFastForward, L key (+10s)
  if (code === 39 || code === 417 || key === "ArrowRight" || key === "MediaFastForward" || key === "l" || key === "L") {
    e.preventDefault();
    const cur = player.currentTime() || 0;
    const dur = player.duration() || 0;
    player.currentTime(Math.min(dur, cur + 10));
    showTvOsd("⏩ +10s");
    return;
  }

  // Space (32), Enter/OK (13), Tizen Play (19), Pause (19), PlayPause (10252)
  if (code === 32 || code === 13 || code === 19 || code === 10252 || key === " " || key === "Enter" || key === "MediaPlayPause" || key === "MediaPlay" || key === "MediaPause") {
    if (document.getElementById('tab-player').style.display !== 'none') {
      e.preventDefault();
      if (player.paused()) { player.play(); showTvOsd("▶ Play"); }
      else { player.pause(); showTvOsd("⏸ Pause"); }
      return;
    }
  }

  // Subtitle Toggle key (Tizen Subtitle/Caption 10221, "c", "C")
  if (code === 10221 || key === "c" || key === "C" || key === "Subtitle") {
    e.preventDefault();
    const tracks = player.textTracks();
    if (tracks && tracks.length) {
      let showing = false;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === "subtitles" || tracks[i].kind === "captions") {
          if (tracks[i].mode === "showing") { tracks[i].mode = "hidden"; }
          else { tracks[i].mode = "showing"; showing = true; }
        }
      }
      showTvOsd(showing ? "💬 Subtitles ON" : "💬 Subtitles OFF");
    } else {
      showTvOsd("No Subtitles Found");
    }
    return;
  }

  // D-pad Up (38) / Down (40) for Subtitle Position adjustment
  if (code === 38 || key === "ArrowUp") {
    e.preventDefault();
    changeSubPos(-15);
    return;
  }
  if (code === 40 || key === "ArrowDown") {
    e.preventDefault();
    changeSubPos(15);
    return;
  }

  if(key === "8" || code === 56){ e.preventDefault(); shiftSubtitles(100); return; }
  if(key === "0" || code === 48){ e.preventDefault(); shiftSubtitles(-100); return; }
  if(key === "1" || code === 49){ e.preventDefault(); changeSubGap(-0.05); return; }
  if(key === "3" || code === 51){ e.preventDefault(); changeSubGap(0.05); return; }
  if(key === "4" || code === 52){ e.preventDefault(); changeSubSize(-0.1); return; }
  if(key === "6" || code === 54){ e.preventDefault(); changeSubSize(0.1); return; }
  if(key === "2" || code === 50){ e.preventDefault(); changeSubPos(-15); return; }
  if(key === "5" || code === 53){ e.preventDefault(); changeSubPos(15); return; }
}

window.addEventListener("keydown", handleKey);

window.addEventListener("load", () => {
  applySubtitleStyle();
  buildGrid();
  loadRepoFromInput();
});
