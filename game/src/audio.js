// Ridgeline Courier — sound, generated not shipped. One clear job: a WebAudio engine
// hum that follows the throttle, plus chimes for rings, drops and landings. No audio
// files, no network, and silent until the player first touches the game.
export function createAudio() {
  let ctx = null;
  let hum = null;
  let humGain = null;
  let muted = false;

  /** Start the audio graph on the first user gesture. Safe to call repeatedly. */
  function ensure() {
    if (ctx || muted) return;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      hum = ctx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      humGain = ctx.createGain();
      humGain.gain.value = 0.0;
      hum.connect(filter);
      filter.connect(humGain);
      humGain.connect(ctx.destination);
      hum.start();
    } catch {
      ctx = null;
    }
  }

  /** Follow the throttle: louder and higher as the engine works harder. */
  function engine(throttle, dt) {
    if (!ctx || !hum || muted) return;
    const target = 0.02 + throttle * 0.05;
    humGain.gain.setTargetAtTime(target, ctx.currentTime, dt);
    hum.frequency.setTargetAtTime(48 + throttle * 70, ctx.currentTime, dt);
  }

  /** A short two-note chime for a ring or a drop. */
  function chime(freq = 660) {
    if (!ctx || muted) return;
    for (const [at, f] of [[0, freq], [0.09, freq * 1.5]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.16, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    }
  }

  /** A low thud for a crash, a warm chord for a landing. */
  function thud() {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  function setMuted(value) {
    muted = value;
    if (humGain) humGain.gain.value = 0;
  }

  return { ensure, engine, chime, thud, setMuted };
}
