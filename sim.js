const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const readouts = document.getElementById('readouts');
const missionStatus = document.getElementById('missionStatus');

const world = {
  runway: { x: 0, z: 0, heading: 90, length: 950, width: 75 },
  waypoints: [
    { x: 3500, z: -1800, alt: 1500, reached: false },
    { x: 6200, z: 900, alt: 1900, reached: false },
    { x: 900, z: 3000, alt: 1200, reached: false },
  ],
};

const planeDefaults = {
  x: -300,
  y: 25,
  z: 0,
  speed: 78,
  throttle: 0.55,
  pitch: 1,
  roll: 0,
  yaw: 90,
  verticalSpeed: 0,
  crashed: false,
  landed: false,
  completedMission: false,
  score: 0,
};

let plane = { ...planeDefaults };
let activeWaypoint = 0;

const keys = new Set();
window.addEventListener('keydown', (event) => keys.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

function resetFlight() {
  plane = { ...planeDefaults };
  activeWaypoint = 0;
  for (const wp of world.waypoints) wp.reached = false;
  missionStatus.textContent = 'Reach all waypoints, then return and land at the runway.';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(a) {
  let angle = a % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function shortestTurn(from, to) {
  return ((to - from + 540) % 360) - 180;
}

function update(dt) {
  if (keys.has('r')) {
    resetFlight();
    return;
  }

  if (plane.crashed) return;

  const controlRate = 35;
  if (keys.has('w')) plane.pitch -= controlRate * dt;
  if (keys.has('s')) plane.pitch += controlRate * dt;
  if (keys.has('a')) plane.roll -= controlRate * dt;
  if (keys.has('d')) plane.roll += controlRate * dt;
  if (keys.has('q')) plane.yaw -= 45 * dt;
  if (keys.has('e')) plane.yaw += 45 * dt;

  if (keys.has('arrowup')) plane.throttle += 0.4 * dt;
  if (keys.has('arrowdown')) plane.throttle -= 0.4 * dt;

  plane.throttle = clamp(plane.throttle, 0.1, 1);
  plane.pitch = clamp(plane.pitch, -20, 25);
  plane.roll = clamp(plane.roll, -45, 45);
  plane.yaw = normalizeAngle(plane.yaw);

  const drag = 0.0095 * plane.speed;
  const power = 110 * plane.throttle;
  const brake = keys.has(' ') ? 35 : 0;

  plane.speed += (power - drag - brake) * dt;
  plane.speed = clamp(plane.speed, 0, 280);

  const lowSpeedPenalty = plane.speed < 60 ? (60 - plane.speed) * 0.18 : 0;
  const lift = (plane.speed * (0.055 + plane.pitch * 0.0022)) - 6 - lowSpeedPenalty;

  plane.verticalSpeed += lift * dt;
  plane.verticalSpeed -= 10.5 * dt;
  plane.verticalSpeed *= 0.986;

  const headingDrift = plane.roll * 0.32 * dt * (plane.speed / 120);
  plane.yaw = normalizeAngle(plane.yaw + headingDrift);

  const yawRad = (plane.yaw * Math.PI) / 180;
  plane.x += Math.cos(yawRad) * plane.speed * dt;
  plane.z += Math.sin(yawRad) * plane.speed * dt;
  plane.y += plane.verticalSpeed * dt;

  if (plane.y <= 0) {
    const runwayHeadingError = Math.abs(shortestTurn(plane.yaw, world.runway.heading));
    const onRunway = Math.abs(plane.z - world.runway.z) < world.runway.width
      && plane.x > -world.runway.length * 0.5
      && plane.x < world.runway.length * 0.5;

    if (onRunway && plane.speed < 55 && runwayHeadingError < 18 && plane.completedMission) {
      plane.landed = true;
      plane.y = 0;
      plane.verticalSpeed = 0;
      plane.speed *= 0.98;
      if (plane.speed < 1) plane.speed = 0;
      missionStatus.textContent = `Perfect landing! Mission complete with ${plane.score} score.`;
    } else {
      plane.crashed = true;
      plane.y = 0;
      plane.speed = 0;
      missionStatus.textContent = 'Crash detected. Press R to restart the mission.';
    }
  }

  if (!plane.landed) {
    evaluateMission();
  }
}

function evaluateMission() {
  if (activeWaypoint < world.waypoints.length) {
    const wp = world.waypoints[activeWaypoint];
    const d = Math.hypot(plane.x - wp.x, plane.z - wp.z);
    const altError = Math.abs(plane.y - wp.alt);

    if (d < 250 && altError < 260) {
      wp.reached = true;
      activeWaypoint += 1;
      plane.score += 300;
      missionStatus.textContent = activeWaypoint < world.waypoints.length
        ? `Waypoint ${activeWaypoint}/${world.waypoints.length} reached. Continue to the next marker.`
        : 'All waypoints reached. Return to runway and land.';
    }
  } else if (!plane.completedMission) {
    plane.completedMission = true;
  }

  if (plane.y > 50 && plane.speed > 65) {
    plane.score += 1;
  }
}

function worldToScreen(x, z, scale, center) {
  return {
    x: center.x + x / scale,
    y: center.y + z / scale,
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawHorizon();
  drawMiniMap();
  drawHud();

  if (plane.crashed) {
    drawOverlay('CRASH', '#f43f5e');
  } else if (plane.landed && plane.completedMission && plane.speed < 1) {
    drawOverlay('MISSION COMPLETE', '#34d399');
  }
}

function drawHorizon() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const pitchPx = plane.pitch * 3;
  const rollRad = (plane.roll * Math.PI) / 180;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);

  ctx.fillStyle = '#1f4b99';
  ctx.fillRect(-canvas.width, -canvas.height * 2 + pitchPx, canvas.width * 2, canvas.height * 2);

  ctx.fillStyle = '#4b3423';
  ctx.fillRect(-canvas.width, pitchPx, canvas.width * 2, canvas.height * 2);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-canvas.width, pitchPx);
  ctx.lineTo(canvas.width, pitchPx);
  ctx.stroke();

  for (let deg = -30; deg <= 30; deg += 5) {
    if (deg === 0) continue;
    const y = pitchPx + deg * 6;
    const len = deg % 10 === 0 ? 120 : 60;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-len, y);
    ctx.lineTo(len, y);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 45, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 45, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 20);
  ctx.stroke();
}

