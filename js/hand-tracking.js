/**
 * hand-tracking.js — MediaPipe Hands wrapper
 * Udostępnia: HandTracker singleton
 *   .start(videoEl)  — uruchom kamerę + detekcję
 *   .stop()
 *   .cursor          — {x, y, pinching, visible, confidence}
 *   .circleMotion    — {angle, speed, direction, revolutions} do kręcenia korbą
 *   .paused          — otwarta dłoń zatrzymana przez 2 sekundy
 *   .gunGesture      — wyprostowany wskazujący i kciuk skierowany w górę
 *   .onPinchStart / .onPinchEnd — callbacki
 */

const HandTracker = (() => {
  let hands = null;
  let camera = null;
  let running = false;
  let ready = false;
  let lastResults = null;
  let paused = false;
  let gunGesture = false;
  let openHandSince = 0;
  let pauseAnchor = null;
  let handRaised = false;
  let raisedSince = 0;
  let crossedWrists = false;
  let crossedSince = 0;
  let lastSwipeAt = 0;
  let lastPushAt = 0;
  let lastScrollAt = 0;
  const motionHistory = [];
  const gestureEvents = { swipeLeft: false, swipeRight: false, pushForward: false,
    dismissSwipe: false, scrollUp: false, scrollDown: false };

  // Normalized cursor position (0-1)
  const cursor = {
    x: 0.5, y: 0.5,
    rawX: 0.5, rawY: 0.5,
    pinching: false,
    visible: false,
    confidence: 0,
    smoothX: 0.5, smoothY: 0.5
  };

  // Circle motion detection for crank
  const circleMotion = {
    angle: 0,
    prevAngle: 0,
    speed: 0,
    direction: 0, // 1=CW, -1=CCW
    revolutions: 0,
    totalAngle: 0,
    history: [], // last N angles for rhythm detection
    rhythm: 0,   // 0-1 how regular the motion is
    centerX: 0.5,
    centerY: 0.5
  };

  // Drag motion for frame extraction
  const dragMotion = {
    startX: 0, startY: 0,
    deltaX: 0, deltaY: 0,
    speed: 0,
    smoothness: 1, // 1=perfectly smooth, 0=jerky
    speedHistory: []
  };

  // Callbacks
  let onPinchStart = null;
  let onPinchEnd = null;
  let pinchWasActive = false;

  // Smoothing factor (higher = smoother but more laggy)
  const SMOOTH = 0.35;

  // Pinch threshold (distance between thumb tip and index tip)
  const PINCH_THRESHOLD = 0.06;
  const PINCH_RELEASE_THRESHOLD = 0.08;

  function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function takeGesture(name) {
    const active = gestureEvents[name];
    gestureEvents[name] = false;
    return active;
  }

  function updateWholeHandGestures(results, landmarks) {
    const time = performance.now();
    const wrist = landmarks[0];
    const palm = landmarks[9];
    const middleTip = landmarks[12];
    if (!wrist || !palm || !middleTip) return;

    // Hands provides relative z (the wrist is near zero), so apparent hand growth
    // is the primary depth cue. Relative palm z is a supporting cue.
    const sample = {
      time: time,
      x: 1 - palm.x,
      y: palm.y,
      z: Number.isFinite(palm.z) ? palm.z : 0,
      size: distance(wrist, middleTip)
    };
    motionHistory.push(sample);
    while (motionHistory.length && motionHistory[0].time < time - 1300) motionHistory.shift();
    const recent = motionHistory.find(function (item) { return time - item.time >= 120 && time - item.time <= 450; });
    if (recent) {
      const dx = sample.x - recent.x;
      const dy = sample.y - recent.y;
      const elapsed = time - recent.time;
      if (time - lastSwipeAt > 600 && Math.abs(dy) < 0.16) {
        if (Math.abs(dx) >= 0.32 && elapsed <= 260) {
          gestureEvents.dismissSwipe = true;
          lastSwipeAt = time;
        } else if (Math.abs(dx) >= 0.19 && elapsed <= 450) {
          gestureEvents[dx < 0 ? 'swipeLeft' : 'swipeRight'] = true;
          lastSwipeAt = time;
        }
      }
      const growth = recent.size > 0 ? sample.size / recent.size : 1;
      if (time - lastPushAt > 850 && growth >= 1.28 && Math.abs(dx) < 0.17 && Math.abs(dy) < 0.17 &&
          (sample.z < recent.z - 0.015 || growth >= 1.42)) {
        gestureEvents.pushForward = true;
        lastPushAt = time;
      }
    }
    const slow = motionHistory.find(function (item) { return time - item.time >= 650 && time - item.time <= 1300; });
    if (slow && time - lastScrollAt > 500) {
      const dx = sample.x - slow.x;
      const dy = sample.y - slow.y;
      if (Math.abs(dx) < 0.1 && Math.abs(dy) >= 0.12 && Math.abs(dy) <= 0.34) {
        gestureEvents[dy < 0 ? 'scrollUp' : 'scrollDown'] = true;
        lastScrollAt = time;
      }
    }

    const headY = results.multiFaceLandmarks && results.multiFaceLandmarks[0] && results.multiFaceLandmarks[0][10]
      ? results.multiFaceLandmarks[0][10].y : 0.24;
    const aboveHead = wrist.y < headY - 0.02;
    if (aboveHead) {
      if (!raisedSince) raisedSince = time;
      handRaised = time - raisedSince >= 2000;
    } else { raisedSince = 0; handRaised = false; }

    const hands = results.multiHandLandmarks || [];
    if (hands.length >= 2 && hands[0][0] && hands[1][0] && hands[0][9] && hands[1][9]) {
      const a = hands[0][0];
      const b = hands[1][0];
      const palmsApart = Math.abs(hands[0][9].x - hands[1][9].x) > 0.08;
      const wristsReversed = (a.x - b.x) * (hands[0][9].x - hands[1][9].x) < 0;
      const crossed = Math.abs(a.x - b.x) < 0.14 && Math.abs(a.y - b.y) < 0.14 &&
        (a.x + b.x) / 2 > 0.27 && (a.x + b.x) / 2 < 0.73 &&
        (a.y + b.y) / 2 > 0.3 && (a.y + b.y) / 2 < 0.82 && palmsApart && wristsReversed;
      if (crossed) {
        if (!crossedSince) crossedSince = time;
        crossedWrists = time - crossedSince >= 1500;
      } else { crossedSince = 0; crossedWrists = false; }
    } else { crossedSince = 0; crossedWrists = false; }
  }

  function fingerExtended(landmarks, tipIndex, jointIndex) {
    const wrist = landmarks[0];
    const tip = landmarks[tipIndex];
    const joint = landmarks[jointIndex];
    return !!(wrist && tip && joint) && distance(tip, wrist) > distance(joint, wrist) * 1.1;
  }

  function updateHandGestures(landmarks) {
    const indexExtended = fingerExtended(landmarks, 8, 6);
    const middleExtended = fingerExtended(landmarks, 12, 10);
    const ringExtended = fingerExtended(landmarks, 16, 14);
    const pinkyExtended = fingerExtended(landmarks, 20, 18);
    const thumbExtended = fingerExtended(landmarks, 4, 3);
    const thumbTip = landmarks[4];
    const thumbJoint = landmarks[3];

    gunGesture = !!(
      indexExtended && thumbExtended && thumbTip && thumbJoint &&
      thumbTip.y < thumbJoint.y - 0.01 &&
      !middleExtended && !ringExtended && !pinkyExtended
    );

    const openHand = indexExtended && middleExtended && ringExtended && pinkyExtended;
    if (paused) return;
    if (!openHand) {
      openHandSince = 0;
      pauseAnchor = null;
      return;
    }

    const center = landmarks[9] || landmarks[0];
    if (!center) return;
    if (!pauseAnchor) {
      pauseAnchor = { x: center.x, y: center.y };
      openHandSince = performance.now();
      return;
    }

    const movement = Math.hypot(center.x - pauseAnchor.x, center.y - pauseAnchor.y);
    if (movement > 0.035) {
      pauseAnchor = { x: center.x, y: center.y };
      openHandSince = performance.now();
      return;
    }
    if (openHandSince && performance.now() - openHandSince >= 2000) paused = true;
  }

  function processResults(results) {
    lastResults = results;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      cursor.visible = false;
      cursor.pinching = false;
      cursor.confidence = 0;
      gunGesture = false;
      handRaised = false;
      raisedSince = 0;
      crossedWrists = false;
      crossedSince = 0;
      motionHistory.length = 0;
      Object.keys(gestureEvents).forEach(function (key) { gestureEvents[key] = false; });
      if (!paused) {
        openHandSince = 0;
        pauseAnchor = null;
      }
      return;
    }

    // Gdy dwie ręce: preferuj tę która ostatnio ścisnęła (pinch), żeby nie skakać między rękami
    let activeHandIndex = 0;
    if (results.multiHandLandmarks.length >= 2) {
      const h0tip = results.multiHandLandmarks[0][4];
      const h0idx = results.multiHandLandmarks[0][8];
      const h1tip = results.multiHandLandmarks[1][4];
      const h1idx = results.multiHandLandmarks[1][8];
      const d0 = h0tip && h0idx ? distance(h0tip, h0idx) : 1;
      const d1 = h1tip && h1idx ? distance(h1tip, h1idx) : 1;
      // Wybierz rękę bliżej pincha; jeśli już piszczy — nie zmieniaj
      if (!cursor.pinching) {
        activeHandIndex = d0 <= d1 ? 0 : 1;
      } else {
        // Zostań przy tej samej ręce podczas piszku — porównaj pozycję kursora
        const prevX = cursor.rawX;
        const x0 = 1.0 - (results.multiHandLandmarks[0][8] ? results.multiHandLandmarks[0][8].x : 0);
        const x1 = 1.0 - (results.multiHandLandmarks[1][8] ? results.multiHandLandmarks[1][8].x : 0);
        activeHandIndex = Math.abs(x0 - prevX) <= Math.abs(x1 - prevX) ? 0 : 1;
      }
    }
    const landmarks = results.multiHandLandmarks[activeHandIndex];
    const indexTip = landmarks[8];   // Index finger tip
    const thumbTip = landmarks[4];   // Thumb tip
    const wrist = landmarks[0];

    updateHandGestures(landmarks);
    updateWholeHandGestures(results, landmarks);

    // Mirror X (camera is mirrored)
    const rawX = 1.0 - indexTip.x;
    const rawY = indexTip.y;

    // Smooth cursor
    cursor.rawX = rawX;
    cursor.rawY = rawY;
    cursor.smoothX += (rawX - cursor.smoothX) * SMOOTH;
    cursor.smoothY += (rawY - cursor.smoothY) * SMOOTH;
    cursor.x = cursor.smoothX;
    cursor.y = cursor.smoothY;
    cursor.visible = true;
    cursor.confidence = 1;

    // Pinch detection
    const pinchDist = distance(thumbTip, indexTip);
    const wasPinching = cursor.pinching;

    if (pinchDist < PINCH_THRESHOLD) {
      cursor.pinching = true;
    } else if (pinchDist > PINCH_RELEASE_THRESHOLD) {
      cursor.pinching = false;
    }

    if (cursor.pinching && !wasPinching && onPinchStart) {
      onPinchStart(cursor);
    }
    if (!cursor.pinching && wasPinching && onPinchEnd) {
      onPinchEnd(cursor);
    }

    // Circle motion tracking (using wrist position relative to center)
    const handCenterX = 1.0 - landmarks[9].x; // Middle finger MCP
    const handCenterY = landmarks[9].y;

    // Update rolling center
    circleMotion.centerX += (handCenterX - circleMotion.centerX) * 0.02;
    circleMotion.centerY += (handCenterY - circleMotion.centerY) * 0.02;

    const dx = handCenterX - circleMotion.centerX;
    const dy = handCenterY - circleMotion.centerY;
    const newAngle = Math.atan2(dy, dx);

    // Calculate angular velocity
    let angleDiff = newAngle - circleMotion.prevAngle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    circleMotion.speed = Math.abs(angleDiff);
    circleMotion.direction = angleDiff > 0 ? 1 : -1;
    circleMotion.totalAngle += angleDiff;
    circleMotion.revolutions = circleMotion.totalAngle / (2 * Math.PI);
    circleMotion.prevAngle = newAngle;
    circleMotion.angle = newAngle;

    // Rhythm tracking (consistency of speed)
    circleMotion.history.push(circleMotion.speed);
    if (circleMotion.history.length > 30) circleMotion.history.shift();
    if (circleMotion.history.length > 5) {
      const avg = circleMotion.history.reduce((a, b) => a + b) / circleMotion.history.length;
      const variance = circleMotion.history.reduce((a, b) => a + (b - avg) ** 2, 0) / circleMotion.history.length;
      circleMotion.rhythm = Math.max(0, 1 - Math.sqrt(variance) / (avg + 0.001));
    }

    // Drag motion tracking
    const prevSpeed = dragMotion.speed;
    dragMotion.speed = Math.sqrt(
      (rawX - (cursor.rawX || rawX)) ** 2 +
      (rawY - (cursor.rawY || rawY)) ** 2
    );
    dragMotion.speedHistory.push(dragMotion.speed);
    if (dragMotion.speedHistory.length > 20) dragMotion.speedHistory.shift();

    // Smoothness = how consistent is the speed (low variance = smooth)
    if (dragMotion.speedHistory.length > 3) {
      const avg = dragMotion.speedHistory.reduce((a, b) => a + b) / dragMotion.speedHistory.length;
      const variance = dragMotion.speedHistory.reduce((a, b) => a + (b - avg) ** 2, 0) / dragMotion.speedHistory.length;
      dragMotion.smoothness = Math.max(0, 1 - Math.sqrt(variance) * 50);
    }
  }

  async function start(videoEl) {
    if (running) return;
    paused = false;
    gunGesture = false;
    openHandSince = 0;
    pauseAnchor = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (e) {
      console.error('Kamera niedostępna:', e);
      return false;
    }

    try {
      if (typeof Hands !== 'function' || typeof Camera !== 'function') return false;
      hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });
      hands.onResults(processResults);
      camera = new Camera(videoEl, {
        onFrame: async () => {
          if (!running) return;
          try { await hands.send({ image: videoEl }); }
          catch (error) { console.warn('Błąd klatki MediaPipe:', error); }
        },
        width: 640,
        height: 480
      });
    } catch (error) {
      console.warn('Nie udało się uruchomić MediaPipe:', error);
      return false;
    }

    running = true;
    camera.start();
    return true;
  }

  function stop() {
    running = false;
    paused = false;
    gunGesture = false;
    openHandSince = 0;
    pauseAnchor = null;
    if (camera) camera.stop();
    handRaised = false;
    crossedWrists = false;
    motionHistory.length = 0;
    lastResults = null;
    cursor.visible = false;
    cursor.pinching = false;
    Object.keys(gestureEvents).forEach(function (key) { gestureEvents[key] = false; });
  }

  function setOnPinchStart(fn) { onPinchStart = fn; }
  function setOnPinchEnd(fn) { onPinchEnd = fn; }

  ready = true;
  return {
    start, stop,
    cursor, circleMotion, dragMotion,
    setOnPinchStart, setOnPinchEnd,
    get paused() { return paused; },
    set paused(value) {
      paused = !!value;
      if (!paused) {
        openHandSince = 0;
        pauseAnchor = null;
      }
    },
    get gunGesture() { return gunGesture; },
    get swipeLeft() { return takeGesture('swipeLeft'); },
    get swipeRight() { return takeGesture('swipeRight'); },
    get pushForward() { return takeGesture('pushForward'); },
    get dismissSwipe() { return takeGesture('dismissSwipe'); },
    get scrollUp() { return takeGesture('scrollUp'); },
    get scrollDown() { return takeGesture('scrollDown'); },
    get handRaised() { return handRaised; },
    get crossedWrists() { return crossedWrists; },
    get running() { return running; },
    get ready() { return ready; },
    get lastResults() { return lastResults; }
  };
})();


