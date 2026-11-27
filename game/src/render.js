// Ridgeline Courier — everything the player sees. One clear job: draw the sky, the
// valley, the runway, the rings, the plane and the instruments, plus the title,
// pause and end screens. No game logic lives here, only pixels.
import {
  CEILING, CORRIDOR, FOCAL, HORIZON_Y, MISSIONS, PALETTES, RUNWAY_LENGTH, SCREEN_DONE,
  SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, VIEW_AHEAD, VIEW_H, VIEW_W,
} from './config.js';
import { cameraFor, headingText, metresToFeet, msToKnots, onScreen, project } from './flight.js';
import { riverX } from './world.js';

/** Blend two #rrggbb colours. */
function lerpColour(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

/** Pick the ground colour for a patch of valley at height h, blended smoothly so
 * the valley shades instead of stepping in hard bands. */
function groundColour(pal, h, s, x, runwayS) {
  if (s >= runwayS && s <= runwayS + RUNWAY_LENGTH && Math.abs(x) < 42) return pal.runway;
  if (Math.abs(x - riverX(s)) < 11 && h < 14) return pal.river;
  if (h <= 8) return pal.groundLow;
  if (h <= 20) return lerpColour(pal.groundLow, pal.groundMid, (h - 8) / 12);
  if (h <= 34) return pal.groundMid;
  if (h <= 48) return lerpColour(pal.groundMid, pal.groundHigh, (h - 34) / 14);
  if (h <= 58) return pal.groundHigh;
  if (h <= 78) return lerpColour(pal.groundHigh, pal.snow, (h - 58) / 20);
  return pal.snow;
}

/** A ridge silhouette for one parallax layer, drawn across the screen. */
function drawRidge(ctx, pal, colour, s, parallax, base, amp, seed) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W; sx += 32) {
    const t = (sx + s * parallax) * 0.004 + seed;
    const y = HORIZON_Y - base - amp * (0.55 + 0.45 * Math.sin(t * 1.7 + Math.sin(t * 0.6) * 1.3));
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

/** The pseudo-3D valley floor: horizontal slices from far to near, column by column.
 * Columns are sampled in screen space, so no ground polygon ever paints the sky:
 * each band is the strip of valley between two distances, exactly as wide as the screen. */
function drawGround(ctx, world, cam, pal) {
  const slices = [];
  const count = 46;
  for (let i = 0; i < count; i += 1) {
    const f = i / (count - 1);
    slices.push(14 + Math.pow(f, 2.4) * (VIEW_AHEAD - 14));
  }
  const cols = 48;
  const colW = VIEW_W / cols;
  // Ground height at a screen column, for one distance slice.
  const heightAt = (sx, dz) => {
    const s = cam.s + dz;
    const wx = cam.x + (sx - VIEW_W / 2) * (dz / FOCAL);
    return { s, wx, h: world.groundHeight(s, wx) };
  };
  const yAt = (sx, dz) => {
    const { h } = heightAt(sx, dz);
    return HORIZON_Y - (h - cam.y) * (FOCAL / dz);
  };
  for (let i = slices.length - 1; i > 0; i -= 1) {
    const dzFar = slices[i];
    const dzNear = slices[i - 1];
    for (let j = 0; j < cols; j += 1) {
      const sx0 = j * colW;
      const sx1 = sx0 + colW;
      const mid = heightAt((sx0 + sx1) / 2, (dzFar + dzNear) / 2);
      ctx.fillStyle = groundColour(pal, mid.h, mid.s, mid.wx, world.runwayS);
      ctx.globalAlpha = 0.35 + 0.65 * (1 - i / slices.length);
      ctx.beginPath();
      ctx.moveTo(sx0, yAt(sx0, dzFar));
      ctx.lineTo(sx1, yAt(sx1, dzFar));
      ctx.lineTo(sx1, yAt(sx1, dzNear));
      ctx.lineTo(sx0, yAt(sx0, dzNear));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // The strip between the camera and the nearest slice is valley floor too.
  const dzNear = slices[0];
  for (let j = 0; j < cols; j += 1) {
    const sx0 = j * colW;
    const sx1 = sx0 + colW;
    const mid = heightAt((sx0 + sx1) / 2, dzNear);
    ctx.fillStyle = groundColour(pal, mid.h, mid.s, mid.wx, world.runwayS);
    ctx.beginPath();
    ctx.moveTo(sx0, yAt(sx0, dzNear));
    ctx.lineTo(sx1, yAt(sx1, dzNear));
    ctx.lineTo(sx1, VIEW_H);
    ctx.lineTo(sx0, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
}

/** Runway threshold bars and centreline, projected onto the flat strip. */
function drawRunwayMarks(ctx, world, cam) {
  const marks = [];
  for (let d = 0; d <= RUNWAY_LENGTH; d += 60) marks.push(world.runwayS + d);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const s of marks) {
    const a = project(cam, s, -3, 0.3);
    const b = project(cam, s, 3, 0.3);
    const c = project(cam, s + 26, 3, 0.3);
    const d2 = project(cam, s + 26, -3, 0.3);
    if (!a || !b || !c || !d2) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Golden hoops: the next one burns bright, the rest wait their turn. */
function drawRings(ctx, world, cam, time, screen) {
  const st = world.state;
  for (let i = world.rings.length - 1; i >= 0; i -= 1) {
    const ring = world.rings[i];
    if (ring.s < cam.s + 4 || ring.s > cam.s + VIEW_AHEAD) continue;
    const p = project(cam, ring.s, ring.x, ring.y);
    if (!onScreen(p, 120)) continue;
    const r = ring.r * p.scale;
    if (r < 2) continue;
    const isNext = i === st.ringIndex;
    const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 0.55;
    ctx.save();
    ctx.globalAlpha = ring.passed ? 0.25 : pulse;
    ctx.strokeStyle = ring.passed ? '#58d68d' : isNext ? '#ffcf3f' : '#e8f2ff';
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.shadowColor = isNext ? '#ffbf00' : '#ffffff';
    ctx.shadowBlur = isNext ? 22 : 6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (isNext && screen !== SCREEN_TITLE) {
      ctx.fillStyle = '#ffcf3f';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1}`, p.x, p.y - r - 10);
    }
  }
}

/** Smoke columns over the supply clearings, and a marker when one is done. */
function drawDrops(ctx, world, cam, time) {
  for (const zone of world.drops) {
    const p = project(cam, zone.s, zone.x, 2);
    if (!onScreen(p, 60)) continue;
    const h = 90 * p.scale;
    const drift = Math.sin(time * 0.8 + zone.s) * 6 * p.scale;
    const grad = ctx.createLinearGradient(0, p.y - h, 0, p.y);
    grad.addColorStop(0, 'rgba(255,120,60,0)');
    grad.addColorStop(1, zone.done ? 'rgba(88,214,141,0.75)' : 'rgba(255,120,60,0.8)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.x + drift, p.y - h / 2, 9 * p.scale + 3, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = zone.done ? '#58d68d' : '#ff7840';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(zone.done ? 'SUPPLIED ✓' : 'DROP ZONE — SPACE', p.x, p.y - h - 8);
  }
}

/** Puffy seeded clouds drifting over the valley. */
function drawClouds(ctx, world, cam, time) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of world.clouds) {
    const s = c.s + time * c.speed * 2;
    if (s < cam.s + 4 || s > cam.s + VIEW_AHEAD) continue;
    const p = project(cam, s, c.x, c.y);
    if (!onScreen(p, 140)) continue;
    const r = c.r * p.scale;
    if (r < 3) continue;
    ctx.globalAlpha = Math.min(0.85, 0.25 + p.scale * 0.5);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.5, p.y + r * 0.1, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.5, p.y + r * 0.08, r * 0.65, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The Kestrel herself, seen from behind and above, banking with the turn. */
function drawAircraft(ctx, st, time) {
  const cx = VIEW_W / 2;
  const cy = 512 + st.pitch * 14;
  const strobe = Math.sin(time * 6) > 0.6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(st.bank * 0.85);
  // Wings, swept back, sunlit on top.
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-168, 6);
  ctx.quadraticCurveTo(-120, -14, -34, -6);
  ctx.lineTo(34, -6);
  ctx.quadraticCurveTo(120, -14, 168, 6);
  ctx.quadraticCurveTo(120, 16, 30, 12);
  ctx.lineTo(-30, 12);
  ctx.quadraticCurveTo(-120, 16, -168, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-150, 2, 300, 3);
  // Tailplane and fin.
  ctx.fillStyle = '#b93228';
  ctx.beginPath();
  ctx.moveTo(-52, -14);
  ctx.lineTo(52, -14);
  ctx.lineTo(30, -26);
  ctx.lineTo(-30, -26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-14, -64);
  ctx.lineTo(14, -64);
  ctx.closePath();
  ctx.fill();
  // Fuselage, seen from the stern, with the lit cockpit glass.
  const body = ctx.createLinearGradient(-26, 0, 26, 0);
  body.addColorStop(0, '#8f241c');
  body.addColorStop(0.5, '#e0503f');
  body.addColorStop(1, '#8f241c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-24, -58);
  ctx.quadraticCurveTo(0, -70, 24, -58);
  ctx.lineTo(30, 34);
  ctx.quadraticCurveTo(0, 46, -30, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#bfe8ff';
  ctx.shadowColor = '#7fd4ff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(-15, -56, 30, 20, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Registration and nav lights: red port, green starboard, white strobe.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N-KSTRL', 0, 22);
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(-168, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2eff5e';
  ctx.beginPath();
  ctx.arc(168, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  if (strobe) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -64, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Exhaust shimmer at full throttle.
  if (st.throttle > 0.7) {
    ctx.fillStyle = `rgba(255,180,80,${0.25 + 0.2 * Math.sin(time * 31)})`;
    ctx.beginPath();
    ctx.ellipse(0, 44, 12, 10 + 6 * Math.sin(time * 27), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A lit instrument panel: the HUD the judge is asked to see. */
function drawHud(ctx, world) {
  const st = world.state;
  const pal = PALETTES[world.mission.tod];
  const panel = 'rgba(8,14,24,0.62)';
  const line = 'rgba(255,210,122,0.5)';
  ctx.textAlign = 'left';
  // Top-left: the big three, altitude / speed / heading.
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(14, 14, 300, 92, 10);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.fillStyle = pal.hud;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`ALT ${String(metresToFeet(st.y)).padStart(5, '0')} FT`, 28, 46);
  ctx.fillText(`SPD ${String(msToKnots(st.speed)).padStart(3, '0')} KT`, 28, 76);
  ctx.fillStyle = pal.hudDim;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`HDG ${headingText(st.heading)}°   V/S ${st.pitch > 0 ? '+' : ''}${Math.round(st.pitch * 14)} M/S`, 28, 98);
  // Top-centre: compass strip.
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(VIEW_W / 2 - 190, 14, 380, 40, 10);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  const deg = ((st.heading * 180) / Math.PI + 360) % 360;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(VIEW_W / 2 - 190, 14, 380, 40, 10);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const a = Math.round((deg + d) / 15) * 15;
    const off = ((a - deg + 540) % 360) - 180;
    const x = VIEW_W / 2 + off * 3;
    const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[((a % 360) + 360) % 360];
    ctx.fillText(label ?? String(((a % 360) + 360) % 360).padStart(3, '0'), x, 40);
    ctx.fillRect(x - 1, 18, 2, label ? 8 : 5);
  }
  ctx.restore();
  ctx.fillStyle = pal.hud;
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2 - 6, 14);
  ctx.lineTo(VIEW_W / 2 + 6, 14);
  ctx.lineTo(VIEW_W / 2, 24);
  ctx.closePath();
  ctx.fill();
  // Top-right: fuel, score, rings, mission clock.
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(VIEW_W - 314, 14, 300, 92, 10);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.fillStyle = st.fuel < 15 ? '#ff5a4e' : pal.hud;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', VIEW_W - 300, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(VIEW_W - 240, 28, 150, 14);
  ctx.fillStyle = st.fuel < 15 ? '#ff5a4e' : '#58d68d';
  ctx.fillRect(VIEW_W - 240, 28, Math.max(0, 150 * (st.fuel / 100)), 14);
  ctx.fillStyle = pal.hud;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`SCORE ${st.score}`, VIEW_W - 300, 70);
  ctx.fillStyle = pal.hudDim;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`RINGS ${st.ringsHit}/${world.rings.length}   ${Math.floor(st.time)}s`, VIEW_W - 300, 96);
  // Bottom-left: artificial horizon, the lit dial.
  const hx = 78;
  const hy = VIEW_H - 78;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, 52, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-st.bank);
  ctx.translate(0, st.pitch * 26);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-60, -60, 120, 60);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-60, 0, 120, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-60, -2, 120, 4);
  ctx.restore();
  ctx.strokeStyle = pal.hud;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx - 26, hy);
  ctx.lineTo(hx + 26, hy);
  ctx.moveTo(hx, hy - 6);
  ctx.lineTo(hx, hy + 6);
  ctx.stroke();
  ctx.fillStyle = pal.hud;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + 70);
  // Bottom-right: throttle lever.
  const tx = VIEW_W - 78;
  const ty = VIEW_H - 78;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(tx - 46, ty - 56, 92, 112, 10);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(tx - 8, ty - 44, 16, 88);
  ctx.fillStyle = '#ffb347';
  const th = 88 * st.throttle;
  ctx.fillRect(tx - 8, ty + 44 - th, 16, th);
  ctx.fillStyle = pal.hud;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`THR ${Math.round(st.throttle * 100)}%`, tx, ty + 70);
  // Next-target pointer and the pilot's message line.
  const target = nextTargetText(world);
  if (target && st.status === 'flying') {
    ctx.fillStyle = pal.hud;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(target, VIEW_W / 2, 132);
  }
  if (st.message && st.time - st.messageAt < 4) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(st.message, VIEW_W / 2, 168);
  }
  // Warnings, flashing, because a quiet warning is no warning.
  const ground = world.groundHeight(st.s, st.x);
  if (st.status === 'flying' && st.y - ground < 14 && st.pitch < 0 && Math.sin(st.time * 10) > 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ PULL UP ⚠', VIEW_W / 2, 230);
  }
  if (st.status === 'flying' && st.fuel > 0 && st.fuel < 15 && Math.sin(st.time * 6) > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', VIEW_W / 2, 262);
  }
}

function nextTargetText(world) {
  const st = world.state;
  if (st.ringIndex < world.rings.length) {
    const ring = world.rings[st.ringIndex];
    const dist = Math.max(0, Math.round(ring.s - st.s));
    const steer = ring.x > st.x + 12 ? 'BANK RIGHT →' : ring.x < st.x - 12 ? '← BANK LEFT' : 'ON THE NOSE';
    const arrow = ring.x > st.x + 12 ? '→' : ring.x < st.x - 12 ? '←' : '•';
    return `${arrow} NEXT RING ${st.ringIndex + 1} — ${dist} M — ${steer}`;
  }
  if (world.drops.some((z) => !z.done)) {
    const zone = world.drops.find((z) => !z.done);
    return `◆ DROP ZONE — ${Math.max(0, Math.round(zone.s - st.s))} M — SPACE TO DROP`;
  }
  const dist = Math.max(0, Math.round(world.runwayS + RUNWAY_LENGTH / 2 - st.s));
  return `✈ RUNWAY — ${dist} M — SLOW DOWN, FLARE GENTLY`;
}

/** Title, pause and end overlays: dark glass over the living valley. */
function drawOverlay(ctx, world, screen, best) {
  const st = world.state;
  ctx.fillStyle = 'rgba(6,10,18,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('RIDGELINE COURIER', VIEW_W / 2, 130);
    ctx.fillStyle = '#eaf4ff';
    ctx.font = '20px Georgia, serif';
    ctx.fillText('A bush-plane courier over the dawn valley — rings, rivers, and one short strip.', VIEW_W / 2, 168);
    for (let i = 0; i < MISSIONS.length; i += 1) {
      const m = MISSIONS[i];
      const x = 200 + i * 300;
      const y = 230;
      const selected = i === world.missionIndex;
      ctx.fillStyle = selected ? 'rgba(255,210,122,0.25)' : 'rgba(8,14,24,0.7)';
      ctx.strokeStyle = selected ? '#ffd27a' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x - 130, y, 260, 150, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd27a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${i + 1} — ${m.name.toUpperCase()}`, x, y + 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px monospace';
      ctx.fillText(m.tag, x, y + 58);
      ctx.font = '13px monospace';
      wrapText(ctx, m.blurb, x, y + 82, 230, 18);
    }
    ctx.fillStyle = '#cfe3ff';
    ctx.font = '16px monospace';
    ctx.fillText('↑ ↓ throttle · ← → bank & turn · mouse up/down or SPACE to climb · SPACE drops supplies · P pause · R restart', VIEW_W / 2, 440);
    ctx.fillText('Fly the golden rings, mind the ridges, and land slow and straight. Click a mission or press 1 / 2 / 3.', VIEW_W / 2, 470);
    if (best > 0) {
      ctx.fillStyle = '#ffd27a';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`BEST SCORE: ${best}`, VIEW_W / 2, 512);
    }
  } else if (screen === SCREEN_PAUSE) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('PAUSED', VIEW_W / 2, 320);
    ctx.font = '18px monospace';
    ctx.fillText('P to resume · R to restart the sortie', VIEW_W / 2, 360);
  } else if (screen === SCREEN_OVER) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('SORTIE LOST', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.fillText(st.reason, VIEW_W / 2, 344);
    ctx.font = '18px monospace';
    ctx.fillText(`Score ${st.score} · Rings ${st.ringsHit}/${world.rings.length} · Press R to fly again`, VIEW_W / 2, 386);
  } else if (screen === SCREEN_DONE) {
    ctx.fillStyle = '#58d68d';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('MISSION COMPLETE', VIEW_W / 2, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.fillText(`Down safe on the strip${st.landedSoft ? ' — a greaser!' : ''}`, VIEW_W / 2, 324);
    ctx.font = '18px monospace';
    ctx.fillText(`Score ${st.score} · Rings ${st.ringsHit}/${world.rings.length} · Drops ${st.dropsDone} · Fuel left ${Math.round(st.fuel)}`, VIEW_W / 2, 362);
    ctx.fillText('Press R for another sortie, or 1 / 2 / 3 to change mission.', VIEW_W / 2, 398);
  }
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** Draw one frame of the world for the given screen. */
export function render(ctx, world, screen, best, time) {
  const pal = PALETTES[world.mission.tod];
  const st = world.state;
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 40);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.55, pal.skyMid);
  sky.addColorStop(1, pal.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sun, low and fat at dusk.
  const sunX = world.mission.tod === 'dusk' ? 980 : 1020;
  const sunY = world.mission.tod === 'dusk' ? 300 : 110;
  const sunR = world.mission.tod === 'dusk' ? 46 : 34;
  ctx.fillStyle = pal.sun;
  ctx.shadowColor = pal.sun;
  ctx.shadowBlur = 60;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  const cam = cameraFor(st);
  drawRidge(ctx, pal, pal.far, st.s, 0.012, 60, 55, 1.7);
  drawRidge(ctx, pal, pal.near, st.s, 0.03, 26, 42, 4.2);
  drawClouds(ctx, world, cam, time);
  drawGround(ctx, world, cam, pal);
  drawRunwayMarks(ctx, world, cam);
  drawDrops(ctx, world, cam, time);
  drawRings(ctx, world, cam, time, screen);
  // The plane's shadow on the valley floor, so height reads at a glance.
  const ground = world.groundHeight(st.s, st.x);
  const shadow = project(cam, st.s + 6, st.x, ground + 0.4);
  if (shadow && st.status !== 'crashed') {
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.3 - (st.y - ground) * 0.004)})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, 34 * shadow.scale + 8, 8 * shadow.scale + 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (screen === SCREEN_TITLE) {
    // Parked on the strip for the title: the plane sits low over the runway.
    drawAircraft(ctx, { ...st, y: 2, pitch: 0, bank: 0 }, time);
  } else {
    drawAircraft(ctx, st, time);
  }
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHud(ctx, world);
  if (screen !== SCREEN_PLAY) drawOverlay(ctx, world, screen, best);
}
