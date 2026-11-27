// Ridgeline Courier — camera and projection. One clear job: turn world metres into
// screen pixels for the chase camera that rides behind the plane.
import { FOCAL, HORIZON_Y, VIEW_H, VIEW_W } from './config.js';

/** The chase camera: a little behind and above the plane, looking down the route. */
export function cameraFor(state) {
  return { s: state.s - 16, x: state.x * 0.92, y: state.y + 7 };
}

/**
 * Project a world point to the screen. Returns null when the point is behind the
 * camera or too close to draw. Screen x centres on the plane, screen y puts the
 * horizon at HORIZON_Y plus a little pitch feel.
 */
export function project(cam, s, x, y, pitch = 0) {
  const dz = s - cam.s;
  if (dz < 2) return null;
  const scale = FOCAL / dz;
  return {
    x: VIEW_W / 2 + (x - cam.x) * scale,
    y: HORIZON_Y - (y - cam.y) * scale + pitch * 26,
    scale,
    dz,
  };
}

/** Is a screen point inside the canvas with a little margin? */
export function onScreen(p, margin = 80) {
  return p !== null && p.x > -margin && p.x < VIEW_W + margin && p.y > -margin && p.y < VIEW_H + margin;
}

/** A compass heading in degrees from the route-relative heading in radians. */
export function headingDegrees(heading) {
  return ((heading * 180) / Math.PI + 360) % 360;
}

/** Format a heading as a three-digit compass bearing. */
export function headingText(heading) {
  return String(Math.round(headingDegrees(heading))).padStart(3, '0');
}

/** Metres to feet, for the altimeter. */
export function metresToFeet(m) {
  return Math.round(m * 3.28084);
}

/** Metres per second to knots, for the airspeed indicator. */
export function msToKnots(ms) {
  return Math.round(ms * 1.94384);
}
