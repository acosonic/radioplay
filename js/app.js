/* RadioPlay – app.js */
const BASE = 'api';

// ── State ──
let currentUrl  = null;
let currentName = null;
let startedAt   = null;
let timerInterval    = null;
let statusInterval   = null;
let metaInterval     = null;
let lastMetaTitle    = null;
let favorites = JSON.parse(localStorage.getItem('rp_favorites') || '{}');
let history   = JSON.parse(localStorage.getItem('rp_history')   || '[]');
let isDayMode = localStorage.getItem('rp_theme') !== 'night';
let playbackMode = localStorage.getItem('rp_playback_mode') || 'browser';
let playerOpen = localStorage.getItem('rp_player_open') !== 'false';

// Migrate old favorites format {url: name} → {url: {name, url}}
Object.keys(favorites).forEach(url => {
  if (typeof favorites[url] === 'string')
    favorites[url] = { name: favorites[url], url };
});

// ── DOM refs ──
const grid          = document.getElementById('station-grid');
const statusMsg     = document.getElementById('status-msg');
const btnSearch     = document.getElementById('btn-search');
const btnStop       = document.getElementById('btn-stop');
const btnYtPlay     = document.getElementById('btn-yt-play');
const btnYtClose    = document.getElementById('btn-yt-close');
const btnYtToggle   = document.getElementById('btn-yt-toggle');
const ytOverlay     = document.getElementById('yt-overlay');
const ytUrl         = document.getElementById('yt-url');
const nowPlaying    = document.getElementById('now-playing');
const playTimer     = document.getElementById('play-timer');
const npFavicon     = document.getElementById('np-favicon');
const npFaviconPh   = document.getElementById('np-favicon-ph');
const volSlider     = document.getElementById('vol-slider');
const volVal        = document.getElementById('vol-val');
const volIcon       = document.getElementById('vol-icon');
const btnTheme      = document.getElementById('btn-theme');
const btnHome       = document.getElementById('btn-home');
const waveform      = document.getElementById('waveform');
const searchQ       = document.getElementById('search-q');
const filterTag     = document.getElementById('filter-tag');
const filterCountry = document.getElementById('filter-country');
const filterQuality = document.getElementById('filter-quality');
const filterLimit   = document.getElementById('filter-limit');
const btnMode       = document.getElementById('btn-mode');
const btnTest       = document.getElementById('btn-test');
const testModal     = document.getElementById('test-modal');
const testModalBody = document.getElementById('test-modal-body');
const btnTestClose  = document.getElementById('btn-test-close');
const btnAbout        = document.getElementById('btn-about');
const aboutModal      = document.getElementById('about-modal');
const btnAboutClose   = document.getElementById('btn-about-close');
const audioEl         = document.getElementById('audio-player');
const playerBar       = document.getElementById('player-bar');
const btnPlayerToggle = document.getElementById('btn-player-toggle');

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(isDayMode);

  renderHome();
  initVolume();

  if (btnPlayerToggle) {
    btnPlayerToggle.addEventListener('click', () => {
      playerOpen = !playerOpen;
      localStorage.setItem('rp_player_open', String(playerOpen));
      applyPlayerState();
    });
    applyPlayerState();
  }

  btnHome.addEventListener('click', renderHome);
  btnSearch.addEventListener('click', doSearch);
  searchQ.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  btnStop.addEventListener('click', doStop);

  btnYtToggle.addEventListener('click', () => toggleYtOverlay());
  btnYtClose.addEventListener('click', () => toggleYtOverlay(false));
  btnYtPlay.addEventListener('click', doYoutube);
  ytUrl.addEventListener('keydown', e => { if (e.key === 'Enter') doYoutube(); });

  btnTheme.addEventListener('click', () => {
    isDayMode = !isDayMode;
    localStorage.setItem('rp_theme', isDayMode ? 'day' : 'night');
    applyTheme(isDayMode);
  });

  btnMode.addEventListener('click', toggleMode);
  btnTest.addEventListener('click', openTestModal);
  btnTestClose.addEventListener('click', () => testModal.classList.add('hidden'));
  testModal.addEventListener('click', e => { if (e.target === testModal) testModal.classList.add('hidden'); });

  btnAbout.addEventListener('click', () => aboutModal.classList.remove('hidden'));
  btnAboutClose.addEventListener('click', () => aboutModal.classList.add('hidden'));
  aboutModal.addEventListener('click', e => { if (e.target === aboutModal) aboutModal.classList.add('hidden'); });

  audioEl.addEventListener('error', () => { showMsg('Stream error.', 'error'); clearPlaying(); });
  audioEl.addEventListener('ended', () => clearPlaying());

  metaInterval = setInterval(fetchMetadata, 25000);
  applyMode();
});

