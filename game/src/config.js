// Ridgeline Courier — shared constants. One clear job: every number the game tunes lives here.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;
export const FOCAL = 540;
export const HORIZON_Y = 352;
export const MAX_SPEED = 92; // m/s at full throttle, level flight
export const MIN_SPEED = 18; // m/s, below this the plane stalls and sinks
export const MAX_CLIMB = 14; // m/s at best climb
export const MAX_DESCENT = 18; // m/s
export const TURN_RATE = 0.55; // rad/s of heading per unit bank
export const MAX_BANK = 0.9; // rad
export const CORRIDOR = 170; // metres either side of the route centreline
export const CEILING = 420; // metres
export const VIEW_AHEAD = 950; // metres of terrain drawn ahead
export const RUNWAY_LENGTH = 620;
export const FUEL_BURN = 0.55; // fuel units per second at full throttle
export const RING_SCORE = 250;
export const DROP_SCORE = 400;
export const LANDING_SCORE = 500;

// Screens the game can show.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

// Three sorties, one engine: different goals, light, fuel and weather.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tag: 'Dawn Valley',
    seed: 11,
    tod: 'day',
    fuel: 100,
    rings: 8,
    drops: 0,
    wind: 0,
    blurb: 'Thread 8 golden rings down the valley, then put her down on the strip.',
  },
  {
    id: 'river-drop',
    name: 'River Drop',
    tag: 'Supply Run',
    seed: 47,
    tod: 'day',
    fuel: 100,
    rings: 4,
    drops: 3,
    wind: 0,
    blurb: 'Follow the river, drop supplies on the three smoke-marked clearings.',
  },
  {
    id: 'dusk-landing',
    name: 'Dusk Landing',
    tag: 'Last Light',
    seed: 83,
    tod: 'dusk',
    fuel: 48,
    rings: 3,
    drops: 0,
    wind: 6,
    blurb: 'Low fuel, fading light, a crosswind off the ridge. Land her clean.',
  },
];

export const PALETTES = {
  day: {
    skyTop: '#2f6fd0',
    skyMid: '#7fb2e8',
    skyLow: '#cfe6f7',
    sun: '#fff3c4',
    far: '#8fa8c8',
    near: '#6f8fb5',
    groundLow: '#5d8a4a',
    groundMid: '#7ba05b',
    groundHigh: '#8a7a5e',
    snow: '#eef3f6',
    river: '#3f7fc4',
    runway: '#3c4148',
    hud: '#ffd27a',
    hudDim: '#bfe3ff',
  },
  dusk: {
    skyTop: '#2c2350',
    skyMid: '#b35a6e',
    skyLow: '#f2a35e',
    sun: '#ffb347',
    far: '#7a5a7d',
    near: '#5e4666',
    groundLow: '#4a5a3a',
    groundMid: '#5f6b45',
    groundHigh: '#6e5a44',
    snow: '#d9c9c2',
    river: '#7a5a8f',
    runway: '#33363d',
    hud: '#ffb347',
    hudDim: '#e8c9ff',
  },
};
