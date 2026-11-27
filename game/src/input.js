// Ridgeline Courier — keyboard and mouse. One clear job: turn keys and the pointer
// into the { turn, pitch, throttle, drop } the flight model eats, and report the
// one-shot actions (pause, restart, mission pick, drop) the shell acts on.
export function createInput(canvas) {
  const keys = new Set();
  const input = { turn: 0, pitch: 0, throttle: 0, drop: false };
  const actions = { pause: false, restart: false, mission: -1, mute: false, clicked: null };
  let mouseY = null;
  let mouseDown = false;

  function key(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = key(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'p' || k === 'Escape') actions.pause = true;
    if (k === 'r') actions.restart = true;
    if (k === 'm') actions.mute = true;
    if (k === '1' || k === '2' || k === '3') actions.mission = Number(k) - 1;
    if (k === ' ') input.drop = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(key(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = (e.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('pointerdown', (e) => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    actions.clicked = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  /** Recompute the held controls from the keys and pointer. Call once a frame. */
  function poll() {
    const left = keys.has('ArrowLeft') || keys.has('a');
    const right = keys.has('ArrowRight') || keys.has('d');
    input.turn = (right ? 1 : 0) - (left ? 1 : 0);
    const up = keys.has('ArrowUp') || keys.has('w');
    const down = keys.has('ArrowDown') || keys.has('s');
    input.throttle = (up ? 1 : 0) - (down ? 1 : 0);
    // Pitch: mouse above centre climbs, below descends; Space climbs, C descends.
    let pitch = 0;
    if (mouseY !== null && mouseDown) pitch = (0.5 - mouseY) * 2;
    if (keys.has(' ')) pitch = 1;
    if (keys.has('c')) pitch = -1;
    input.pitch = Math.max(-1, Math.min(1, pitch));
    return { ...input };
  }

  /** Take and clear the one-shot actions queued since the last frame. */
  function takeActions() {
    const taken = { ...actions, clicked: actions.clicked };
    actions.pause = false;
    actions.restart = false;
    actions.mission = -1;
    actions.mute = false;
    actions.clicked = null;
    input.drop = false;
    return taken;
  }

  return { poll, takeActions };
}