function drawMiniMap() {
  const map = { x: 30, y: canvas.height - 230, w: 310, h: 190 };
  ctx.fillStyle = 'rgba(3, 7, 18, 0.75)';
  ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(map.x, map.y, map.w, map.h);

  const scale = 35;
  const center = { x: map.x + map.w / 2, y: map.y + map.h / 2 };

  const rwStart = worldToScreen(-world.runway.length / 2, world.runway.z, scale, center);
  const rwEnd = worldToScreen(world.runway.length / 2, world.runway.z, scale, center);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rwStart.x, rwStart.y);
  ctx.lineTo(rwEnd.x, rwEnd.y);
  ctx.stroke();

  world.waypoints.forEach((wp, i) => {
    const p = worldToScreen(wp.x, wp.z, scale, center);
    ctx.fillStyle = wp.reached ? '#34d399' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${i + 1}`, p.x + 8, p.y - 8);
  });

  const aircraft = worldToScreen(plane.x, plane.z, scale, center);
  ctx.save();
  ctx.translate(aircraft.x, aircraft.y);
  ctx.rotate((plane.yaw * Math.PI) / 180);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, 6);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '13px sans-serif';
  ctx.fillText('Tactical Map', map.x + 8, map.y + 18);
}

function drawHud() {
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px monospace';
  ctx.fillText(`SPD ${plane.speed.toFixed(0)} kt`, 32, 38);
  ctx.fillText(`ALT ${Math.max(0, plane.y).toFixed(0)} ft`, 32, 60);
  ctx.fillText(`HDG ${plane.yaw.toFixed(0)}°`, 32, 82);
  ctx.fillText(`V/S ${plane.verticalSpeed.toFixed(0)} fpm`, 32, 104);
  ctx.fillText(`THR ${(plane.throttle * 100).toFixed(0)}%`, 32, 126);
  ctx.fillText(`SCR ${plane.score}`, 32, 148);

  if (activeWaypoint < world.waypoints.length) {
    const wp = world.waypoints[activeWaypoint];
    const bearing = normalizeAngle((Math.atan2(wp.z - plane.z, wp.x - plane.x) * 180) / Math.PI);
    const distance = Math.hypot(wp.x - plane.x, wp.z - plane.z);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`NEXT WP ${activeWaypoint + 1}`, canvas.width - 240, 38);
    ctx.fillText(`BRG ${bearing.toFixed(0)}°`, canvas.width - 240, 60);
    ctx.fillText(`DST ${(distance / 100).toFixed(1)} nm`, canvas.width - 240, 82);
    ctx.fillText(`TGT ALT ${wp.alt} ft`, canvas.width - 240, 104);
  }

  renderReadouts();
}

function drawOverlay(text, color) {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = '700 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'start';
}

function gaugeState(value, warning, danger, invert = false) {
  if (!invert) {
    if (value < danger || value > 1000) return 'danger';
    if (value < warning) return 'warn';
    return 'ok';
  }
  if (value > danger) return 'danger';
  if (value > warning) return 'warn';
  return 'ok';
}

function renderReadouts() {
  const entries = [
    ['Airspeed', `${plane.speed.toFixed(0)} kt`, gaugeState(plane.speed, 75, 58)],
    ['Altitude', `${Math.max(0, plane.y).toFixed(0)} ft`, gaugeState(plane.y, 90, 25)],
    ['Pitch', `${plane.pitch.toFixed(1)}°`, gaugeState(Math.abs(plane.pitch), 14, 20, true)],
    ['Roll', `${plane.roll.toFixed(1)}°`, gaugeState(Math.abs(plane.roll), 30, 42, true)],
    ['Throttle', `${(plane.throttle * 100).toFixed(0)}%`, gaugeState(plane.throttle * 100, 25, 12)],
    ['Vertical Speed', `${plane.verticalSpeed.toFixed(0)} fpm`, gaugeState(Math.abs(plane.verticalSpeed), 900, 1500, true)],
    ['Mission Score', `${plane.score}`, 'ok'],
  ];

  readouts.innerHTML = entries
    .map(([label, value, severity]) => `<li><span class="label">${label}</span><span class="value ${severity}">${value}</span></li>`)
    .join('');
}

let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(tick);
}

resetFlight();
requestAnimationFrame(tick);