// ── Player bar toggle ──
function applyPlayerState() {
  playerBar.classList.toggle('player-collapsed', !playerOpen);
}

// ── Playback mode toggle ──
async function toggleMode() {
  if (currentUrl) {
    if (playbackMode === 'server') {
      try { await fetch(`${BASE}/stop.php`, { method: 'POST' }); } catch {}
    } else {
      audioEl.pause();
      audioEl.src = '';
    }
    clearPlaying();
  }
  playbackMode = playbackMode === 'server' ? 'browser' : 'server';
  localStorage.setItem('rp_playback_mode', playbackMode);
  applyMode();
}

// Paper Icon Theme — colored
const monitorSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><g transform="translate(-285 235.003)"><path d="m 300.0002,-234 c 1,0 1,1 1,1 v 10 c 0,0 0,1 -1,1 h -14 c 0,0 -1,0 -1,-1 v -10 c 0,0 0,-1 1,-1 z m -0.99959,2 h -12 l -4.1e-4,8 12,-0.024 z m -3.00041,11 -2e-4,0.99664 h -6 l 2e-4,-0.99664 c 0,-1 1,-1 1,-1 h 4.02177 c 0,0 0.97823,0 0.97823,1 z" fill="#7c8cff"/></g></svg>';
const speakerSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><g transform="translate(-445 195)"><path d="m 456.79,-187 c 0,-1.3 -0.72,-2.42 -1.79,-3 v 6 c 1.06,-0.58 1.79,-1.7 1.79,-3 z m -10.69889,-2.90909 v 5.81818 h 2.81818 L 453,-180 v -14 l -4.0908,4.09091 z M 455,-194 v 1.5 c 2.32,0.74 4,2.93 4,5.5 0,2.57 -1.68,4.76 -4,5.5 v 1.5 c 3.15,-0.78 5.5,-3.6 5.5,-7 0,-3.4 -2.35,-6.22 -5.5,-7 z" fill="#50c8e8"/></g></svg>';
const moonSvg    = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53z" fill="#9090e8"/></svg>';
const sunSvg     = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="m 353.0002,-494.28125 c -0.73799,0.72824 -1.44477,1.55677 -2.19141,2.28125 h -2.80859 v 2.80859 c -0.72459,0.74666 -1.55292,1.4535 -2.28125,2.19141 0.72849,0.73824 1.55656,1.47349 2.28125,2.22266 V -482 h 2.80664 c 0.74736,0.725 1.45473,1.55231 2.19336,2.28125 0.73886,-0.7291 1.47479,-1.55615 2.22461,-2.28125 h 2.77539 v -2.77734 c 0.72474,-0.74912 1.5527,-1.48443 2.28125,-2.22266 -0.72829,-0.73805 -1.5567,-1.44467 -2.28125,-2.19141 V -492 h -2.77734 c -0.74913,-0.72473 -1.48445,-1.55272 -2.22266,-2.28125 z m 0,3.28125 c 2.20914,0 4,1.79086 4,4 0,2.20914 -1.79086,4 -4,4 -2.20914,0 -4,-1.79086 -4,-4 0,-2.20914 1.79086,-4 4,-4 z m 0,1 a 3,3 0 0 0 -3,3 3,3 0 0 0 3,3 3,3 0 0 0 3,-3 3,3 0 0 0 -3,-3 z" fill="#f0c030" transform="translate(-345 495.003)"/></svg>';

