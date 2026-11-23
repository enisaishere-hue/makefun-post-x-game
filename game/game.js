// ORBIT BLASTER 3D — a tiny 3D space shooter built from one prompt.
// "Build me a tiny 3D space shooter I can play in the browser: a ship, asteroids,
// lasers, score, and game feel that makes every hit land."
//
// Juice (trauma shake, hit-stop, squash & stretch, particles) follows the
// game-feel playbook: shake = trauma^2 with summed sines on the camera only,
// hit-stop restores on a real-time timer owned by the newest call, and every
// scale tween ends exactly at its rest value.
//
// No network, no model calls, no build step: Three.js is vendored beside it
// and this file is the whole game. Play with mouse / arrows / A,D + Space,
// or open with ?demo=1 for the autopilot that plays itself (used to record
// the gameplay video). R toggles reduce-shake. ?reduceShake=1 starts reduced.

import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const CAPTURE = params.get('capture') === '1'; // deterministic stepping for video recording
const REDUCE_SHAKE_START = params.get('reduceShake') === '1';

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.get('noaa') !== '1', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x050510);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050510, 22, 55);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 100);
const CAM_BASE = new THREE.Vector3(0, 2.7, 9.2);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 0.2, -6);

scene.add(new THREE.AmbientLight(0x8899ff, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 8, 6);
scene.add(key);
const rim = new THREE.PointLight(0xff4fd8, 60, 30);
rim.position.set(-6, 4, -8);
scene.add(rim);

// Starfield backdrop: three shells of points, slowly drifting toward camera.
function makeStars(count, spread, size, color) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
    pos[i * 3 + 2] = -Math.random() * 42;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true });
  const pts = new THREE.Points(g, m);
  pts.userData.speed = 0.6 + Math.random() * 1.4;
  scene.add(pts);
  return pts;
}
const starLayers = [makeStars(420, 44, 0.14, 0xffffff), makeStars(260, 40, 0.2, 0x9fd8ff), makeStars(140, 36, 0.26, 0xffd9f2)];

// ---------------------------------------------------------------- juice
// Trauma-based shake: shake = trauma^2, decayed in REAL time so it never
// freezes off-centre during hit-stop. Summed sines, never per-frame random.
// Only the camera offset moves — never a body, never collision.
const juice = {
  trauma: 0,
  decay: 1.2,          // trauma lost per real second
  strength: REDUCE_SHAKE_START ? 0.25 : 1.0, // reduce-shake setting 0..1
  timeScale: 1,        // hit-stop slows the simulation, not the shake
  hitStopId: 0,
  stopRemaining: 0, // sim-seconds left on the current stop (capture mode)
  stopId: 0,
  maxOffset: { x: 0.55, y: 0.4 },
  maxRoll: 0.045,
  t: 0,
  addTrauma(amount) {
    // Hits add; they never reset the shake.
    this.trauma = Math.min(this.trauma + amount, 1);
  },
  // Hit-stop: slow time, restore after a REAL-TIME delay; only the newest
  // call owns the restore, so two hits 30 ms apart cannot cut each other short.
  // In capture mode the clock is stepped by hand, so the stop counts down in
  // sim time inside tick() instead of a real-time timer.
  hitStop(duration = 0.08, slow = 0.05) {
    const id = ++this.hitStopId;
    this.timeScale = slow;
    if (CAPTURE) {
      this.stopId = id;
      this.stopRemaining = duration;
      return;
    }
    setTimeout(() => {
      if (id === this.hitStopId) this.timeScale = 1;
    }, duration * 1000);
  },
  update(realDt) {
    if (this.trauma > 0) {
      this.trauma = Math.max(this.trauma - this.decay * realDt, 0);
    }
    const shake = this.trauma * this.trauma * this.strength;
    this.t += realDt * 30;
    camera.position.x = CAM_BASE.x + this.maxOffset.x * shake * Math.sin(this.t * 1.7);
    camera.position.y = CAM_BASE.y + this.maxOffset.y * shake * Math.sin(this.t * 2.3);
    camera.rotation.z = this.maxRoll * shake * Math.sin(this.t * 1.1);
    if (this.trauma === 0) {
      camera.position.x = CAM_BASE.x;
      camera.position.y = CAM_BASE.y;
      camera.rotation.z = 0;
    }
  },
};

