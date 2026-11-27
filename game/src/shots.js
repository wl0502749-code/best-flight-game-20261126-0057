// Ridgeline Courier — screenshot scenes. One clear job: stage the three frames the
// entry hands in (?shot=start|play|end), by flying the real rules forward from a fresh
// world with a simple autopilot, so each shot is what the game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, clamp, createWorld, nextTarget, resetWorld, stepWorld } from './world.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/** Steer at the next objective: the next ring, the nearest open drop zone, or the strip. */
export function autopilot(world, careful = false) {
  const st = world.state;
  let target = nextTarget(world);
  for (const zone of world.drops) {
    if (!zone.done && zone.s > st.s && zone.s < st.s + 400 && (!target || zone.s < target.s)) {
      target = { kind: 'drop', s: zone.s, x: zone.x, y: 80, r: 30 };
    }
  }
  const ds = Math.max(20, target.s - st.s);
  const wantHeading = Math.atan2(target.x - st.x, ds);
  const turn = clamp((wantHeading - st.heading) * (careful ? 3.2 : 2.4), -1, 1);
  let wantY = target.kind === 'runway' ? (ds < 150 ? 0.5 : Math.max(4, Math.min(40, ds * 0.06))) : target.y;
  // Terrain-aware floor: never plan a height the ridge ahead does not allow. Only
  // on short final, over the graded strip, may the floor drop to the runway itself.
  const groundAhead = world.groundHeight(st.s + 120, st.x);
  const nearStrip = target.kind === 'runway' && ds < 250;
  const floor = nearStrip ? groundAhead + 0.5 : groundAhead + 12;
  wantY = Math.max(wantY, floor);
  let pitch = clamp((wantY - st.y) / 26, -1, 1);
  // On final, trade speed for a gentle descent and keep the nose on the centreline.
  let throttle = 0;
  if (target.kind === 'runway' && ds < 700) {
    throttle = st.speed > 46 ? -1 : 0.4;
    pitch = clamp((wantY - st.y) / 12, -1, 0.5);
  } else if (st.speed > 78) {
    throttle = -0.6;
  } else if (st.speed < 52) {
    throttle = 0.8;
  }
  const drop =
    target.kind === 'drop' && Math.abs(st.s - target.s) < 70 && Math.abs(st.x - target.x) < 26 && st.y < 130;
  return { turn, pitch, throttle, drop };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(world, { turn: 0, pitch: 0, throttle: 0, drop: false });
    return { screen: 'title', best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const careful = name === 'end';
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = stepWorld(world, autopilot(world, careful));
    if (events & EVENT_OVER) break;
  }
  const st = world.state;
  if (name === 'end' && st.status !== 'landed') {
    // A hurried pilot can still bin it; the end frame is the landing, so fly the
    // approach again, slower and straighter, from a fresh world.
    resetWorld(world);
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const events = stepWorld(world, autopilot(world, true));
      if (events & EVENT_OVER) break;
    }
  }
  if (world.state.status === 'landed') return { screen: 'done', best: world.state.score };
  if (world.state.status === 'crashed') return { screen: 'over', best: world.state.score };
  return { screen: 'play', best: world.state.score };
}

export { createWorld, SAMPLE };