// Zachowaj oba warianty nazwy, bo starszy kod gry używa HandTracker.
const handTracker = HandTracker;
if (typeof window !== 'undefined') {
  window.HandTracker = HandTracker;
  window.handTracker = handTracker;
}
/* Large crank-circle detection for the miodarka round. */
(function attachCrankCircleMotion() {
  'use strict';

  const wrists = [];
  let lastSignature = '';

  function viewport() {
    const canvas = document.getElementById('game-canvas');
    return {
      width: canvas && (canvas.clientWidth || canvas.width) || window.innerWidth || 1280,
      height: canvas && (canvas.clientHeight || canvas.height) || window.innerHeight || 720
    };
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function measureCrank(points) {
    if (points.length < 12) return { valid: false, radius: 0, coverage: 0, uniformity: 0 };
    const center = points.reduce(function (sum, point) {
      sum.x += point.x; sum.y += point.y; return sum;
    }, { x: 0, y: 0 });
    center.x /= points.length;
    center.y /= points.length;
    const radii = points.map(function (point) { return Math.hypot(point.x - center.x, point.y - center.y); });
    const radius = radii.reduce(function (sum, value) { return sum + value; }, 0) / radii.length;
    const radiusDeviation = Math.sqrt(radii.reduce(function (sum, value) { return sum + Math.pow(value - radius, 2); }, 0) / radii.length);
    const circleFit = radius ? Math.max(0, 1 - radiusDeviation / radius) : 0;
    const angles = points.map(function (point) { return Math.atan2(point.y - center.y, point.x - center.x); });
    let signed = 0;
    let absolute = 0;
    const steps = [];
    for (let index = 1; index < angles.length; index += 1) {
      const step = normalizeAngle(angles[index] - angles[index - 1]);
      if (Math.abs(step) <= Math.PI * 0.55) {
        signed += step;
        absolute += Math.abs(step);
        if (Math.abs(step) > 0.003) steps.push(Math.abs(step));
      }
    }
    const direction = absolute ? Math.abs(signed) / absolute : 0;
    const coverage = Math.min(1, Math.abs(signed) / (Math.PI * 2));
    const averageStep = steps.length ? steps.reduce(function (sum, value) { return sum + value; }, 0) / steps.length : 0;
    const stepDeviation = steps.length ? Math.sqrt(steps.reduce(function (sum, value) { return sum + Math.pow(value - averageStep, 2); }, 0) / steps.length) : Infinity;
    const uniformity = averageStep ? Math.max(0, 1 - stepDeviation / averageStep) : 0;
    return {
      valid: radius >= 120 && circleFit >= 0.72 && coverage >= 0.75 && direction >= 0.8 && uniformity >= 0.45,
      radius: radius,
      coverage: coverage,
      uniformity: uniformity
    };
  }

  function update() {
    const handTracker = window.HandTracker;
    if (!handTracker) { window.requestAnimationFrame(update); return; }
    const hands = handTracker.lastResults && handTracker.lastResults.multiHandLandmarks;
    const wrist = hands && hands.find(function (hand) { return hand && hand[0] && Number.isFinite(hand[0].x) && Number.isFinite(hand[0].y); });
    if (wrist) {
      const marker = wrist[0];
      const signature = marker.x.toFixed(4) + ':' + marker.y.toFixed(4);
      if (signature !== lastSignature) {
        const size = viewport();
        wrists.push({ x: marker.x * size.width, y: marker.y * size.height });
        if (wrists.length > 30) wrists.shift();
        lastSignature = signature;
      }
    } else if (wrists.length) {
      wrists.length = 0;
      lastSignature = '';
    }
    const motion = handTracker.circleMotion || {};
    const measured = measureCrank(wrists);
    motion.valid = measured.valid;
    motion.radius = measured.radius;
    motion.coverage = measured.coverage;
    motion.uniformity = measured.uniformity;
    handTracker.circleMotion = motion;
    window.requestAnimationFrame(update);
  }

  update();
}());

/* Gesture exports used by movement rounds.  They read the latest MediaPipe frame. */
(function attachTwoHandGestures() {
  'use strict';

  const history = [];
  let lastSignature = '';
  let lastWaving = false;

  function landmarks(tracker) {
    const results = tracker && tracker.lastResults;
    const hands = results && results.multiHandLandmarks;
    return hands && hands.length >= 2 && hands[0] && hands[1] ? hands.slice(0, 2) : null;
  }

  function headY(results) {
    const pose = results && results.multiPoseLandmarks && results.multiPoseLandmarks[0];
    if (pose && pose[0] && Number.isFinite(pose[0].y)) return pose[0].y;
    const face = results && results.multiFaceLandmarks && results.multiFaceLandmarks[0];
    if (face && face[10] && Number.isFinite(face[10].y)) return face[10].y;
    return 0.3;
  }

  function shoulderY(results) {
    const pose = results && results.multiPoseLandmarks && results.multiPoseLandmarks[0];
    if (pose && pose[11] && pose[12] && Number.isFinite(pose[11].y) && Number.isFinite(pose[12].y)) return (pose[11].y + pose[12].y) / 2;
    return 0.62;
  }

  function updateWaving(tracker, hands) {
    const wrists = hands.map(function (hand) { return hand[0]; });
    if (!wrists.every(function (wrist) { return wrist && Number.isFinite(wrist.x) && Number.isFinite(wrist.y); })) return false;
    const signature = wrists.map(function (wrist) { return wrist.x.toFixed(4) + ':' + wrist.y.toFixed(4); }).join('|');
    const time = performance.now();
    if (signature !== lastSignature) {
      history.push({ time: time, left: wrists[0].x, right: wrists[1].x });
      lastSignature = signature;
    }
    while (history.length && history[0].time < time - 650) history.shift();
    if (history.length < 4) return false;
    let leftTravel = 0;
    let rightTravel = 0;
    let leftReversal = false;
    let rightReversal = false;
    let previousLeft = 0;
    let previousRight = 0;
    for (let index = 1; index < history.length; index += 1) {
      const leftStep = history[index].left - history[index - 1].left;
      const rightStep = history[index].right - history[index - 1].right;
      leftTravel += Math.abs(leftStep);
      rightTravel += Math.abs(rightStep);
      if (leftStep * previousLeft < 0) leftReversal = true;
      if (rightStep * previousRight < 0) rightReversal = true;
      if (Math.abs(leftStep) > 0.002) previousLeft = leftStep;
      if (Math.abs(rightStep) > 0.002) previousRight = rightStep;
    }
    return leftTravel >= 0.12 && rightTravel >= 0.12 && leftReversal && rightReversal;
  }

  function attach() {
    const handTracker = window.HandTracker;
    if (!handTracker) { window.requestAnimationFrame(attach); return; }
    Object.defineProperties(handTracker, {
      handsUp: { configurable: true, get: function () {
        const hands = landmarks(handTracker);
        if (!hands) return false;
        const reference = headY(handTracker.lastResults) - 0.015;
        return hands.every(function (hand) { return hand[0] && hand[0].y < reference; });
      } },
      handsDown: { configurable: true, get: function () {
        const hands = landmarks(handTracker);
        if (!hands) return false;
        const reference = shoulderY(handTracker.lastResults) + 0.12;
        return hands.every(function (hand) { return hand[0] && hand[0].y > reference; });
      } },
      waving: { configurable: true, get: function () {
        const hands = landmarks(handTracker);
        lastWaving = !!hands && updateWaving(handTracker, hands);
        return lastWaving;
      } }
    });
  }

  attach();
}());
