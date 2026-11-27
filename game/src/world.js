// Ridgeline Courier — the world and the flight model. One clear job: the valley, the
// route, the rings, the runway, and how the plane moves through them. Pure functions of
// (seed, distance, lateral) so a screenshot staged from a seed is always the same frame.
import {
  CEILING, CORRIDOR, FUEL_BURN, LANDING_SCORE, MAX_BANK, MAX_CLIMB, MAX_DESCENT,
  MAX_SPEED, MIN_SPEED, MISSIONS, RING_SCORE, DROP_SCORE, RUNWAY_LENGTH, STEP,
  TURN_RATE,
} from './config.js';
import { makeRng, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_DROP = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASH = 8;
export const EVENT_OVER = 16;

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** The river meanders across the valley floor. */
export function riverX(s) {
  return 62 * Math.sin(s * 0.0011 + 0.7) + 28 * Math.sin(s * 0.0029 + 2.1);
}

/**
 * Ground height in metres at route distance s and lateral offset x. A valley floor that
 * rises into ridges on both sides, with the river carving a dip. Seeded ridge phases
 * keep every mission's valley distinct but fixed.
 */
export function makeGround(phases, runwayS = Infinity) {
  return function groundHeight(s, x) {
    const ax = Math.abs(x);
    const valley = 6 * Math.sin(s * 0.004 + phases[0]) + 4 * Math.sin(s * 0.011 + phases[1]);
    const ridgeRaw =
      46 * Math.pow(Math.max(0, (ax - 90) / 120), 1.6) * (0.75 + 0.25 * Math.sin(s * 0.0016 + phases[2])) +
      26 * Math.pow(Math.max(0, (ax - 55) / 120), 2) * (0.6 + 0.4 * Math.sin(s * 0.0031 + phases[3] + ax * 0.004));
    // Saturate: the valley walls rise to real mountains, never to skyscrapers.
    const ridge = (110 * ridgeRaw) / (ridgeRaw + 110);
    const riverDip = 5 * Math.exp(-Math.pow((x - riverX(s)) / 16, 2));
    const bumps = 2.2 * Math.sin(s * 0.021 + x * 0.05 + phases[4]);
    let height = Math.max(0, valley + ridge - riverDip + bumps);
    // The strip is graded flat: blend the ground to zero across the runway.
    if (s > runwayS - 60 && s < runwayS + RUNWAY_LENGTH + 60 && ax < 70) {
      const edge = Math.min(1, Math.min(s - (runwayS - 60), runwayS + RUNWAY_LENGTH + 60 - s) / 60, (70 - ax) / 20);
      height *= 1 - Math.max(0, Math.min(1, edge));
    }
    return height;
  };
}

/** Build the ring course for a mission: golden hoops strung down the valley. */
export function buildRings(mission, groundHeight) {
  const rings = [];
  const start = 700;
  const end = 700 + mission.rings * 520;
  for (let i = 0; i < mission.rings; i += 1) {
    const s = start + i * 520 + (i % 2 === 0 ? 40 : -30);
    const x = clamp(58 * Math.sin(i * 1.35 + mission.seed), -95, 95);
    const ground = groundHeight(s, x);
    rings.push({ s, x, y: ground + 42 + (i % 3) * 14, r: 26, passed: false, missed: false });
  }
  return { rings, runwayS: end + 620 };
}

/** Build the supply-drop clearings for the river mission, on the river bank. */
export function buildDrops(mission) {
  const zones = [];
  for (let i = 0; i < mission.drops; i += 1) {
    const s = 1500 + i * 900;
    zones.push({ s, x: riverX(s) + 42, done: false, smoked: false });
  }
  return zones;
}

/** A fresh, seeded world for one mission. */
export function createWorld(missionIndex) {
  const mission = MISSIONS[missionIndex] ?? MISSIONS[0];
  const rng = makeRng(mission.seed * 7919 + 13);
  const phases = [range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28)];
  const runwayS = 700 + mission.rings * 520 + 620;
  const groundHeight = makeGround(phases, runwayS);
  const { rings } = buildRings(mission, groundHeight);
  const drops = buildDrops(mission);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      s: range(rng, 200, 7000),
      x: range(rng, -420, 420),
      y: range(rng, 150, 330),
      r: range(rng, 26, 70),
      speed: range(rng, 0.4, 1.1),
    });
  }
  return {
    mission,
    missionIndex,
    groundHeight,
    rings,
    runwayS,
    drops,
    clouds,
    state: freshState(mission),
  };
}

