// ── VoxelWorld — world.js ──────────────────────────────────────────────────

const GRID_SIZE   = 40;    // tiles per side
const TILE_SIZE   = 1;     // world units per tile
const MAX_HEIGHT  = 16;    // max cube stack
const COOLDOWN_MS = 30000; // 30 seconds

const COLORS = [
  '#ff4444','#ff8800','#ffdd00','#88cc00',
  '#00cc66','#00cccc','#0088ff','#4444ff',
  '#8844ff','#cc44cc','#ff44aa','#ffffff',
  '#cccccc','#888888','#444444','#111111',
  '#8B4513','#d4a96a','#228B22','#006400',
  '#00008B','#191970','#800000','#ff6666',
  '#ffa07a','#ffd700','#adff2f','#7fffd4',
  '#87ceeb','#dda0dd','#f0e68c','#ff69b4',
];

// ── State ──────────────────────────────────────────────────────────────────
let selectedColor = COLORS[6]; // default blue
let lastPlaceTime = -COOLDOWN_MS;
let hoveredTile   = null;
const voxels      = {}; // key: "x,z,y" → mesh

// ── Scene setup ───────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1e);
scene.fog = new THREE.Fog(0x0a0f1e, 40, 90);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 28, 40);
camera.lookAt(0, 0, 0);

// ── Lights ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x334466, 0.8);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near    = 1;
sun.shadow.camera.far     = 120;
sun.shadow.camera.left    = -30;
sun.shadow.camera.right   =  30;
sun.shadow.camera.top     =  30;
sun.shadow.camera.bottom  = -30;
scene.add(sun);

// ── Ground grid (map tiles) ────────────────────────────────────────────────
const tileGroup = new THREE.Group();
scene.add(tileGroup);

const tileGeo = new THREE.PlaneGeometry(TILE_SIZE - 0.02, TILE_SIZE - 0.02);
tileGeo.rotateX(-Math.PI / 2);

// Subtle world map-like palette for ground tiles
function tileColor(x, z) {
  const nx = x / GRID_SIZE;
  const nz = z / GRID_SIZE;
  const n  = Math.sin(nx * 7.3) * Math.cos(nz * 5.1) * 0.5 + 0.5;
  if (n < 0.38) return new THREE.Color(0x1a3a6e); // ocean
  if (n < 0.42) return new THREE.Color(0x2a5c9e); // shallow
  if (n < 0.55) return new THREE.Color(0x3d7a3d); // lowland
  if (n < 0.68) return new THREE.Color(0x4e9a4e); // midland
  if (n < 0.80) return new THREE.Color(0x8a7a5a); // highland
  return new THREE.Color(0xdddddd);                // snow peak
}

const tiles = []; // for raycasting
for (let x = 0; x < GRID_SIZE; x++) {
  for (let z = 0; z < GRID_SIZE; z++) {
    const mat  = new THREE.MeshLambertMaterial({ color: tileColor(x, z) });
    const mesh = new THREE.Mesh(tileGeo, mat);
    mesh.receiveShadow = true;
    mesh.position.set(
      (x - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2,
      0,
      (z - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2
    );
    mesh.userData = { isTile: true, gx: x, gz: z };
    tileGroup.add(mesh);
    tiles.push(mesh);
  }
}

// Grid lines
const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x1a2a3a, 0x1a2a3a);
gridHelper.position.y = 0.005;
scene.add(gridHelper);

// ── Hover highlight ────────────────────────────────────────────────────────
const hlGeo  = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
hlGeo.rotateX(-Math.PI / 2);
const hlMat  = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false
});
const highlight = new THREE.Mesh(hlGeo, hlMat);
highlight.visible = false;
scene.add(highlight);

// ── Ghost cube (preview) ───────────────────────────────────────────────────
const ghostGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96, TILE_SIZE * 0.96);
const ghostMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, transparent: true, opacity: 0.45
});
const ghost    = new THREE.Mesh(ghostGeo, ghostMat);
ghost.visible  = false;
scene.add(ghost);

// ── Cube placement ─────────────────────────────────────────────────────────
const cubeGeo = new THREE.BoxGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94, TILE_SIZE * 0.94);

function stackHeight(gx, gz) {
  let h = 0;
  while (voxels[`${gx},${gz},${h}`]) h++;
  return h;
}