function applyMode() {
  if (playbackMode === 'server') {
    if (!statusInterval) {
      statusInterval = setInterval(fetchStatus, 5000);
      fetchStatus();
    }
    btnMode.innerHTML = monitorSvg;
    btnMode.classList.add('active');
    btnMode.dataset.tooltip = '🖥 Server mode — active\n\nAudio plays via VLC on the server.\nVolume controls system output.\nGood for local / home listening.\n\nClick to switch to Browser mode.';
  } else {
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    btnMode.innerHTML = speakerSvg;
    btnMode.classList.remove('active');
    btnMode.dataset.tooltip = '🔊 Browser mode — active\n\nAudio streams directly in your browser.\nVolume is local, max 100%.\nGood for remote / guest listening.\n\nClick to switch to Server mode.';
  }
  const max = playbackMode === 'server' ? 150 : 100;
  const savedVol = parseInt(localStorage.getItem('rp_volume') ?? '78');
  setSliderUI(Math.min(savedVol, max));
}

// ── YouTube overlay ──
function toggleYtOverlay(force) {
  const show = force !== undefined ? force : ytOverlay.classList.contains('hidden');
  ytOverlay.classList.toggle('hidden', !show);
  btnYtToggle.classList.toggle('active', show);
  if (show) setTimeout(() => ytUrl.focus(), 50);
}

// ── Search ──
async function doSearch() {
  const q       = searchQ.value.trim();
  const tag     = filterTag.value;
  const country = filterCountry.value;
  const quality = filterQuality.value;
  const limit   = filterLimit.value;

  if (!q && !tag && !country) {
    showMsg('Enter a search term or select a genre/country.', 'info');
    return;
  }

  showMsg('Searching...', 'info');
  btnSearch.disabled = true;
  btnSearch.textContent = '…';

  grid.className = 'station-grid';
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const params = new URLSearchParams();
  if (q)            params.set('q', q);
  if (tag)          params.set('tag', tag);
  if (country)      params.set('country', country);
  if (quality > 0)  params.set('bitrateMin', quality);
  params.set('limit', limit);

  try {
    const res  = await fetch(`${BASE}/search.php?${params}`);
    const data = await res.json();
    if (data.error) { showMsg('Error: ' + data.error, 'error'); grid.innerHTML = ''; return; }
    hideMsg();
    renderStations(data);
  } catch {
    showMsg('Network error.', 'error');
    grid.innerHTML = '';
  } finally {
    btnSearch.disabled = false;
    btnSearch.textContent = 'Search';
  }
}

