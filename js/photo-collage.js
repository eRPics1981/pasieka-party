/* Pamiątkowe zdjęcie drużyny, rysowane bezpośrednio na canvasie gry. */
window.PhotoCollage = (function () {
  'use strict';

  let canvas = null;
  let ctx = null;
  let startedAt = 0;
  let captured = false;
  let entries = [];
  function init() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  }

  function begin(results) {
    entries = results;
    startedAt = performance.now();
    captured = false;
  }

  function drawLogo(context, x, y, size) {
    context.save();
    context.translate(x, y);
    context.scale(size / 80, size / 80);
    context.fillStyle = 'rgba(255,245,220,0.96)';
    context.beginPath();
    context.arc(0, 0, 47, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(135,206,235,0.8)';
    context.beginPath();
    context.ellipse(-10, -17, 13, 8, -0.55, 0, Math.PI * 2);
    context.ellipse(10, -17, 13, 8, 0.55, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd700';
    context.beginPath();
    context.ellipse(0, 3, 18, 25, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2c2c2c';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(-15, -5); context.lineTo(15, -5);
    context.moveTo(-17, 7); context.lineTo(17, 7);
    context.stroke();
    context.fillStyle = '#2c2c2c';
    context.beginPath();
    context.arc(-6, -1, 2, 0, Math.PI * 2);
    context.arc(6, -1, 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawResults(context, width, height) {
    const panelHeight = Math.min(height * 0.48, 390);
    const panelY = height - panelHeight - height * 0.045;
    context.fillStyle = 'rgba(26, 10, 0, 0.76)';
    context.beginPath();
    context.roundRect(width * 0.08, panelY, width * 0.84, panelHeight, 24);
    context.fill();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffd78a';
    context.font = 'bold 36px Segoe UI, Arial, sans-serif';
    context.fillText('PASIĘCZNA EKIPA', width / 2, panelY + 42);
    drawLogo(context, width / 2, panelY - 30, 76);

    const lineHeight = Math.min(44, (panelHeight - 78) / Math.max(entries.length, 1));
    entries.forEach(function (entry, index) {
      const y = panelY + 88 + index * lineHeight;
      context.fillStyle = index === 0 ? '#ffd700' : '#fff5dc';
      context.font = 'bold 23px Segoe UI, Arial, sans-serif';
      const label = (index + 1) + '. ' + entry.name + '  ·  ' + entry.score + ' pkt' + (entry.title ? '  ·  ' + entry.title : '');
      context.fillText(label, width / 2, y, width * 0.78);
    });
    context.fillStyle = '#fff5dc';
    context.font = '18px Segoe UI, Arial, sans-serif';
    context.fillText('Pasieka Party', width / 2, height - 24);
  }

  function draw(gameCanvas, video, gfx) {
    try {
      if (!gameCanvas || !gfx || !gfx.ctx) return false;
      if (!canvas || !ctx) init();
    const stream = video && video.srcObject;
    const cameraReady = !!video && video.readyState >= 2 && video.videoWidth > 0 &&
      video.videoHeight > 0 && !!stream;
    const width = gfx.W;
    const height = gfx.H;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!captured) {
      gfx.drawMeadowBg();
      const elapsed = performance.now() - startedAt;
      const count = 3 - Math.floor(elapsed / 1000);
      if (count > 0) {
        const context = gfx.ctx;
        context.save();
        context.fillStyle = 'rgba(26, 10, 0, 0.36)';
        context.fillRect(0, 0, width, height);
        gfx.drawTitle(String(count), height * 0.48, Math.min(180, height * 0.25), '#fff5dc');
        context.restore();
        return false;
      }

      // A live camera frame is used only when it has decoded image data.
      if (cameraReady) {
        const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
        const sw = width / scale;
        const sh = height / scale;
        gfx.ctx.save();
        gfx.ctx.translate(width, 0);
        gfx.ctx.scale(-1, 1);
        gfx.ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, width, height);
        gfx.ctx.restore();
      } else {
        // drawMeadowBg supplies the requested meadow-only fallback.
        gfx.drawMeadowBg();
      }
      ctx.drawImage(gameCanvas, 0, 0, width, height);
      drawResults(ctx, width, height);
      captured = true;
    }

    gfx.ctx.drawImage(canvas, 0, 0, width, height);
    gfx.drawBigButton('POBIERZ ZDJĘCIE', width / 2 - 190, height * 0.84, 380, 68, true);
    gfx.drawSubtitle('Kliknij, aby pobrać pamiątkę PNG', height * 0.94, 18);
      return true;
    } catch (error) {
      console.warn('Kolaż zdjęć pominięty: kamera jest niedostępna.', error);
      return false;
    }
  }

  function download() {
    if (!captured || !canvas) return;
    const link = document.createElement('a');
    link.download = 'pasieka-party-pamiatka.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { init: init, begin: begin, draw: draw, download: download };
}());