// Back-out easing: overshoots past rest, then settles on it.
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// Scale tweens. Every tween ends by snapping exactly to its rest value
// (obj.userData.restScale, default 1,1,1), and a retrigger kills the
// previous tween on the same object first so two tweens can never fight
// over one scale.
const REST = new THREE.Vector3(1, 1, 1);
const tweens = [];
function restOf(obj) { return obj.userData.restScale || REST; }
function popScale(obj, from, dur = 0.18) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    if (tweens[i].obj === obj) tweens.splice(i, 1);
  }
  obj.scale.set(from.x, from.y, from.z);
  tweens.push({ obj, from, dur, elapsed: 0 });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.elapsed += dt;
    const k = Math.min(tw.elapsed / tw.dur, 1);
    const e = easeOutBack(k);
    const rest = restOf(tw.obj);
    // Lerp from the popped scale back toward rest with overshoot.
    tw.obj.scale.set(
      tw.from.x + (rest.x - tw.from.x) * e,
      tw.from.y + (rest.y - tw.from.y) * e,
      tw.from.z + (rest.z - tw.from.z) * e,
    );
    if (k >= 1) {
      tw.obj.scale.copy(rest); // exact rest value, no drift
      tweens.splice(i, 1);
    }
  }
}

// Particles: one THREE.Points pool per burst, gravity-free drift + fade.
const bursts = [];
function spawnParticles(pos, count, color, speed = 6) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const vels = [];
  for (let i = 0; i < count; i++) {
    p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    vels.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 1 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  bursts.push({ pts, vels, life: 0.7, max: 0.7 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    const arr = b.pts.geometry.attributes.position.array;
    for (let j = 0; j < b.vels.length; j++) {
      arr[j * 3] += b.vels[j].x * dt;
      arr[j * 3 + 1] += b.vels[j].y * dt;
      arr[j * 3 + 2] += b.vels[j].z * dt;
    }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.material.opacity = Math.max(b.life / b.max, 0);
    if (b.life <= 0) {
      scene.remove(b.pts);
      b.pts.geometry.dispose();
      b.pts.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

// One feedback bundle per event tier, so the whole game stays proportional.
// small:  trauma 0.15, no hit-stop,  3 particles  (pickup)
// medium: trauma 0.40, hit-stop 0.05s, 8 particles (laser hit)
// large:  trauma 0.85, hit-stop 0.12s, 30 particles (asteroid destroyed / ship hit)
function feedback(tier, pos) {
  if (tier === 'small') {
    juice.addTrauma(0.15);
    if (pos) spawnParticles(pos, 3, 0x7dffce, 3);
  } else if (tier === 'medium') {
    juice.addTrauma(0.4);
    juice.hitStop(0.05, 0.05);
    if (pos) spawnParticles(pos, 8, 0xffc46b, 5);
  } else {
    juice.addTrauma(0.85);
    juice.hitStop(0.12, 0.05);
    if (pos) spawnParticles(pos, 30, 0xff5d7a, 7);
  }
}

// ---------------------------------------------------------------- entities
const shipMat = new THREE.MeshStandardMaterial({ color: 0x37e0ff, metalness: 0.6, roughness: 0.3, emissive: 0x0a4a66 });
const ship = new THREE.Group();
{
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 4), shipMat);
  nose.rotation.x = -Math.PI / 2; nose.rotation.y = Math.PI / 4;
  nose.position.z = -0.4;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 0.8), shipMat);
  wing.position.z = 0.45;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0x881155, metalness: 0.4, roughness: 0.4 }));
  tail.position.set(0, 0.05, 0.75);
  const glow = new THREE.PointLight(0x37e0ff, 12, 6);
  glow.position.set(0, 0, 1.2);
  ship.add(nose, wing, tail, glow);
}
ship.position.set(0, -1.6, 0);
ship.scale.setScalar(1.35);
ship.userData.restScale = new THREE.Vector3(1.35, 1.35, 1.35);
scene.add(ship);

const asteroids = [];
const lasers = [];
const pickups = [];
const asteroidGeo = new THREE.IcosahedronGeometry(1.1, 0);
const asteroidMat = new THREE.MeshStandardMaterial({ color: 0x9a7b5f, metalness: 0.2, roughness: 0.9, flatShading: true });
const laserGeo = new THREE.BoxGeometry(0.14, 0.14, 2.2);
const laserMat = new THREE.MeshBasicMaterial({ color: 0x8affff });
const starGeo = new THREE.OctahedronGeometry(0.32);
const starMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xaa7700, metalness: 0.7, roughness: 0.2 });