// ── Render stations ──
function renderStations(stations) {
  grid.innerHTML = '';

  if (!stations || stations.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">🔍</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">No stations found</div>
      <div>Try a different search term or remove filters.</div></div>`;
    return;
  }

  const hdr = document.createElement('div');
  hdr.className = 'results-header';
  hdr.innerHTML = `<button class="btn-home-result">← Home</button>
    <span class="results-count">${stations.length} station${stations.length !== 1 ? 's' : ''}</span>`;
  hdr.querySelector('.btn-home-result').addEventListener('click', renderHome);
  grid.appendChild(hdr);

  stations.forEach(s => { if (s.url) grid.appendChild(buildCard(s)); });
}

function buildCard(s) {
  const card = document.createElement('div');
  card.className = 'station-card' + (currentUrl === s.url ? ' playing' : '');
  card.dataset.url = s.url;

  const logoHtml = s.favicon
    ? `<img class="station-logo" src="${escHtml(s.favicon)}" alt=""
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="station-logo-placeholder" style="display:none">${firstLetter(s.name)}</div>`
    : `<div class="station-logo-placeholder">${firstLetter(s.name)}</div>`;

  const tags = s.tags ? s.tags.split(',').slice(0, 2).map(t => t.trim()).filter(Boolean) : [];
  const tagsHtml    = tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
  const bitrateHtml = s.bitrate ? `<span class="bitrate">${s.bitrate}k</span>` : '';
  const countryHtml = s.country
    ? `<div class="station-country">${flagEmoji(s.countrycode)} ${escHtml(s.country)}</div>` : '';

  const liveClass = s.lastcheckok === 1 ? 'live-ok' : s.lastcheckok === 0 ? 'live-dead' : 'live-unknown';
  const liveTitle = s.lastcheckok === 1 ? 'Live' : s.lastcheckok === 0 ? 'Offline' : 'Unknown';
  const isFav     = !!favorites[s.url];
  const isPlaying = currentUrl === s.url;

  card.innerHTML = `
    <div class="card-top">
      ${logoHtml}
      <div class="station-info">
        <div class="station-name" title="${escHtml(s.name)}">
          ${escHtml(s.name)}<span class="live-badge ${liveClass}" title="${liveTitle}"></span>
        </div>
        <div class="station-meta">${tagsHtml}${bitrateHtml}${s.codec ? `<span class="bitrate">${escHtml(s.codec)}</span>` : ''}</div>
        ${countryHtml}
      </div>
    </div>
    <div class="card-footer">
      <button class="btn-play${isPlaying ? ' playing' : ''}">${isPlaying ? '■ Playing' : '▶ Play'}</button>
      <button class="btn-fav${isFav ? ' active' : ''}" title="Favourite">♡</button>
    </div>`;

  card.querySelector('.btn-play').addEventListener('click', () => doPlay(s.url, s.name, s.favicon));
  card.querySelector('.btn-fav').addEventListener('click', e => {
    toggleFav(e.currentTarget, s.url, s);
    const fp = document.getElementById('panel-favorites-list');
    if (fp) renderFavoritesPanel(fp);
  });

  return card;
}

// ── Play ──
async function doPlay(url, name, favicon = '') {
  if (!url) return;
  showMsg(`Starting: ${name}`, 'info');

  if (playbackMode === 'browser') {
    audioEl.src = url;
    audioEl.play().catch(() => { showMsg('Playback failed.', 'error'); clearPlaying(); });
    addToHistory(name, url, favicon, 'radio');
    setPlaying(url, name, Math.floor(Date.now() / 1000), favicon, 'radio');
    hideMsg();
    return;
  }

  const form = new FormData();
  form.append('url', url);
  form.append('name', name);
  form.append('favicon', favicon || '');

  try {
    const res  = await fetch(`${BASE}/play.php`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      addToHistory(name, url, favicon, 'radio');
      setPlaying(url, name, Math.floor(Date.now() / 1000), favicon, 'radio');
      hideMsg();
    } else {
      showMsg('Play failed: ' + (data.error || 'unknown'), 'error');
    }
  } catch { showMsg('Network error.', 'error'); }
}

// ── Stop ──
async function doStop() {
  if (playbackMode === 'browser') {
    audioEl.pause();
    audioEl.src = '';
    clearPlaying();
    return;
  }
  try {
    const res  = await fetch(`${BASE}/stop.php`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) clearPlaying();
  } catch { showMsg('Stop failed.', 'error'); }
}

// ── YouTube ──
async function doYoutube() {
  const url = ytUrl.value.trim();
  if (!url) return;

  if (!url.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i)) {
    showMsg('Please enter a valid YouTube URL.', 'error');
    return;
  }

  btnYtPlay.disabled = true;
  btnYtPlay.textContent = '…';
  showMsg('Extracting stream via yt-dlp…', 'info');

  const form = new FormData();
  form.append('url', url);
  if (playbackMode === 'browser') form.append('mode', 'browser');

  try {
    const res  = await fetch(`${BASE}/youtube.php`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      if (playbackMode === 'browser') {
        audioEl.src = data.streamUrl;
        audioEl.play().catch(() => { showMsg('Playback failed.', 'error'); clearPlaying(); });
      }
      addToHistory(data.name, url, '', 'youtube');
      setPlaying(url, data.name, Math.floor(Date.now() / 1000), '', 'youtube');
      showMsg('Playing: ' + data.name, 'success');
      ytUrl.value = '';
      toggleYtOverlay(false);
    } else {
      showMsg('YouTube error: ' + (data.error || 'unknown'), 'error');
    }
  } catch { showMsg('Network error.', 'error'); }
  finally {
    btnYtPlay.disabled = false;
    btnYtPlay.textContent = '▶ Play';
  }
}

// ── Status polling ──
async function fetchStatus() {
  try {
    const res  = await fetch(`${BASE}/status.php`);
    const data = await res.json();
    if (data.playing) {
      if (currentUrl !== data.url)
        setPlaying(data.url, data.name, data.started_at, data.favicon || '', data.type || 'radio');
    } else {
      if (currentUrl !== null) clearPlaying();
    }
  } catch {}
}

// ── Metadata polling ──
async function fetchMetadata() {
  if (!currentUrl) return;
  try {
    const endpoint = playbackMode === 'browser'
      ? `${BASE}/metadata.php?url=${encodeURIComponent(currentUrl)}`
      : `${BASE}/metadata.php`;
    const res  = await fetch(endpoint);
    const data = await res.json();
    const title = data.title || null;
    if (title === lastMetaTitle) return;
    lastMetaTitle = title;
    const el = nowPlaying.querySelector('.np-track');
    if (!el) return;
    if (title) {
      el.textContent = '♪ ' + title;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  } catch {}
}

// ── State helpers ──
function setPlaying(url, name, ts, favicon, type) {
  currentUrl  = url;
  currentName = name;
  startedAt   = ts;

  btnStop.disabled = false;

  // Player bar favicon
  if (favicon) {
    npFavicon.src = favicon;
    npFavicon.classList.remove('hidden');
    npFaviconPh.classList.add('hidden');
    npFavicon.onerror = () => { npFavicon.classList.add('hidden'); npFaviconPh.classList.remove('hidden'); };
  } else {
    npFavicon.classList.add('hidden');
    npFaviconPh.classList.remove('hidden');
    npFaviconPh.textContent = type === 'youtube' ? '▶' : '♫';
  }

  const typeClass = type === 'youtube' ? 'youtube' : 'radio';
  const typeLabel = type === 'youtube' ? 'YouTube' : 'Radio';

  nowPlaying.innerHTML = `
    <div class="np-name">${escHtml(name)}</div>
    <div class="np-track hidden"></div>
    <div class="np-sub">
      <span class="np-dot"></span>
      <span class="np-type-badge ${typeClass}">${typeLabel}</span>
      Live
    </div>`;

  waveform.classList.add('active');

  // Auto-expand player bar on mobile when playback starts
  if (window.matchMedia('(max-width: 600px)').matches && !playerOpen) {
    playerOpen = true;
    localStorage.setItem('rp_player_open', 'true');
    applyPlayerState();
  }

  startTimer();
  updateCardHighlights();
  refreshHistoryPanel();

  // Fetch metadata shortly after starting (give VLC time to connect)
  if (type === 'radio') {
    lastMetaTitle = null;
    setTimeout(fetchMetadata, 4000);
  }
}

function clearPlaying() {
  currentUrl  = null;
  currentName = null;
  startedAt   = null;

  btnStop.disabled = true;
  npFavicon.classList.add('hidden');
  npFaviconPh.classList.remove('hidden');
  npFaviconPh.textContent = '♫';
  nowPlaying.innerHTML = '<span class="np-idle">No station playing</span>';
  playTimer.textContent = '';

  waveform.classList.remove('active');
  stopTimer();
  lastMetaTitle = null;
  updateCardHighlights();
}

function updateCardHighlights() {
  document.querySelectorAll('.station-card').forEach(card => {
    const active = card.dataset.url === currentUrl;
    card.classList.toggle('playing', active);
    const btn = card.querySelector('.btn-play');
    if (btn) { btn.classList.toggle('playing', active); btn.textContent = active ? '■ Playing' : '▶ Play'; }
  });
  document.querySelectorAll('.fav-row, .hist-row').forEach(row => {
    const active = row.dataset.url === currentUrl;
    row.classList.toggle('playing', active);
    const btn = row.querySelector('.fav-play, .hist-play');
    if (btn) { btn.classList.toggle('playing', active); btn.textContent = active ? '■' : '▶'; }
  });
}

// ── Timer ──
function startTimer() {
  stopTimer();
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}
function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
function updateTimer() {
  if (!startedAt) { playTimer.textContent = ''; return; }
  playTimer.textContent = formatDuration(Math.floor(Date.now() / 1000) - startedAt);
}
function formatDuration(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

// ── Favourites ──
function toggleFav(btn, url, station) {
  if (favorites[url]) {
    delete favorites[url];
    btn.classList.remove('active');
  } else {
    favorites[url] = typeof station === 'object' ? station : { name: station, url };
    btn.classList.add('active');
  }
  saveFavorites();
}
function saveFavorites() {
  localStorage.setItem('rp_favorites', JSON.stringify(favorites));
}

// ── Home Panels ──
const HOME_TAGS = [
  'pop','rock','jazz','classical','electronic','hip-hop','house','techno',
  'metal','blues','folk','reggae','country','soul','rnb','punk','indie',
  'news','talk','sport','ambient','lounge','chillout','disco','latin',
  'christian','gospel','oldies','80s','90s','top 40',
];

function renderHome() {
  grid.className = 'home-panels';
  grid.innerHTML = '';

  // Tags panel
  const tagsPanel = document.createElement('div');
  tagsPanel.className = 'home-panel';
  tagsPanel.innerHTML = `<div class="panel-header">🏷️ Browse by Genre</div>
    <div class="panel-body"><div class="panel-tags">${HOME_TAGS.map(t =>
      `<button class="tag-chip" data-tag="${escHtml(t)}">${escHtml(t)}</button>`).join('')}</div></div>`;
  tagsPanel.querySelectorAll('.tag-chip').forEach(btn =>
    btn.addEventListener('click', () => { filterTag.value = btn.dataset.tag; searchQ.value = ''; doSearch(); }));

  // Favorites panel
  const favPanel = document.createElement('div');
  favPanel.className = 'home-panel';
  favPanel.innerHTML = `<div class="panel-header">♡ Favorites</div><div class="panel-body"><div id="panel-favorites-list"></div></div>`;
  favPanel.addEventListener('dragover', e => { e.preventDefault(); favPanel.classList.add('drop-target'); });
  favPanel.addEventListener('dragleave', () => favPanel.classList.remove('drop-target'));
  favPanel.addEventListener('drop', e => {
    e.preventDefault();
    favPanel.classList.remove('drop-target');
    try {
      const item = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!item.url || favorites[item.url]) return;
      favorites[item.url] = { name: item.name, url: item.url, favicon: item.favicon || '', tags: '', country: '', countrycode: '' };
      saveFavorites();
      renderFavoritesPanel(document.getElementById('panel-favorites-list'));
    } catch {}
  });

  // History panel
  const histPanel = document.createElement('div');
  histPanel.className = 'home-panel';
  histPanel.innerHTML = `<div class="panel-header">🕐 History</div><div class="panel-body"><div id="panel-history-list"><p class="panel-empty">No history yet.</p></div></div>`;

  grid.appendChild(tagsPanel);
  grid.appendChild(favPanel);
  grid.appendChild(histPanel);

  renderFavoritesPanel(document.getElementById('panel-favorites-list'));
  loadHistoryPanel();
}

function renderFavoritesPanel(container) {
  const keys = Object.keys(favorites);
  if (!keys.length) { container.innerHTML = '<p class="panel-empty">No favorites yet. Click ♡ on a station card.</p>'; return; }
  container.innerHTML = '';
  keys.forEach(url => {
    const s = favorites[url], name = s.name || url, isPlaying = currentUrl === url;
    const logoHtml = s.favicon
      ? `<img class="fav-logo" src="${escHtml(s.favicon)}" alt=""
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="fav-logo-placeholder" style="display:none">${firstLetter(name)}</div>`
      : `<div class="fav-logo-placeholder">${firstLetter(name)}</div>`;
    const tags = s.tags ? s.tags.split(',').slice(0,2).map(t=>t.trim()).filter(Boolean) : [];

    const row = document.createElement('div');
    row.className = 'fav-row' + (isPlaying ? ' playing' : '');
    row.dataset.url = url;
    row.innerHTML = `
      <div class="fav-logo-wrap">${logoHtml}</div>
      <div class="fav-info">
        <div class="fav-name" title="${escHtml(name)}">${escHtml(name)}</div>
        <div class="fav-meta">${tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}
          ${s.country ? `<span>${flagEmoji(s.countrycode)} ${escHtml(s.country)}</span>` : ''}</div>
      </div>
      <button class="fav-play${isPlaying?' playing':''}">${isPlaying?'■':'▶'}</button>
      <button class="fav-remove" title="Remove">✕</button>`;

    row.querySelector('.fav-play').addEventListener('click', () => doPlay(url, name, s.favicon));
    row.querySelector('.fav-remove').addEventListener('click', () => {
      delete favorites[url]; saveFavorites();
      renderFavoritesPanel(container);
    });
    container.appendChild(row);
  });
}

function loadHistoryPanel() {
  const container = document.getElementById('panel-history-list');
  if (!container) return;
  renderHistoryPanel(container, history);
}

function addToHistory(name, url, favicon, type) {
  // Deduplicate consecutive same-URL plays
  if (history.length && history[0].url === url) return;
  history.unshift({ name, url, favicon: favicon || '', type, played_at: Math.floor(Date.now() / 1000) });
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('rp_history', JSON.stringify(history));
}

function renderHistoryPanel(container, items) {
  if (!items || !items.length) { container.innerHTML = '<p class="panel-empty">No history yet.</p>'; return; }
  container.innerHTML = '';
  items.forEach(item => {
    const url = item.url, name = item.name, type = item.type || 'radio';
    const isPlaying = currentUrl === url;
    const logoHtml = item.favicon
      ? `<img class="hist-logo" src="${escHtml(item.favicon)}" alt=""
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="hist-logo-placeholder${type==='youtube'?' yt':''}" style="display:none">${type==='youtube'?'▶':firstLetter(name)}</div>`
      : `<div class="hist-logo-placeholder${type==='youtube'?' yt':''}">${type==='youtube'?'▶':firstLetter(name)}</div>`;

    const row = document.createElement('div');
    row.className = 'hist-row' + (isPlaying ? ' playing' : '');
    row.dataset.url = url;
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify({ name, url, favicon: item.favicon || '' }));
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.innerHTML = `
      <div class="hist-logo-wrap">${logoHtml}</div>
      <div class="hist-info">
        <div class="hist-name" title="${escHtml(name)}">${escHtml(name)}</div>
        <div class="hist-meta">
          <span class="hist-type-badge ${type}">${type}</span>
          <span class="hist-time">${timeAgo(item.played_at)}</span>
        </div>
      </div>
      <button class="hist-play${isPlaying?' playing':''}">${isPlaying?'■':'▶'}</button>`;

    row.querySelector('.hist-play').addEventListener('click', () => {
      if (type === 'youtube') {
        ytUrl.value = url;
        toggleYtOverlay(true);
      } else {
        doPlay(url, name, item.favicon || '');
      }
    });
    container.appendChild(row);
  });
}

function refreshHistoryPanel() {
  loadHistoryPanel();
}

function timeAgo(ts) {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60)   return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

// ── Theme ──
function applyTheme(day) {
  document.body.classList.toggle('day', day);
  btnTheme.innerHTML = day ? moonSvg : sunSvg;
  btnTheme.dataset.tooltip = day ? 'Switch to night mode' : 'Switch to day mode';
}

// ── Volume ──
let volDebounce = null;

function initVolume() {
  const saved = parseInt(localStorage.getItem('rp_volume') ?? '78');
  setSliderUI(saved);
  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value);
    setSliderUI(v);
    clearTimeout(volDebounce);
    volDebounce = setTimeout(() => sendVolume(v), 120);
  });
  volIcon.addEventListener('click', () => {
    const v = parseInt(volSlider.value);
    const next = v > 0 ? 0 : (parseInt(localStorage.getItem('rp_volume') ?? '78') || 78);
    setSliderUI(next);
    sendVolume(next);
  });
}
function setSliderUI(v) {
  const max = playbackMode === 'server' ? 150 : 100;
  volSlider.max = max;
  v = Math.min(v, max);
  volSlider.value = v;
  volVal.textContent = v + '%';
  volSlider.style.setProperty('--pct', (v / max * 100).toFixed(1) + '%');
  volIcon.textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
}
async function sendVolume(v) {
  if (v > 0) localStorage.setItem('rp_volume', v);
  if (playbackMode === 'browser') {
    audioEl.volume = Math.min(v, 100) / 100;
    return;
  }
  const form = new FormData();
  form.append('level', v);
  try { await fetch(`${BASE}/volume.php`, { method: 'POST', body: form }); } catch {}
}

// ── Status messages ──
function showMsg(text, type) { statusMsg.textContent = text; statusMsg.className = `status-msg ${type}`; }
function hideMsg() { statusMsg.className = 'status-msg hidden'; }

// ── Utilities ──
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function firstLetter(name) { return name ? name.charAt(0).toUpperCase() : '?'; }
function flagEmoji(code) {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('');
}

// ── Diagnostics ──
async function openTestModal() {
  testModal.classList.remove('hidden');
  testModalBody.innerHTML = '<div class="test-running"><div class="spinner"></div> Running tests…</div>';
  const results = playbackMode === 'browser' ? await runBrowserTests() : await runServerTests();
  renderTestResults(results);
}

async function runBrowserTests() {
  const results = [];

  // Audio element support
  const audioSupport = !!window.HTMLAudioElement;
  results.push({ label: 'HTML5 Audio supported', ok: audioSupport });

  // Fetch API
  results.push({ label: 'Fetch API available', ok: typeof fetch === 'function' });

  // LocalStorage
  let lsOk = false;
  try { localStorage.setItem('rp_test', '1'); localStorage.removeItem('rp_test'); lsOk = true; } catch {}
  results.push({ label: 'LocalStorage available', ok: lsOk });

  // MP3/AAC support
  const audio = new Audio();
  const mp3 = audio.canPlayType('audio/mpeg') !== '';
  const aac = audio.canPlayType('audio/aac') !== '';
  results.push({ label: 'MP3 decode support', ok: mp3, detail: audio.canPlayType('audio/mpeg') || 'no' });
  results.push({ label: 'AAC decode support', ok: aac, detail: audio.canPlayType('audio/aac') || 'no' });

  // Radio Browser API reachable
  try {
    const r = await fetch('https://all.api.radio-browser.info/json/stats', { signal: AbortSignal.timeout(6000) });
    results.push({ label: 'Radio Browser API reachable', ok: r.ok, detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}` });
  } catch (e) {
    results.push({ label: 'Radio Browser API reachable', ok: false, detail: e.message });
  }

  // Local search API (PHP backend up at all)
  try {
    const r = await fetch(`${BASE}/search.php?q=test&limit=1`, { signal: AbortSignal.timeout(6000) });
    results.push({ label: 'Local search API (PHP)', ok: r.ok, detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}` });
  } catch (e) {
    results.push({ label: 'Local search API (PHP)', ok: false, detail: e.message });
  }

  return results;
}

async function runServerTests() {
  const results = [];

  // Local search API
  try {
    const r = await fetch(`${BASE}/search.php?q=test&limit=1`, { signal: AbortSignal.timeout(6000) });
    results.push({ label: 'Local search API (PHP)', ok: r.ok, detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}` });
  } catch (e) {
    results.push({ label: 'Local search API (PHP)', ok: false, detail: e.message });
  }

  // Server diagnostics endpoint
  try {
    const r = await fetch(`${BASE}/test.php`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) {
      results.push({ label: 'Server test endpoint', ok: false, detail: `HTTP ${r.status}` });
      return results;
    }
    const data = await r.json();
    results.push({ label: 'Server test endpoint', ok: true });
    (data.tests || []).forEach(t => results.push(t));
  } catch (e) {
    results.push({ label: 'Server test endpoint', ok: false, detail: e.message });
  }

  return results;
}

