(function () {
  "use strict";

  let context = null;

  function getContext() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    }
    if (context.state === "suspended") context.resume();
    return context;
  }

  function tone(frequency, durationMs, options = {}) {
    const ctx = getContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    const duration = durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.18, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function noise(durationMs, volume = 0.16, filterFrequency = 1400) {
    const ctx = getContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    const duration = durationMs / 1000;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration);
  }

  const SFX = {
    init() {
      return getContext();
    },
    beepGood() {
      tone(523.25, 100, { type: "sine", volume: 0.2 }); // C5
    },
    beepBad() {
      tone(130.81, 200, { type: "triangle", volume: 0.22 }); // C3
    },
    tick() {
      tone(1100, 50, { type: "square", volume: 0.1 });
    },
    fanfare() {
      tone(523.25, 180, { volume: 0.16 });
      setTimeout(() => tone(659.25, 180, { volume: 0.16 }), 170);
      setTimeout(() => tone(783.99, 320, { volume: 0.18 }), 340);
    },
    drumroll() {
      noise(500, 0.13, 4200);
      tone(90, 500, { type: "sawtooth", endFrequency: 180, volume: 0.07 });
    },
    splash() {
      noise(150, 0.2, 1800);
      tone(420, 150, { type: "sine", endFrequency: 110, volume: 0.12 });
    }
  };

  window.SFX = SFX;
})();
