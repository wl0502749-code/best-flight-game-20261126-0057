// Ridgeline Courier — the shell. One clear job: own the canvas, the screen state, the
// frame loop and the ?shot= staging, and wire input, audio, world and render together.
import { MISSIONS, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, STEP, VIEW_H, VIEW_W } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { autopilot, stageShot } from './shots.js';
import { EVENT_CRASH, EVENT_LANDED, EVENT_RING, EVENT_DROP, clamp, createWorld, resetWorld, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') ?? 1);

const input = createInput(canvas);
const audio = createAudio();
let missionIndex = 0;
let world = createWorld(missionIndex);
let screen = SCREEN_TITLE;
let best = loadBest();
let muted = false;
let shotStaged = false;

function loadBest() {
  try {
    return Number(window.localStorage.getItem('ridgeline-courier-best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('ridgeline-courier-best', String(value));
  } catch {
    // Private mode or a host that blocks storage: the score still shows this run.
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Start the chosen mission from the top of the valley. */
function startMission(index) {
  missionIndex = clamp(index, 0, MISSIONS.length - 1);
  world = createWorld(missionIndex);
  screen = SCREEN_PLAY;
  announce(`${world.mission.name}: ${world.mission.blurb}`);
}

/** The title screen's mission cards, in canvas pixels. */
function missionCardAt(x, y) {
  if (y < 230 || y > 380) return -1;
  for (let i = 0; i < MISSIONS.length; i += 1) {
    const cx = 200 + i * 300;
    if (x >= cx - 130 && x <= cx + 130) return i;
  }
  return -1;
}

function handleActions(actions) {
  if (actions.mute) {
    muted = !muted;
    audio.setMuted(muted);
  }
  if (actions.mission >= 0) startMission(actions.mission);
  if (actions.restart) {
    resetWorld(world);
    screen = SCREEN_PLAY;
    announce('Sortie restarted.');
  }
  if (actions.pause && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
    screen = screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
  }
  if (actions.clicked && screen === SCREEN_TITLE) {
    const picked = missionCardAt(actions.clicked.x * VIEW_W, actions.clicked.y * VIEW_H);
    if (picked >= 0) startMission(picked);
  }
}

/** One live frame: read the controls, step the world, draw it. */
function frame(now, last) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  const held = input.poll();
  const actions = input.takeActions();
  audio.ensure();
  handleActions(actions);

  if (screen === SCREEN_TITLE) {
    // Attract mode: the Kestrel flies herself behind the menu; bin it and she resets.
    const events = stepWorld(world, autopilot(world));
    if (events & (EVENT_CRASH | EVENT_LANDED)) resetWorld(world);
  } else if (screen === SCREEN_PLAY) {
    const events = stepWorld(world, held, dt);
    audio.engine(world.state.throttle, dt);
    if (events & EVENT_RING) audio.chime(660);
    if (events & EVENT_DROP) audio.chime(520);
    if (events & EVENT_LANDED) audio.chime(880);
    if (events & EVENT_CRASH) audio.thud();
    if (world.state.status === 'landed') {
      screen = SCREEN_DONE;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Mission complete. Score ${world.state.score}.`);
    } else if (world.state.status === 'crashed') {
      screen = SCREEN_OVER;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Sortie lost. ${world.state.reason}`);
    }
  }
  render(ctx, world, screen, best, world.state.time);
}

/** The deterministic screenshot path: stage once, draw once, say ready. */
function shotFrame() {
  if (shotStaged) return;
  shotStaged = true;
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  render(ctx, world, screen, best, world.state.time);
  window.__shotReady = true;
  document.title = `Ridgeline Courier — ${shotName ?? 'start'} shot`;
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}

window.addEventListener('resize', fitCanvas);
fitCanvas();
announce('Ridgeline Courier. Pick a mission to fly.');

if (shotName) {
  // Screenshots never wait on a frame loop: draw the staged frame at once.
  if (document.readyState === 'complete') shotFrame();
  else window.addEventListener('load', shotFrame);
} else {
  let last = performance.now();
  const loop = (now) => {
    frame(now, last);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