function renderTestResults(results) {
  const allOk = results.every(r => r.ok);
  const modeLabel = playbackMode === 'browser' ? '🔊 Browser mode' : '🖥 Server mode';
  let html = `<div class="test-mode-label">${modeLabel}</div>`;
  html += '<ul class="test-list">';
  for (const r of results) {
    const icon = r.ok ? '<span class="test-ok">✓</span>' : '<span class="test-fail">✗</span>';
    const detail = r.detail ? `<span class="test-detail">${escHtml(r.detail)}</span>` : '';
    html += `<li class="test-item">${icon} <span class="test-label">${escHtml(r.label)}</span>${detail}</li>`;
  }
  html += '</ul>';
  html += allOk
    ? '<div class="test-summary ok">✓ All tests passed</div>'
    : '<div class="test-summary fail">✗ Some tests failed — see details above<br><a class="test-install-link" href="https://github.com/acosonic/radioplay#installation" target="_blank">📖 View install instructions</a></div>';
  testModalBody.innerHTML = html;
}

// ── PWA: Service Worker + Install prompt ──
const btnInstall = document.getElementById('btn-install');
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstall.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  btnInstall.classList.add('hidden');
  deferredInstallPrompt = null;
});

btnInstall.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    btnInstall.classList.add('hidden');
    deferredInstallPrompt = null;
  }
});