function spawnAsteroid(x) {
  const a = new THREE.Mesh(asteroidGeo, asteroidMat);
  // Spawn in the ship's firing plane (y near -1.6): the ship steers in x
  // only, so an asteroid far above the laser line could never be hit and
  // would always damage the ship. Keep every target hittable.
  a.position.set(x ?? (Math.random() - 0.5) * 13, -1.6 + (Math.random() - 0.5) * 1.6, -30);
  a.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  a.userData = { spin: (Math.random() - 0.5) * 2.4, speed: 5 + Math.random() * 3, hp: 2, radius: 1.15 };
  a.scale.setScalar(0.9 + Math.random() * 0.6);
  a.userData.restScale = a.scale.clone();
  scene.add(a);
  asteroids.push(a);
  return a;
}
function spawnPickup(pos) {
  const s = new THREE.Mesh(starGeo, starMat);
  s.position.copy(pos);
  s.userData = { speed: 3.2 };
  scene.add(s);
  pickups.push(s);
}
function fireLaser() {
  const l = new THREE.Mesh(laserGeo, laserMat);
  l.position.set(ship.position.x, ship.position.y + 0.15, ship.position.z - 1.2);
  l.userData = { speed: 34 };
  scene.add(l);
  lasers.push(l);
  // Muzzle pop: ship stretches back along z, springs home with overshoot.
  popScale(ship, new THREE.Vector3(1.12, 1.12, 0.72), 0.16);
}

// ---------------------------------------------------------------- state + HUD
let score = 0, combo = 0, lives = 3, shots = 0, hits = 0;
let spawnTimer = 0, fireTimer = 0, elapsed = 0, gameOver = false;
const hudScore = document.getElementById('score');
const hudLives = document.getElementById('lives');
const hudNote = document.getElementById('note');
const hudShake = document.getElementById('shake');
function refreshHud() {
  hudScore.textContent = `SCORE ${String(score).padStart(5, '0')}`;
  hudLives.textContent = '♥'.repeat(Math.max(lives, 0)) + '♡'.repeat(Math.max(3 - lives, 0));
  hudShake.textContent = juice.strength < 1 ? 'SHAKE: REDUCED (R)' : 'SHAKE: FULL (R)';
}
function setNote(text, ms = 1600) {
  hudNote.textContent = text;
  hudNote.style.opacity = '1';
  clearTimeout(setNote._t);
  setNote._t = setTimeout(() => { hudNote.style.opacity = '0'; }, ms);
}
refreshHud();

// ---------------------------------------------------------------- input
const keys = {};
let pointerX = null;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); fireLaser(); }
  if (e.code === 'KeyR') {
    juice.strength = juice.strength < 1 ? 1 : 0.25;
    refreshHud();
    setNote(juice.strength < 1 ? 'Reduce shake ON' : 'Reduce shake OFF');
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('pointermove', (e) => { pointerX = (e.clientX / innerWidth - 0.5) * 14; });
addEventListener('pointerdown', () => fireLaser());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- demo autopilot
// The autopilot steers toward the nearest asteroid and fires on a beat, so a
// recording shows real hits, explosions and pickups without a human player.
function demoStep(dt) {
  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireLaser();
    fireTimer = 0.34;
  }
  let target = null, best = Infinity;
  for (const a of asteroids) {
    const d = Math.abs(a.position.z - ship.position.z);
    if (d < best) { best = d; target = a; }
  }
  if (target) {
    const dx = target.position.x - ship.position.x;
    ship.position.x += THREE.MathUtils.clamp(dx * 2.2 * dt, -6 * dt, 6 * dt);
  }
}

