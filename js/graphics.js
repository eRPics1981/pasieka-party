/**
 * graphics.js — Rysowanie Canvas 2D: tła, elementy gry, UI
 * Spójny styl: ciepłe kolory pasieki, duże czytelne napisy
 */

const GFX = (() => {
  let ctx = null;
  let W = 1920, H = 1080;

  // Color palette
  const PAL = {
    honey:     '#F5A623',
    honeyDark: '#C47F17',
    honeyLight:'#FFD78A',
    wood:      '#8B6914',
    woodDark:  '#5C4A0E',
    green:     '#4A7C2E',
    greenDark: '#2D5016',
    sky:       '#87CEEB',
    white:     '#FFF8E7',
    black:     '#1a0a00',
    red:       '#D63031',
    cream:     '#FFF5DC',
    brown:     '#6B4226',
    beeYellow: '#FFD700',
    beeBlack:  '#2C2C2C',
  };

  function init(canvas) {
    ctx = canvas.getContext('2d');
    resize(canvas);
    window.addEventListener('resize', () => resize(canvas));
  }

  function resize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear(color = PAL.black) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }

  // === BACKGROUND SCENES ===

  function drawMeadowBg() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    skyGrad.addColorStop(0, '#4A90D9');
    skyGrad.addColorStop(1, '#87CEEB');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.6);

    // Sun
    ctx.fillStyle = PAL.beeYellow;
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.15, 60, 0, Math.PI * 2);
    ctx.fill();

    // Rays
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Date.now() * 0.001;
      ctx.beginPath();
      ctx.moveTo(W * 0.85 + Math.cos(a) * 70, H * 0.15 + Math.sin(a) * 70);
      ctx.lineTo(W * 0.85 + Math.cos(a) * 100, H * 0.15 + Math.sin(a) * 100);
      ctx.stroke();
    }

    // Hills
    ctx.fillStyle = PAL.green;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    for (let x = 0; x <= W; x += 50) {
      ctx.lineTo(x, H * 0.55 + Math.sin(x * 0.005) * 30 + Math.sin(x * 0.012) * 15);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Grass
    ctx.fillStyle = PAL.greenDark;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.6);
    for (let x = 0; x <= W; x += 30) {
      ctx.lineTo(x, H * 0.6 + Math.sin(x * 0.008 + 1) * 20);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Flowers
    const t = Date.now() * 0.002;
    for (let i = 0; i < 15; i++) {
      const fx = (i * 137 + 50) % W;
      const fy = H * 0.62 + Math.sin(fx * 0.01) * 20 + (i % 3) * 15;
      drawFlower(fx, fy, 8 + (i % 3) * 3, t + i);
    }
  }

  function drawFlower(x, y, size, t) {
    // Stem
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(t * 0.5) * 2, y + size * 2);
    ctx.stroke();

    // Petals
    const colors = ['#FF69B4', '#FFD700', '#FF6347', '#9370DB', '#FF4500'];
    ctx.fillStyle = colors[Math.floor(x + y) % colors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + Math.sin(t) * 0.1;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * size * 0.5, y + Math.sin(a) * size * 0.5,
                  size * 0.4, size * 0.25, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // === BEEHIVE / APIARY ELEMENTS ===

  function drawBeehive(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Hive body (stacked boxes)
    for (let i = 0; i < 3; i++) {
      const bw = 100 - i * 5;
      const bh = 35;
      const by = -i * bh;
      ctx.fillStyle = i % 2 === 0 ? PAL.wood : PAL.honeyDark;
      ctx.strokeStyle = PAL.woodDark;
      ctx.lineWidth = 2;
      ctx.fillRect(-bw / 2, by - bh, bw, bh);
      ctx.strokeRect(-bw / 2, by - bh, bw, bh);
    }

    // Roof
    ctx.fillStyle = PAL.woodDark;
    ctx.beginPath();
    ctx.moveTo(-65, -105);
    ctx.lineTo(0, -135);
    ctx.lineTo(65, -105);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Entrance
    ctx.fillStyle = PAL.black;
    ctx.beginPath();
    ctx.arc(0, -5, 10, Math.PI, 0);
    ctx.fill();

    ctx.restore();
  }

  function drawBee(x, y, size = 20, wingPhase = 0) {
    ctx.save();
    ctx.translate(x, y);

    // Wings
    ctx.fillStyle = 'rgba(200,220,255,0.6)';
    const wingAngle = Math.sin(wingPhase * 15) * 0.4;
    ctx.beginPath();
    ctx.ellipse(-2, -size * 0.4, size * 0.5, size * 0.25, wingAngle - 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, -size * 0.4, size * 0.5, size * 0.25, -wingAngle + 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = PAL.beeYellow;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stripes
    ctx.fillStyle = PAL.beeBlack;
    for (let s = -1; s <= 1; s++) {
      ctx.fillRect(-size * 0.35, s * size * 0.18 - 2, size * 0.7, 4);
    }

    // Eyes
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-5, -size * 0.15, 3, 0, Math.PI * 2);
    ctx.arc(5, -size * 0.15, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-4, -size * 0.15, 1.5, 0, Math.PI * 2);
    ctx.arc(6, -size * 0.15, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Czułki
    ctx.strokeStyle = PAL.beeBlack;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, -size * 0.45);
    ctx.quadraticCurveTo(-size * 0.3, -size * 0.8, -size * 0.25, -size * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -size * 0.45);
    ctx.quadraticCurveTo(size * 0.3, -size * 0.8, size * 0.25, -size * 0.9);
    ctx.stroke();
    // Kulki na czułkach
    ctx.fillStyle = PAL.beeBlack;
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.9, 2, 0, Math.PI * 2);
    ctx.arc(size * 0.25, -size * 0.9, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // === HONEY FRAME ===

  function drawHoneyFrame(x, y, width, height, pullProgress = 0) {
    ctx.save();
    ctx.translate(x, y - pullProgress * height * 0.5);

    // Frame wood
    ctx.fillStyle = PAL.wood;
    ctx.strokeStyle = PAL.woodDark;
    ctx.lineWidth = 3;

    // Top bar
    ctx.fillRect(-width / 2 - 10, -height / 2 - 8, width + 20, 16);
    ctx.strokeRect(-width / 2 - 10, -height / 2 - 8, width + 20, 16);

    // Side bars
    ctx.fillRect(-width / 2 - 5, -height / 2, 10, height);
    ctx.fillRect(width / 2 - 5, -height / 2, 10, height);

    // Honeycomb cells
    const cellSize = 12;
    const visibleHeight = height * (1 - pullProgress * 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-width / 2 + 5, -height / 2 + 8, width - 10, visibleHeight - 8);
    ctx.clip();

    for (let row = 0; row < height / (cellSize * 1.5); row++) {
      for (let col = 0; col < width / (cellSize * 1.7); col++) {
        const cx = -width / 2 + 15 + col * cellSize * 1.7 + (row % 2) * cellSize * 0.85;
        const cy = -height / 2 + 15 + row * cellSize * 1.5;
        drawHexCell(cx, cy, cellSize * 0.45);
      }
    }
    ctx.restore();

    // Honey drip when pulling
    if (pullProgress > 0.3) {
      ctx.fillStyle = PAL.honey;
      for (let d = 0; d < 3; d++) {
        const dx = -width / 4 + d * width / 4;
        const dripLen = (pullProgress - 0.3) * 60 * (1 + Math.sin(Date.now() * 0.003 + d) * 0.3);
        ctx.beginPath();
        ctx.ellipse(dx, height / 2 + dripLen, 4, dripLen * 0.5 + 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawHexCell(x, y, r) {
    ctx.fillStyle = PAL.honeyLight;
    ctx.strokeStyle = PAL.honeyDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // === HONEY SPINNER (MIODARKA) ===

  function drawSpinner(x, y, radius, rotation = 0, shakeAmount = 0) {
    ctx.save();
    ctx.translate(x + Math.sin(Date.now() * 0.02) * shakeAmount, y);

    // Barrel body
    ctx.fillStyle = '#C0C0C0';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Metal bands
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 4;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.ellipse(0, b * radius * 0.5, radius * 1.02, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Internal spinning frame
    ctx.save();
    ctx.rotate(rotation);
    ctx.strokeStyle = PAL.woodDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, -radius * 0.8);
    ctx.lineTo(-radius * 0.6, radius * 0.8);
    ctx.moveTo(radius * 0.6, -radius * 0.8);
    ctx.lineTo(radius * 0.6, radius * 0.8);
    ctx.moveTo(0, -radius * 0.3);
    ctx.lineTo(0, radius * 0.3);
    ctx.stroke();
    ctx.restore();

    // Crank handle on top
    ctx.save();
    ctx.translate(0, -radius * 1.3 - 10);
    ctx.rotate(rotation * 2);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();
    // Handle grip
    ctx.fillStyle = PAL.wood;
    ctx.beginPath();
    ctx.arc(40, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.woodDark;
    ctx.stroke();
    ctx.restore();

    // Honey drip at bottom
    const dripPhase = Date.now() * 0.002;
    ctx.fillStyle = PAL.honey;
    ctx.beginPath();
    const dripY = radius * 1.3 + 10 + Math.sin(dripPhase) * 5;
    ctx.ellipse(0, dripY, 6, 10 + Math.sin(dripPhase * 1.3) * 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // === DUCK ===

  function drawDuck(x, y, size = 40, alive = true, direction = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);

    if (!alive) {
      ctx.rotate(Math.PI * 0.5);
      ctx.globalAlpha = 0.6;
    }

    // Body
    ctx.fillStyle = '#4A6741';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#2E5930';
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // White ring
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.15, size * 0.2, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // Beak
    ctx.fillStyle = '#FFB347';
    ctx.beginPath();
    ctx.moveTo(size * 0.7, -size * 0.32);
    ctx.lineTo(size * 0.95, -size * 0.28);
    ctx.lineTo(size * 0.7, -size * 0.24);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(size * 0.55, -size * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(size * 0.57, -size * 0.35, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#3D5A3A';
    ctx.beginPath();
    ctx.ellipse(-size * 0.1, -size * 0.05, size * 0.35, size * 0.2, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // === CROSSHAIR / CURSOR ===

  function drawCrosshair(x, y, pinching = false, size = 30) {
    ctx.save();
    ctx.translate(x, y);

    const color = pinching ? PAL.red : PAL.honeyLight;
    const t = Date.now() * 0.003;

    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines
    const gap = size * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(0, -gap);
    ctx.moveTo(0, gap); ctx.lineTo(0, size);
    ctx.moveTo(-size, 0); ctx.lineTo(-gap, 0);
    ctx.moveTo(gap, 0); ctx.lineTo(size, 0);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, pinching ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();

    // Pinch indicator
    if (pinching) {
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size + 8 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // === UI TEXT ===

  function drawTitle(text, y = null, size = 72, color = PAL.honeyLight) {
    if (y === null) y = H * 0.2;
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, W / 2 + 3, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function drawSubtitle(text, y = null, size = 36, color = PAL.cream) {
    if (y === null) y = H * 0.32;
    ctx.fillStyle = color;
    ctx.font = `${size}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  }

  function drawBigButton(text, x, y, w, h, highlighted = false) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (highlighted) {
      grad.addColorStop(0, PAL.honey);
      grad.addColorStop(1, PAL.honeyDark);
    } else {
      grad.addColorStop(0, PAL.wood);
      grad.addColorStop(1, PAL.woodDark);
    }

    // Button body
    ctx.fillStyle = grad;
    roundRect(x, y, w, h, 15);
    ctx.fill();

    // Border
    ctx.strokeStyle = highlighted ? PAL.honeyLight : PAL.honeyDark;
    ctx.lineWidth = 3;
    roundRect(x, y, w, h, 15);
    ctx.stroke();

    // Text
    ctx.fillStyle = PAL.white;
    ctx.font = `bold 36px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawTimer(timeLeft, maxTime, x = W - 120, y = 60) {
    const pct = timeLeft / maxTime;
    const color = pct > 0.3 ? PAL.honey : PAL.red;

    // Background circle
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, 35, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, 35, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Time text
    ctx.fillStyle = color;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(timeLeft), x, y);
  }

  function drawScore(score, label, x = 120, y = 60) {
    ctx.fillStyle = PAL.honeyLight;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score, x, y);

    ctx.fillStyle = PAL.cream;
    ctx.font = '18px sans-serif';
    ctx.fillText(label, x, y + 30);
  }

  function drawProgressBar(x, y, w, h, progress, color = PAL.honey) {
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(x, y, w, h, h / 2);
    ctx.fill();

    // Fill
    if (progress > 0) {
      ctx.fillStyle = color;
      roundRect(x + 2, y + 2, (w - 4) * Math.min(1, progress), h - 4, (h - 4) / 2);
      ctx.fill();
    }
  }

  // === CAMERA FEED OVERLAY ===

  function drawCameraPreview(videoEl, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    // Mirror the camera feed
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, w, h);
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  // === ANTLERS (ROGI) ===

  function drawAntlers(x, y, size = 40) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = PAL.brown;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Left antler
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-size * 0.6, -size * 0.8, -size * 0.3, -size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.45, -size * 0.6);
    ctx.quadraticCurveTo(-size * 0.8, -size * 0.9, -size * 0.7, -size * 1.1);
    ctx.stroke();

    // Right antler
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(size * 0.6, -size * 0.8, size * 0.3, -size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.45, -size * 0.6);
    ctx.quadraticCurveTo(size * 0.8, -size * 0.9, size * 0.7, -size * 1.1);
    ctx.stroke();

    ctx.restore();
  }

  // === FLOATING BEES (ambient) ===

  const ambientBees = [];
  for (let i = 0; i < 8; i++) {
    ambientBees.push({
      x: Math.random(), y: Math.random() * 0.5 + 0.1,
      vx: (Math.random() - 0.5) * 0.0005,
      vy: (Math.random() - 0.5) * 0.0003,
      size: 12 + Math.random() * 10,
      phase: Math.random() * 100
    });
  }

  function drawAmbientBees() {
    const t = Date.now() * 0.001;
    for (const b of ambientBees) {
      b.x += b.vx + Math.sin(t + b.phase) * 0.0002;
      b.y += b.vy + Math.cos(t * 0.7 + b.phase) * 0.0001;
      if (b.x < -0.05) b.x = 1.05;
      if (b.x > 1.05) b.x = -0.05;
      if (b.y < 0.05) b.vy = Math.abs(b.vy);
      if (b.y > 0.55) b.vy = -Math.abs(b.vy);

      drawBee(b.x * W, b.y * H, b.size, t + b.phase);
    }
  }

  // Helpers
  function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  return {
    init, clear, resize, PAL,
    drawMeadowBg, drawBeehive, drawBee, drawAmbientBees,
    drawHoneyFrame, drawSpinner, drawDuck,
    drawCrosshair, drawAntlers,
    drawTitle, drawSubtitle, drawBigButton,
    drawTimer, drawScore, drawProgressBar,
    drawCameraPreview, drawFlower,
    pointInRect, roundRect,
    get ctx() { return ctx; },
    get W() { return W; },
    get H() { return H; }
  };
})();
