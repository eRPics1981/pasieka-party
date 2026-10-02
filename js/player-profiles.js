/* Camera-based profile capture and naming flow. */
window.PlayerProfiles = (function () {
  'use strict';

  const STORAGE_KEY = 'pasieka-party-profiles';
  const EXPRESSIONS = [
    { face: '🐝', text: 'Zrób minę pszczelego mistrza!' },
    { face: '😮', text: 'Zrób wielkie oczy, jak po pierwszym miodzie!' },
    { face: '😎', text: 'Pokaż minę króla parkietu!' },
    { face: '😜', text: 'Zrób psotną minę trutnia!' },
    { face: '😁', text: 'Uśmiechnij się jak po dokładce tortu!' }
  ];

  let video;
  let canvas;
  let gfx;
  let pose = null;
  let active = false;
  let stage = 'framing';
  let status = 'Za daleko';
  let landmarks = null;
  let lastPoseAt = 0;
  let poseBusy = false;
  let stableSince = 0;
  let expression = null;
  let countdown = 0;
  let snapshot = null;
  let controls = null;
  let nameInput = null;
  let menuButton = null;
  let profiles = [];
  let errorMessage = '';

  function loadProfiles() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      profiles = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      profiles = [];
    }
    return profiles;
  }

  function saveProfile() {
    const name = nameInput.value.trim();
    if (!name || !snapshot) {
      nameInput.focus();
      return false;
    }
    loadProfiles();
    const profile = {
      id: 'player-' + Date.now(),
      name: name,
      photo: snapshot.toDataURL('image/jpeg', 0.9),
      createdAt: new Date().toISOString()
    };
    profiles.push(profile);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); }
    catch (error) { errorMessage = 'Brak miejsca na zapis zdjęcia w tej przeglądarce.'; return false; }
    close();
    return true;
  }

  function createControls() {
    if (controls) return;
    controls = document.createElement('div');
    controls.style.cssText = 'position:fixed;z-index:12000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,88vw);padding:18px;background:#241509;color:#fff5dc;border:2px solid #ffd78a;border-radius:14px;box-shadow:0 8px 32px #000b;font:16px sans-serif;display:none';
    const label = document.createElement('label');
    label.textContent = 'Jak masz na imię? Wpisz i naciśnij Enter';
    label.style.cssText = 'display:block;margin-bottom:10px;font-weight:bold';
    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 32;
    nameInput.autocomplete = 'given-name';
    nameInput.placeholder = 'Twoje imię';
    nameInput.style.cssText = 'box-sizing:border-box;width:100%;padding:12px;border:1px solid #ffd78a;border-radius:8px;font-size:18px';
    nameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (saveProfile() && video && video.paused) video.play().catch(function () {});
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (video && video.paused) video.play().catch(function () {});
        close();
      }
    });
    label.appendChild(nameInput);
    controls.appendChild(label);
    const hint = document.createElement('div');
    hint.textContent = 'Enter zapisuje zdjęcie profilowe';
    hint.style.cssText = 'margin-top:8px;color:#ffd78a;font-size:14px';
    controls.appendChild(hint);
    document.body.appendChild(controls);
  }

  function createMenuButton() {
    if (menuButton) return;
    menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = 'Zrób zdjęcie profilowe';
    menuButton.style.cssText = 'position:fixed;z-index:11000;left:14px;top:14px;padding:10px 14px;border:2px solid #ffd78a;border-radius:10px;background:#5c3b13;color:#fff5dc;font:bold 15px sans-serif;cursor:pointer;display:none';
    menuButton.addEventListener('click', start);
    document.body.appendChild(menuButton);
  }

  function init(cameraVideo, gameCanvas, graphics) {
    video = cameraVideo;
    canvas = gameCanvas;
    gfx = graphics;
    createControls();
    createMenuButton();
    loadProfiles();
    window.addEventListener('keydown', function (event) {
      if (active && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (video && video.paused) video.play().catch(function () {});
        close();
      }
    });
    if (window.Pose) {
      pose = new window.Pose({ locateFile: function (file) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/' + file;
      } });
      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      pose.onResults(function (results) {
        landmarks = results.poseLandmarks || null;
        updateDistance();
      });
    } else {
      errorMessage = 'Nie udało się uruchomić MediaPipe Pose.';
    }
  }

  function updateDistance() {
    if (!landmarks || !video || !video.videoWidth || !video.videoHeight) {
      status = 'Za daleko';
      return;
    }
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    if (!nose || !leftShoulder || !rightShoulder || nose.visibility < 0.45 ||
        leftShoulder.visibility < 0.45 || rightShoulder.visibility < 0.45) {
      status = 'Za daleko';
      return;
    }
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const headToShoulders = Math.abs(shoulderY - nose.y);
    const shouldersInFrame = leftShoulder.x > 0.02 && rightShoulder.x < 0.98;
    const hipsVisible = leftHip && rightHip && leftHip.visibility > 0.35 && rightHip.visibility > 0.35;
    const torsoHeight = hipsVisible ? ((leftHip.y + rightHip.y) / 2 - shoulderY) : 0;

    if (!shouldersInFrame || shoulderWidth > 0.56 || headToShoulders > 0.48 || nose.y < 0.015) {
      status = 'Za blisko';
    } else if (shoulderWidth < 0.17 || headToShoulders < 0.12 || (hipsVisible && torsoHeight < 0.12)) {
      status = 'Za daleko';
    } else {
      status = 'OK';
    }
  }

  function start() {
    if (!video || !pose) {
      errorMessage = 'Kamera lub MediaPipe nie są dostępne.';
      active = true;
      stage = 'framing';
      return;
    }
    active = true;
    stage = 'framing';
    errorMessage = '';
    stableSince = 0;
    expression = null;
    snapshot = null;
    landmarks = null;
    status = 'Za daleko';
  }

  function update() {
    if (!active) return false;
    const now = performance.now();
    if (stage === 'framing' && pose && video && video.readyState >= 2 && !poseBusy && now - lastPoseAt > 100) {
      poseBusy = true;
      lastPoseAt = now;
      pose.send({ image: video }).catch(function () {
        errorMessage = 'Nie można odczytać obrazu z kamery.';
      }).finally(function () { poseBusy = false; });
    }
    if (stage === 'framing') {
      if (status === 'OK') {
        if (!stableSince) stableSince = now;
        if (!expression) expression = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
        if (now - stableSince >= 1600) {
          countdown = now + 3000;
          stage = 'countdown';
        }
      } else {
        stableSince = 0;
        expression = null;
      }
    } else if (stage === 'countdown' && now >= countdown) {
      snapshot = document.createElement('canvas');
      snapshot.width = video.videoWidth;
      snapshot.height = video.videoHeight;
      snapshot.getContext('2d').drawImage(video, 0, 0, snapshot.width, snapshot.height);
      video.pause();
      stage = 'name';
      controls.style.display = 'block';
      nameInput.value = '';
      nameInput.focus();
    }
    return true;
  }

  function drawMenuButton(inMenu) {
    if (menuButton) menuButton.style.display = inMenu && !active ? 'block' : 'none';
  }

  function draw() {
    if (!active || !canvas || !gfx) return;
    const ctx = gfx.ctx;
    const w = gfx.W;
    const h = gfx.H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,18,17,0.88)';
    ctx.fillRect(0, 0, w, h);

    if (stage === 'name' && snapshot) {
      const scale = Math.max(w / snapshot.width, h / snapshot.height);
      const sw = w / scale;
      const sh = h / scale;
      ctx.drawImage(snapshot, (snapshot.width - sw) / 2, (snapshot.height - sh) / 2, sw, sh, 0, 0, w, h);
      ctx.fillStyle = 'rgba(20,10,0,0.48)';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      gfx.drawTitle('TAK WYGLĄDA TWOJE ZDJĘCIE', h * 0.12, Math.min(46, w * 0.04), '#FFF5DC');
      gfx.drawSubtitle('Wpisz imię i zatwierdź Enterem', h * 0.87, 24, '#FFF5DC');
    } else {
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(18,12,4,0.62)';
      ctx.fillRect(0, 0, w, h * 0.19);
      gfx.drawTitle('ZDJĘCIE PROFILOWE', h * 0.08, Math.min(48, w * 0.04), '#FFF5DC');

      const barX = w * 0.25;
      const barY = h * 0.82;
      const barW = w * 0.5;
      const barH = 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      const fill = status === 'OK' ? 1 : status === 'Za blisko' ? 0.88 : 0.18;
      ctx.fillStyle = status === 'OK' ? '#52d273' : status === 'Za blisko' ? '#e65745' : '#f1bd48';
      ctx.fillRect(barX, barY, barW * fill, barH);
      gfx.drawSubtitle(status, h * 0.79, 28, '#FFF5DC');

      if (stage === 'framing' && expression) {
        gfx.drawSubtitle(expression.face + '  ' + expression.text, h * 0.28, 30, '#FFD78A');
      }
      if (stage === 'countdown') {
        gfx.drawTitle(String(Math.max(1, Math.ceil((countdown - performance.now()) / 1000))), h * 0.52, Math.min(170, h * 0.23), '#FFD700');
      }
      if (errorMessage) gfx.drawSubtitle(errorMessage, h * 0.92, 18, '#FFD78A');
    }
    ctx.restore();
  }

  function close() {
    active = false;
    stage = 'framing';
    if (controls) controls.style.display = 'none';
    if (menuButton) menuButton.style.display = 'block';
  }

  function getAll() {
    return loadProfiles();
  }

  function isActive() {
    return active;
  }

  return {
    init: init,
    start: start,
    update: update,
    draw: draw,
    drawMenuButton: drawMenuButton,
    getAll: getAll,
    list: getAll,
    isActive: isActive
  };
}());
