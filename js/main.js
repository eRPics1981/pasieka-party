/** Główna pętla, tury graczy i sterowanie Pasieka Party. */
(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const video = document.getElementById('camera-feed');
  if (!canvas || typeof GFX === 'undefined' || !window.Rounds) return;
  GFX.init(canvas);
  if (window.PhotoCollage) PhotoCollage.init(canvas);
  if (window.PlayerProfiles) PlayerProfiles.init(video, canvas, GFX);
  if (!window.PlayerProfiles) {
    const profileScript = document.createElement('script');
    profileScript.src = 'js/player-profiles.js';
    document.head.appendChild(profileScript);
  }

  const game = {
    screen: 'menu',
    activeLayer: 'menu',
    uncertaintyMode: true,
    lastUncertaintyAt: 0,
    raisedWasActive: false,
    crossedWasActive: false,
    menuFocus: 1,
    roundFocus: 0,
    roundIndex: 0,
    round: null,
    roundState: null,
    apiaryId: 'siedlanowo',
    apiary: null,
    playerCount: 1,
    playerIndex: 0,
    playerScores: [0],
    players: [],
    profileIndex: 0,
    profileSnapshot: null,
    profileDetected: null,
    profileAction: false,
    lastProfileCheck: 0,
    matchCandidate: '',
    matchStreak: 0,
    welcome: '',
    galleryItems: [],
    galleryImages: [],
    gallerySelection: -1,
    galleryAction: false,
    roundScores: [],
    roundStats: [],
    matchStartedAt: 0,
    matchEndedAt: 0,
    partyReport: null,
    partyReportAction: false,
    comments: null,
    voiceLines: null,
    chroniclesSlides: null,
    voiceText: '',
    voiceUntil: 0,
    lastHandVisible: false,
    lastMotionAt: 0,
    idleVoicePlayed: false,
    lastVoiceX: null,
    lastVoiceY: null,
    profiles: null,
    profileCards: [],
    profileHoverId: null,
    profileHoverAt: 0,
    activeProfileId: null,
    defaultVoiceLines: null,
    textEditor: { open: false, categories: [], category: '', index: 0, lastX: null, input: null, controls: null, lastGesture: false },
    roundComment: '',
    totalScore: 0,
    lastScore: 0,
    timeLeft: 0,
    lastFrame: 0,
    actionPressed: false,
    homeAction: false,
    pressPoint: { x: 0.5, y: 0.78 },
    pointer: { x: 0.5, y: 0.5, down: false, visible: true },
    handAvailable: false,
    handTrackerReady: false,
    cameraStarting: false,
    cameraAttempted: false,
    cameraMessage: '',
    menuPresence: {
      seconds: 0,
      overlay: false,
      suggestedPlayers: 1,
      count: 0,
      announcedCount: 0,
      twoHandsReady: false,
      message: '',
      messageUntil: 0,
      lastHandCount: 0,
      pendingEntryCount: 0,
      lastSpeechAt: 0,
      emptySince: 0,
      noPlayerAnnounced: false
    },
    autoDetect: true,
    completedRounds: [],
    calibration: { pinches: 0, lastAction: false, armed: false },
    pause: { active: false, openedAt: 0, latched: false, pausedAt: 0 },
    survivalTest: { startedAt: 0, samples: [], report: null, complete: false },
    introArmed: false,
    menuHandAction: false,
    apiaryHandAction: false,
    gameSelectAction: false,
    calibrationNextScreen: 'menu',
    profilePhotoTaken: false,
    profileName: '',
    profileAutoConfirmAt: 0,
    sound: null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const now = () => performance.now() / 1000;
  const playerName = (index) => game.players[index] ? game.players[index].name : 'Gracz ' + (index + 1);
  const CALIBRATION_KEY = 'pasieka-party-calibrated-v1';
  const SURVIVAL_TEST_KEY = 'pasieka-party-survival-test-v1';
  const PARTY_REPORT_KEY = 'pasieka-party-last-report-v1';

  function calibrationWasDone() {
    try { return localStorage.getItem(CALIBRATION_KEY) === '1'; }
    catch (_) { return false; }
  }

  function markCalibrationDone() {
    try { localStorage.setItem(CALIBRATION_KEY, '1'); }
    catch (_) { /* localStorage może być wyłączony */ }
  }

  function analyzeClothingColor(videoEl) {
    try {
      if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return null;
      const tmp = document.createElement('canvas');
      tmp.width = 16; tmp.height = 16;
      const ctx2 = tmp.getContext('2d');
      // Pobierz obszar tułowia (środkowy pionowy pas, 25–70% wysokości)
      const sx = videoEl.videoWidth * 0.2, sy = videoEl.videoHeight * 0.25;
      const sw = videoEl.videoWidth * 0.6, sh = videoEl.videoHeight * 0.45;
      ctx2.save(); ctx2.translate(16, 0); ctx2.scale(-1, 1);
      ctx2.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 16, 16);
      ctx2.restore();
      const px = ctx2.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      if (delta < 28) {
        if (r > 185) return 'Biały';
        if (r < 55) return 'Czarny';
        return 'Szary';
      }
      let hue = 0;
      if (max === r) hue = ((g - b) / delta + 6) % 6 * 60;
      else if (max === g) hue = ((b - r) / delta + 2) * 60;
      else hue = ((r - g) / delta + 4) * 60;
      if (hue < 20 || hue >= 340) return 'Czerwony';
      if (hue < 45) return 'Pomarańczowy';
      if (hue < 75) return 'Żółty';
      if (hue < 165) return 'Zielony';
      if (hue < 200) return 'Turkusowy';
      if (hue < 265) return 'Niebieski';
      if (hue < 295) return 'Fioletowy';
      return 'Różowy';
    } catch (_) { return null; }
  }

  function makeAutoProfileName() {
    const color = analyzeClothingColor(video);
    const base = color || ('Gracz ' + (game.profileIndex + 1));
    const used = game.players.map(function (p) { return p.name; });
    if (!used.includes(base)) return base;
    let i = 2;
    while (used.includes(base + ' ' + i)) i++;
    return base + ' ' + i;
  }

  fetch('assets/comments.json').then(function (response) {
    if (!response.ok) throw new Error('Nie udało się pobrać komentarzy.');
    return response.json();
  }).then(function (comments) { game.comments = comments; }).catch(function () { game.comments = null; });

  fetch('assets/voice-lines.json').then(function (response) {
    if (!response.ok) throw new Error('Voice lines unavailable');
    return response.json();
  }).then(function (lines) {
    game.defaultVoiceLines = cloneVoiceLines(lines);
    game.voiceLines = cloneVoiceLines(lines);
    try {
      const overrides = JSON.parse(window.localStorage.getItem('pasieka-party-voice-overrides') || '{}');
      Object.keys(overrides).forEach(function (category) {
        if (Array.isArray(overrides[category]) && Array.isArray(game.voiceLines[category])) {
          game.voiceLines[category] = overrides[category].slice(0, game.voiceLines[category].length);
        }
      });
    } catch (error) { /* Use the bundled voice lines when overrides are invalid. */ }
  }).catch(function () { game.voiceLines = null; });

  fetch('assets/kroniki-marcina.json').then(function (response) {
    if (!response.ok) throw new Error('Kroniki niedostępne');
    return response.json();
  }).then(function (slides) {
    game.chroniclesSlides = Array.isArray(slides) ? slides : [];
    if (game.round && game.round.type === 'chronicles' && game.roundState && !game.roundState.chronicles.questions.length) {
      game.roundState.chronicles.questions = Rounds.makeChroniclesQuestions(game.chroniclesSlides);
      game.roundState.chronicles.deadline = now() + 8;
      if (game.screen === 'playing') game.roundState.startedAt = now();
    }
  }).catch(function () { game.chroniclesSlides = []; });

  const voiceQueue = [];
  let voiceSpeaking = false;

  function playNextVoice() {
    if (voiceSpeaking || !voiceQueue.length) return;
    const text = voiceQueue.shift();
    voiceSpeaking = true;
    game.voiceText = text;
    game.voiceUntil = now() + Math.max(3.8, text.length / 13);
    let finished = false;
    const finish = function () {
      if (finished) return;
      finished = true;
      voiceSpeaking = false;
      game.voiceUntil = 0;
      playNextVoice();
    };
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      try {
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
        return;
      } catch (_) { /* Caption timing is the fallback. */ }
    }
    setTimeout(finish, Math.min(7500, Math.max(1600, text.length * 55)));
  }

  function addToVoiceQueue(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    voiceQueue.push(text.trim());
    playNextVoice();
  }

  function sayVoice(category) {
    const group = game.voiceLines && game.voiceLines[category];
    const options = category === 'niepewnosc' && group && !Array.isArray(group)
      ? (group[game.round && game.round.id] || group[game.round && game.round.type] || group.default)
      : group;
    if (!options || !options.length) return '';
    const profile = game.players[game.playerIndex] || game.profileDetected || {};
    const values = {
      imie: profile.name || 'Graczu',
      wiek: profile.age || '?',
      skad: profile.town || 'okolic',
      kolor: profile.color || 'miodowy',
      runda: game.round ? game.round.title : 'tej rundzie'
    };
    const text = options[Math.floor(Math.random() * options.length)].replace(/\{(imie|wiek|skad|kolor|runda)\}/g, function (_, key) {
      return String(values[key]);
    });
    addToVoiceQueue(text);
    return text;
  }

  const profileImageCache = new Map();
  function savedProfiles() {
    if (game.profiles) return game.profiles;
    let profiles = [];
    if (window.PlayerProfiles) {
      const api = window.PlayerProfiles;
      try {
        profiles = typeof api.getAll === 'function' ? api.getAll() :
          typeof api.list === 'function' ? api.list() : api.profiles || [];
      } catch (error) { profiles = []; }
    }
    if (!Array.isArray(profiles) || !profiles.length) {
      for (const key of ['pasieka-party-profiles', 'pasiekaPartyProfiles', 'playerProfiles']) {
        try {
          const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
          if (Array.isArray(stored) && stored.length) { profiles = stored; break; }
        } catch (error) { /* Ignore malformed or unavailable local storage. */ }
      }
    }
    game.profiles = Array.isArray(profiles) ? profiles.filter(function (profile) { return profile && (profile.name || profile.imie); }) : [];
    return game.profiles;
  }

  function updateProfileHover() {
    if (!game.handAvailable || typeof HandTracker === 'undefined' || !HandTracker.cursor.visible) {
      game.profileHoverId = null;
      return;
    }
    const handX = HandTracker.cursor.x * GFX.W;
    const handY = HandTracker.cursor.y * GFX.H;
    const card = game.profileCards.find(function (candidate) {
      return handX >= candidate.x && handX <= candidate.x + candidate.width &&
        handY >= candidate.y && handY <= candidate.y + candidate.height;
    });
    if (!card) {
      game.profileHoverId = null;
      return;
    }
    if (game.profileHoverId !== card.id) {
      game.profileHoverId = card.id;
      game.profileHoverAt = performance.now();
      return;
    }
    const cursor = HandTracker.cursor;
    const gesture = cursor.pinching || cursor.pushing || cursor.push ||
      cursor.gesture === 'pinch' || cursor.gesture === 'push';
    if (game.screen === 'menu' && gesture) {
      game.menuHandAction = true;
      game.actionPressed = false;
      game.pointer.down = false;
      if (performance.now() - game.profileHoverAt >= 1000) game.activeProfileId = card.id;
    }
  }

  function drawProfileCard(profile, x, y, width, height, active, highlighted) {
    const ctx = GFX.ctx;
    ctx.save();
    ctx.fillStyle = active ? 'rgba(245,166,35,0.95)' : 'rgba(26,10,0,0.82)';
    ctx.strokeStyle = highlighted || active ? '#FFD700' : 'rgba(255,245,220,0.7)';
    ctx.lineWidth = highlighted || active ? 4 : 2;
    GFX.roundRect(x, y, width, height, 14);
    ctx.fill();
    ctx.stroke();
    const photo = profile.photo || profile.image || profile.thumbnail || profile.avatar || profile.photoDataUrl;
    const imageSize = height * 0.62;
    const imageX = x + (width - imageSize) / 2;
    const imageY = y + 8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + width / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
    ctx.clip();
    if (photo) {
      let image = profileImageCache.get(photo);
      if (!image) {
        image = new Image();
        image.src = photo;
        profileImageCache.set(photo, image);
      }
      if (image.complete && image.naturalWidth) ctx.drawImage(image, imageX, imageY, imageSize, imageSize);
      else {
        ctx.fillStyle = '#F5A623';
        ctx.fillRect(imageX, imageY, imageSize, imageSize);
      }
    } else {
      ctx.fillStyle = '#F5A623';
      ctx.fillRect(imageX, imageY, imageSize, imageSize);
    }
    ctx.restore();
    ctx.fillStyle = '#FFF5DC';
    ctx.font = 'bold 15px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(profile.name || profile.imie, x + width / 2, y + height - 15, width - 10);
    ctx.restore();
  }

  function drawProfileCards() {
    const buttonCtx = GFX.ctx;
    const buttonX = GFX.W - 205;
    const buttonY = 14;
    buttonCtx.save();
    buttonCtx.fillStyle = 'rgba(26,10,0,0.8)';
    buttonCtx.strokeStyle = '#FFD78A';
    buttonCtx.lineWidth = 2;
    GFX.roundRect(buttonX, buttonY, 190, 40, 10);
    buttonCtx.fill();
    buttonCtx.stroke();
    buttonCtx.fillStyle = '#FFF5DC';
    buttonCtx.font = 'bold 15px Segoe UI, Arial, sans-serif';
    buttonCtx.textAlign = 'center';
    buttonCtx.textBaseline = 'middle';
    buttonCtx.fillText('Edytuj teksty', buttonX + 95, buttonY + 20);
    buttonCtx.restore();
    const profiles = savedProfiles();
    game.profileCards = [];
    const visible = profiles.filter(function (profile, index) {
      return String(profile.id || profile.name || profile.imie || index) !== String(game.activeProfileId);
    }).slice(0, 6);
    const cardWidth = Math.min(150, (GFX.W - 32) / Math.max(visible.length, 1));
    const cardHeight = 94;
    const totalWidth = visible.length * cardWidth;
    visible.forEach(function (profile, index) {
      const id = String(profile.id || profile.name || profile.imie || index);
      const x = (GFX.W - totalWidth) / 2 + index * cardWidth;
      const y = GFX.H - cardHeight - 10;
      const card = { id: id, x: x, y: y, width: cardWidth - 8, height: cardHeight };
      game.profileCards.push(card);
      drawProfileCard(profile, x, y, card.width, card.height, false, game.profileHoverId === id);
    });
    const active = profiles.find(function (profile, index) {
      return String(profile.id || profile.name || profile.imie || index) === String(game.activeProfileId);
    });
    if (active) drawProfileCard(active, GFX.W * 0.5 - 105, GFX.H * 0.34, 210, 132, true, false);
    if (game.textEditor.open) drawVoiceEditor();
  }

  const voiceOverrideKey = 'pasieka-party-voice-overrides';
  function cloneVoiceLines(lines) {
    return JSON.parse(JSON.stringify(lines));
  }

  function persistVoiceOverrides() {
    const overrides = {};
    Object.keys(game.voiceLines || {}).forEach(function (key) {
      if (Array.isArray(game.voiceLines[key])) overrides[key] = game.voiceLines[key];
    });
    try { window.localStorage.setItem(voiceOverrideKey, JSON.stringify(overrides)); }
    catch (error) { /* Keep the current edit in memory if storage is unavailable. */ }
  }

  function createVoiceEditorControls() {
    if (game.textEditor.controls) return;
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;z-index:10000;left:50%;bottom:4%;transform:translateX(-50%);width:min(680px,90vw);padding:14px;background:#241509;border:2px solid #ffd78a;border-radius:14px;box-shadow:0 8px 30px #0009;color:#fff5dc;font:16px sans-serif;display:none';
    const caption = document.createElement('div');
    caption.textContent = 'Edytuj wybraną kwestię';
    caption.style.marginBottom = '8px';
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Treść kwestii głosowej');
    input.style.cssText = 'box-sizing:border-box;width:100%;padding:12px;font:18px sans-serif;border-radius:8px;border:1px solid #ffd78a';
    input.addEventListener('input', function () {
      const editor = game.textEditor;
      if (!editor.category || !Array.isArray(game.voiceLines[editor.category])) return;
      game.voiceLines[editor.category][editor.index] = input.value;
      persistVoiceOverrides();
    });
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    const makeButton = function (label, action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:9px 14px;border:0;border-radius:7px;background:#f5a623;color:#1a0a00;font-weight:bold;cursor:pointer';
      button.addEventListener('click', action);
      buttons.appendChild(button);
      return button;
    };
    makeButton('Reset', resetVoiceOverrides);
    makeButton('Zamknij', closeVoiceEditor);
    panel.appendChild(caption);
    panel.appendChild(input);
    panel.appendChild(buttons);
    document.body.appendChild(panel);
    game.textEditor.input = input;
    game.textEditor.controls = panel;
  }

  function openVoiceEditor() {
    if (!game.voiceLines) return;
    const editor = game.textEditor;
    editor.open = true;
    editor.categories = Object.keys(game.voiceLines).filter(function (key) { return Array.isArray(game.voiceLines[key]); });
    if (!editor.categories.includes(editor.category)) editor.category = editor.categories[0] || '';
    editor.index = 0;
    createVoiceEditorControls();
    editor.controls.style.display = 'block';
    selectVoiceLine();
  }

  function selectVoiceLine() {
    const editor = game.textEditor;
    const lines = game.voiceLines && game.voiceLines[editor.category];
    if (!Array.isArray(lines) || !lines.length) return;
    editor.index = Math.max(0, Math.min(editor.index, lines.length - 1));
    if (editor.input) {
      editor.input.value = lines[editor.index];
      editor.input.focus();
      editor.input.select();
    }
  }

  function resetVoiceOverrides() {
    try { window.localStorage.removeItem(voiceOverrideKey); } catch (error) { /* Ignore blocked storage. */ }
    if (!game.defaultVoiceLines) return;
    game.voiceLines = cloneVoiceLines(game.defaultVoiceLines);
    selectVoiceLine();
  }

  function closeVoiceEditor() {
    game.textEditor.open = false;
    if (game.textEditor.controls) game.textEditor.controls.style.display = 'none';
    game.textEditor.lastGesture = false;
  }

  function updateVoiceEditor(pos) {
    const editor = game.textEditor;
    const cursor = typeof HandTracker !== 'undefined' ? HandTracker.cursor : {};
    const gesture = !!(game.actionPressed || pos.action || cursor.pushing || cursor.push ||
      cursor.gesture === 'pinch' || cursor.gesture === 'push');
    if (editor.lastX !== null && Math.abs(pos.x - editor.lastX) > 0.16) {
      const lines = game.voiceLines[editor.category] || [];
      editor.index += pos.x < editor.lastX ? 1 : -1;
      if (editor.index < 0) editor.index = lines.length - 1;
      if (editor.index >= lines.length) editor.index = 0;
      selectVoiceLine();
    }
    editor.lastX = pos.x;
    if (gesture && !editor.lastGesture) {
      if (pos.x < 0.32 && editor.categories.length) {
        const top = GFX.H * 0.21;
        const rowHeight = Math.min(46, GFX.H * 0.065);
        const categoryIndex = Math.max(0, Math.min(editor.categories.length - 1, Math.floor((pos.y * GFX.H - top) / rowHeight)));
        editor.category = editor.categories[categoryIndex];
        editor.index = 0;
        selectVoiceLine();
      } else {
        selectVoiceLine();
      }
    }
    editor.lastGesture = gesture;
    game.actionPressed = false;
  }

  function drawVoiceEditor() {
    const editor = game.textEditor;
    const ctx = GFX.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(12,8,3,0.9)';
    ctx.fillRect(0, 0, GFX.W, GFX.H);
    GFX.drawTitle('EDYTOR TEKSTÓW', GFX.H * 0.1, Math.min(54, GFX.W * 0.04), '#FFD78A');
    const left = GFX.W * 0.04;
    const categoryWidth = GFX.W * 0.28;
    const top = GFX.H * 0.21;
    const rowHeight = Math.min(46, GFX.H * 0.065);
    editor.categories.forEach(function (category, index) {
      ctx.fillStyle = category === editor.category ? '#FFD700' : '#FFF5DC';
      ctx.font = category === editor.category ? 'bold 19px sans-serif' : '17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(category, left, top + index * rowHeight, categoryWidth - 8);
    });
    const lines = game.voiceLines[editor.category] || [];
    const lineX = GFX.W * 0.36;
    const lineWidth = GFX.W * 0.6;
    const first = Math.max(0, Math.min(editor.index - 2, lines.length - 5));
    lines.slice(first, first + 5).forEach(function (line, offset) {
      const index = first + offset;
      const y = top + offset * rowHeight;
      ctx.fillStyle = index === editor.index ? 'rgba(245,166,35,0.38)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(lineX - 8, y - 24, lineWidth, rowHeight - 3);
      ctx.fillStyle = index === editor.index ? '#FFD700' : '#FFF5DC';
      ctx.font = index === editor.index ? 'bold 16px sans-serif' : '15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(line, lineX, y, lineWidth - 18);
    });
    ctx.fillStyle = '#FFF5DC';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Wskaż kategorię po lewej. Przesuń dłoń w bok, aby zmieniać teksty; pinch/push wybiera tekst do edycji.', GFX.W / 2, GFX.H * 0.88, GFX.W * 0.92);
    ctx.restore();
  }

  function pointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    game.pointer.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    game.pointer.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    game.pointer.visible = true;
  }

  function press() {
    game.actionPressed = true;
    game.pressPoint.x = game.pointer.x;
    game.pressPoint.y = game.pointer.y;
  }

  canvas.addEventListener('pointermove', pointerFromEvent);
  canvas.addEventListener('pointerdown', function (event) {
    pointerFromEvent(event);
    game.pointer.down = true;
    press();
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', function (event) {
    pointerFromEvent(event);
    game.pointer.down = false;
  });
  canvas.addEventListener('pointercancel', function () { game.pointer.down = false; });

  window.addEventListener('keydown', function (event) {
    if (event.code === 'Escape') { event.preventDefault(); returnToMenu(); return; }
    if (game.screen === 'profile') { if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); if (game.profilePhotoTaken) confirmProfile(); else takeProfilePhoto(); return; } return; }
    if (game.screen === 'menu' && (event.code === 'Digit1' || event.code === 'Numpad1')) selectPlayers(1);
    if (game.screen === 'menu' && (event.code === 'Digit2' || event.code === 'Numpad2')) selectPlayers(2);
    if (game.screen === 'menu' && (event.code === 'Digit4' || event.code === 'Numpad4')) selectPlayers(4);
    if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); game.pointer.down = true; press(); }
    if (event.code === 'KeyC' && game.screen === 'menu') { event.preventDefault(); beginCalibration('menu'); }
  });
  window.addEventListener('keyup', function (event) {
    if (event.code === 'Space' || event.code === 'Enter') game.pointer.down = false;
  });

  function handPosition() {
    if (typeof HandTracker !== 'undefined' && game.handAvailable && HandTracker.cursor.visible) {
      return {
        x: clamp(HandTracker.cursor.x, 0, 1),
        y: clamp(HandTracker.cursor.y, 0, 1),
        visible: true,
        action: !!HandTracker.cursor.pinching
      };
    }
    return {
      x: game.pointer.x,
      y: game.pointer.y,
      visible: game.pointer.visible,
      action: game.pointer.down
    };
  }

  function beginCamera() {
    if (typeof HandTracker === 'undefined' || !HandTracker.ready || !video || game.handAvailable || game.cameraStarting || game.cameraAttempted) return;
    game.cameraAttempted = true;
    game.cameraStarting = true;
    HandTracker.start(video).then(function (started) {
      game.cameraStarting = false;
      game.handAvailable = !!started;
      if (!started) game.cameraMessage = 'Kamera niedostępna — użyj myszy.';
    }).catch(function () {
      game.cameraStarting = false;
      game.cameraMessage = 'Kamera niedostępna — użyj myszy.';
    });
  }

  function stopCamera() {
    if (typeof HandTracker !== 'undefined' && HandTracker.running) HandTracker.stop();
    game.handAvailable = false;
    game.cameraStarting = false;
    game.cameraAttempted = false;
  }

  function returnToMenu() {
    stopCamera();
    closeVoiceEditor();
    game.actionPressed = false;
    game.homeAction = false;
    game.pointer.down = false;
    game.menuHandAction = false;
    game.apiaryHandAction = false;
    game.gameSelectAction = false;
    game.profileAction = false;
    game.galleryAction = false;
    game.introArmed = false;
    game.pause.active = false;
    game.pause.openedAt = 0;
    game.pause.latched = false;
    game.pause.pausedAt = 0;
    game.pauseOverlay = false;
    game.pauseAction = false;
    game.raisedWasActive = false;
    game.crossedWasActive = false;
    setTrackerPaused(false);
    game.menuPresence.seconds = 0;
    game.menuPresence.overlay = false;
    game.menuPresence.suggestedPlayers = game.playerCount || 1;
    game.menuPresence.count = 0;
    game.menuPresence.announcedCount = 0;
    game.menuPresence.twoHandsReady = false;
    game.menuPresence.message = '';
    game.menuPresence.messageUntil = 0;
    game.menuPresence.lastHandCount = 0;
    game.menuPresence.pendingEntryCount = 0;
    game.menuPresence.emptySince = 0;
    game.menuPresence.noPlayerAnnounced = false;
    game.screen = 'menu';
    if (game.autoDetect) {
      game.cameraAttempted = false;
      beginCamera();
    }
  }

  function visiblePeopleCount() {
    if (typeof HandTracker === 'undefined' || !game.handAvailable) return 0;
    const results = HandTracker.lastResults;
    const hands = results && results.multiHandLandmarks;
    if (hands && hands.length) return Math.min(4, hands.length);
    return HandTracker.cursor.visible ? 1 : 0;
  }

  function updateMenuPresence(delta) {
    const presence = game.menuPresence;
    const time = now();
    if (!game.autoDetect) {
      presence.seconds = 0;
      presence.overlay = false;
      presence.count = 0;
      presence.announcedCount = 0;
      presence.twoHandsReady = false;
      presence.message = '';
      presence.messageUntil = 0;
      presence.lastHandCount = 0;
      presence.pendingEntryCount = 0;
      presence.emptySince = 0;
      presence.noPlayerAnnounced = false;
      return;
    }
    const count = visiblePeopleCount();
    const previousCount = presence.lastHandCount;
    presence.count = count;
    const countChanged = count !== previousCount;
    presence.lastHandCount = count;

    if (count === 0) {
      if (countChanged) {
        presence.seconds = 0;
        presence.pendingEntryCount = 0;
        presence.overlay = false;
        presence.twoHandsReady = false;
        presence.emptySince = time;
        presence.message = '';
        presence.messageUntil = 0;
      }
      if (!presence.emptySince) presence.emptySince = time;
      if (!presence.noPlayerAnnounced && game.screen === 'menu' && time - presence.emptySince >= 60 && time - presence.lastSpeechAt >= 90) {
        const fallback = 'Dyć tu się nudzi bez ludzi! Zawołaj kogoś!';
        const message = sayVoice('nikt_nie_gra') || fallback;
        const hasLines = game.voiceLines && Array.isArray(game.voiceLines.nikt_nie_gra) && game.voiceLines.nikt_nie_gra.length;
        if (!hasLines) addToVoiceQueue(message);
        presence.lastSpeechAt = time;
        presence.noPlayerAnnounced = true;
        presence.message = message;
        presence.messageUntil = time + 6;
      }
      return;
    }

    if (countChanged) {
      presence.seconds = 0;
      presence.announcedCount = 0;
      presence.overlay = false;
      presence.twoHandsReady = false;
      presence.emptySince = 0;
      presence.noPlayerAnnounced = false;
      presence.pendingEntryCount = (previousCount === 0 && count === 1) ||
        (previousCount === 1 && count === 2) ? count : 0;
    }

    presence.seconds = Math.min(3, presence.seconds + delta);
    if (presence.seconds < 3 || !presence.pendingEntryCount) return;
    if (time - presence.lastSpeechAt < 30) {
      presence.pendingEntryCount = 0;
      return;
    }

    const entryCount = presence.pendingEntryCount;
    presence.pendingEntryCount = 0;
    presence.announcedCount = entryCount;
    presence.lastSpeechAt = time;
    if (entryCount === 1) {
      const fallback = 'Dyć zawołaj kogoś jeszcze! Nie baw się sam jak palec!';
      const message = fallback;
      presence.message = message;
      presence.messageUntil = time + 6;
      presence.overlay = false;
      presence.twoHandsReady = false;
      return;
    }
    presence.suggestedPlayers = 2;
    selectPlayers(presence.suggestedPlayers);
    presence.twoHandsReady = true;
    presence.message = 'Ej, już was dwóch! Zaczynamy?';
    presence.messageUntil = time + 6;
    presence.overlay = true;
  }

  function selectPlayers(count) {
    if (count !== 1 && count !== 2 && count !== 4) return;
    game.playerCount = count;
    game.playerScores = Array.from({ length: count }, function () { return 0; });
  }

  function startMatch(apiaryId) {
    game.apiaryId = apiaryId || 'siedlanowo';
    game.apiary = Rounds.getApiary(game.apiaryId);
    game.cameraAttempted = false;
    game.playerScores = Array.from({ length: game.playerCount }, function () { return 0; });
    game.totalScore = 0;
    game.playerIndex = 0;
    game.roundIndex = 0;
    game.roundScores = Array.from({ length: game.playerCount }, function () { return []; });
    game.roundStats = Array.from({ length: game.playerCount }, function () { return []; });
    game.matchStartedAt = now();
    game.matchEndedAt = 0;
    game.partyReport = null;
    game.partyReportAction = false;
    game.completedRounds = [];
    game.players = [];
    game.profileIndex = 0;
    beginProfile();
  }

  function beginProfile() {
    game.profileSnapshot = null;
    game.profilePhotoTaken = false;
    game.profileDetected = null;
    game.profileAction = false;
    game.matchCandidate = '';
    game.matchStreak = 0;
    game.welcome = '';
    game.actionPressed = false;
    game.pointer.down = false;
    game.profileName = '';
    game.profileAutoConfirmAt = 0;
    game.screen = 'profile';
    beginCamera();
  }

  function checkReturningPlayer() {
    if ((game.screen === 'profile' && game.profilePhotoTaken) || !window.PlayerProfiles || now() - game.lastProfileCheck < 0.8) return;
    game.lastProfileCheck = now();
    const match = PlayerProfiles.match(video);
    if (!match) {
      game.matchStreak = 0;
      game.matchCandidate = '';
      game.profileDetected = null;
      game.welcome = '';
      return;
    }
    game.matchStreak = game.matchCandidate === match.name ? game.matchStreak + 1 : 1;
    game.matchCandidate = match.name;
    if (game.matchStreak >= 2) {
      game.profileDetected = match;
      game.welcome = 'Hej ' + match.name + '! Pobij swój rekord: ' + match.highScore + ' pkt';
    }
  }

  function captureProfileFallback(source) {
    if (!source || source.readyState < 2 || !source.videoWidth || !source.videoHeight) return null;
    try {
      const snapshot = document.createElement('canvas');
      snapshot.width = source.videoWidth;
      snapshot.height = source.videoHeight;
      const context = snapshot.getContext('2d');
      if (!context) return null;
      context.translate(snapshot.width, 0);
      context.scale(-1, 1);
      context.drawImage(source, 0, 0, snapshot.width, snapshot.height);
      return { photo: snapshot.toDataURL('image/jpeg', 0.72), hash: null };
    } catch (error) {
      console.warn('Zdjęcie profilu pominięte: kamera jest niedostępna.', error);
      return null;
    }
  }

  function takeProfilePhoto() {
    // Najpierw wykryj kolor (przed zdjęciem, żeby video był dostępny)
    game.profileName = makeAutoProfileName();
    try {
      game.profileSnapshot = window.PlayerProfiles && typeof PlayerProfiles.capture === 'function'
        ? PlayerProfiles.capture(video) : captureProfileFallback(video);
    } catch (error) {
      console.warn('Nie udało się wykonać zdjęcia profilu.', error);
      game.profileSnapshot = captureProfileFallback(video);
    }
    game.profilePhotoTaken = true;
    game.profileImage = game.profileSnapshot ? new Image() : null;
    if (game.profileImage) game.profileImage.src = game.profileSnapshot.photo;
    game.profileAutoConfirmAt = now() + 2.2; // auto-przejdź po 2.2s
    game.actionPressed = false;
  }

  function confirmProfile() {
    if (game.screen !== 'profile' || !game.profilePhotoTaken) return;
    game.profileAutoConfirmAt = 0;
    const name = game.profileName || ('Gracz ' + (game.profileIndex + 1));
    const profile = { name: name, survivalTest: game.survivalTest.report };
    try { if (window.PlayerProfiles) PlayerProfiles.saveProfile(profile, game.profileSnapshot); } catch (e) { console.warn('saveProfile error:', e); }
    game.players.push({ name: name, photo: game.profileSnapshot && game.profileSnapshot.photo || null });
    game.profilePhotoTaken = false;
    game.profileAutoConfirmAt = 0;
    game.profileIndex += 1;
    if (game.profileIndex < game.playerCount) beginProfile();
    else showGameSelect();
  }

  function openGallery() {
    game.menuPresence.overlay = false;
    game.galleryItems = window.PlayerProfiles ? PlayerProfiles.gallery() : [];
    game.galleryImages = game.galleryItems.map(function (item) {
      const image = new Image();
      image.src = item.image;
      return image;
    });
    game.gallerySelection = -1;
    game.galleryAction = false;
    game.actionPressed = false;
    game.screen = 'gallery';
  }

  function showGameSelect() {
    if (game.completedRounds.length >= Rounds.count(game.apiaryId)) {
      finishGame();
      return;
    }
    game.screen = 'gameSelect';
    game.gameSelectAction = false;
    game.actionPressed = false;
    game.pointer.down = false;
  }

  function gameTileAt(point) {
    const count = Rounds.count(game.apiaryId);
    const columns = 2;
    const tileWidth = 0.38;
    const tileHeight = 0.105;
    for (let index = 0; index < count; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 0.08 + column * 0.47;
      const y = 0.29 + row * 0.145;
      if (point.x >= x && point.x <= x + tileWidth && point.y >= y && point.y <= y + tileHeight) return index;
    }
    return -1;
  }

  function startSelectedRound(index) {
    if (index < 0 || game.completedRounds.indexOf(index) >= 0) return;
    game.playerIndex = 0;
    startRound(index);
  }

  function beginCalibration(nextScreen) {
    game.calibration = { pinches: 0, lastAction: false, armed: false };
    game.calibrationNextScreen = nextScreen || 'menu';
    game.actionPressed = false;
    game.pointer.down = false;
    game.screen = 'calibration';
    beginCamera();
  }

  function finishCalibration() {
    markCalibrationDone();
    game.actionPressed = false;
    game.pointer.down = false;
    beginSurvivalTest(game.calibrationNextScreen || 'menu');
  }

  function beginSurvivalTest(nextScreen) {
    game.survivalTest = { startedAt: now(), samples: [], report: null, complete: false, nextScreen: nextScreen || 'menu' };
    game.actionPressed = false;
    game.pointer.down = false;
    game.screen = 'survivalTest';
    beginCamera();
  }

  function landmarkSample() {
    if (!game.handAvailable || typeof HandTracker === 'undefined') return null;
    const hands = HandTracker.lastResults && HandTracker.lastResults.multiHandLandmarks;
    const hand = hands && hands[0];
    if (!hand || hand.length < 21) return null;
    const points = hand.map(function (point) {
      return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
    });
    return points.every(Boolean) ? points : null;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    return Math.sqrt(values.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / values.length);
  }

  function makeSurvivalReport(samples) {
    let jitter = 0.055;
    if (samples.length >= 8) {
      const deviations = [];
      for (let landmark = 0; landmark < 21; landmark += 1) {
        deviations.push(standardDeviation(samples.map(function (sample) { return sample[landmark].x; })));
        deviations.push(standardDeviation(samples.map(function (sample) { return sample[landmark].y; })));
      }
      jitter = deviations.reduce(function (sum, value) { return sum + value; }, 0) / deviations.length;
    }
    const wobble = clamp((jitter - 0.003) / 0.045, 0, 1);
    const chances = Rounds.all.map(function (round, index) {
      const bases = [96, 88, 94, 82, 86];
      const penalties = [50, 76, 82, 57, 68];
      return { title: round.title, chance: Math.round(clamp((bases[index] || 84) - wobble * (penalties[index] || 64), 8, 98)) };
    });
    let comment;
    if (samples.length < 8) comment = 'Mózg Elektronowy nic nie widzi. Dyć pokaż tę dłoń, bo z taką mgłą nawet ryba nie bierze.';
    else if (wobble > 0.68) comment = 'Dyć kajś ty był? Przy wodarce możliwe skręcenie nadgarstka, a miodarka patrzy z niepokojem.';
    else if (wobble > 0.34) comment = 'No, ręka chodzi jak łódka na Jezioraku. Da się, ale korbę kręć z namysłem.';
    else comment = 'Elegancko, jakbyś od rana miód wirował. Mózg Elektronowy daje błogosławieństwo na pasiekę.';
    return {
      measuredAt: new Date().toISOString(),
      jitter: Number(jitter.toFixed(4)),
      sampleCount: samples.length,
      chances: chances,
      comment: comment
    };
  }

  function saveSurvivalReport(report) {
    try { localStorage.setItem(SURVIVAL_TEST_KEY, JSON.stringify(report)); }
    catch (_) { /* localStorage może być wyłączony */ }
  }

  function startRound(index) {
    game.roundIndex = index;
    game.round = Rounds.get(index, game.apiaryId);
    game.roundState = {
      startedAt: now(),
      pausedAt: 0,
      progress: 0,
      bonus: 0,
      penalty: 0,
      chronicles: game.round.type === 'chronicles' ? {
        questions: Rounds.makeChroniclesQuestions(game.chroniclesSlides || []),
        index: 0, choice: 1, hits: 0, deadline: 0,
        feedbackUntil: 0, feedback: ''
      } : null,
      targets: Rounds.makeTargets(game.round.target, index + game.playerIndex * 101 + 41),
      drag: { active: false, lastY: 0, lastVelocity: 0, jerks: 0, progress: 0 },
      spin: {
        baseline: typeof HandTracker !== 'undefined' ? HandTracker.circleMotion.revolutions : 0,
        progress: 0,
        lastX: null,
        motions: [],
        rhythm: 0,
        chaoticTime: 0,
        pathPoints: [],
        lastAngle: null,
        lastCenter: null,
        pathTurns: 0,
        circleRadius: 0,
        circleFit: 0,
        circleCoverage: 0
      },
      ducks: [],
      boars: [],
      frogger: { obstacles: [], lastSpawnAt: now(), jumpingUntil: 0, crouchingUntil: 0, flyingUntil: 0, cleared: 0 },
      fishing: {
        fish: [], nextSpawnAt: now() + 0.8, lastY: null, lastX: null, castTravel: 0,
        castStartedAt: 0, activeFish: null, biteUntil: 0, reelPoints: [], reelTurns: 0,
        reelLastAngle: null, lastReelAt: 0
      },
      boarShotActive: false,
      shots: 0,
      hits: 0,
      series: 0,
      bestSeries: 0,
      shotActive: false,
      accuracy: 0
    };
    game.timeLeft = game.round.duration;
    game.actionPressed = false;
    game.screen = 'roundIntro';
    game.introArmed = false;
    beginCamera();
  }

  function beginPlaying() {
    game.roundState.startedAt = now();
    game.roundState.pausedAt = 0;
    game.pauseOverlay = false;
    game.pauseAction = false;
    game.screen = 'playing';
    game.activeLayer = 'game';
    game.lastUncertaintyAt = now();
    if (game.round.type === 'chronicles') game.roundState.chronicles.deadline = now() + 8;
    game.actionPressed = false;
    game.lastMotionAt = now();
    game.idleVoicePlayed = false;
  }

  function trackerIsPaused() {
    if (typeof handTracker !== 'undefined') return !!handTracker.paused;
    return typeof HandTracker !== 'undefined' && !!HandTracker.paused;
  }

  function setTrackerPaused(value) {
    if (typeof handTracker !== 'undefined') handTracker.paused = value;
    else if (typeof HandTracker !== 'undefined') HandTracker.paused = value;
  }

  function openPauseMenu() {
    if (game.pauseOverlay || !game.roundState) return;
    game.timeLeft = Math.max(0, game.round.duration - (now() - game.roundState.startedAt));
    game.roundState.pausedAt = now();
    game.pauseOverlay = true;
    game.activeLayer = 'pause';
    game.pauseAction = false;
    game.actionPressed = false;
    game.pointer.down = false;
  }

  function continueAfterPause() {
    if (game.roundState && game.roundState.pausedAt) {
      const pausedFor = now() - game.roundState.pausedAt;
      game.roundState.startedAt += pausedFor;
      if (game.roundState.chronicles) {
        game.roundState.chronicles.deadline += pausedFor;
        if (game.roundState.chronicles.feedbackUntil) game.roundState.chronicles.feedbackUntil += pausedFor;
      }
      game.roundState.pausedAt = 0;
    }
    setTrackerPaused(false);
    game.pauseOverlay = false;
    game.activeLayer = 'game';
    game.lastUncertaintyAt = now();
    game.pauseAction = false;
    game.actionPressed = false;
    game.pointer.down = false;
  }

  function leavePauseToMenu() {
    returnToMenu();
  }

  function cancelOrNextPlayer() {
    if ((game.screen === 'playing' || game.screen === 'roundIntro') && game.playerIndex + 1 < game.playerCount) {
      game.pauseOverlay = false;
      game.playerIndex += 1;
      startRound(game.roundIndex);
    } else {
      leavePauseToMenu();
    }
    game.actionPressed = false;
    game.pointer.down = false;
  }

  function updatePauseMenu(pos, pushForward) {
    const handPress = pushForward || (pos.action && !game.pauseAction);
    if (game.actionPressed || handPress) {
      const point = handPress ? pos : game.pressPoint;
      if (point.y > 0.48 && point.y < 0.7) {
        if (point.x < 0.5) leavePauseToMenu();
        else continueAfterPause();
      }
      game.actionPressed = false;
    }
    game.pauseAction = pos.action;
  }

  function finishRound(success) {
    const state = game.roundState;
    const round = game.round;
    let base = success
      ? round.points * (0.5 + state.progress * 0.5)
      : round.points * state.progress * 0.35;
    if (round.type === 'chronicles') base = round.points * state.chronicles.hits / Math.max(1, state.chronicles.questions.length);

    if (round.type === 'gun' || round.type === 'boars') {
      state.accuracy = state.shots ? state.hits / state.shots : 0;
      base *= 0.4 + state.accuracy * 0.6;
    }
    game.lastScore = Math.max(0, Math.round(base + round.points * state.bonus - round.points * state.penalty));
    game.playerScores[game.playerIndex] += game.lastScore;
    game.roundScores[game.playerIndex][game.roundIndex] = game.lastScore;
    if (!game.roundStats[game.playerIndex]) game.roundStats[game.playerIndex] = [];
    game.roundStats[game.playerIndex][game.roundIndex] = {
      shots: round.type === 'chronicles' ? state.chronicles.questions.length : state.shots || 0,
      hits: round.type === 'chronicles' ? state.chronicles.hits : state.hits || 0,
      misses: round.type === 'chronicles' ? state.chronicles.questions.length - state.chronicles.hits : Math.max(0, (state.shots || 0) - (state.hits || 0)),
      elapsedSeconds: Math.max(0, game.round.duration - game.timeLeft)
    };
    game.totalScore = game.playerScores.reduce(function (sum, score) { return sum + score; }, 0);
    game.roundComment = pickRoundComment(round, state);
    sayVoice(success ? 'komentarz_wynik_dobry' : 'komentarz_wynik_zły');
    if (window.SFX) SFX.fanfare();
    game.screen = 'roundResult';
    game.pointer.down = false;
    game.actionPressed = false;
  }

  function pickRoundComment(round, state) {
    if (!game.comments) return '';
    let key;
    if (round.type === 'drag') key = state.drag.jerks <= 1 ? 'frame_good' : 'frame_bad';
    else if (round.type === 'spin') key = state.bonus >= state.penalty ? 'crank_good' : 'crank_bad';
    else if (round.type === 'gun') key = state.accuracy >= 0.5 ? 'ducks_good' : 'ducks_bad';
    else return '';
    const lines = game.comments[key] || [];
    return lines.length ? lines[Math.floor(Math.random() * lines.length)] : '';
  }

  function persistScoresFallback() {
    try {
      const stored = JSON.parse(localStorage.getItem('pasieka-party-profiles-v1') || '[]');
      if (!Array.isArray(stored)) return;
      game.players.forEach(function (player, index) {
        const profile = stored.find(function (item) { return item && item.name === player.name; });
        const score = game.playerScores[index] || 0;
        if (profile && score > (profile.highScore || 0)) profile.highScore = score;
        else if (!profile) stored.unshift({ name: player.name, highScore: score, photo: player.photo || null, hash: null });
      });
      localStorage.setItem('pasieka-party-profiles-v1', JSON.stringify(stored));
    } catch (_) { /* Wynik pozostaje w bieżącej rozgrywce, gdy zapis przeglądarki jest wyłączony. */ }
  }

  function reportTitleFor(round) {
    const titles = {
      collect: 'Król Pyłku',
      drag: 'Mistrz Ramki',
      spin: 'Król Wirówki',
      fishing: 'Król Wodarki',
      gun: 'Postrach Kaczek',
      frogger: 'Mistrz Żab',
      boars: 'Łowca Dziczków',
      chronicles: 'Kronikarz Marcina',
      placeholder: 'Mistrz Pasieki'
    };
    return titles[round && round.type] || 'Wszechstronny Pszczelarz';
  }

  function buildPartyReport() {
    const storedProfiles = savedProfiles();
    const rounds = [];
    for (let index = 0; index < Rounds.count(game.apiaryId); index += 1) rounds.push(Rounds.get(index, game.apiaryId));
    let totalMisses = 0;
    let bestHighlight = { score: -1, name: '', title: '' };
    const ranking = game.playerScores.map(function (score, index) {
      const current = game.players[index] || {};
      const stored = storedProfiles.find(function (profile) {
        const storedName = profile.name || profile.imie;
        return storedName && storedName === current.name;
      }) || {};
      const profile = Object.assign({}, stored, current);
      const stats = game.roundStats[index] || [];
      const misses = stats.reduce(function (sum, roundStats) { return sum + (roundStats ? roundStats.misses || 0 : 0); }, 0);
      totalMisses += misses;
      const scores = game.roundScores[index] || [];
      let bestRound = -1;
      let bestRoundScore = -1;
      scores.forEach(function (roundScore, roundIndex) {
        if (typeof roundScore === 'number' && roundScore > bestRoundScore && rounds[roundIndex]) {
          bestRound = roundIndex;
          bestRoundScore = roundScore;
        }
      });
      if (bestRoundScore > 0 && bestRoundScore > bestHighlight.score) {
        bestHighlight = { score: bestRoundScore, name: profile.name || playerName(index), title: rounds[bestRound].title };
      }
      return {
        name: profile.name || playerName(index),
        score: Number(score) || 0,
        title: bestRound >= 0 ? reportTitleFor(rounds[bestRound]) : 'Pszczeli Debiutant',
        misses: misses
      };
    }).sort(function (a, b) {
      return b.score - a.score || a.name.localeCompare(b.name, 'pl');
    });
    const endedAt = game.matchEndedAt || now();
    const elapsedSeconds = Math.max(0, endedAt - (game.matchStartedAt || endedAt));
    const missLeader = ranking.slice().sort(function (a, b) { return b.misses - a.misses; })[0];
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60 * 10) / 10);
    const funFacts = [
      'Miód punktowy: ' + game.playerScores.reduce(function (sum, score) { return sum + score; }, 0) + ' pkt',
      totalMisses ? 'Król pudła: ' + missLeader.name + ' (' + missLeader.misses + ' pudłowań)' : 'Zero pudłowań. Mózg Elektronowy sprawdza okulary!',
      bestHighlight.score > 0 ? 'Złoty strzał: ' + bestHighlight.name + ' — ' + bestHighlight.title + ' (' + bestHighlight.score + ' pkt)' : 'Złoty strzał: jeszcze czeka na bohatera.',
      'Czas miodobrania: ' + durationMinutes + ' min — pszczoły już liczą nadgodziny.'
    ];
    return {
      generatedAt: new Date().toISOString(),
      apiary: game.apiary ? game.apiary.name : game.apiaryId,
      totalScore: game.playerScores.reduce(function (sum, score) { return sum + score; }, 0),
      totalMisses: totalMisses,
      elapsedSeconds: elapsedSeconds,
      funFacts: funFacts,
      ranking: ranking
    };
  }

  function savePartyReport(report) {
    try { localStorage.setItem(PARTY_REPORT_KEY, JSON.stringify(report)); }
    catch (_) { /* localStorage może być wyłączony */ }
  }

  function partyReportText(report) {
    const lines = [
      'PASIEKA PARTY — KONIEC IMPREZY',
      'Pasieka: ' + report.apiary,
      'Data: ' + new Date(report.generatedAt).toLocaleString('pl-PL'),
      '',
      'RANKING'
    ];
    report.ranking.forEach(function (entry, index) {
      lines.push((index + 1) + '. ' + entry.name + ' — ' + entry.score + ' pkt — ' + entry.title);
    });
    lines.push('', 'STATYSTYKI');
    (report.funFacts || []).forEach(function (fact) { lines.push('- ' + fact); });
    return lines.join('\n');
  }

  function downloadPartyReport() {
    const report = game.partyReport || buildPartyReport();
    game.partyReport = report;
    savePartyReport(report);
    const blob = new Blob(['\uFEFF', partyReportText(report)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pasieka-party-raport.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function finishGame() {
    game.matchEndedAt = now();
    const bestScore = game.playerScores.reduce(function (best, score) { return Math.max(best, score); }, 0);
    if (window.PlayerProfiles) {
      const players = game.playerScores.map(function (score, index) {
        const profile = game.players[index] || {};
        PlayerProfiles.recordScore(profile.name, score);
        return { name: profile.name || playerName(index), photo: profile.photo || null, score: score };
      });
      PlayerProfiles.saveCollage(players).catch(function () { /* local storage may be unavailable */ });
    } else persistScoresFallback();
    game.partyReport = buildPartyReport();
    savePartyReport(game.partyReport);
    sayVoice(bestScore > 0 ? 'komentarz_wynik_dobry' : 'komentarz_wynik_zły');
    game.screen = 'partyReport';
    game.partyReportAction = false;
    game.actionPressed = false;
  }

  function nextTurn() {
    game.actionPressed = false;
    if (game.playerIndex + 1 < game.playerCount) {
      game.playerIndex += 1;
      startRound(game.roundIndex);
    } else {
      if (game.completedRounds.indexOf(game.roundIndex) < 0) game.completedRounds.push(game.roundIndex);
      showGameSelect();
    }
  }

  function updateCollect(pos, action) {
    const state = game.roundState;
    state.targets.forEach(function (target) {
      if (!target.alive) return;
      target.x = clamp(target.x + target.vx, 0.08, 0.92);
      target.y = clamp(target.y + target.vy, 0.18, 0.78);
      target.phase += 0.08;
      const dx = pos.x - target.x;
      const dy = pos.y - target.y;
      if (action && dx * dx + dy * dy < 0.0025) {
        target.alive = false;
        state.progress = clamp(state.progress + 1 / game.round.target, 0, 1);
        sayVoice('reakcja_trafienie');
        if (window.SFX) SFX.beepGood();
      }
    });
    if (state.progress >= 1) finishRound(true);
  }

  function updateDrag(pos, action, delta) {
    const state = game.roundState;
    const drag = state.drag;
    const rule = game.round.rule;
    const nearFrame = pos.x > 0.28 && pos.x < 0.72 && pos.y > 0.15 && pos.y < 0.88;

    if (action && !drag.active && nearFrame) {
      drag.active = true;
      drag.lastY = pos.y;
      drag.lastVelocity = 0;
    }
    if (drag.active && action) {
      const movement = pos.y - drag.lastY;
      const velocity = movement / Math.max(delta, 0.016);
      const jerk = Math.abs(movement) > rule.jerkThreshold ||
        Math.abs(velocity - drag.lastVelocity) > rule.jerkVelocityThreshold;

      if (jerk && Math.abs(movement) > 0.004) {
        drag.jerks += 1;
        state.penalty = clamp(state.penalty + rule.jerkPenalty, 0, 0.9);
        drag.progress = clamp(drag.progress - rule.jerkPenalty, 0, 1);
        if (window.SFX) SFX.beepBad();
      } else if (movement * rule.direction > 0) {
        drag.progress = clamp(drag.progress + movement * rule.direction * rule.progressScale, 0, 1);
      }
      drag.lastY = pos.y;
      drag.lastVelocity = velocity;
    }
    if (!action) drag.active = false;
    state.progress = drag.progress;
    if (drag.progress >= 1) finishRound(true);
  }

  function calculateFallbackRhythm(spin, movement) {
    if (movement < 0.0004) return spin.rhythm;
    spin.motions.push(movement);
    if (spin.motions.length > 16) spin.motions.shift();
    if (spin.motions.length < 4) return spin.rhythm;
    const average = spin.motions.reduce(function (sum, value) { return sum + value; }, 0) / spin.motions.length;
    const variance = spin.motions.reduce(function (sum, value) { return sum + Math.pow(value - average, 2); }, 0) / spin.motions.length;
    return clamp(1 - Math.sqrt(variance) / (average + 0.0001), 0, 1);
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function measureCircle(points) {
    if (points.length < 8) return { valid: false, radius: 0, fit: 0, coverage: 0, direction: 0, angle: 0 };
    const center = points.reduce(function (result, point) {
      result.x += point.x;
      result.y += point.y;
      return result;
    }, { x: 0, y: 0 });
    center.x /= points.length;
    center.y /= points.length;

    const radii = points.map(function (point) {
      return Math.hypot(point.x - center.x, point.y - center.y);
    });
    const radius = radii.reduce(function (sum, value) { return sum + value; }, 0) / radii.length;
    const variance = radii.reduce(function (sum, value) { return sum + Math.pow(value - radius, 2); }, 0) / radii.length;
    const fit = clamp(1 - Math.sqrt(variance) / (radius + 0.0001), 0, 1);
    const angles = points.map(function (point) { return Math.atan2(point.y - center.y, point.x - center.x); });
    let signed = 0;
    let absolute = 0;
    let pathLength = 0;
    for (let i = 1; i < points.length; i += 1) {
      const step = normalizeAngle(angles[i] - angles[i - 1]);
      signed += step;
      absolute += Math.abs(step);
      pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const direction = absolute ? Math.abs(signed) / absolute : 0;
    const coverage = clamp(pathLength / (Math.PI * 2 * Math.max(radius, 0.001) * 1.25), 0, 1);
    return {
      valid: true,
      radius,
      fit,
      coverage,
      direction,
      angle: angles[angles.length - 1],
      center
    };
  }

  function updateSpin(pos, delta) {
    const state = game.roundState;
    const spin = state.spin;
    const rule = game.round.rule;
    if (!pos.visible) return;
    spin.pathPoints.push({ x: pos.x, y: pos.y });
    if (spin.pathPoints.length > 48) spin.pathPoints.shift();
    const metrics = measureCircle(spin.pathPoints);
    const crankMotion = game.handAvailable && typeof HandTracker !== 'undefined' ? HandTracker.circleMotion : null;
    const largeCrankAccepted = !crankMotion || typeof crankMotion.valid !== 'boolean' || crankMotion.valid;
    const validCircle = metrics.valid && metrics.radius >= rule.minRadius &&
      metrics.fit >= rule.minFit && metrics.coverage >= rule.minCoverage &&
      metrics.direction >= rule.minDirection && largeCrankAccepted;
    spin.circleRadius = metrics.radius;
    spin.circleFit = metrics.fit;
    spin.circleCoverage = metrics.coverage;

    if (validCircle) {
      if (spin.lastAngle !== null) {
        const step = normalizeAngle(metrics.angle - spin.lastAngle);
        if (Math.abs(step) < Math.PI * 0.75) spin.pathTurns += Math.abs(step) / (Math.PI * 2);
        const fallbackRhythm = calculateFallbackRhythm(spin, Math.abs(step));
        const handRhythm = game.handAvailable && typeof HandTracker !== 'undefined'
          ? clamp(HandTracker.circleMotion.rhythm, 0, 1) : fallbackRhythm;
        spin.rhythm = spin.rhythm * 0.85 + handRhythm * 0.15;
      }
      spin.lastAngle = metrics.angle;
      if (spin.rhythm >= rule.rhythmThreshold) state.bonus = clamp(state.bonus + delta * rule.rhythmBonus * 0.08, 0, rule.rhythmBonus);
      else {
        state.penalty = clamp(state.penalty + delta * rule.chaosPenalty * 0.08, 0, 0.75);
        spin.chaoticTime += delta;
      }
    } else {
      spin.lastAngle = null;
      if (spin.circleRadius >= rule.minRadius && spin.circleFit < rule.minFit) {
        state.penalty = clamp(state.penalty + delta * rule.chaosPenalty * 0.04, 0, 0.75);
        spin.chaoticTime += delta;
      }
    }

    const rawProgress = spin.pathTurns / rule.targetTurns;
    spin.progress = clamp(rawProgress, 0, 1);
    state.progress = clamp(spin.progress + state.bonus - state.penalty, 0, 1);
    if (state.progress >= 1) finishRound(true);
  }

  function updateFlyingDucks(pos, action, delta) {
    const state = game.roundState;
    const rule = game.round.rule;
    if (!state.ducks.length) {
      state.ducks = state.targets.map(function (target, index) {
        const angle = (index % 2 ? -1 : 1) * (0.25 + (index % 5) * 0.37);
        const speed = 0.16 + (index % 4) * 0.025;
        return {
          x: target.x,
          y: 0.25 + (index % 4) * 0.12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          direction: Math.cos(angle) < 0 ? -1 : 1,
          alive: true,
          size: 30 + (index % 3) * 5,
          phase: index * 0.8
        };
      });
    }
    state.ducks.forEach(function (duck) {
      if (!duck.alive) return;
      duck.x += duck.vx * delta;
      duck.y += duck.vy * delta;
      duck.phase += delta * 8;
      if (duck.x < 0.06 || duck.x > 0.94) {
        duck.x = clamp(duck.x, 0.06, 0.94);
        duck.vx *= -1;
        duck.direction = duck.vx < 0 ? -1 : 1;
      }
      if (duck.y < 0.18 || duck.y > 0.72) duck.vy *= -1;
      if (Math.random() < rule.directionChangeChance * delta * 60) {
        const turn = (Math.random() - 0.5) * 1.1;
        const angle = Math.atan2(duck.vy, duck.vx) + turn;
        const speed = Math.max(0.12, Math.hypot(duck.vx, duck.vy));
        duck.vx = Math.cos(angle) * speed;
        duck.vy = Math.sin(angle) * speed;
        duck.direction = duck.vx < 0 ? -1 : 1;
      }
    });

    const trackerActive = game.handAvailable && typeof HandTracker !== 'undefined';
    const gun = trackerActive && HandTracker.gunGesture;
    const trigger = trackerActive ? !!gun : !!action;
    const shot = trigger && !state.shotActive;
    state.shotActive = trigger;
    if (!shot) return;
    state.shots += 1;

    let closest = null;
    let closestDistance = Infinity;
    state.ducks.forEach(function (duck) {
      if (!duck.alive) return;
      const dx = pos.x - duck.x;
      const dy = pos.y - duck.y;
      const distance = dx * dx + dy * dy;
      if (distance < closestDistance) { closest = duck; closestDistance = distance; }
    });

    if (closest && closestDistance <= rule.hitRadius * rule.hitRadius) {
      closest.alive = false;
      state.hits += 1;
      state.series += 1;
      state.bestSeries = Math.max(state.bestSeries, state.series);
      state.bonus = clamp(state.bonus + rule.seriesBonus * Math.min(state.series, 5), 0, 0.35);
      state.progress = clamp(state.hits / game.round.target, 0, 1);
      sayVoice('reakcja_trafienie');
      if (window.SFX) SFX.beepGood();
    } else {
      state.series = 0;
      sayVoice('reakcja_pudło');
      if (window.SFX) SFX.beepBad();
    }
    state.accuracy = state.shots ? state.hits / state.shots : 0;
    if (state.progress >= 1) finishRound(true);
  }

  function randomFish(rule) {
    const area = rule.fishSpawnArea;
    return {
      x: area.xMin + Math.random() * (area.xMax - area.xMin),
      y: area.yMin + Math.random() * (area.yMax - area.yMin),
      size: 18 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      biting: false,
      caught: false
    };
  }

  function resetFishingCast(fishing, time) {
    fishing.castTravel = 0;
    fishing.castStartedAt = time || 0;
  }

  function startFishBite(fishing, fish, rule, time) {
    fishing.activeFish = fish;
    fish.biting = true;
    fishing.biteUntil = time + 2.5;
    fishing.reelPoints = [];
    fishing.reelTurns = 0;
    fishing.reelLastAngle = null;
    fishing.lastReelAt = time;
    fishing.lastY = null;
    fishing.lastX = null;
    if (window.SFX) SFX.tick();
  }

  function updateFishing(pos, delta) {
    const state = game.roundState;
    const fishing = state.fishing;
    const rule = game.round.rule;
    const time = now();
    const interval = rule.fishSpawnInterval;
    if (time >= fishing.nextSpawnAt) {
      fishing.fish.push(randomFish(rule));
      fishing.nextSpawnAt = time + interval[0] + Math.random() * (interval[1] - interval[0]);
    }
    fishing.fish.forEach(function (fish) { fish.phase += delta * 4; });

    if (pos.visible && !fishing.activeFish) {
      if (fishing.lastY === null) {
        fishing.lastY = pos.y;
        fishing.lastX = pos.x;
        fishing.castStartedAt = time;
      } else {
        const vertical = Math.abs(pos.y - fishing.lastY);
        const horizontal = Math.abs(pos.x - fishing.lastX);
        if (time - fishing.castStartedAt > 0.8) resetFishingCast(fishing, time);
        if (vertical > horizontal && vertical / Math.max(delta, 0.016) >= rule.castMinVelocity) fishing.castTravel += vertical;
        fishing.lastY = pos.y;
        fishing.lastX = pos.x;
        if (fishing.castTravel >= rule.castMinTravel) {
          const fish = fishing.fish.find(function (candidate) { return !candidate.caught && !candidate.biting; });
          if (fish) startFishBite(fishing, fish, rule, time);
          resetFishingCast(fishing, time);
        }
      }
    } else if (!pos.visible) {
      fishing.lastY = null;
      fishing.lastX = null;
      resetFishingCast(fishing, time);
    }

    const fish = fishing.activeFish;
    if (fish) {
      if (time >= fishing.biteUntil) {
        fish.biting = false;
        fishing.activeFish = null;
        fishing.reelPoints = [];
        fishing.reelTurns = 0;
        fishing.reelLastAngle = null;
        fishing.lastY = null;
        fishing.lastX = null;
        if (window.SFX) SFX.beepBad();
      } else if (pos.visible) {
        fishing.reelPoints.push({ x: pos.x, y: pos.y });
        if (fishing.reelPoints.length > 28) fishing.reelPoints.shift();
        const metrics = measureCircle(fishing.reelPoints);
        const validReel = metrics.valid && metrics.radius >= rule.reelMinRadius && metrics.radius <= rule.reelMaxRadius &&
          metrics.fit >= 0.58 && metrics.coverage >= 0.4 && metrics.direction >= 0.55;
        if (validReel && fishing.reelLastAngle !== null) {
          const step = normalizeAngle(metrics.angle - fishing.reelLastAngle);
          const turnsPerSecond = Math.abs(step) / (Math.PI * 2 * Math.max(delta, 0.016));
          if (turnsPerSecond >= rule.reelMinSpeed && Math.abs(step) < Math.PI * 0.75) fishing.reelTurns += Math.abs(step) / (Math.PI * 2);
        }
        fishing.reelLastAngle = validReel ? metrics.angle : null;
        if (fishing.reelTurns >= rule.reelMinTurns) {
          fish.caught = true;
          fishing.activeFish = null;
          fishing.lastY = null;
          fishing.lastX = null;
          fishing.reelPoints = [];
          fishing.reelTurns = 0;
          fishing.reelLastAngle = null;
          state.progress = clamp(state.progress + 1 / game.round.target, 0, 1);
          state.bonus = clamp(state.bonus + 0.025, 0, 0.2);
          if (window.SFX) SFX.beepGood();
        }
      }
    }
    fishing.fish = fishing.fish.filter(function (candidate) { return !candidate.caught; });
    if (state.progress >= 1) finishRound(true);
  }

  function updateFrogger(delta) {
    const state = game.roundState;
    const frogger = state.frogger;
    const rule = game.round.rule;
    const tracker = window.HandTracker;
    const time = now();
    if (tracker && tracker.waving) frogger.flyingUntil = time + rule.flightDuration;
    else if (tracker && tracker.handsUp) frogger.jumpingUntil = time + rule.jumpDuration;
    else if (tracker && tracker.handsDown) frogger.crouchingUntil = time + rule.crouchDuration;

    const spawnDelay = Math.max(0.75, 1.25 - rule.obstacleSpeed * 1000);
    if (time - frogger.lastSpawnAt >= spawnDelay) {
      const kinds = ['jump', 'crouch', 'water'];
      frogger.obstacles.push({ x: 1.08, kind: kinds[(frogger.cleared + frogger.obstacles.length) % kinds.length], resolved: false });
      frogger.lastSpawnAt = time;
    }
    frogger.obstacles.forEach(function (obstacle) {
      if (obstacle.resolved) return;
      obstacle.x -= rule.obstacleSpeed * delta * 1000;
      if (obstacle.x > 0.25) return;
      const safe = obstacle.kind === 'jump' ? time < frogger.jumpingUntil :
        obstacle.kind === 'crouch' ? time < frogger.crouchingUntil : time < frogger.flyingUntil;
      obstacle.resolved = true;
      if (safe) {
        frogger.cleared += 1;
        state.progress = clamp(frogger.cleared / game.round.target, 0, 1);
        state.bonus = clamp(state.bonus + 0.015, 0, 0.2);
        if (window.SFX) SFX.beepGood();
      } else {
        state.penalty = clamp(state.penalty + 0.08, 0, 0.75);
        if (window.SFX) SFX.beepBad();
      }
    });
    frogger.obstacles = frogger.obstacles.filter(function (obstacle) { return !obstacle.resolved; });
    if (state.progress >= 1) finishRound(true);
  }

  function updateBoars(pos, action, delta) {
    const state = game.roundState;
    const rule = game.round.rule;
    if (!state.boars.length) {
      state.boars = state.targets.map(function (target, index) {
        const direction = index % 2 ? -1 : 1;
        return {
          x: direction > 0 ? -0.08 : 1.08,
          y: 0.32 + (index % 5) * 0.1,
          speed: 0.00065 + Math.random() * 0.00055,
          direction,
          alive: true,
          size: 32 + Math.random() * 10
        };
      });
    }
    state.boars.forEach(function (boar) {
      if (!boar.alive) return;
      boar.x += boar.speed * boar.direction * delta * 1000;
      boar.y += (Math.random() - 0.5) * 0.0015;
      boar.y = clamp(boar.y, 0.25, 0.72);
      if (Math.random() < rule.directionChangeChance) {
        boar.direction *= -1;
        boar.speed = 0.00065 + Math.random() * 0.0007;
      }
      if (boar.x < -0.14) boar.x = 1.14;
      if (boar.x > 1.14) boar.x = -0.14;
    });

    const shot = action && !state.boarShotActive;
    state.boarShotActive = action;
    if (!shot) return;
    state.shots += 1;
    let closest = null;
    let closestDistance = Infinity;
    state.boars.forEach(function (boar) {
      if (!boar.alive) return;
      const distance = Math.pow(pos.x - boar.x, 2) + Math.pow(pos.y - boar.y, 2);
      if (distance < closestDistance) { closest = boar; closestDistance = distance; }
    });
    if (closest && closestDistance <= rule.hitRadius * rule.hitRadius) {
      closest.alive = false;
      state.hits += 1;
      state.series += 1;
      state.bestSeries = Math.max(state.bestSeries, state.series);
      state.bonus = clamp(state.bonus + rule.seriesBonus * Math.min(state.series, 4), 0, 0.35);
      state.progress = clamp(state.hits / game.round.target, 0, 1);
      sayVoice('reakcja_trafienie');
      if (window.SFX) SFX.beepGood();
    } else {
      state.series = 0;
      state.penalty = clamp(state.penalty + rule.missPenalty, 0, 0.75);
      sayVoice('reakcja_pudło');
      if (window.SFX) SFX.beepBad();
    }
    state.accuracy = state.shots ? state.hits / state.shots : 0;
    if (state.progress >= 1) finishRound(true);
  }

  function updateChronicles(pos, pushForward, swipeLeft, swipeRight) {
    const state = game.roundState;
    const quiz = state.chronicles;
    if (!quiz.questions.length) return;
    const time = now();
    if (quiz.feedbackUntil) {
      game.actionPressed = false;
      if (time < quiz.feedbackUntil) return;
      quiz.feedbackUntil = 0;
      quiz.feedback = '';
      quiz.index += 1;
      if (quiz.index >= quiz.questions.length) {
        state.progress = quiz.hits / quiz.questions.length;
        finishRound(true);
        return;
      }
      quiz.deadline = time + 8;
      quiz.lastAction = pos.action;
    }
    if (swipeLeft) quiz.choice = (quiz.choice + 2) % 3;
    if (swipeRight) quiz.choice = (quiz.choice + 1) % 3;
    const clicked = game.actionPressed;
    if (clicked) {
      const point = game.pressPoint;
      if (point.y >= 0.6 && point.y <= 0.7) {
        const option = Math.floor((point.x - 0.12) / 0.27);
        if (option >= 0 && option < 3 && point.x <= 0.12 + option * 0.27 + 0.24) quiz.choice = option;
      }
    }
    const action = pushForward || clicked || (pos.action && !quiz.lastAction);
    quiz.lastAction = pos.action;
    game.actionPressed = false;
    if (!action && time < quiz.deadline) return;
    const question = quiz.questions[quiz.index];
    const correct = action && quiz.choice === question.correct;
    if (correct) {
      quiz.hits += 1;
      sayVoice('reakcja_trafienie');
      if (window.SFX) SFX.beepGood();
      quiz.feedback = 'Trafione! Dyć ty znasz Marcina jak własną kieszeń!';
    } else {
      sayVoice('reakcja_pudło');
      if (window.SFX) SFX.beepBad();
      quiz.feedback = (action ? 'Pudło! ' : 'Czas minął! ') + 'Poprawnie: ' + question.options[question.correct];
    }
    quiz.feedbackUntil = time + 0.65;
    state.progress = quiz.hits / quiz.questions.length;
  }

  function updateCalibration(pos) {
    const calibration = game.calibration;
    const action = pos.action || game.actionPressed;
    if (!action) calibration.armed = true;
    if (action && calibration.armed && !calibration.lastAction) {
      calibration.pinches += 1;
      calibration.armed = false;
      if (window.SFX) SFX.tick();
      if (calibration.pinches >= 3) { finishCalibration(); return; }
    }
    calibration.lastAction = action;
    game.actionPressed = false;
  }

  function updateSurvivalTest() {
    const test = game.survivalTest;
    if (!test.complete) {
      const sample = landmarkSample();
      if (sample) test.samples.push(sample);
      if (now() - test.startedAt >= 5) {
        test.report = makeSurvivalReport(test.samples);
        test.complete = true;
        saveSurvivalReport(test.report);
        if (window.SFX) SFX.tick();
      }
      return;
    }
    if (game.actionPressed || handPosition().action) {
      game.actionPressed = false;
      game.pointer.down = false;
      game.screen = test.nextScreen || 'menu';
    }
  }

  function drawHomeButton() {
    GFX.drawBigButton('MENU', 18, 18, 112, 42, false);
  }

  function openPalmVisible() {
    if (!game.handAvailable || typeof HandTracker === 'undefined') return false;
    const hands = HandTracker.lastResults && HandTracker.lastResults.multiHandLandmarks;
    if (!hands || !hands.length) return false;
    return hands.some(function (hand) {
      if (!hand || hand.length < 21 || !hand[0]) return false;
      const wrist = hand[0];
      const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]];
      const extended = fingers.filter(function (pair) {
        const tip = hand[pair[0]];
        const joint = hand[pair[1]];
        if (!tip || !joint) return false;
        const tipDistance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const jointDistance = Math.hypot(joint.x - wrist.x, joint.y - wrist.y);
        return tipDistance > jointDistance * 1.14;
      }).length;
      return extended >= 4;
    });
  }

  function shiftPausedTimers(seconds) {
    if (game.roundState) {
      game.roundState.startedAt += seconds;
      if (game.roundState.frogger) {
        game.roundState.frogger.lastSpawnAt += seconds;
        game.roundState.frogger.jumpingUntil += seconds;
        game.roundState.frogger.crouchingUntil += seconds;
        game.roundState.frogger.flyingUntil += seconds;
      }
      if (game.roundState.fishing) {
        game.roundState.fishing.nextSpawnAt += seconds;
        game.roundState.fishing.biteUntil += seconds;
      }
    }
    if (game.survivalTest && game.survivalTest.startedAt) game.survivalTest.startedAt += seconds;
  }

  function updatePauseGesture() {
    const pause = game.pause;
    const time = now();
    if (game.screen !== 'playing') {
      pause.active = false;
      pause.openedAt = 0;
      pause.latched = false;
      pause.pausedAt = 0;
      return false;
    }
    if (!openPalmVisible()) {
      pause.openedAt = 0;
      pause.latched = false;
      return pause.active;
    }
    if (!pause.openedAt) pause.openedAt = time;
    if (pause.latched || time - pause.openedAt < 2) return pause.active;
    pause.latched = true;
    pause.openedAt = 0;
    game.actionPressed = false;
    game.pointer.down = false;
    if (pause.active) {
      const elapsed = time - pause.pausedAt;
      pause.active = false;
      shiftPausedTimers(elapsed);
    } else {
      pause.active = true;
      pause.pausedAt = time;
    }
    return pause.active;
  }

  function update(delta) {
    const pos = handPosition();
    const tracker = typeof HandTracker !== 'undefined' ? HandTracker : null;
    const pushForward = !!(tracker && tracker.pushForward);
    const homePoint = game.actionPressed ? game.pressPoint : (pushForward || pos.action ? pos : null);
    if (game.screen !== 'menu' && homePoint && homePoint.x <= 0.16 && homePoint.y <= 0.14) {
      returnToMenu();
      return;
    }
    game.homeAction = !!pos.action;
    // Auto-confirm profilu musi działać nawet gdy PlayerProfiles.update() przejmuje sterowanie
    if (game.screen === 'profile' && game.profilePhotoTaken && game.profileAutoConfirmAt > 0 && now() >= game.profileAutoConfirmAt) {
      confirmProfile(); return;
    }
    if (game.screen === 'profile' && game.profilePhotoTaken && (game.actionPressed || game.pointer.down)) {
      confirmProfile(); game.actionPressed = false; game.pointer.down = false; return;
    }
    if (window.PlayerProfiles && PlayerProfiles.update()) {
      game.actionPressed = false;
      return;
    }
    if (updatePauseGesture()) return;
    if (game.textEditor.open) {
      updateVoiceEditor(pos);
      return;
    }
    if (game.screen === 'menu' && (game.actionPressed || pos.action)) {
      const point = game.actionPressed ? game.pressPoint : pos;
      if (point.x > 0.82 && point.y < 0.13) {
        openVoiceEditor();
        game.actionPressed = false;
        game.pointer.down = false;
        return;
      }
    }
    const swipeLeft = !!(tracker && tracker.swipeLeft);
    const swipeRight = !!(tracker && tracker.swipeRight);
    const dismissSwipe = !!(tracker && tracker.dismissSwipe);
    const scrollUp = !!(tracker && tracker.scrollUp);
    const scrollDown = !!(tracker && tracker.scrollDown);
    const raised = !!(tracker && tracker.handRaised);
    const crossed = !!(tracker && tracker.crossedWrists);
    const raisedNow = raised && !game.raisedWasActive;
    const crossedNow = crossed && !game.crossedWasActive;
    game.raisedWasActive = raised;
    game.crossedWasActive = crossed;
    game.activeLayer = game.pauseOverlay ? 'pause' : game.screen === 'playing' ? 'game' : 'menu';
    if (crossedNow || dismissSwipe) { cancelOrNextPlayer(); return; }
    if (game.activeLayer === 'game' && raisedNow) openPauseMenu();
    if (game.pauseOverlay) {
      updatePauseMenu(pos, pushForward);
      return;
    }
    const handVisible = game.handAvailable && typeof HandTracker !== 'undefined' && HandTracker.cursor.visible;
    if (handVisible && !game.lastHandVisible && game.screen === 'playing') sayVoice('powitanie');
    game.lastHandVisible = handVisible;
    if (game.screen === 'playing') {
      if (game.uncertaintyMode && now() - game.lastUncertaintyAt >= 15) {
        sayVoice('niepewnosc');
        game.lastUncertaintyAt = now();
      }
      const moved = game.lastVoiceX !== null && (Math.abs(pos.x - game.lastVoiceX) + Math.abs(pos.y - game.lastVoiceY) > 0.008);
      if (moved || pos.action) {
        game.lastMotionAt = now();
        game.idleVoicePlayed = false;
      } else if (!game.idleVoicePlayed && now() - game.lastMotionAt >= 3) {
        sayVoice('zach\u0119ta');
        game.idleVoicePlayed = true;
      }
      game.lastVoiceX = pos.x;
      game.lastVoiceY = pos.y;
    }
    if (game.screen === 'menu') {
      if (swipeLeft || swipeRight) {
        game.menuFocus = (game.menuFocus + (swipeRight ? 1 : 2)) % 3;
        selectPlayers([1, 2, 4][game.menuFocus]);
      }
      if (game.autoDetect) beginCamera();
      checkReturningPlayer();
      updateMenuPresence(delta);
      updateProfileHover();
      updateProfileHover();
      const handPress = pushForward || (pos.action && !game.menuHandAction);
      if (game.actionPressed || handPress) {
        const point = handPress ? pos : game.pressPoint;
        if (game.menuPresence.overlay && point.y > 0.6 && point.y < 0.86) {
          selectPlayers(game.menuPresence.suggestedPlayers);
          game.menuPresence.overlay = false;
          startMatch();
        } else if (game.menuPresence.overlay) {
          game.actionPressed = false;
          game.menuHandAction = pos.action;
          return;
        } else if (point.y >= 0.94) {
          openGallery();
        } else if (point.y >= 0.84 && point.y < 0.94) {
          game.autoDetect = !game.autoDetect;
          if (game.autoDetect) {
            game.cameraAttempted = false;
            beginCamera();
          } else {
            stopCamera();
          }
        } else if (point.y > 0.55 && point.y < 0.7) {
          if (point.x < 0.4) selectPlayers(1);
          else if (point.x < 0.6) selectPlayers(2);
          else selectPlayers(4);
        } else if (point.y > 0.72) startMatch();
        game.actionPressed = false;
      }
      game.menuHandAction = pos.action;
      return;
    }
    if (game.screen === 'profile') {
      checkReturningPlayer();
      // Auto-confirm po upływie czasu
      if (game.profilePhotoTaken && game.profileAutoConfirmAt > 0 && now() >= game.profileAutoConfirmAt) {
        confirmProfile(); return;
      }
      const handPress = pushForward || (pos.action && !game.profileAction);
      if (game.actionPressed || handPress) {
        if (game.profilePhotoTaken) { confirmProfile(); }
        else { takeProfilePhoto(); }
        game.actionPressed = false;
      }
      game.profileAction = pos.action;
      return;
    }
    if (game.screen === 'gallery') {
      if (swipeLeft || swipeRight || scrollUp || scrollDown) {
        const step = (swipeRight || scrollDown) ? 1 : -1;
        game.gallerySelection = clamp((game.gallerySelection < 0 ? 0 : game.gallerySelection) + step, 0, Math.max(0, game.galleryItems.length - 1));
      }
      const handPress = pushForward || (pos.action && !game.galleryAction);
      if (game.actionPressed || handPress) {
        const point = handPress ? pos : game.pressPoint;
        if (point.y > 0.88) game.screen = 'menu';
        else if (game.gallerySelection >= 0) game.gallerySelection = -1;
        else {
          const column = Math.floor((point.x - 0.04) / 0.24);
          const row = Math.floor((point.y - 0.27) / 0.115);
          const xWithin = (point.x - 0.04) - column * 0.24;
          const yWithin = (point.y - 0.27) - row * 0.115;
          const index = row * 4 + column;
          if (column >= 0 && column < 4 && row >= 0 && row < 5 && xWithin <= 0.20 && yWithin <= 0.10 && index < game.galleryItems.length) game.gallerySelection = index;
        }
        game.actionPressed = false;
      }
      game.galleryAction = pos.action;
      return;
    }
    if (game.screen === 'calibration') { updateCalibration(pos); return; }
    if (game.screen === 'survivalTest') { updateSurvivalTest(); return; }
    if (game.screen === 'gameSelect') {
      if (swipeLeft || swipeRight) game.roundFocus = clamp(game.roundFocus + (swipeRight ? 1 : -1), 0, Rounds.count(game.apiaryId) - 1);
      const handPress = pushForward || (pos.action && !game.gameSelectAction);
      if (game.actionPressed || handPress) {
        const point = handPress ? pos : game.pressPoint;
        startSelectedRound(pushForward ? game.roundFocus : gameTileAt(point));
        game.actionPressed = false;
      }
      game.gameSelectAction = pos.action;
      return;
    }
    if (game.screen === 'apiarySelect') {
      const handPress = pushForward || (pos.action && !game.apiaryHandAction);
      if (game.actionPressed || handPress) {
        const point = handPress ? pos : game.pressPoint;
        if (point.y > 0.35 && point.y < 0.72) startMatch(point.x < 0.5 ? 'siedlanowo' : 'paslek');
        game.actionPressed = false;
      }
      game.apiaryHandAction = pos.action;
      return;
    }
    if (game.screen === 'roundIntro') {
      if (!pos.action) game.introArmed = true;
      if (game.introArmed && (game.actionPressed || pushForward || pos.action)) beginPlaying();
      return;
    }
    if (game.screen === 'playing') {
      game.timeLeft = Math.max(0, game.round.duration - (now() - game.roundState.startedAt));
      if (game.timeLeft <= 0) { finishRound(game.roundState.progress >= 1); return; }
      if (game.round.type === 'chronicles') { updateChronicles(pos, pushForward, swipeLeft, swipeRight); return; }
      const action = pos.action || game.actionPressed || pushForward;
      if (game.round.type === 'collect') updateCollect(pos, action);
      if (game.round.type === 'drag') updateDrag(pos, action, delta);
      if (game.round.type === 'spin') updateSpin(pos, delta);
      if (game.round.type === 'gun') updateFlyingDucks(pos, action, delta);
      if (game.round.type === 'frogger') updateFrogger(delta);
      if (game.round.type === 'boars') updateBoars(pos, action, delta);
      if (game.round.type === 'fishing') updateFishing(pos, delta);
      if (game.round.type === 'placeholder') {
        game.roundState.progress = 1;
        if (game.timeLeft < game.round.duration - 1.5 || action) finishRound(true);
      }
      game.actionPressed = false;
      return;
    }
    if (game.screen === 'roundResult' && (game.actionPressed || pushForward || pos.action)) { nextTurn(); return; }
    if (game.screen === 'partyReport') {
      const handPress = pushForward || (pos.action && !game.partyReportAction);
      if (game.actionPressed || handPress) {
        const point = handPress ? pos : game.pressPoint;
        if (point.x > 0.5 - 190 / GFX.W && point.x < 0.5 + 190 / GFX.W &&
            point.y > 0.81 && point.y < 0.81 + 66 / GFX.H) downloadPartyReport();
        game.actionPressed = false;
      }
      game.partyReportAction = pos.action;
      return;
    }
    if (game.screen === 'gameOver' && (game.actionPressed || pushForward || pos.action)) {
      const point = game.actionPressed ? game.pressPoint : pos;
      game.actionPressed = false;
      if (point.y > 0.75 && point.y < 0.83 && point.x > 0.25 && point.x < 0.75) {
        const titles = game.comments && game.comments.titles || {};
        const ranking = game.playerScores.map(function (score, index) {
          return { score: score, player: index, rounds: game.roundScores[index] || [] };
        }).sort(function (a, b) { return b.score - a.score; });
        const awards = [
          { round: 1, key: 'best_frame' },
          { round: 2, key: 'best_crank' },
          { round: 3, key: 'best_ducks' }
        ];
        awards.forEach(function (award) {
          const leader = ranking.slice().sort(function (a, b) { return (b.rounds[award.round] || 0) - (a.rounds[award.round] || 0); })[0];
          if (leader) leader.awards = (leader.awards || []).concat(titles[award.key] || '');
        });
        if (!window.PhotoCollage || typeof PhotoCollage.begin !== 'function') {
          returnToMenu();
          return;
        }
        PhotoCollage.begin(ranking.map(function (entry, rank) {
          const earned = (entry.awards || []).filter(Boolean);
          if (rank === 0) earned.unshift(titles.best_overall || 'Mistrz Pasieki');
          if (rank === ranking.length - 1 && ranking.length > 1) earned.push(titles.worst_overall || '');
          return { name: playerName(entry.player), score: entry.score, title: earned.filter(Boolean).join(', ') };
        }));
        game.screen = 'photoCollage';
      } else if (point.y >= 0.83) {
        game.apiaryHandAction = false;
        game.screen = 'apiarySelect';
      }
    }
    if (game.screen === 'photoCollage' && (game.actionPressed || pushForward || pos.action)) {
      const point = game.actionPressed ? game.pressPoint : pos;
      game.actionPressed = false;
      if (point.y > 0.78 && PhotoCollage.draw(canvas, video, GFX)) PhotoCollage.download();
    }
  }

  function header(title, subtitle) {
    GFX.drawTitle(title, GFX.H * 0.12, Math.min(64, GFX.W * 0.045));
    if (subtitle) GFX.drawSubtitle(subtitle, GFX.H * 0.2, Math.min(26, GFX.W * 0.022));
  }

  function drawMenu() {
    GFX.drawMeadowBg();
    GFX.drawAmbientBees();
    drawProfileCards();
    GFX.drawTitle('PASIEKA PARTY', GFX.H * 0.2, Math.min(72, GFX.W * 0.05));
    if (game.menuPresence.message && game.menuPresence.messageUntil > now()) {
      GFX.drawSubtitle(game.menuPresence.message, GFX.H * 0.34, Math.min(24, GFX.W * 0.019), '#FFD700');
    }
    GFX.drawSubtitle('GRACZY', GFX.H * 0.5, 24, '#FFF5DC');
    [1, 2, 4].forEach(function (count, index) {
      const x = GFX.W * 0.5 - 270 + index * 190;
      GFX.drawBigButton(String(count), x, GFX.H * 0.56, 170, 62, game.playerCount === count);
    });
    GFX.drawBigButton(game.menuPresence.twoHandsReady ? 'START — 2 GRACZY' : 'START', GFX.W * 0.5 - 190, GFX.H * 0.76, 380, 76, true);
    GFX.drawBigButton('AUTO-DETECT: ' + (game.autoDetect ? 'ON' : 'OFF'), GFX.W * 0.5 - 150, GFX.H * 0.87, 300, 54, game.autoDetect);
  }

  function drawAutoStartOverlay() {
    if (!game.menuPresence.overlay) return;
    const ctx = GFX.ctx;
    ctx.fillStyle = 'rgba(26, 10, 0, 0.86)';
    ctx.fillRect(0, 0, GFX.W, GFX.H);
    GFX.drawTitle('HEJ! CHCESZ ZAGRAĆ?', GFX.H * 0.29, Math.min(58, GFX.W * 0.042), '#FFD700');
    GFX.drawSubtitle('Osób: ' + game.menuPresence.count + ' · graczy: ' + game.menuPresence.suggestedPlayers, GFX.H * 0.46, 24, '#FFF5DC');
    GFX.drawBigButton('START', GFX.W * 0.5 - 170, GFX.H * 0.62, 340, 78, true);
  }

  function drawGameSelect() {
    GFX.drawMeadowBg();
    header('WYBIERZ RUNDĘ', game.apiary ? game.apiary.name + ' · Gracz ' + (game.playerIndex + 1) : 'Uszczypnij kafelek');
    const count = Rounds.count(game.apiaryId);
    for (let index = 0; index < count; index += 1) {
      const round = Rounds.get(index, game.apiaryId);
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = GFX.W * (0.08 + column * 0.47);
      const y = GFX.H * (0.29 + row * 0.145);
      const completed = game.completedRounds.indexOf(index) >= 0;
      GFX.drawBigButton((completed ? '✓ ' : '') + (index + 1) + '. ' + round.title, x, y, GFX.W * 0.38, GFX.H * 0.105, !completed);
    }
    GFX.drawSubtitle('Pinch na kafelku wybiera rundę · ukończone rundy są oznaczone ✓', GFX.H * 0.91, 17, '#FFF5DC');
  }

  function drawProfile() {
    GFX.drawMeadowBg();
    const ctx = GFX.ctx;

    if (!game.profilePhotoTaken) {
      // ===== EKRAN KAMERY =====
      header('GRACZ ' + (game.profileIndex + 1) + ' — ZDJĘCIE', 'Stań przed kamerą i kliknij lub naciśnij spację.');
      const pW = Math.min(GFX.W * 0.72, GFX.H * 1.2);
      const pH = pW * 0.56;
      const pX = (GFX.W - pW) / 2, pY = GFX.H * 0.24;
      ctx.fillStyle = '#1a3010';
      ctx.fillRect(pX, pY, pW, pH);
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.translate(pX + pW, pY);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, pW, pH);
        ctx.restore();
      } else {
        GFX.drawSubtitle('Czekam na kamerę…', pY + pH / 2, 20, '#FFD78A');
      }
      ctx.strokeStyle = '#FFD78A'; ctx.lineWidth = 4;
      ctx.strokeRect(pX, pY, pW, pH);
      if (game.welcome) GFX.drawSubtitle(game.welcome, GFX.H * 0.2, 22, '#FFD700');
      const btnH2 = Math.round(GFX.H * 0.12);
      GFX.drawBigButton('ZRÓB ZDJĘCIE', GFX.W * 0.15, GFX.H - btnH2 - GFX.H * 0.03, GFX.W * 0.7, btnH2, true);
    } else {
      // ===== EKRAN POTWIERDZENIA =====
      const timeLeft = Math.max(0, game.profileAutoConfirmAt - now());
      header('GRACZ ' + (game.profileIndex + 1) + ' — ' + game.profileName.toUpperCase(),
        'Kliknij aby kontynuować. Automatycznie za ' + Math.ceil(timeLeft) + 's…');
      // Mniejsze zdjęcie — max 52% wysokości ekranu, żeby pasek i przycisk były widoczne
      const pW = Math.min(GFX.W * 0.58, GFX.H * 0.8);
      const pH = Math.min(pW * 0.75, GFX.H * 0.52);
      const pX = (GFX.W - pW) / 2, pY = GFX.H * 0.2;
      ctx.fillStyle = '#1a3010';
      ctx.fillRect(pX, pY, pW, pH);
      if (game.profileImage && game.profileImage.complete && game.profileImage.naturalWidth) {
        ctx.drawImage(game.profileImage, pX, pY, pW, pH);
      }
      // Kolorowa etykieta z imieniem na dole zdjęcia
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(pX, pY + pH - 48, pW, 48);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold ' + Math.min(32, Math.round(pW * 0.08)) + 'px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(game.profileName, pX + pW / 2, pY + pH - 12);
      ctx.strokeStyle = '#FFD78A'; ctx.lineWidth = 4;
      ctx.strokeRect(pX, pY, pW, pH);
      // Pasek odliczania
      const barW = Math.min(GFX.W * 0.65, 460);
      const barX = (GFX.W - barW) / 2;
      const barY = pY + pH + 12;
      ctx.fillStyle = 'rgba(255,215,0,0.2)';
      ctx.fillRect(barX, barY, barW, 12);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(barX, barY, barW * (timeLeft / 2.2), 12);
      // Przycisk DALEJ
      const btnH = Math.round(GFX.H * 0.1);
      GFX.drawBigButton('DALEJ ▶', GFX.W * 0.25, barY + 20, GFX.W * 0.5, btnH, true);
    }
  }

  function drawGallery() {
    GFX.drawMeadowBg();
    header('GALERIA', 'Ostatnie 20 rozgrywek');
    const ctx = GFX.ctx;
    if (game.gallerySelection >= 0) {
      const image = game.galleryImages[game.gallerySelection];
      if (image && image.complete && image.naturalWidth) {
        const width = Math.min(GFX.W * 0.82, GFX.H * 1.4);
        const height = width * 0.5625;
        ctx.drawImage(image, (GFX.W - width) / 2, GFX.H * 0.27, width, height);
      }
      GFX.drawSubtitle('Kliknij zdjęcie, aby wrócić do miniatur.', GFX.H * 0.83, 18);
    } else if (!game.galleryItems.length) {
      GFX.drawSubtitle('Zagraj mecz, aby dodać pierwsze zdjęcie.', GFX.H * 0.5, 26);
    } else {
      game.galleryItems.forEach(function (item, index) {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = GFX.W * (0.04 + column * 0.24);
        const y = GFX.H * (0.27 + row * 0.115);
        const width = GFX.W * 0.20;
        const height = GFX.H * 0.10;
        ctx.fillStyle = '#2D5016';
        ctx.fillRect(x, y, width, height);
        const image = game.galleryImages[index];
        if (image && image.complete && image.naturalWidth) ctx.drawImage(image, x, y, width, height);
        ctx.strokeStyle = '#FFD78A';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
      });
    }
    GFX.drawBigButton('WRÓĆ DO MENU', GFX.W * 0.5 - 160, GFX.H * 0.9, 320, 54, true);
  }

  function drawCalibration() {
    GFX.clear('#1a0a00');
    header('KALIBRACJA KAMERY', 'Pokaż dłoń i wykonaj trzy spokojne pinche.');
    const width = Math.min(320, GFX.W * 0.42, GFX.H * 0.55);
    const height = width * 0.75;
    const x = GFX.W - width - 24;
    const y = GFX.H * 0.29;
    const ctx = GFX.ctx;
    const results = game.handAvailable && typeof HandTracker !== 'undefined' ? HandTracker.lastResults : null;
    const hand = results && results.multiHandLandmarks && results.multiHandLandmarks[0];
    const visiblePoints = hand ? hand.filter(function (point) {
      return Number.isFinite(point.x) && Number.isFinite(point.y) &&
        point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
    }).length : 0;
    let message = 'Pokaż całą dłoń w kadrze';
    let color = '#FFD78A';
    if (hand && visiblePoints >= 15 && hand[0] && hand[12]) {
      const size = Math.hypot(hand[12].x - hand[0].x, hand[12].y - hand[0].y);
      if (size < 0.15) { message = 'Podejdź bliżej'; color = '#E74C3C'; }
      else if (size > 0.35) { message = 'Oddaj się'; color = '#F1C40F'; }
      else { message = 'Idealna odległość!'; color = '#55D66B'; }
    }
    ctx.fillStyle = '#2D5016';
    ctx.fillRect(x, y, width, height);
    if (video && video.readyState >= 2) {
      ctx.save();
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + width * 0.25, y + height * 0.08, width * 0.5, height * 0.84);
    ctx.font = 'bold ' + Math.max(14, Math.min(22, width * 0.065)) + 'px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(message, x + width / 2, y + height + 30);
    ctx.font = '16px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = '#FFF5DC';
    ctx.fillText('Punkty dłoni: ' + visiblePoints + ' / 21', x + width / 2, y + height + 54);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(GFX.W * 0.5 - 100 + i * 100, GFX.H * 0.72, 22, 0, Math.PI * 2);
      ctx.strokeStyle = i < game.calibration.pinches ? '#FFD700' : 'rgba(255,255,255,0.35)';
      ctx.stroke();
      if (i < game.calibration.pinches) { ctx.fillStyle = '#FFD700'; ctx.fill(); }
    }
    GFX.drawSubtitle('PINCHE: ' + game.calibration.pinches + ' / 3', GFX.H * 0.83, 28, '#FFF5DC');
    if (!game.handAvailable) GFX.drawSubtitle(game.cameraMessage || 'Jeśli kamera nie działa, klikaj myszą.', GFX.H * 0.9, 18, '#FFD78A');
  }

  function drawSurvivalTest() {
    const test = game.survivalTest;
    const elapsed = clamp(now() - test.startedAt, 0, 5);
    GFX.clear('#173F4A');
    GFX.drawTitle('TEST PRZEŻYWALNOŚCI', GFX.H * 0.13, Math.min(54, GFX.W * 0.04), '#FFD700');
    GFX.drawSubtitle('MÓZG ELEKTRONOWY ANALIZUJE STABILNOŚĆ DŁONI', GFX.H * 0.2, 19, '#FFF5DC');
    const ctx = GFX.ctx;
    const width = Math.min(GFX.W * 0.72, 680);
    const x = (GFX.W - width) / 2;
    if (!test.complete) {
      ctx.fillStyle = 'rgba(26,10,0,0.72)';
      ctx.fillRect(x, GFX.H * 0.38, width, 82);
      ctx.fillStyle = '#294E5A';
      ctx.fillRect(x + 8, GFX.H * 0.38 + 42, width - 16, 20);
      ctx.fillStyle = '#46FBD5';
      ctx.fillRect(x + 8, GFX.H * 0.38 + 42, (width - 16) * elapsed / 5, 20);
      GFX.drawSubtitle('Trzymaj dłoń spokojnie… ' + Math.ceil(Math.max(0, 5 - elapsed)) + ' s', GFX.H * 0.43, 25, '#FFF5DC');
      GFX.drawSubtitle('Badamy punkty dłoni z kamery.', GFX.H * 0.59, 18, '#FFD78A');
      return;
    }
    const report = test.report;
    ctx.fillStyle = 'rgba(26,10,0,0.78)';
    ctx.fillRect(x, GFX.H * 0.27, width, GFX.H * 0.5);
    GFX.drawSubtitle('Odchylenie dłoni: ' + report.jitter.toFixed(4) + ' · próbek: ' + report.sampleCount, GFX.H * 0.33, 18, '#46FBD5');
    report.chances.forEach(function (entry, index) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const tx = GFX.W * (column ? 0.65 : 0.35);
      const ty = GFX.H * (0.41 + row * 0.095);
      ctx.fillStyle = entry.chance < 35 ? '#FF876D' : entry.chance < 65 ? '#FFD78A' : '#71E58A';
      ctx.font = 'bold ' + Math.min(24, GFX.W * 0.021) + 'px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(entry.title + ': ' + entry.chance + '%', tx, ty);
    });
    ctx.fillStyle = '#FFF5DC';
    ctx.font = Math.min(18, GFX.W * 0.017) + 'px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    const words = report.comment.split(' ');
    const lines = [''];
    words.forEach(function (word) {
      const candidate = (lines[lines.length - 1] + ' ' + word).trim();
      if (ctx.measureText(candidate).width > width - 48 && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = candidate;
    });
    lines.slice(0, 3).forEach(function (line, index) { ctx.fillText(line, GFX.W * 0.5, GFX.H * (0.66 + index * 0.045)); });
    GFX.drawSubtitle('Uszczypnij lub kliknij, aby przejść do menu.', GFX.H * 0.84, 18, '#FFD700');
  }

  function drawIntro() {
    GFX.drawMeadowBg();
    GFX.drawTitle(game.round.title, GFX.H * 0.2, Math.min(64, GFX.W * 0.045));
    GFX.drawBigButton('START', GFX.W * 0.5 - 150, GFX.H * 0.72, 300, 70, true);
  }

  function drawFishing(state) {
    const ctx = GFX.ctx;
    const fishing = state.fishing;
    const area = game.round.rule.fishSpawnArea;
    GFX.clear('#68B9D5');
    ctx.fillStyle = '#2879A6'; ctx.fillRect(0, GFX.H * 0.64, GFX.W, GFX.H * 0.36);
    ctx.fillStyle = '#D9C46A'; ctx.fillRect(0, GFX.H * 0.59, GFX.W, GFX.H * 0.06);
    fishing.fish.forEach(function (fish) {
      const x = fish.x * GFX.W;
      const y = clamp(fish.y * GFX.H + Math.sin(fish.phase) * 5, area.yMin * GFX.H, area.yMax * GFX.H);
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = fish.biting ? '#FFD700' : '#F27F55';
      ctx.beginPath(); ctx.ellipse(0, 0, fish.size, fish.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-fish.size, 0); ctx.lineTo(-fish.size * 1.6, -fish.size * 0.55); ctx.lineTo(-fish.size * 1.6, fish.size * 0.55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1A1008'; ctx.beginPath(); ctx.arc(fish.size * 0.45, -fish.size * 0.16, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (fish.biting) {
        ctx.strokeStyle = '#FFF5DC'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - fish.size); ctx.lineTo(x, GFX.H * 0.22); ctx.stroke();
      }
    });
    const message = fishing.activeFish ? 'RYBA BIERZE! Szybko kręć małe koła nadgarstkiem.' : 'Zarzucaj: wykonaj szybki ruch ręką góra–dół.';
    GFX.drawSubtitle(message, GFX.H * 0.86, 20, fishing.activeFish ? '#FFD700' : '#FFF5DC');
  }

  function drawFrogger(state) {
    const ctx = GFX.ctx;
    const frogger = state.frogger;
    const time = now();
    GFX.clear('#6AC3E8');
    ctx.fillStyle = '#3E8F48'; ctx.fillRect(0, GFX.H * 0.72, GFX.W, GFX.H * 0.28);
    ctx.fillStyle = '#555047'; ctx.fillRect(0, GFX.H * 0.38, GFX.W, GFX.H * 0.34);
    ctx.strokeStyle = '#F8E16C'; ctx.lineWidth = 5; ctx.setLineDash([28, 24]);
    ctx.beginPath(); ctx.moveTo(0, GFX.H * 0.55); ctx.lineTo(GFX.W, GFX.H * 0.55); ctx.stroke(); ctx.setLineDash([]);
    frogger.obstacles.forEach(function (obstacle) {
      if (obstacle.resolved) return;
      const x = obstacle.x * GFX.W;
      if (obstacle.kind === 'water') {
        ctx.fillStyle = '#2379AD'; ctx.fillRect(x - 38, GFX.H * 0.43, 76, GFX.H * 0.23);
        ctx.fillStyle = '#DCEFFF'; ctx.font = 'bold 19px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('WODA', x, GFX.H * 0.57);
      } else if (obstacle.kind === 'jump') {
        ctx.fillStyle = '#D77A31'; ctx.fillRect(x - 24, GFX.H * 0.62, 48, 34);
      } else {
        ctx.fillStyle = '#B93535'; ctx.fillRect(x - 32, GFX.H * 0.42, 64, 18);
        ctx.fillRect(x - 4, GFX.H * 0.42, 8, GFX.H * 0.2);
      }
    });
    const jumping = time < frogger.jumpingUntil;
    const crouching = time < frogger.crouchingUntil;
    const flying = time < frogger.flyingUntil;
    const frogX = GFX.W * 0.2;
    const frogY = flying ? GFX.H * 0.31 : jumping ? GFX.H * 0.44 : crouching ? GFX.H * 0.66 : GFX.H * 0.6;
    ctx.fillStyle = '#69CE56';
    ctx.beginPath(); ctx.ellipse(frogX, frogY, 28, crouching ? 14 : 23, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF5DC'; ctx.beginPath(); ctx.arc(frogX - 10, frogY - 15, 7, 0, Math.PI * 2); ctx.arc(frogX + 10, frogY - 15, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1A1008'; ctx.beginPath(); ctx.arc(frogX - 10, frogY - 15, 2.5, 0, Math.PI * 2); ctx.arc(frogX + 10, frogY - 15, 2.5, 0, Math.PI * 2); ctx.fill();
    GFX.drawSubtitle(flying ? 'LOT!' : jumping ? 'SKOK!' : crouching ? 'KUCNIĘCIE!' : 'Gotów na przeszkodę', GFX.H * 0.86, 22, '#FFF5DC');
  }

  function drawBoars(boars) {
    const ctx = GFX.ctx;
    boars.forEach(function (boar) {
      if (!boar.alive) return;
      const x = boar.x * GFX.W;
      const y = boar.y * GFX.H;
      const size = boar.size;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(boar.direction, 1);
      ctx.fillStyle = '#4B2D22';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.78, size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#633A2B';
      ctx.beginPath();
      ctx.arc(size * 0.62, -size * 0.16, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8C5A43';
      ctx.beginPath();
      ctx.ellipse(size * 0.86, -size * 0.08, size * 0.2, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#17100D';
      ctx.beginPath();
      ctx.arc(size * 0.76, -size * 0.22, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D39B70';
      ctx.beginPath();
      ctx.moveTo(size * 0.46, -size * 0.42); ctx.lineTo(size * 0.62, -size * 0.7); ctx.lineTo(size * 0.72, -size * 0.36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2A1712';
      ctx.fillRect(-size * 0.45, size * 0.25, size * 0.13, size * 0.32);
      ctx.fillRect(size * 0.22, size * 0.25, size * 0.13, size * 0.32);
      ctx.restore();
    });
  }

  function drawChronicles(state) {
    const ctx = GFX.ctx;
    const quiz = state.chronicles;
    GFX.drawMeadowBg();
    GFX.drawTitle('KRONIKI MARCINA', GFX.H * 0.13, Math.min(56, GFX.W * 0.045));
    if (!quiz.questions.length) {
      GFX.drawSubtitle(game.chroniclesSlides === null ? 'Ładowanie kronik…' : 'Nie udało się wczytać kronik. Wróć do menu.', GFX.H * 0.48, 25, '#FFF5DC');
      return;
    }
    const question = quiz.questions[quiz.index];
    GFX.drawSubtitle('Pytanie ' + (quiz.index + 1) + ' / ' + quiz.questions.length + '   •   Trafienia: ' + quiz.hits, GFX.H * 0.22, 23, '#FFD700');
    GFX.drawSubtitle((question.chapter ? question.chapter + ' · ' : '') + 'SWIPE ←/→: WYBIERZ ROK', GFX.H * 0.255, 17, '#FFD78A');
    ctx.save();
    ctx.fillStyle = 'rgba(26,10,0,0.83)';
    ctx.fillRect(GFX.W * 0.1, GFX.H * 0.27, GFX.W * 0.8, GFX.H * 0.23);
    ctx.fillStyle = '#FFF5DC';
    ctx.font = 'bold ' + Math.min(30, GFX.W * 0.027) + 'px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = question.text.replace(/\s+/g, ' ').split(' ');
    const lines = [''];
    words.forEach(function (word) {
      const line = lines[lines.length - 1];
      const next = (line + ' ' + word).trim();
      if (line && ctx.measureText(next).width > GFX.W * 0.72) lines.push(word);
      else lines[lines.length - 1] = next;
    });
    lines.slice(0, 4).forEach(function (line, index) {
      ctx.fillText(line, GFX.W * 0.5, GFX.H * (0.35 + index * 0.044), GFX.W * 0.72);
    });
    ctx.restore();
    question.options.forEach(function (option, index) {
      const width = GFX.W * 0.24;
      const x = GFX.W * (0.12 + index * 0.27);
      GFX.drawBigButton(String(option), x, GFX.H * 0.6, width, 70, index === quiz.choice);
    });
    GFX.drawSubtitle(quiz.feedback || 'SWIPE ←/→: wybierz rok   •   wypchnij dłoń: zatwierdź', GFX.H * 0.78, 20, '#FFF5DC');
    const clock = game.pauseOverlay && state.pausedAt ? state.pausedAt : now();
    GFX.drawSubtitle('Czas: ' + Math.ceil(Math.max(0, quiz.deadline - clock)) + ' s', GFX.H * 0.85, 27, '#FFD700');
  }

  function drawPlaying() {
    const round = game.round;
    const state = game.roundState;
    if (round.type === 'chronicles') { drawChronicles(state); return; }
    if (round.type === 'collect') {
      GFX.drawMeadowBg();
      state.targets.forEach(function (target) { if (target.alive) GFX.drawBee(target.x * GFX.W, target.y * GFX.H, target.size, target.phase); });
    }
    if (round.type === 'drag') {
      GFX.drawMeadowBg();
      GFX.drawBeehive(GFX.W * 0.5, GFX.H * 0.82, Math.min(1.4, GFX.W / 1200));
      GFX.drawHoneyFrame(GFX.W * 0.5, GFX.H * 0.52, Math.min(260, GFX.W * 0.23), Math.min(390, GFX.H * 0.42), state.progress);
    }
    if (round.type === 'spin') {
      GFX.drawMeadowBg();
      GFX.drawSpinner(GFX.W * 0.5, GFX.H * 0.55, Math.min(150, GFX.H * 0.18), state.progress * Math.PI * 8, (1 - state.progress) * 3);
    }
    if (round.type === 'gun') {
      GFX.clear('#5A9BC2');
      const ctx = GFX.ctx;
      ctx.fillStyle = '#B7E4F9'; ctx.fillRect(0, 0, GFX.W, GFX.H);
      ctx.fillStyle = '#7BCB83'; ctx.fillRect(0, GFX.H * 0.82, GFX.W, GFX.H * 0.18);
      state.ducks.forEach(function (duck) { if (duck.alive) GFX.drawDuck(duck.x * GFX.W, duck.y * GFX.H, duck.size, true, duck.direction); });
    }
    if (round.type === 'frogger') drawFrogger(state);
    if (round.type === 'boars') {
      GFX.drawMeadowBg();
      drawBoars(state.boars);
    }
    if (round.type === 'fishing') drawFishing(state);
    if (round.type === 'frogger') drawFrogger(state);
    if (round.type === 'placeholder') {
      GFX.clear('#1a0a00');
      GFX.drawMeadowBg();
    }
    const pos = handPosition();
    if (pos.visible) GFX.drawCrosshair(pos.x * GFX.W, pos.y * GFX.H, pos.action, 26);
    GFX.drawTitle(round.title, GFX.H * 0.12, Math.min(58, GFX.W * 0.04));
    GFX.drawTimer(game.timeLeft, round.duration, GFX.W - 90, 60);
    GFX.drawScore(game.playerScores[game.playerIndex] + Math.round(round.points * state.progress), '', 120, 70);
  }

  function drawPauseOverlay() {
    const ctx = GFX.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(26, 10, 0, 0.82)';
    ctx.fillRect(0, 0, GFX.W, GFX.H);
    GFX.drawTitle('PAUZA', GFX.H * 0.28, Math.min(64, GFX.W * 0.05), '#FFD700');
    GFX.drawBigButton('WRÓĆ DO MENU', GFX.W * 0.08, GFX.H * 0.54, GFX.W * 0.38, 76, false);
    GFX.drawBigButton('KONTYNUUJ', GFX.W * 0.54, GFX.H * 0.54, GFX.W * 0.38, 76, true);
    ctx.restore();
  }

  function drawResult() {
    GFX.drawMeadowBg();
    GFX.drawTitle(game.round.title, GFX.H * 0.2, Math.min(64, GFX.W * 0.045));
    GFX.drawBee(GFX.W * 0.5, GFX.H * 0.4, 42, performance.now() * 0.005);
    GFX.drawSubtitle('+' + game.lastScore, GFX.H * 0.55, 52, '#FFD700');
    const next = game.playerIndex + 1 < game.playerCount ? 'NASTĘPNY GRACZ' : (game.completedRounds.length + 1 >= Rounds.count(game.apiaryId) ? 'WYNIK' : 'WYBIERZ RUNDĘ');
    GFX.drawBigButton(next, GFX.W * 0.5 - 190, GFX.H * 0.72, 380, 70, true);
  }

  function drawPartyReport() {
    const report = game.partyReport || buildPartyReport();
    game.partyReport = report;
    GFX.drawMeadowBg();
    header('KONIEC IMPREZY', report.apiary);
    const fontSize = Math.min(24, GFX.W * 0.019);
    report.ranking.forEach(function (entry, index) {
      const y = GFX.H * (0.29 + index * 0.065);
      GFX.drawSubtitle((index + 1) + '. ' + entry.name + ' — ' + entry.score + ' pkt — ' + entry.title, y, fontSize, index === 0 ? '#FFD700' : '#FFF5DC');
    });
    (report.funFacts || []).forEach(function (fact, index) {
      GFX.drawSubtitle(fact, GFX.H * (0.57 + index * 0.055), Math.min(21, GFX.W * 0.018), '#FFD78A');
    });
    GFX.drawBigButton('POBIERZ RAPORT', GFX.W * 0.5 - 190, GFX.H * 0.81, 380, 66, true);
  }

  function drawGameOver() {
    GFX.drawMeadowBg();
    const ranking = game.playerScores.map(function (score, index) {
      return { score: score, player: index, rounds: game.roundScores[index] || [] };
    }).sort(function (a, b) { return b.score - a.score; });
    const winner = ranking[0];
    const titles = game.comments && game.comments.titles;
    header('PASIECZNY MISTRZ!', winner ? (titles && titles.best_overall || 'Król Pasieki') + ' — Gracz ' + (winner.player + 1) : 'Wszystkie rundy ukończone');
    ranking.forEach(function (entry, rank) {
      const title = rank === 0 && titles ? titles.best_overall : '';
      const line = (rank + 1) + '. ' + playerName(entry.player) + ': ' + entry.score + (title ? ' — ' + title : '');
      GFX.drawSubtitle(line, GFX.H * (0.34 + rank * 0.065), 24, rank === 0 ? '#FFD700' : '#FFF5DC');
    });
    const topFrame = ranking.slice().sort(function (a, b) { return (b.rounds[1] || 0) - (a.rounds[1] || 0); })[0];
    const topSpin = ranking.slice().sort(function (a, b) { return (b.rounds[2] || 0) - (a.rounds[2] || 0); })[0];
    const topDucks = ranking.slice().sort(function (a, b) { return (b.rounds[3] || 0) - (a.rounds[3] || 0); })[0];
    if (topFrame) GFX.drawSubtitle('Mistrz Ramki: Gracz ' + (topFrame.player + 1), GFX.H * 0.64, 16, '#FFF5DC');
    if (topSpin) GFX.drawSubtitle('Król Wirówki: Gracz ' + (topSpin.player + 1), GFX.H * 0.685, 16, '#FFF5DC');
    if (topDucks) GFX.drawSubtitle('Postrach Kaczek: Gracz ' + (topDucks.player + 1), GFX.H * 0.73, 16, '#FFF5DC');
    GFX.drawBigButton('ZRÓB ZDJĘCIE DRUŻYNY!', GFX.W * 0.5 - 250, GFX.H * 0.76, 500, 60, true);
    GFX.drawBigButton('WYBIERZ PASIEKĘ', GFX.W * 0.5 - 210, GFX.H * 0.86, 420, 58, false);
  }

  function drawApiarySelect() {
    GFX.drawMeadowBg();
    GFX.drawTitle('KTÓRA PASIEKA?', GFX.H * 0.2, Math.min(64, GFX.W * 0.045));
    const siedlanowo = Rounds.getApiary('siedlanowo');
    const paslek = Rounds.getApiary('paslek');
    const buttonWidth = GFX.W * 0.35;
    GFX.drawBigButton(siedlanowo.name, GFX.W * 0.1, GFX.H * 0.46, buttonWidth, 82, true);
    GFX.drawBigButton(paslek.name, GFX.W * 0.55, GFX.H * 0.46, buttonWidth, 82, false);
  }

  function drawCursorOverlay() {
    const pos = handPosition();
    if (pos.visible) GFX.drawCrosshair(pos.x * GFX.W, pos.y * GFX.H, pos.action || game.pointer.down, 30);
  }

  function drawMiniCamera() {
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    const ctx = GFX.ctx;
    const width = Math.min(200, Math.max(1, GFX.W - 32));
    const height = Math.min(150, Math.max(1, GFX.H - 32), width * 0.75);
    const x = 16;
    const y = GFX.H - height - 16;
    ctx.save();
    ctx.save();
    ctx.fillStyle = 'rgba(26,10,0,0.85)';
    ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    const results = typeof HandTracker !== 'undefined' && HandTracker.lastResults;
    const hands = results && results.multiHandLandmarks || [];
    const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]];
    hands.forEach(function (hand) {
      ctx.save();
      ctx.strokeStyle = '#46FBD5';
      ctx.lineWidth = 2;
      links.forEach(function (pair) {
        const a = hand[pair[0]];
        const b = hand[pair[1]];
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(x + (1 - a.x) * width, y + a.y * height);
        ctx.lineTo(x + (1 - b.x) * width, y + b.y * height);
        ctx.stroke();
      });
      ctx.fillStyle = '#FFD700';
      hand.forEach(function (point) {
        if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
        ctx.beginPath();
        ctx.arc(x + (1 - point.x) * width, y + point.y * height, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
    ctx.strokeStyle = '#FFD78A';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  function drawCancelHint() {
    const ctx = GFX.ctx;
    const x = GFX.W - 40;
    const y = GFX.H - 36;
    ctx.save();
    ctx.fillStyle = 'rgba(26,10,0,0.72)';
    ctx.fillRect(x - 28, y - 28, 56, 56);
    ctx.strokeStyle = '#FFF5DC';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 13); ctx.lineTo(x + 13, y + 13);
    ctx.moveTo(x + 13, y - 13); ctx.lineTo(x - 13, y + 13);
    ctx.stroke();
    ctx.restore();
  }

  function drawScene() {
    if (window.PlayerProfiles) PlayerProfiles.drawMenuButton(game.screen === 'menu');
    if (game.screen === 'menu') {
      drawMenu();
      if (game.welcome) GFX.drawSubtitle(game.welcome, GFX.H * 0.28, 22, '#FFD700');
      if (!game.menuPresence.overlay) GFX.drawBigButton('GALERIA', GFX.W * 0.5 - 150, GFX.H * 0.95, 300, 42, false);
      drawAutoStartOverlay();
      drawCursorOverlay();
    }
    if (game.screen === 'gameSelect') { drawGameSelect(); drawCursorOverlay(); }
    if (game.screen === 'profile') { drawProfile(); drawCursorOverlay(); }
    if (game.screen === 'gallery') { drawGallery(); drawCursorOverlay(); }
    if (game.screen === 'calibration') { drawCalibration(); drawCursorOverlay(); }
    if (game.screen === 'survivalTest') { drawSurvivalTest(); drawCursorOverlay(); }
    if (game.screen === 'apiarySelect') { drawApiarySelect(); drawCursorOverlay(); }
    if (game.screen === 'roundIntro') { drawIntro(); drawCursorOverlay(); }
    if (game.screen === 'playing') {
      drawPlaying();
      if (game.pauseOverlay) {
        drawPauseOverlay();
        drawCursorOverlay();
      }
    }
    if (game.screen === 'roundResult') { drawResult(); drawCursorOverlay(); }
    if (game.screen === 'partyReport') { drawPartyReport(); drawCursorOverlay(); }
    if (game.screen === 'gameOver') { drawGameOver(); drawCursorOverlay(); }
    if (game.screen === 'photoCollage' && window.PhotoCollage && PhotoCollage.draw(canvas, video, GFX)) stopCamera();
    if (game.screen !== 'menu') drawHomeButton();
    if (game.screen !== 'playing' && game.voiceText && game.voiceUntil > now()) {
      const ctx = GFX.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(26,10,0,0.78)';
      ctx.fillRect(GFX.W * 0.12, GFX.H * 0.84, GFX.W * 0.76, GFX.H * 0.1);
      ctx.fillStyle = '#FFF5DC';
      ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(game.voiceText, GFX.W * 0.5, GFX.H * 0.89, GFX.W * 0.72);
      ctx.restore();
    }
    if (game.pause.active) {
      const ctx = GFX.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(10, 18, 28, 0.82)';
      ctx.fillRect(0, 0, GFX.W, GFX.H);
      ctx.restore();
      GFX.drawTitle('PAUZA', GFX.H * 0.44, Math.min(64, GFX.W * 0.05), '#FFD700');
      GFX.drawSubtitle('Otwórz dłoń na 2 sekundy, aby wrócić do gry.', GFX.H * 0.54, 22, '#FFF5DC');
    }
    drawMiniCamera();
    drawCancelHint();
  }

  function draw() {
    try {
      drawScene();
      game.runtimeDrawError = '';
    } catch (error) {
      const message = error && error.message || 'Nieznany błąd rysowania';
      if (game.runtimeDrawError !== message) console.error('Błąd rysowania Pasieka Party:', error);
      game.runtimeDrawError = message;
      try {
        GFX.clear('#1a0a00');
        GFX.drawTitle('BŁĄD WIDOKU', GFX.H * 0.45, Math.min(42, GFX.W * 0.04), '#FFD700');
        GFX.drawSubtitle('Możesz wrócić do menu klawiszem Esc.', GFX.H * 0.54, 22, '#FFF5DC');
      } catch (_) { /* Keep the animation loop alive even if canvas recovery also fails. */ }
    }
  }

  function frame(timestamp) {
    try {
      const delta = Math.min(0.05, Math.max(0, (timestamp - game.lastFrame) / 1000 || 0));
      game.lastFrame = timestamp;
      update(delta);
      draw();
    } catch (error) {
      const message = error && error.message || 'Nieznany błąd aktualizacji';
      if (game.runtimeError !== message) console.error('Błąd aktualizacji Pasieka Party:', error);
      game.runtimeError = message;
      game.actionPressed = false;
      game.pointer.down = false;
    }
    requestAnimationFrame(frame);
  }

  function startGameLoopWhenTrackerIsReady() {
    if (typeof HandTracker === 'undefined' || !HandTracker.ready) {
      requestAnimationFrame(startGameLoopWhenTrackerIsReady);
      return;
    }
    game.handTrackerReady = true;
    if (calibrationWasDone()) {
      game.screen = 'menu';
      if (game.autoDetect) beginCamera();
    } else {
      beginCalibration('menu');
    }
    requestAnimationFrame(frame);
  }
  startGameLoopWhenTrackerIsReady();
}());