/** The plane's live state at the start of a sortie. */
export function freshState(mission) {
  return {
    s: 0,
    x: 0,
    y: 34,
    heading: 0,
    bank: 0,
    pitch: 0,
    speed: 42,
    throttle: 0.62,
    fuel: mission.fuel,
    score: 0,
    ringIndex: 0,
    ringsHit: 0,
    dropsDone: 0,
    time: 0,
    status: 'flying', // flying | landed | crashed | done
    reason: '',
    message: '',
    messageAt: 0,
    flare: 0,
    landedSoft: false,
  };
}

/** Reset a world to the start of its mission. */
export function resetWorld(world) {
  const fresh = createWorld(world.missionIndex);
  world.groundHeight = fresh.groundHeight;
  world.rings = fresh.rings;
  world.runwayS = fresh.runwayS;
  world.drops = fresh.drops;
  world.clouds = fresh.clouds;
  world.state = freshState(world.mission);
}

/** Distance from the plane to the next ring, or to the runway when the rings are done. */
export function nextTarget(world) {
  const st = world.state;
  if (st.ringIndex < world.rings.length) return { kind: 'ring', ...world.rings[st.ringIndex] };
  return { kind: 'runway', s: world.runwayS + RUNWAY_LENGTH / 2, x: 0, y: 6, r: 40 };
}

function announce(world, text) {
  world.state.message = text;
  world.state.messageAt = world.state.time;
}

/**
 * One fixed physics step. `input` is { turn: -1..1, pitch: -1..1, throttle: -1..1,
 * drop: bool }. Returns an event bitmask. Deterministic: no wall clock, no Math.random.
 */
