// Synthesised sound, no files: a tiny WebAudio helper. Every effect is an
// oscillator or a noise buffer through a gain envelope, created lazily on the
// first user gesture (browsers block audio before one). M mutes.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; never break the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (muted) return;
    const c = ensure();
    if (!c || !noiseBuf) return;
    try {
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq || 3000;
      filter.Q.value = 0.8;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol || 0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start();
      src.stop(c.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; never break the game.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    place() { tone(520, 0.08, 'triangle', 0.1, 700); },
    prep() { noise(0.12, 0.1, 1800); },
    chop() { noise(0.07, 0.22, 900); tone(180, 0.06, 'square', 0.06, 120); },
    ready() { tone(880, 0.12, 'sine', 0.1, 1180); },
    serve() { tone(660, 0.1, 'triangle', 0.14); setTimeout(() => tone(990, 0.16, 'triangle', 0.14), 90); },
    expire() { tone(220, 0.3, 'sawtooth', 0.1, 110); },
    burn() { noise(0.3, 0.12, 500); },
    over() { tone(392, 0.25, 'triangle', 0.12, 330); setTimeout(() => tone(262, 0.4, 'triangle', 0.12), 220); },
  };
}