// ---------------------------------------------------------------- collisions
function explodeAsteroid(a, idx) {
  const pos = a.position.clone();
  scene.remove(a);
  asteroids.splice(idx, 1);
  feedback('large', pos); // big hit: heavy shake + hit-stop + 30 particles
  score += 100 + combo * 25;
  combo++;
  hits++;
  if (Math.random() < 0.45) spawnPickup(pos);
  setNote(combo >= 3 ? `COMBO x${combo}!` : 'ASTEROID DOWN  +100');
  refreshHud();
}
function damageShip() {
  lives--;
  combo = 0;
  feedback('large', ship.position.clone());
  popScale(ship, new THREE.Vector3(0.6, 0.6, 1.4), 0.3); // squash, spring home
  refreshHud();
  if (lives <= 0) {
    gameOver = true;
    spawnParticles(ship.position.clone(), 40, 0x37e0ff, 9);
    ship.visible = false;
    setNote('GAME OVER — press R to restart', 60000);
  } else {
    setNote(`HULL HIT — ${lives} ${lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function tick(rawDt) {
  const realDt = Math.min(rawDt, 0.05);
  // Capture mode: the hit-stop counts down in sim time, newest id owns it.
  if (CAPTURE && juice.stopRemaining > 0) {
    juice.stopRemaining -= rawDt;
    if (juice.stopRemaining <= 0 && juice.stopId === juice.hitStopId) juice.timeScale = 1;
  }
  const dt = realDt * juice.timeScale; // hit-stop slows the sim only
  elapsed += dt;

  // Shake decays on WALL-CLOCK time (uncapped rawDt), so it never freezes
  // off-centre during hit-stop and never lags when frames run slow.
  // Tweens + particles ride the slowed sim.
  juice.update(Math.min(rawDt, 0.5));
  updateTweens(dt);
  updateBursts(dt);

  for (const s of starLayers) {
    s.position.z += s.userData.speed * dt * 2;
    if (s.position.z > 4) s.position.z -= 42;
  }

  if (!gameOver) {
    // Steering: keys / pointer, or the autopilot in demo mode.
    let vx = 0;
    if (keys.ArrowLeft || keys.KeyA) vx -= 9;
    if (keys.ArrowRight || keys.KeyD) vx += 9;
    if (DEMO) demoStep(dt);
    else if (pointerX !== null) ship.position.x += THREE.MathUtils.clamp(pointerX - ship.position.x, -9 * dt, 9 * dt);
    ship.position.x = THREE.MathUtils.clamp(ship.position.x + vx * dt, -6.5, 6.5);
    ship.rotation.z = THREE.MathUtils.clamp(-vx * 0.045, -0.4, 0.4);
    ship.position.y = -1.6 + Math.sin(elapsed * 2.2) * 0.12; // gentle hover bob

    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnAsteroid(); spawnTimer = 0.9 + Math.random() * 0.6; }

    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      const prevZ = l.position.z;
      l.position.z -= l.userData.speed * dt;
      if (l.position.z < -38) { scene.remove(l); lasers.splice(i, 1); continue; }
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const a = asteroids[j];
        const r = a.userData.radius * a.scale.x + 0.6;
        // Swept check: the laser steps ~1.7 units per sim frame at low fps,
        // so test the whole segment it crossed, not just its new position,
        // or fast lasers tunnel straight through an asteroid.
        const lateral = Math.hypot(l.position.x - a.position.x, l.position.y - a.position.y);
        const crossed = prevZ >= a.position.z - r && l.position.z <= a.position.z + r;
        if (lateral < r && crossed) {
          scene.remove(l); lasers.splice(i, 1);
          a.userData.hp--;
          if (a.userData.hp <= 0) explodeAsteroid(a, j);
          else {
            feedback('medium', l.position.clone()); // glancing hit
            popScale(a, new THREE.Vector3(1.35, 0.65, 1.35), 0.18); // squash, spring home
            score += 10; refreshHud();
          }
          break;
        }
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.position.z += a.userData.speed * dt;
      a.rotation.x += a.userData.spin * dt;
      a.rotation.y += a.userData.spin * 0.7 * dt;
      if (a.position.z > 6) { // slipped past: it clips the ship
        scene.remove(a); asteroids.splice(i, 1);
        damageShip();
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const s = pickups[i];
      s.position.z += s.userData.speed * dt;
      s.rotation.y += 3 * dt;
      if (s.position.distanceTo(ship.position) < 1.3) {
        scene.remove(s); pickups.splice(i, 1);
        score += 50;
        feedback('small', s.position.clone()); // light tick, no hit-stop
        setNote('STAR +50');
        refreshHud();
      } else if (s.position.z > 6) { scene.remove(s); pickups.splice(i, 1); }
    }
  }

  renderer.render(scene, camera);
}
function frame(now) {
  requestAnimationFrame(frame);
  tick((now - last) / 1000);
  last = now;
}
// In capture mode the loop is driven by hand (__step) so every video frame
// is exactly 1/30 s of game time, no matter how slow the renderer is.
if (CAPTURE) {
  window.__step = (dt) => tick(dt);
} else {
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- test hooks
// Headless verification drives these: fire two hits 30 ms apart and assert
// time scale returns to 1.0, trauma decays to 0, and every scale tween ends
// exactly at its rest value.
window.__game = {
  juice,
  get state() {
    return {
      timeScale: juice.timeScale,
      trauma: juice.trauma,
      tweens: tweens.length,
      bursts: bursts.length,
      score, lives, asteroids: asteroids.length, lasers: lasers.length,
      shipScale: [ship.scale.x, ship.scale.y, ship.scale.z],
    };
  },
  hit(tier = 'medium', pos) {
    feedback(tier, pos || new THREE.Vector3(0, 0, -6));
  },
  pop(obj = 'ship') {
    popScale(obj === 'ship' ? ship : asteroids[0] || ship, new THREE.Vector3(1.3, 0.7, 1.3), 0.18);
  },
  fire: fireLaser,
  spawn: spawnAsteroid,
  setShake(v) { juice.strength = v; refreshHud(); },
};
