/**
 * Music Player Component — Category Tabs Edition
 * HTML5 Audio API | No frameworks | localStorage persistence
 *
 * Usage:
 *   <link rel="stylesheet" href="components/music-player/music-player.css">
 *   <script src="components/music-player/music-player.js"></script>
 *
 * It auto-inits and mounts to document.body.
 * Or call: MusicPlayer.init({ container: '#your-container' })
 *
 *
 * ============ HOW TO ADD MUSIC ============
 *
 * 1. Put your .mp3 files in  assets/music/
 *
 * 2. Open this file and find the CATEGORIES object below.
 *
 * 3. Add a track to the matching category:
 *
 *    const CATEGORIES = {
 *      rap: {
 *        name: '说唱',
 *        icon: '🎤',
 *        tracks: [
 *          { title: '歌名', artist: '作者', src: 'assets/music/文件名.mp3' },  // ← add here
 *        ],
 *      },
 *      pop:    { ... },   // 流行
 *      rock:   { ... },   // 摇滚
 *      instrumental: { ... },  // 纯音乐
 *      special: { ... },  // (ﾟω´)
 *    };
 *
 * 4. Done — no rebuild needed, just refresh the page.
 * ===========================================
 */
;(function () {
  'use strict';

  /* ============================================
     CATEGORIES — Add music here!
     ============================================ */
  const CATEGORIES = {
    /* --- 说唱 --- */
    rap: {
      name: '说唱',
      icon: '🎤',
      tracks: [
        { title: '弃子',         artist: 'from秋末', src: 'assets/music/弃子.mp3' },
        { title: 'sakana',       artist: 'from秋末', src: 'assets/music/sakana.mp3' },
        { title: '3dgirl没有爱', artist: 'from秋末', src: 'assets/music/3dgirl没有爱.mp3' },
        { title: '19-2000', artist: 'from虞CH', src: 'assets/music/19-2000.mp3' },
        { title: '烂泥', artist: 'from秋末', src: 'assets/music/烂泥.mp3' },
        { title: '创口贴', artist: 'from秋末', src: 'assets/music/创口贴.mp3' },
      ],
    },

    /* --- 流行 --- */
    pop: {
      name: '流行',
      icon: '🎵',
      tracks: [
        { title: 'payphone',       artist: 'from秋末', src: 'assets/music/payphone.mp3' },
        { title: 'maybe',          artist: 'from秋末',     src: 'assets/music/maybe.mp3' },
        { title: '零距离的思念',    artist: 'from秋末',     src: 'assets/music/零距离的思念.mp3' },
        
        
      ],
    },

    /* --- 摇滚 --- */
    rock: {
      name: '摇滚',
      icon: '🎸',
      tracks: [
        { title: 'rifle', artist: 'from秋末', src: 'assets/music/rifle.mp3' },
      ],
    },

    /* --- 纯音乐 --- */
    instrumental: {
      name: '纯音乐',
      icon: '🎹',
      tracks: [
        { title: '星际拓荒(南方见)', artist: 'from秋末', src: 'assets/music/星际拓荒(南方见).mp3' },
      ],
    },

    /* --- (ﾟω´) --- */
    special: {
      name: '(ﾟω´)',
      icon: '(ﾟω´)',
      tracks: [
        { title: 'Who Says',         artist: 'from万ZH', src: 'assets/music/Who Says.mp3' },
        { title: 'We Are The World', artist: 'from虞CH', src: 'assets/music/We Are The World.mp3' },
        { title: 'tek it',           artist: 'from秋末', src: 'assets/music/tek it.mp3' },
        { title: 'I Love You 3000',    artist: 'from吴YY',     src: 'assets/music/I Love You 3000.mp3' },
      ],
    },
  };

  /* Category order for display */
  const CATEGORY_ORDER = ['rap', 'pop', 'rock', 'instrumental', 'special'];

  /* ============================================
     STATE
     ============================================ */
  const LS_KEY = 'mp_state_v2';
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  let activeCategory = 'pop';
  let currentIndex = 0;
  let volume = 0.7;
  let isPlaying = false;
  let panelOpen = false;
  let seeking = false;
  let shuffle = false;
  let loopMode = 'all'; // 'all', 'one', 'none'
  let lastVol = 0.7;

  /* ============================================
     DOM REFS
     ============================================ */
  let $root, $toggle, $panel, $title, $progressFill, $progressBar;
  let $timeNow, $timeTotal, $btnPrev, $btnPlay, $btnNext;
  let $volumeIcon, $volumeSlider, $playlistEl, $categoriesEl, $artistEl;
  let $btnShuffle, $btnLoop;

  /* ============================================
     SVG ICONS
     ============================================ */
  const icons = {
    music: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
    prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>',
    next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>',
    volHigh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>',
    volLow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>',
    volMute: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    shuffle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    loop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
  };

  /* ============================================
     HELPERS
     ============================================ */
  function fmt(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function escapeHTML(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getTracks() {
    return CATEGORIES[activeCategory] ? CATEGORIES[activeCategory].tracks : [];
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        category: activeCategory,
        index: currentIndex,
        volume: volume,
        shuffle: shuffle,
        loopMode: loopMode,
      }));
    } catch (_) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s.category && CATEGORIES[s.category]) {
        activeCategory = s.category;
      }
      var tracks = getTracks();
      if (typeof s.index === 'number' && s.index >= 0 && s.index < tracks.length) {
        currentIndex = s.index;
      }
      if (typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) {
        volume = s.volume;
      }
      if (typeof s.shuffle === 'boolean') {
        shuffle = s.shuffle;
      }
      if (s.loopMode === 'all' || s.loopMode === 'one' || s.loopMode === 'none') {
        loopMode = s.loopMode;
      }
    } catch (_) {}
  }

  /* ============================================
     MODULE: Spectrum Visualizer (Web Audio API)
     ============================================ */
  const SpectrumVisualizer = {
    canvas: null,
    ctx: null,
    audioContext: null,
    analyser: null,
    source: null,
    animFrame: null,
    bars: 40,
    initialized: false,
    connected: false,
    dataArray: null,
    audioEl: null,
    w: 0,
    h: 0,

    init(canvasEl, audioEl) {
      this.canvas = canvasEl;
      this.audioEl = audioEl;
      this.ctx = canvasEl.getContext('2d');
      this._resize();
    },

    _resize() {
      if (!this.canvas || !this.ctx) return;
      var dpr = window.devicePixelRatio || 1;
      var rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var newW = Math.round(rect.width * dpr);
      var newH = Math.round(rect.height * dpr);
      if (this.canvas.width === newW && this.canvas.height === newH) return;
      this.canvas.width = newW;
      this.canvas.height = newH;
      this.ctx.scale(dpr, dpr);
      this.w = rect.width;
      this.h = rect.height;
    },

    _initAudioContext() {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        var bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.initialized = true;
      } catch (e) {
        console.warn('[Spectrum] AudioContext init failed:', e);
      }
    },

    _connect() {
      if (this.connected || !this.initialized) return;
      try {
        this.source = this.audioContext.createMediaElementSource(this.audioEl);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.connected = true;
      } catch (e) {
        console.warn('[Spectrum] Connect failed:', e);
      }
    },

    ensureAudioGraph(callback) {
      if (!this.canvas || !this.ctx) { if (callback) callback(); return; }
      if (this.connected) { if (callback) callback(); return; }
      /* Skip Web Audio API for file:// protocol (CORS restriction) */
      if (location.protocol === 'file:') { if (callback) callback(); return; }
      if (!this.initialized) this._initAudioContext();
      var self = this;
      function doConnect() {
        self._connect();
        if (callback) callback();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(doConnect);
      } else {
        doConnect();
      }
    },

    start() {
      if (!this.canvas || !this.ctx) return;
      /* file:// protocol — skip canvas animation (no audio data due to CORS) */
      if (location.protocol === 'file:') return;
      var self = this;
      function beginAnimate() {
        if (self.animFrame === null) {
          self._resize();
          self._animate();
        }
      }
      this.ensureAudioGraph(beginAnimate);
    },

    stop() {
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.w, this.h);
      }
    },

    _draw() {
      if (!this.ctx || !this.canvas || !this.w || !this.h || !this.analyser) return;
      var ctx = this.ctx;
      var w = this.w;
      var h = this.h;
      ctx.clearRect(0, 0, w, h);

      this.analyser.getByteFrequencyData(this.dataArray);

      var barCount = this.bars;
      var step = Math.floor(this.dataArray.length / barCount);
      var barWidth = (w / barCount) * 0.65;
      var gap = (w / barCount) * 0.35;
      var radius = 2;

      for (var i = 0; i < barCount; i++) {
        var sum = 0;
        for (var j = 0; j < step; j++) {
          sum += this.dataArray[i * step + j];
        }
        var avg = sum / step;
        var pct = avg / 255;
        var barHeight = Math.max(1, pct * h * 0.85);
        var x = i * (barWidth + gap) + gap / 2;
        var y = h - barHeight;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, h);
        ctx.lineTo(x, h);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        var gradient = ctx.createLinearGradient(x, y, x, h);
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(0.5, '#7c3aed');
        gradient.addColorStop(1, '#6366f1');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    },

    _animate() {
      this._draw();
      this.animFrame = requestAnimationFrame(this._animate.bind(this));
    },

    dispose() {
      this.stop();
      if (this.source) {
        try { this.source.disconnect(); } catch (e) {}
        this.source = null;
      }
      if (this.analyser) {
        try { this.analyser.disconnect(); } catch (e) {}
        this.analyser = null;
      }
      if (this.audioContext) {
        this.audioContext.close().catch(function () {});
        this.audioContext = null;
      }
      this.initialized = false;
      this.connected = false;
      this.dataArray = null;
      this.canvas = null;
      this.ctx = null;
    },
  };

  /* ============================================
     FADE TRANSITION HELPERS
     ============================================ */
  function fadeOut(duration, callback) {
    var startVol = audio.volume;
    if (startVol === 0) { if (callback) callback(); return; }
    var startTime = performance.now();
    function step(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = startVol * (1 - eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        audio.volume = 0;
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  }

  function fadeIn(duration) {
    if (volume === 0) return;
    var startTime = performance.now();
    function step(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = volume * eased;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        audio.volume = volume;
      }
    }
    requestAnimationFrame(step);
  }

  /* ============================================
     BUILD DOM
     ============================================ */
  function buildCategoriesHTML() {
    return CATEGORY_ORDER.map(function (key) {
      var cat = CATEGORIES[key];
      var count = cat.tracks.length;
      return (
        '<button class="mp-cat-tab' + (key === activeCategory ? ' mp-cat-active' : '') + '" data-cat="' + key + '">' +
          '<span class="mp-cat-icon">' + cat.icon + '</span>' +
          '<span class="mp-cat-name">' + escapeHTML(cat.name) + '</span>' +
          '<span class="mp-cat-count">' + count + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function buildPlaylistHTML() {
    var tracks = getTracks();

    if (tracks.length === 0) {
      return (
        '<div class="mp-playlist-empty">' +
          '<div class="mp-playlist-empty-icon">🎶</div>' +
          '<div class="mp-playlist-empty-text">这个分类还没有歌曲<br>快去添加吧！</div>' +
        '</div>'
      );
    }

    return tracks.map(function (track, i) {
      var artistText = track.artist ? escapeHTML(track.artist) : '';
      return (
        '<div class="mp-playlist-item' + (i === currentIndex ? ' mp-active' : '') + '" data-index="' + i + '">' +
          '<span class="mp-pl-index">' +
            '<span class="mp-pl-index-num">' + (i + 1) + '</span>' +
            '<span class="mp-pl-bars">' +
              '<span class="mp-pl-bar"></span>' +
              '<span class="mp-pl-bar"></span>' +
              '<span class="mp-pl-bar"></span>' +
            '</span>' +
          '</span>' +
          '<span class="mp-pl-info">' +
            '<span class="mp-pl-title">' + escapeHTML(track.title) + '</span>' +
            (artistText ? '<span class="mp-pl-artist">' + artistText + '</span>' : '') +
          '</span>' +
        '</div>'
      );
    }).join('');
  }

  function mount(target) {
    var el = document.createElement('div');
    el.className = 'mp';
    el.innerHTML =
      '<button class="mp-toggle" aria-label="Toggle music player">' +
        '<span class="mp-disc"></span>' +
        icons.music +
      '</button>' +

      '<div class="mp-panel">' +
        /* Now Playing */
        '<div class="mp-now">' +
          '<div class="mp-title" id="mp-title">' +
            (getTracks()[currentIndex] ? escapeHTML(getTracks()[currentIndex].title) : '未选择歌曲') +
          '</div>' +
          '<div class="mp-artist" id="mp-artist">' +
            (getTracks()[currentIndex] && getTracks()[currentIndex].artist
              ? escapeHTML(getTracks()[currentIndex].artist) + ' · '
              : '') +
            escapeHTML(CATEGORIES[activeCategory].name) +
          '</div>' +
        '</div>' +

        /* Progress */
        '<div class="mp-progress-wrap">' +
          '<div class="mp-progress-bar" id="mp-progress-bar">' +
            '<div class="mp-progress-fill" id="mp-progress-fill"></div>' +
          '</div>' +
          '<div class="mp-time">' +
            '<span id="mp-time-now">0:00</span>' +
            '<span id="mp-time-total">0:00</span>' +
          '</div>' +
        '</div>' +

        /* Controls */
        '<div class="mp-controls">' +
          '<button class="mp-btn mp-btn-shuffle' + (shuffle ? ' mp-active' : '') + '" id="mp-btn-shuffle" aria-label="Shuffle">' + icons.shuffle + '</button>' +
          '<button class="mp-btn mp-btn-prev" id="mp-btn-prev" aria-label="Previous">' + icons.prev + '</button>' +
          '<button class="mp-btn mp-btn-play" id="mp-btn-play" aria-label="Play">' + icons.play + '</button>' +
          '<button class="mp-btn mp-btn-next" id="mp-btn-next" aria-label="Next">' + icons.next + '</button>' +
          '<button class="mp-btn mp-btn-loop' + (loopMode !== 'all' ? ' mp-active' : '') + (loopMode === 'one' ? ' mp-loop-one' : '') + '" id="mp-btn-loop" aria-label="Loop">' + icons.loop + '</button>' +
        '</div>' +

        /* Spectrum */
        '<canvas class="mp-spectrum" id="mp-spectrum"></canvas>' +

        /* Volume */
        '<div class="mp-volume-row">' +
          '<span class="mp-volume-icon" id="mp-volume-icon">' + icons.volHigh + '</span>' +
          '<input type="range" class="mp-volume-slider" id="mp-volume-slider" min="0" max="1" step="0.01" value="' + volume + '">' +
        '</div>' +

        /* Category Tabs */
        '<div class="mp-categories" id="mp-categories">' +
          buildCategoriesHTML() +
        '</div>' +

        /* Playlist */
        '<div class="mp-playlist" id="mp-playlist">' +
          '<div class="mp-playlist-label">' +
            '<span>' + escapeHTML(CATEGORIES[activeCategory].name) + '</span>' +
            '<span class="mp-playlist-count" id="mp-playlist-count">' + getTracks().length + ' 首</span>' +
          '</div>' +
          buildPlaylistHTML() +
        '</div>' +
      '</div>';

    (target || document.body).appendChild(el);

    $root          = el;
    $toggle        = el.querySelector('.mp-toggle');
    $panel         = el.querySelector('.mp-panel');
    $title         = el.querySelector('#mp-title');
    var $artist    = el.querySelector('#mp-artist');
    $progressFill  = el.querySelector('#mp-progress-fill');
    $progressBar   = el.querySelector('#mp-progress-bar');
    $timeNow       = el.querySelector('#mp-time-now');
    $timeTotal     = el.querySelector('#mp-time-total');
    $btnPrev       = el.querySelector('#mp-btn-prev');
    $btnPlay       = el.querySelector('#mp-btn-play');
    $btnNext       = el.querySelector('#mp-btn-next');
    $volumeIcon    = el.querySelector('#mp-volume-icon');
    $volumeSlider  = el.querySelector('#mp-volume-slider');
    $categoriesEl  = el.querySelector('#mp-categories');
    $playlistEl    = el.querySelector('#mp-playlist');
    $btnShuffle    = el.querySelector('#mp-btn-shuffle');
    $btnLoop       = el.querySelector('#mp-btn-loop');

    /* Init spectrum visualizer */
    var $spectrum = el.querySelector('#mp-spectrum');
    SpectrumVisualizer.init($spectrum, audio);
    SpectrumVisualizer._resize();
  }

  /* ============================================
     REFRESH PLAYLIST (when switching categories)
     ============================================ */
  function refreshPlaylist() {
    var tracks = getTracks();

    /* Update label + count */
    var label = $playlistEl.querySelector('.mp-playlist-label');
    var countEl = $playlistEl.querySelector('#mp-playlist-count');
    if (label) label.firstChild.textContent = CATEGORIES[activeCategory].name;
    if (countEl) countEl.textContent = tracks.length + ' 首';

    /* Update artist line */
    var $artist = $root.querySelector('#mp-artist');
    if ($artist) {
      var track = tracks[currentIndex];
      if (track && track.artist) {
        $artist.textContent = escapeHTML(track.artist) + ' · ' + escapeHTML(CATEGORIES[activeCategory].name);
      } else {
        $artist.textContent = escapeHTML(CATEGORIES[activeCategory].name);
      }
    }

    /* Rebuild list */
    var itemsHTML = buildPlaylistHTML();
    /* Keep the label, replace the rest */
    var labelEl = $playlistEl.querySelector('.mp-playlist-label');
    $playlistEl.innerHTML = '';
    if (labelEl) $playlistEl.appendChild(labelEl);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = itemsHTML;
    while (wrapper.firstChild) {
      $playlistEl.appendChild(wrapper.firstChild);
    }

    /* Update category tab counts & active */
    $categoriesEl.querySelectorAll('.mp-cat-tab').forEach(function (tab) {
      var key = tab.getAttribute('data-cat');
      tab.classList.toggle('mp-cat-active', key === activeCategory);
      var countSpan = tab.querySelector('.mp-cat-count');
      if (countSpan) countSpan.textContent = CATEGORIES[key].tracks.length;
    });
  }

  /* ============================================
     UPDATE UI
     ============================================ */
  function updatePlayBtn() {
    $btnPlay.innerHTML = isPlaying ? icons.pause : icons.play;
    $toggle.classList.toggle('mp-playing', isPlaying);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  function updateProgress() {
    if (seeking) return;
    var pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    $progressFill.style.width = pct + '%';
    $timeNow.textContent = fmt(audio.currentTime);
  }

  function updateDuration() {
    $timeTotal.textContent = fmt(audio.duration);
  }

  function updateTitle() {
    var tracks = getTracks();
    $title.textContent = tracks[currentIndex] ? tracks[currentIndex].title : '未选择歌曲';
  }

  function updateVolumeIcon() {
    if (volume === 0) {
      $volumeIcon.innerHTML = icons.volMute;
    } else if (volume < 0.5) {
      $volumeIcon.innerHTML = icons.volLow;
    } else {
      $volumeIcon.innerHTML = icons.volHigh;
    }
  }

  function highlightPlaylist() {
    var items = $playlistEl.querySelectorAll('.mp-playlist-item');
    items.forEach(function (item, i) {
      item.classList.toggle('mp-active', i === currentIndex);
    });
  }

  function scrollToActiveTrack() {
    var active = $playlistEl.querySelector('.mp-playlist-item.mp-active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    var tracks = getTracks();
    var track = tracks[currentIndex];
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || CATEGORIES[activeCategory].name,
        album: CATEGORIES[activeCategory].name,
      });
    }
  }

  /* ============================================
     AUDIO LOGIC
     ============================================ */
  function loadTrack(index, autoPlay) {
    var tracks = getTracks();
    if (tracks.length === 0) return;

    currentIndex = ((index % tracks.length) + tracks.length) % tracks.length;

    function doLoad() {
      audio.src = tracks[currentIndex].src;
      audio.load();
      updateTitle();
      highlightPlaylist();
      scrollToActiveTrack();
      updateMediaSession();
      updateProgress();
      save();

      if (autoPlay) {
        SpectrumVisualizer.ensureAudioGraph(function () {
          audio.play().then(function () {
            isPlaying = true;
            updatePlayBtn();
            SpectrumVisualizer.start();
            if (volume > 0) fadeIn(250);
          }).catch(function () {});
        });
      }
    }

    if (isPlaying && audio.src && audio.volume > 0) {
      fadeOut(200, doLoad);
    } else {
      audio.volume = volume;
      doLoad();
    }
  }

  function togglePlay() {
    var tracks = getTracks();
    if (tracks.length === 0) return;
    if (!audio.src) {
      loadTrack(currentIndex, true);
      return;
    }
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      SpectrumVisualizer.ensureAudioGraph(function () {
        audio.play().then(function () {
          isPlaying = true;
          SpectrumVisualizer.start();
        }).catch(function () {});
      });
    }
    updatePlayBtn();
  }

  function playPrev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      updateProgress();
      return;
    }
    var tracks = getTracks();
    var prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      if (loopMode === 'all') {
        loadTrack(tracks.length - 1, isPlaying);
      } else {
        audio.currentTime = 0;
        updateProgress();
      }
      return;
    }
    loadTrack(prevIndex, isPlaying);
  }

  function playNext() {
    var tracks = getTracks();
    if (tracks.length === 0) return;

    if (loopMode === 'one') {
      audio.currentTime = 0;
      if (isPlaying) {
        SpectrumVisualizer.ensureAudioGraph(function () {
          audio.play().catch(function () {});
        });
      }
      updateProgress();
      return;
    }

    if (shuffle) {
      var nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } while (tracks.length > 1 && nextIndex === currentIndex);
      loadTrack(nextIndex, isPlaying);
      return;
    }

    var nextIndex = currentIndex + 1;
    if (nextIndex >= tracks.length) {
      if (loopMode === 'all') {
        loadTrack(0, isPlaying);
      }
      return;
    }
    loadTrack(nextIndex, isPlaying);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    audio.volume = volume;
    $volumeSlider.value = volume;
    updateVolumeIcon();
    save();
  }

  /* ============================================
     SEEK
     ============================================ */
  function seekFromEvent(e) {
    var rect = $progressBar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
    $progressFill.style.width = (pct * 100) + '%';
    $timeNow.textContent = fmt(audio.duration ? pct * audio.duration : 0);
  }

  function onProgressDown(e) {
    seeking = true;
    seekFromEvent(e);
    function onMove(ev) { seekFromEvent(ev); }
    function onUp() {
      seeking = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onProgressTouchStart(e) {
    seeking = true;
    seekFromEvent(e.touches[0]);
    function onMove(ev) { ev.preventDefault(); seekFromEvent(ev.touches[0]); }
    function onEnd() {
      seeking = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  /* ============================================
     EVENT BINDING
     ============================================ */
  function bindEvents() {
    /* Toggle panel */
    $toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      panelOpen = !panelOpen;
      $panel.classList.toggle('mp-open', panelOpen);
      if (panelOpen && !audio.src) {
        loadTrack(currentIndex, false);
      }
    });

    /* Click outside to close */
    document.addEventListener('click', function (e) {
      if (panelOpen && !$root.contains(e.target)) {
        panelOpen = false;
        $panel.classList.remove('mp-open');
      }
    });

    /* Play / Pause */
    $btnPlay.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlay();
    });

    /* Prev / Next */
    $btnPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      playPrev();
    });
    $btnNext.addEventListener('click', function (e) {
      e.stopPropagation();
      playNext();
    });

    /* Volume */
    $volumeSlider.addEventListener('input', function () {
      setVolume(parseFloat(this.value));
    });

    $volumeIcon.addEventListener('click', function () {
      if (volume > 0) {
        lastVol = volume;
        setVolume(0);
      } else {
        setVolume(lastVol || 0.7);
      }
    });

    /* Shuffle */
    $btnShuffle.addEventListener('click', function (e) {
      e.stopPropagation();
      shuffle = !shuffle;
      $btnShuffle.classList.toggle('mp-active', shuffle);
      save();
    });

    /* Loop */
    $btnLoop.addEventListener('click', function (e) {
      e.stopPropagation();
      if (loopMode === 'all') {
        loopMode = 'one';
      } else if (loopMode === 'one') {
        loopMode = 'none';
      } else {
        loopMode = 'all';
      }
      $btnLoop.classList.toggle('mp-active', loopMode !== 'all');
      $btnLoop.classList.toggle('mp-loop-one', loopMode === 'one');
      save();
    });

    /* Progress seek */
    $progressBar.addEventListener('mousedown', onProgressDown);
    $progressBar.addEventListener('touchstart', onProgressTouchStart, { passive: false });

    /* Category tab click */
    $categoriesEl.addEventListener('click', function (e) {
      var tab = e.target.closest('.mp-cat-tab');
      if (!tab) return;
      var cat = tab.getAttribute('data-cat');
      if (cat === activeCategory) return;

      activeCategory = cat;
      currentIndex = 0;
      refreshPlaylist();
      save();

      /* Load first track of new category (don't autoplay) */
      var tracks = getTracks();
      if (tracks.length > 0) {
        audio.src = tracks[0].src;
        audio.load();
        isPlaying = false;
        SpectrumVisualizer.stop();
        updatePlayBtn();
        updateTitle();
        updateProgress();
        $timeTotal.textContent = fmt(0);
      }
    });

    /* Playlist click */
    $playlistEl.addEventListener('click', function (e) {
      var item = e.target.closest('.mp-playlist-item');
      if (!item) return;
      var idx = parseInt(item.getAttribute('data-index'), 10);
      loadTrack(idx, true);
    });

    /* Audio events */
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', playNext);

    audio.addEventListener('play', function () {
      isPlaying = true;
      updatePlayBtn();
      SpectrumVisualizer.ensureAudioGraph(function () {
        SpectrumVisualizer.start();
      });
      save();
    });

    audio.addEventListener('pause', function () {
      isPlaying = false;
      updatePlayBtn();
      SpectrumVisualizer.stop();
      save();
    });

    audio.addEventListener('error', function () {
      var tracks = getTracks();
      if (tracks.length <= 1) return;
      playNext();
    });

    /* Media Session API */
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', function () { togglePlay(); });
      navigator.mediaSession.setActionHandler('pause', function () { togglePlay(); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { playPrev(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { playNext(); });
    }

    /* Keyboard shortcuts */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          if (audio.src) audio.currentTime = Math.max(0, audio.currentTime - 5);
          break;
        case 'ArrowRight':
          if (audio.src) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(volume - 0.05);
          break;
        case 'KeyM':
          setVolume(volume > 0 ? 0 : (lastVol || 0.7));
          break;
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        SpectrumVisualizer.stop();
      } else if (isPlaying) {
        SpectrumVisualizer._resize();
        SpectrumVisualizer.start();
      }
    });

    /* Window resize for spectrum */
    window.addEventListener('resize', function () {
      SpectrumVisualizer._resize();
    });
  }

  /* ============================================
     INIT
     ============================================ */
  function init(opts) {
    opts = opts || {};
    load();
    audio.volume = volume;
    mount(opts.container || null);
    updateVolumeIcon();
    updatePlayBtn();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  /* Public API */
  window.MusicPlayer = {
    init: init,
    play: function () { loadTrack(currentIndex, true); },
    pause: function () { audio.pause(); },
    next: playNext,
    prev: playPrev,
    toggle: togglePlay,
    switchCategory: function (catKey) {
      if (CATEGORIES[catKey]) {
        activeCategory = catKey;
        currentIndex = 0;
        refreshPlaylist();
        save();
      }
    },
  };

})();