function placeCube(gx, gz) {
  const now = Date.now();
  if (now - lastPlaceTime < COOLDOWN_MS) return;

  const h = stackHeight(gx, gz);
  if (h >= MAX_HEIGHT) return;

  const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(selectedColor) });
  const mesh = new THREE.Mesh(cubeGeo, mat);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.position.set(
    (gx - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2,
    h * TILE_SIZE + TILE_SIZE / 2,
    (gz - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2
  );
  scene.add(mesh);
  voxels[`${gx},${gz},${h}`] = mesh;

  lastPlaceTime = now;
  updateCooldownUI();
  updateInfoBox(gx, gz);

  // Pop animation
  mesh.scale.set(0.01, 0.01, 0.01);
  animatePop(mesh);
}

function animatePop(mesh) {
  const start  = performance.now();
  const dur    = 180;
  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const s = t < 0.6 ? t / 0.6 * 1.12 : 1.12 - (t - 0.6) / 0.4 * 0.12;
    mesh.scale.setScalar(s);
    if (t < 1) requestAnimationFrame(tick);
    else mesh.scale.setScalar(1);
  }
  requestAnimationFrame(tick);
}

// ── Orbit controls (manual) ───────────────────────────────────────────────
let isDragging = false, prevMouse = { x: 0, y: 0 };
let theta = 0.6, phi = 0.9, radius = 50;
const target = new THREE.Vector3(0, 0, 0);

canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; }
});
window.addEventListener('mouseup',   () => isDragging = false);
window.addEventListener('mousemove', e => {
  if (isDragging) {
    const dx = (e.clientX - prevMouse.x) * 0.006;
    const dy = (e.clientY - prevMouse.y) * 0.006;
    theta -= dx;
    phi    = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phi - dy));
    prevMouse = { x: e.clientX, y: e.clientY };
  }
  updateRaycast(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', e => {
  radius = Math.max(8, Math.min(90, radius + e.deltaY * 0.05));
});

function updateCamera() {
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(target);
}

// ── Raycasting ────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse2d   = new THREE.Vector2();

function updateRaycast(cx, cy) {
  mouse2d.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse2d, camera);

  const hits = raycaster.intersectObjects(tiles);
  if (hits.length) {
    const { gx, gz } = hits[0].object.userData;
    hoveredTile = { gx, gz };

    const wx = (gx - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
    const wz = (gz - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
    const h  = stackHeight(gx, gz);

    highlight.position.set(wx, 0.01, wz);
    highlight.visible = true;

    ghost.material.color.set(selectedColor);
    ghost.position.set(wx, h * TILE_SIZE + TILE_SIZE / 2, wz);
    ghost.visible = (Date.now() - lastPlaceTime >= COOLDOWN_MS);

    updateInfoBox(gx, gz);
  } else {
    hoveredTile       = null;
    highlight.visible = false;
    ghost.visible     = false;
    document.getElementById('info-coords').textContent = 'Hover a tile to see coords';
    document.getElementById('info-height').textContent = '';
  }
}

canvas.addEventListener('click', e => {
  if (hoveredTile) placeCube(hoveredTile.gx, hoveredTile.gz);
});

// ── UI ─────────────────────────────────────────────────────────────────────
function buildPalette() {
  const el = document.getElementById('palette');
  COLORS.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    s.style.background = c;
    s.addEventListener('click', () => {
      selectedColor = c;
      document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('selected'));
      s.classList.add('selected');
      ghost.material.color.set(c);
    });
    el.appendChild(s);
  });
}
buildPalette();

function updateInfoBox(gx, gz) {
  const lat = ((gz / GRID_SIZE) * 180 - 90).toFixed(2);
  const lng = ((gx / GRID_SIZE) * 360 - 180).toFixed(2);
  const h   = stackHeight(gx, gz);
  document.getElementById('info-coords').textContent = `${lat}°, ${lng}°`;
  document.getElementById('info-height').textContent = `Height: ${h} / ${MAX_HEIGHT}`;
}

function updateCooldownUI() {
  const bar  = document.getElementById('cooldown-bar');
  const text = document.getElementById('cooldown-text');
  const tick = () => {
    const elapsed = Date.now() - lastPlaceTime;
    const pct     = Math.min(elapsed / COOLDOWN_MS, 1);
    bar.style.width = (pct * 100) + '%';
    if (pct < 1) {
      const rem = ((COOLDOWN_MS - elapsed) / 1000).toFixed(1);
      text.textContent = `Next cube in ${rem}s`;
      requestAnimationFrame(tick);
    } else {
      text.textContent = 'Ready to place!';
      if (hoveredTile) ghost.visible = true;
    }
  };
  requestAnimationFrame(tick);
}

// ── Stars background ───────────────────────────────────────────────────────
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 1800; i++) {
  starPos.push((Math.random() - 0.5) * 200, Math.random() * 80 + 5, (Math.random() - 0.5) * 200);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat  = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.15 });
scene.add(new THREE.Points(starGeo, starMat));

// ── Render loop ────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  updateCamera();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
