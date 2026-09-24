/**
 * app.js - Bark Offline Dog & Cat Soundboard
 * Zero-dependency, 100% client-side Web Audio & PWA logic
 */

(function () {
  'use strict';

  // --- Sound Catalog (8 Dogs + 8 Cats) ---
  const SOUNDS = [
    // Dogs
    {
      id: 'dog_big_bark',
      category: 'dog',
      title: 'Big Dog Woof',
      icon: '🐕',
      desc: 'Deep resonant German Shepherd / Mastiff bark',
      file: 'sounds/dog_big_bark.mp3'
    },
    {
      id: 'dog_guard_barks',
      category: 'dog',
      title: 'Guard Dog Alert',
      icon: '🚨',
      desc: 'Fierce repeated alert barks guarding territory',
      file: 'sounds/dog_guard_barks.mp3'
    },
    {
      id: 'dog_angry',
      category: 'dog',
      title: 'Angry Snarl',
      icon: '⚡',
      desc: 'Defensive growl & sharp snappy barks',
      file: 'sounds/dog_angry.mp3'
    },
    {
      id: 'dog_small_poodle',
      category: 'dog',
      title: 'Toy Poodle Yip',
      icon: '🐩',
      desc: 'Sharp, energetic high-pitched yapping',
      file: 'sounds/dog_small_poodle.mp3'
    },
    {
      id: 'dog_dachshund',
      category: 'dog',
      title: 'Mini Dachshund',
      icon: '🐶',
      desc: 'Lively, curious indoor barking',
      file: 'sounds/dog_dachshund.mp3'
    },
    {
      id: 'dog_alert',
      category: 'dog',
      title: 'Rapid Alarm',
      icon: '🔔',
      desc: 'Staccato alarm barking at the front door',
      file: 'sounds/dog_alert.mp3'
    },
    {
      id: 'dog_playful',
      category: 'dog',
      title: 'Playful Woof',
      icon: '🎾',
      desc: 'Happy tail-wagging cheerful greeting',
      file: 'sounds/dog_playful.mp3'
    },
    {
      id: 'dog_wolf_howl',
      category: 'dog',
      title: 'Wolf / Husky Howl',
      icon: '🐺',
      desc: 'Soul-stirring, long wild canine howl',
      file: 'sounds/dog_wolf_howl.mp3'
    },

    // Cats
    {
      id: 'cat_classic_meow',
      category: 'cat',
      title: 'Classic Meow',
      icon: '🐱',
      desc: 'Standard clear household greeting meow',
      file: 'sounds/cat_classic_meow.mp3'
    },
    {
      id: 'cat_kitten_squeak',
      category: 'cat',
      title: 'Kitten Squeak',
      icon: '🍼',
      desc: 'Sweet, tender newborn kitten mew',
      file: 'sounds/cat_kitten_squeak.mp3'
    },
    {
      id: 'cat_gentle_purr',
      category: 'cat',
      title: 'Soothing Purr',
      icon: '💤',
      desc: 'Deep rhythmic calming vibration',
      file: 'sounds/cat_gentle_purr.mp3'
    },
    {
      id: 'cat_angry_hiss',
      category: 'cat',
      title: 'Defensive Hiss',
      icon: '😾',
      desc: 'Sharp air release & warning cat spit',
      file: 'sounds/cat_angry_hiss.mp3'
    },
    {
      id: 'cat_hungry_demand',
      category: 'cat',
      title: 'Hungry Demand',
      icon: '🥣',
      desc: 'Urgent, persistent dinnertime meow',
      file: 'sounds/cat_hungry_demand.mp3'
    },
    {
      id: 'cat_chirp_trill',
      category: 'cat',
      title: 'Bird Chirp / Trill',
      icon: '🐦',
      desc: 'Excited chattering at window birds',
      file: 'sounds/cat_chirp_trill.mp3'
    },
    {
      id: 'cat_dramatic_yowl',
      category: 'cat',
      title: 'Dramatic Yowl',
      icon: '🌙',
      desc: 'Loud nighttime alley caterwaul',
      file: 'sounds/cat_dramatic_yowl.mp3'
    },
    {
      id: 'cat_door_greeting',
      category: 'cat',
      title: 'Doorstep Mew',
      icon: '🚪',
      desc: 'Polite greeting asking to open the door',
      file: 'sounds/cat_door_greeting.mp3'
    }
  ];

  // --- App State ---
  let selectedSound = SOUNDS[0];
  let currentActiveTab = 'dog';
  let masterVolume = 1.0;
  let pitchMultiplier = 1.0;
  let isLooping = false;
  let activeAudioNodes = []; // List of playing sources

  // Web Audio Context & Nodes
  let audioCtx = null;
  let masterGainNode = null;
  let analyserNode = null;
  const audioBufferCache = new Map();

  // Whistle State
  let whistleOsc = null;
  let whistleGain = null;
  let isWhistling = false;

  // Prank State
  let prankSeconds = 3;
  let prankTimerId = null;

  // Deferred PWA Install prompt
  let deferredInstallPrompt = null;

  // DOM Elements
  const heroSoundName = document.getElementById('heroSoundName');
  const heroPadIcon = document.getElementById('heroPadIcon');
  const heroPadText = document.getElementById('heroPadText');
  const heroTriggerBtn = document.getElementById('heroTriggerBtn');
  const heroEqBars = document.getElementById('heroEqBars');

  const tabDogs = document.getElementById('tabDogs');
  const tabCats = document.getElementById('tabCats');
  const tabTools = document.getElementById('tabTools');

  const dogsPane = document.getElementById('dogsPane');
  const catsPane = document.getElementById('catsPane');
  const toolsPane = document.getElementById('toolsPane');

  const dogsGrid = document.getElementById('dogsGrid');
  const catsGrid = document.getElementById('catsGrid');

  const sliderVolume = document.getElementById('sliderVolume');
  const valVolume = document.getElementById('valVolume');
  const pitchPills = document.getElementById('pitchPills');
  const toggleLoop = document.getElementById('toggleLoop');
  const btnStopAll = document.getElementById('btnStopAll');
  const btnQuickStop = document.getElementById('btnQuickStop');

  const visualizerCanvas = document.getElementById('visualizerCanvas');
  const networkBadge = document.getElementById('networkBadge');

  // Dialogs
  const whistleModal = document.getElementById('whistleModal');
  const prankModal = document.getElementById('prankModal');
  const shareModal = document.getElementById('shareModal');
  const aboutModal = document.getElementById('aboutModal');

  const btnOpenWhistle = document.getElementById('btnOpenWhistle');
  const btnOpenPrank = document.getElementById('btnOpenPrank');
  const btnOpenShare = document.getElementById('btnOpenShare');
  const btnOpenAbout = document.getElementById('btnOpenAbout');

  const whistleSlider = document.getElementById('whistleSlider');
  const whistleFreqDisplay = document.getElementById('whistleFreqDisplay');
  const whistleAudibility = document.getElementById('whistleAudibility');
  const btnWhistleToggle = document.getElementById('btnWhistleToggle');

  const prankCountdownArea = document.getElementById('prankCountdownArea');
  const prankCountdown = document.getElementById('prankCountdown');
  const btnStartPrank = document.getElementById('btnStartPrank');

  // --- Audio Engine Initialization ---
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      // Master Gain
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

      // Analyser for real-time waveform visualizer
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;

      masterGainNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination);

      // Start oscilloscope rendering loop
      initVisualizer();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Pre-load audio buffer via fetch or fallback
  async function loadAudioBuffer(sound) {
    if (audioBufferCache.has(sound.id)) {
      return audioBufferCache.get(sound.id);
    }

    const ctx = getAudioContext();
    try {
      const response = await fetch(sound.file);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      audioBufferCache.set(sound.id, decoded);
      return decoded;
    } catch (err) {
      console.warn(`[Bark] Could not decode ${sound.file}, using synthetic fallback`, err);
      const synthetic = createSyntheticAudio(ctx, sound.category);
      audioBufferCache.set(sound.id, synthetic);
      return synthetic;
    }
  }

  // High-quality procedural synthesizer fallback (100% offline guarantee)
  function createSyntheticAudio(ctx, category) {
    const sampleRate = ctx.sampleRate;
    const duration = category === 'dog' ? 0.35 : 0.6;
    const numFrames = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numFrames, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numFrames; i++) {
      const t = i / sampleRate;
      if (category === 'dog') {
        // Bark envelope + frequency drop + noise burst
        const env = Math.exp(-t * 14) * (1 - Math.exp(-t * 120));
        const freq = 280 * Math.exp(-t * 8) + 120;
        const tone = Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(4 * Math.PI * freq * t);
        const noise = (Math.random() * 2 - 1) * 0.35;
        data[i] = (tone + noise) * env;
      } else {
        // Cat meow frequency modulation (rising then falling formant)
        const env = Math.sin((t / duration) * Math.PI);
        const freq = 550 + 250 * Math.sin((t / duration) * Math.PI);
        const tone = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t);
        data[i] = tone * env * 0.7;
      }
    }
    return buffer;
  }

  // Play a sound by definition
  async function playSound(sound) {
    const ctx = getAudioContext();
    triggerHaptic(30);

    try {
      const buffer = await loadAudioBuffer(sound);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(pitchMultiplier, ctx.currentTime);
      source.loop = isLooping;

      source.connect(masterGainNode);

      // Track active nodes
      const activeObj = { id: sound.id, source: source };
      activeAudioNodes.push(activeObj);

      // UI state updates
      setCardPlayingUI(sound.id, true);
      heroTriggerBtn.classList.add('playing');
      heroEqBars.style.opacity = '1';

      source.onended = () => {
        activeAudioNodes = activeAudioNodes.filter((item) => item !== activeObj);
        // If no more instances of this sound are playing, reset UI
        if (!activeAudioNodes.some((item) => item.id === sound.id)) {
          setCardPlayingUI(sound.id, false);
        }
        if (activeAudioNodes.length === 0) {
          heroTriggerBtn.classList.remove('playing');
          heroEqBars.style.opacity = '0';
        }
      };

      source.start(0);
    } catch (e) {
      console.error('[Bark] Playback error:', e);
    }
  }

  function stopAllSounds() {
    activeAudioNodes.forEach(({ source }) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    activeAudioNodes = [];

    // Stop whistle if running
    if (isWhistling) {
      stopWhistle();
    }

    // Reset card UI
    document.querySelectorAll('.sound-card').forEach((c) => c.classList.remove('playing'));
    heroTriggerBtn.classList.remove('playing');
    heroEqBars.style.opacity = '0';
  }

  // --- Haptics ---
  function triggerHaptic(ms = 25) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  // --- UI Population & Card Interaction ---
  function renderSoundCards() {
    dogsGrid.innerHTML = '';
    catsGrid.innerHTML = '';

    SOUNDS.forEach((sound) => {
      const card = document.createElement('div');
      card.className = `sound-card ${sound.category === 'cat' ? 'cat-card' : ''}`;
      card.dataset.soundId = sound.id;
      if (sound.id === selectedSound.id) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="card-icon">${sound.icon}</span>
          <div class="eq-bars">
            <div class="eq-bar"></div>
            <div class="eq-bar"></div>
            <div class="eq-bar"></div>
          </div>
        </div>
        <div class="card-title">${sound.title}</div>
        <div class="card-desc">${sound.desc}</div>
      `;

      card.addEventListener('click', () => {
        selectSound(sound);
        playSound(sound);
      });

      if (sound.category === 'dog') {
        dogsGrid.appendChild(card);
      } else {
        catsGrid.appendChild(card);
      }
    });
  }

  function selectSound(sound) {
    selectedSound = sound;
    heroSoundName.textContent = sound.title;
    heroPadIcon.textContent = sound.icon;

    if (sound.category === 'dog') {
      heroPadText.textContent = 'TAP TO BARK';
      heroTriggerBtn.classList.remove('cat-mode');
    } else {
      heroPadText.textContent = 'TAP TO MEOW';
      heroTriggerBtn.classList.add('cat-mode');
    }

    // Update selected card ring
    document.querySelectorAll('.sound-card').forEach((c) => {
      c.classList.toggle('selected', c.dataset.soundId === sound.id);
    });
  }

  function setCardPlayingUI(soundId, isPlaying) {
    const card = document.querySelector(`.sound-card[data-soundId="${soundId}"]`);
    if (card) {
      card.classList.toggle('playing', isPlaying);
    }
  }

  // --- Tab Navigation ---
  function setupTabs() {
    tabDogs.addEventListener('click', () => switchTab('dog'));
    tabCats.addEventListener('click', () => switchTab('cat'));
    tabTools.addEventListener('click', () => switchTab('tools'));
  }

  function switchTab(tab) {
    currentActiveTab = tab;
    tabDogs.classList.toggle('active', tab === 'dog');
    tabCats.classList.toggle('active', tab === 'cat');
    tabTools.classList.toggle('active', tab === 'tools');

    tabDogs.setAttribute('aria-selected', tab === 'dog');
    tabCats.setAttribute('aria-selected', tab === 'cat');
    tabTools.setAttribute('aria-selected', tab === 'tools');

    dogsPane.style.display = tab === 'dog' ? 'block' : 'none';
    catsPane.style.display = tab === 'cat' ? 'block' : 'none';
    toolsPane.style.display = tab === 'tools' ? 'block' : 'none';

    // If switching to dogs or cats, pick default if current selection is in other category
    if (tab === 'dog' && selectedSound.category !== 'dog') {
      selectSound(SOUNDS.find((s) => s.category === 'dog'));
    } else if (tab === 'cat' && selectedSound.category !== 'cat') {
      selectSound(SOUNDS.find((s) => s.category === 'cat'));
    }
  }

  // --- Controls & FX Listeners ---
  function setupControls() {
    // Volume Slider
    sliderVolume.addEventListener('input', (e) => {
      masterVolume = parseFloat(e.target.value);
      valVolume.textContent = `${Math.round(masterVolume * 100)}%`;
      if (masterGainNode) {
        masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
      }
    });

    // Pitch Pills
    pitchPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-opt');
      if (!btn) return;
      document.querySelectorAll('#pitchPills .pill-opt').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      pitchMultiplier = parseFloat(btn.dataset.pitch);
      triggerHaptic(15);
    });

    // Loop Toggle
    toggleLoop.addEventListener('change', (e) => {
      isLooping = e.target.checked;
      activeAudioNodes.forEach(({ source }) => {
        source.loop = isLooping;
      });
      triggerHaptic(15);
    });

    // Stop Buttons
    btnStopAll.addEventListener('click', stopAllSounds);
    btnQuickStop.addEventListener('click', stopAllSounds);

    // Hero Trigger Pad
    heroTriggerBtn.addEventListener('click', () => {
      playSound(selectedSound);
    });
  }

  // --- Real-time Oscilloscope Canvas ---
  function initVisualizer() {
    const canvas = visualizerCanvas;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio || 300);
    let height = (canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio || 100);

    window.addEventListener('resize', () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
        height = canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
      }
    });

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      requestAnimationFrame(render);

      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Check if sound is actively playing
      const isSounding = activeAudioNodes.length > 0 || isWhistling;

      ctx.lineWidth = 3 * window.devicePixelRatio;
      const isCat = selectedSound.category === 'cat';
      ctx.strokeStyle = isSounding
        ? (isCat ? '#38bdf8' : '#f59e0b')
        : 'rgba(148, 163, 184, 0.25)';

      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    render();
  }

  // --- Ultrasonic Dog Whistle Logic ---
  function setupWhistle() {
    whistleSlider.addEventListener('input', (e) => {
      const freq = parseInt(e.target.value, 10);
      whistleFreqDisplay.textContent = `${freq.toLocaleString()} Hz`;

      if (freq >= 20000) {
        whistleAudibility.textContent = 'Silent to humans • Dogs & Cats hear clearly';
      } else if (freq >= 16000) {
        whistleAudibility.textContent = 'Near human hearing threshold • Dogs hear intensely';
      } else {
        whistleAudibility.textContent = 'Audible high whistle to youth & pets';
      }

      if (whistleOsc && audioCtx) {
        whistleOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      }
    });

    btnWhistleToggle.addEventListener('click', () => {
      if (isWhistling) {
        stopWhistle();
      } else {
        startWhistle();
      }
    });
  }

  function startWhistle() {
    const ctx = getAudioContext();
    const freq = parseInt(whistleSlider.value, 10);

    whistleOsc = ctx.createOscillator();
    whistleGain = ctx.createGain();

    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(freq, ctx.currentTime);

    whistleGain.gain.setValueAtTime(0.8, ctx.currentTime);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(masterGainNode);

    whistleOsc.start();
    isWhistling = true;

    btnWhistleToggle.textContent = 'STOP WHISTLE';
    btnWhistleToggle.style.background = 'var(--danger)';
    triggerHaptic(40);
  }

  function stopWhistle() {
    if (whistleOsc) {
      try {
        whistleOsc.stop();
        whistleOsc.disconnect();
      } catch (e) {}
      whistleOsc = null;
    }
    isWhistling = false;
    btnWhistleToggle.textContent = 'START WHISTLE';
    btnWhistleToggle.style.background = 'var(--primary)';
  }

  // --- Delayed Prank Timer Logic ---
  function setupPrank() {
    document.querySelectorAll('.btn-prank-time').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-prank-time').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        prankSeconds = parseInt(btn.dataset.sec, 10);
        btnStartPrank.textContent = `ARM TIMER (${prankSeconds}s)`;
        triggerHaptic(15);
      });
    });

    btnStartPrank.addEventListener('click', () => {
      if (prankTimerId) {
        clearInterval(prankTimerId);
        prankTimerId = null;
        btnStartPrank.textContent = `ARM TIMER (${prankSeconds}s)`;
        btnStartPrank.style.background = 'var(--primary)';
        prankCountdownArea.style.display = 'none';
        return;
      }

      let remaining = prankSeconds;
      prankCountdownArea.style.display = 'block';
      prankCountdown.textContent = `Surprise in ${remaining}...`;
      btnStartPrank.textContent = 'CANCEL TIMER';
      btnStartPrank.style.background = 'var(--danger)';

      prankTimerId = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          prankCountdown.textContent = `Surprise in ${remaining}...`;
        } else {
          clearInterval(prankTimerId);
          prankTimerId = null;
          prankModal.close();
          prankCountdownArea.style.display = 'none';
          btnStartPrank.textContent = `ARM TIMER (${prankSeconds}s)`;
          btnStartPrank.style.background = 'var(--primary)';
          // Trigger selected sound!
          playSound(selectedSound);
        }
      }, 1000);
    });
  }

  // --- Dialog / Modal Management (with light dismiss & ESC support) ---
  function setupModals() {
    const dialogs = [
      { btn: btnOpenWhistle, dialog: whistleModal },
      { btn: btnOpenPrank, dialog: prankModal },
      { btn: btnOpenShare, dialog: shareModal },
      { btn: btnOpenAbout, dialog: aboutModal }
    ];

    dialogs.forEach(({ btn, dialog }) => {
      btn.addEventListener('click', () => {
        getAudioContext(); // Unlock audio on user interaction
        dialog.showModal();
        triggerHaptic(15);
      });

      // Light dismiss: Close on outside click
      dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          dialog.close();
          if (dialog === whistleModal && isWhistling) stopWhistle();
        }
      });
    });

    // Close buttons inside dialogs
    document.querySelectorAll('.close-dialog').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const dialog = e.target.closest('dialog');
        if (dialog) {
          dialog.close();
          if (dialog === whistleModal && isWhistling) stopWhistle();
        }
      });
    });

    // Native Share / Copy Link
    document.getElementById('btnNativeShare').addEventListener('click', async () => {
      const shareData = {
        title: 'Bark — Offline Dog & Cat Soundboard',
        text: 'Realistic dog barks and cat meows right on your phone. Works 100% offline!',
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (e) {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        const btn = document.getElementById('btnNativeShare');
        const origText = btn.textContent;
        btn.textContent = 'Link Copied!';
        setTimeout(() => (btn.textContent = origText), 2000);
      }
    });
  }

  // --- Network & PWA Registration ---
  function setupPWA() {
    // Update online / offline badge
    function updateOnlineStatus() {
      const isOnline = navigator.onLine;
      if (isOnline) {
        networkBadge.innerHTML = `<span class="status-dot"></span> Offline Ready`;
      } else {
        networkBadge.innerHTML = `<span class="status-dot" style="background-color: var(--primary); box-shadow: 0 0 8px var(--primary);"></span> Airplane Mode (Active)`;
      }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('sw.js')
          .then((reg) => {
            console.log('[Bark] ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.log('[Bark] ServiceWorker registration failed:', err);
          });
      });
    }

    // Capture beforeinstallprompt for Android Chrome
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const shareBtn = document.getElementById('btnNativeShare');
      if (shareBtn) {
        shareBtn.textContent = 'Install Bark App';
        shareBtn.onclick = () => {
          if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            deferredInstallPrompt = null;
          }
        };
      }
    });

    // Hash navigation shortcut: #cats -> switch to cats
    if (window.location.hash === '#cats') {
      switchTab('cat');
    }
  }

  // --- Initialization ---
  function init() {
    renderSoundCards();
    selectSound(SOUNDS[0]);
    setupTabs();
    setupControls();
    setupWhistle();
    setupPrank();
    setupModals();
    setupPWA();

    // Pre-cache primary sound on first touch
    window.addEventListener(
      'pointerdown',
      () => {
        getAudioContext();
        loadAudioBuffer(selectedSound);
      },
      { once: true }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