export function stepWorld(world, input, dt = STEP) {
  const st = world.state;
  if (st.status !== 'flying') return EVENT_NONE;
  let events = EVENT_NONE;
  st.time += dt;

  // Throttle: Up/Down eases it toward full or idle; fuel burns with throttle.
  st.throttle = clamp(st.throttle + (input.throttle ?? 0) * dt * 0.55, 0, 1);
  if (st.fuel <= 0) st.throttle = 0;
  st.fuel = Math.max(0, st.fuel - st.throttle * FUEL_BURN * dt * (world.mission.fuel / 100));

  // Speed chases the throttle, helped downhill and hurt uphill; never below a crawl.
  const targetSpeed = 12 + st.throttle * (MAX_SPEED - 12);
  const climbCost = st.pitch > 0 ? st.pitch * 22 : 0;
  const diveGain = st.pitch < 0 ? -st.pitch * 14 : 0;
  st.speed += clamp(targetSpeed + diveGain - climbCost - st.speed, -26 * dt, 26 * dt);
  if (st.speed < MIN_SPEED) st.speed = Math.max(8, st.speed - 6 * dt);

  // Bank, heading and the crosswind of the dusk sortie.
  const wantBank = clamp((input.turn ?? 0) * MAX_BANK, -MAX_BANK, MAX_BANK);
  st.bank += clamp(wantBank - st.bank, -2.4 * dt, 2.4 * dt);
  st.heading += st.bank * TURN_RATE * dt * (0.55 + 0.45 * (st.speed / MAX_SPEED));
  st.heading = clamp(st.heading, -0.85, 0.85);
  const windPush = world.mission.wind * Math.sin(st.time * 0.4) * 0.4;
  st.x += (Math.sin(st.heading) * st.speed + windPush) * dt;
  st.s += Math.cos(st.heading) * st.speed * dt;
  st.x = clamp(st.x, -CORRIDOR, CORRIDOR);

  // Pitch: climb bleeds speed, descent buys it; the ceiling is a hard lid.
  st.pitch = clamp(input.pitch ?? 0, -1, 1);
  const climb = st.pitch * (st.pitch > 0 ? MAX_CLIMB : MAX_DESCENT) * (0.45 + 0.55 * (st.speed / MAX_SPEED));
  st.y += climb * dt;
  if (st.speed < MIN_SPEED && st.pitch <= 0) st.y -= (MIN_SPEED - st.speed) * 0.5 * dt;
  st.y = clamp(st.y, 0, CEILING);

  // Terrain: kiss the ridge and the sortie is over.
  const ground = world.groundHeight(st.s, st.x);
  const onRunway = st.s >= world.runwayS && st.s <= world.runwayS + RUNWAY_LENGTH && Math.abs(st.x) < 42;
  if (st.y <= ground + 1.2 && !onRunway) {
    st.status = 'crashed';
    st.reason = st.y <= 2 ? 'You flew into the valley floor.' : 'You clipped the ridge.';
    return EVENT_CRASH | EVENT_OVER;
  }
  if (st.y <= 1.2 && onRunway) {
    return land(world, ground);
  }

  // Rings: fly the hoop, don't just fly past it.
  const ring = world.rings[st.ringIndex];
  if (ring && st.s >= ring.s) {
    const dx = st.x - ring.x;
    const dy = st.y - ring.y;
    if (Math.hypot(dx, dy) < ring.r) {
      ring.passed = true;
      st.ringsHit += 1;
      st.score += RING_SCORE;
      announce(world, `Ring ${st.ringsHit} of ${world.rings.length} — clean! +${RING_SCORE}`);
      events |= EVENT_RING;
    } else {
      ring.missed = true;
      announce(world, 'Ring missed — stay on the line.');
    }
    st.ringIndex += 1;
    if (st.ringIndex >= world.rings.length && world.drops.length === 0) {
      announce(world, 'Course clear — bring her home to the strip.');
    }
  }

  // Supply drops: Space over a smoke-marked clearing.
  if (input.drop) {
    for (const zone of world.drops) {
      if (!zone.done && Math.abs(st.s - zone.s) < 90 && Math.abs(st.x - zone.x) < 30 && st.y < 130) {
        zone.done = true;
        st.dropsDone += 1;
        st.score += DROP_SCORE;
        announce(world, `Supplies away — clearing ${st.dropsDone} of ${world.drops.length} fed. +${DROP_SCORE}`);
        events |= EVENT_DROP;
        break;
      }
    }
  }

  // Out of fuel over rough ground: glide, don't fall out of the sky at once.
  if (st.fuel <= 0 && st.message === '') announce(world, 'Fuel empty — glide her to the strip.');
  return events;
}

/** Touch down on the runway: soft and slow scores, hot and hard ends the sortie. */
function land(world, ground) {
  const st = world.state;
  const verticalSpeed = st.pitch * MAX_DESCENT;
  const aligned = Math.abs(st.x) < 30 && Math.abs(st.heading) < 0.3;
  if (st.speed > 62 || verticalSpeed < -9 || !aligned) {
    st.status = 'crashed';
    st.reason = st.speed > 62 ? 'Too fast for the strip — she ran off the end.' : 'Too steep — the gear folded.';
    return EVENT_CRASH | EVENT_OVER;
  }
  st.status = 'landed';
  st.landedSoft = st.speed < 48 && verticalSpeed > -5;
  st.y = ground + 0.4;
  st.speed = Math.max(0, st.speed - 30);
  const fuelBonus = Math.round(st.fuel * 5);
  const softBonus = st.landedSoft ? 150 : 0;
  st.score += LANDING_SCORE + fuelBonus + softBonus;
  announce(world, `Down safe. Landing +${LANDING_SCORE}, fuel +${fuelBonus}${softBonus ? `, greaser +${softBonus}` : ''}`);
  return EVENT_LANDED | EVENT_OVER;
}
