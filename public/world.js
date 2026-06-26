// ── world.js ───────────────────────────────────────────────────────────────

const GRID_SIZE   = 80;
const TILE_SIZE   = 1;
const MAX_HEIGHT  = 16;
const COOLDOWN_MS = 30000;

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

let selectedColor  = COLORS[6];
let hoveredTile    = null;
const voxels       = {};
let mapInstance    = null;
let mode           = 'map'; // 'map' | 'voxel'

window._lastPlaceTime = window._lastPlaceTime || -COOLDOWN_MS;

// ── Leaflet map ────────────────────────────────────────────────────────────
function initMap() {
  mapInstance = L.map('map', { zoomControl: true }).setView([20, 0], 2);

  // Satellite layer (ESRI - 100% free)
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'ESRI', maxZoom: 19 }
  );

  // Relief / terrain layer (OpenTopoMap - 100% free)
  const terrain = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: 'OpenTopoMap', maxZoom: 17 }
  );

  // Street (OpenStreetMap - fallback)
  const street = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: 'OSM', maxZoom: 19 }
  );

  satellite.addTo(mapInstance);

  L.control.layers({
    '🛰 Satellite': satellite,
    '🏔 Relief':    terrain,
    '🗺 Street':    street,
  }).addTo(mapInstance);
}

// ── Three.js scene ─────────────────────────────────────────────────────────
let renderer, scene, camera, animFrameId;
let theta = 0.6, phi = 0.9, radius = 50;
const target = new THREE.Vector3(0, 0, 0);
const tiles  = [];
let highlight, ghost;

function initThreeJS() {
  const canvas = document.getElementById('canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 28, 40);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0x334466, 0.8));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  Object.assign(sun.shadow.camera, { near:1, far:120, left:-30, right:30, top:30, bottom:-30 });
  scene.add(sun);

  // Ground tiles
  const tileGeo = new THREE.PlaneGeometry(TILE_SIZE - 0.02, TILE_SIZE - 0.02);
  tileGeo.rotateX(-Math.PI / 2);

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const mat  = new THREE.MeshLambertMaterial({ color: tileColor(x, z) });
      const mesh = new THREE.Mesh(tileGeo, mat);
      mesh.receiveShadow = true;
      mesh.position.set(
        (x - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2,
        0,
        (z - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2
      );
      mesh.userData = { isTile: true, gx: x, gz: z };
      scene.add(mesh);
      tiles.push(mesh);
    }
  }

  const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x1a2a3a, 0x1a2a3a);
  gridHelper.position.y = 0.005;
  scene.add(gridHelper);

  // Highlight
  const hlGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  hlGeo.rotateX(-Math.PI / 2);
  highlight = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false
  }));
  highlight.visible = false;
  scene.add(highlight);

  // Ghost cube
  const ghostGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96, TILE_SIZE * 0.96);
  ghost = new THREE.Mesh(ghostGeo, new THREE.MeshLambertMaterial({
    color: 0xffffff, transparent: true, opacity: 0.4
  }));
  ghost.visible = false;
  scene.add(ghost);

  // Stars
  const starPos = [];
  for (let i = 0; i < 2000; i++) {
    starPos.push((Math.random()-0.5)*200, Math.random()*80+5, (Math.random()-0.5)*200);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color:0xaaccff, size:0.15 })));

  // Orbit controls
  initOrbitControls();
  buildPalette();
  renderLoop();
}

function tileColor(x, z) {
  const n = Math.sin(x/GRID_SIZE*7.3) * Math.cos(z/GRID_SIZE*5.1) * 0.5 + 0.5;
  if (n < 0.38) return new THREE.Color(0x1a3a6e);
  if (n < 0.42) return new THREE.Color(0x2a5c9e);
  if (n < 0.55) return new THREE.Color(0x3d7a3d);
  if (n < 0.68) return new THREE.Color(0x4e9a4e);
  if (n < 0.80) return new THREE.Color(0x8a7a5a);
  return new THREE.Color(0xdddddd);
}

// ── Cube management ────────────────────────────────────────────────────────
const cubeGeo = new THREE.BoxGeometry(TILE_SIZE*0.94, TILE_SIZE*0.94, TILE_SIZE*0.94);

function stackHeight(gx, gz) {
  let h = 0;
  while (voxels[`${gx},${gz},${h}`]) h++;
  return h;
}

function addCube(gx, gz, height, color, username) {
  if (voxels[`${gx},${gz},${height}`]) return;
  const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const mesh = new THREE.Mesh(cubeGeo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(
    (gx - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2,
    height * TILE_SIZE + TILE_SIZE/2,
    (gz - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2
  );
  mesh.userData = { gx, gz, height, color, username };
  scene.add(mesh);
  voxels[`${gx},${gz},${height}`] = mesh;
  return mesh;
}

async function placeCube(gx, gz) {
  if (!window._token) return;
  if (Date.now() - window._lastPlaceTime < COOLDOWN_MS) return;

  const h = stackHeight(gx, gz);
  if (h >= MAX_HEIGHT) return;

  // Optimistic UI
  const mesh = addCube(gx, gz, h, selectedColor, window._profile?.username);
  animatePop(mesh);
  window._lastPlaceTime = Date.now();
  updateCooldownUI();

  // API call
  try {
    const res = await fetch('/api/cubes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window._token}`
      },
      body: JSON.stringify({ gx, gz, color: selectedColor })
    });

    if (!res.ok) {
      // Rollback on error
      scene.remove(mesh);
      delete voxels[`${gx},${gz},${h}`];
      const err = await res.json();
      console.warn('Place failed:', err.error);
      if (err.error === 'Cooldown active') window._lastPlaceTime = Date.now();
    } else {
      // Update cube count
      if (window._profile) {
        window._profile.cubes_placed++;
        document.getElementById('user-cubes').textContent = `${window._profile.cubes_placed} cubes`;
      }
    }
  } catch (e) {
    scene.remove(mesh);
    delete voxels[`${gx},${gz},${h}`];
    console.error('Network error:', e);
  }
}

// Load all existing cubes from API
async function loadCubes() {
  try {
    const res  = await fetch('/api/cubes?limit=10000');
    const data = await res.json();
    data.forEach(c => addCube(c.gx, c.gz, c.height, c.color, c.username));
    console.log(`Loaded ${data.length} cubes`);
  } catch (e) {
    console.error('Failed to load cubes:', e);
  }
}

function animatePop(mesh) {
  const start = performance.now();
  const tick  = now => {
    const t = Math.min((now - start) / 180, 1);
    const s = t < 0.6 ? t/0.6*1.12 : 1.12 - (t-0.6)/0.4*0.12;
    mesh.scale.setScalar(s);
    if (t < 1) requestAnimationFrame(tick);
    else mesh.scale.setScalar(1);
  };
  requestAnimationFrame(tick);
}

// ── Orbit controls ─────────────────────────────────────────────────────────
function initOrbitControls() {
  const canvas = document.getElementById('canvas');
  let isDragging = false, prev = { x:0, y:0 };

  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { isDragging = true; prev = { x: e.clientX, y: e.clientY }; }
  });
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', e => {
    if (isDragging) {
      theta -= (e.clientX - prev.x) * 0.006;
      phi    = Math.max(0.15, Math.min(Math.PI/2-0.05, phi - (e.clientY - prev.y) * 0.006));
      prev   = { x: e.clientX, y: e.clientY };
    }
    updateRaycast(e.clientX, e.clientY);
  });
  canvas.addEventListener('wheel', e => {
    radius = Math.max(8, Math.min(90, radius + e.deltaY * 0.05));
  });
  canvas.addEventListener('click', e => {
    if (hoveredTile && !isDragging) placeCube(hoveredTile.gx, hoveredTile.gz);
  });
}

// ── Raycasting ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse2d   = new THREE.Vector2();

function updateRaycast(cx, cy) {
  if (mode !== 'voxel') return;
  mouse2d.set((cx/innerWidth)*2-1, -(cy/innerHeight)*2+1);
  raycaster.setFromCamera(mouse2d, camera);
  const hits = raycaster.intersectObjects(tiles);
  if (hits.length) {
    const { gx, gz } = hits[0].object.userData;
    hoveredTile = { gx, gz };
    const wx = (gx - GRID_SIZE/2)*TILE_SIZE + TILE_SIZE/2;
    const wz = (gz - GRID_SIZE/2)*TILE_SIZE + TILE_SIZE/2;
    const h  = stackHeight(gx, gz);
    highlight.position.set(wx, 0.01, wz);
    highlight.visible = true;
    ghost.material.color.set(selectedColor);
    ghost.position.set(wx, h*TILE_SIZE + TILE_SIZE/2, wz);
    ghost.visible = Date.now() - window._lastPlaceTime >= COOLDOWN_MS;
    updateInfoBox(gx, gz);
  } else {
    hoveredTile = highlight.visible = ghost.visible = false;
    document.getElementById('info-coords').textContent = 'Hover a tile';
    document.getElementById('info-height').textContent = '';
    document.getElementById('info-user').textContent   = '';
  }
}

function updateInfoBox(gx, gz) {
  const lat = ((gz/GRID_SIZE)*180-90).toFixed(2);
  const lng = ((gx/GRID_SIZE)*360-180).toFixed(2);
  const h   = stackHeight(gx, gz);
  const top = voxels[`${gx},${gz},${h-1}`];
  document.getElementById('info-coords').textContent = `${lat}°, ${lng}°`;
  document.getElementById('info-height').textContent = `Height: ${h}/${MAX_HEIGHT}`;
  document.getElementById('info-user').textContent   = top ? `by ${top.userData.username}` : '';
}

// ── Render loop ────────────────────────────────────────────────────────────
function renderLoop() {
  animFrameId = requestAnimationFrame(renderLoop);
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(target);
  renderer.render(scene, camera);
}

// ── Mode toggle ────────────────────────────────────────────────────────────
document.getElementById('btn-map-mode').addEventListener('click', () => setMode('map'));
document.getElementById('btn-voxel-mode').addEventListener('click', () => setMode('voxel'));

function setMode(m) {
  mode = m;
  document.getElementById('btn-map-mode').classList.toggle('active',   m === 'map');
  document.getElementById('btn-voxel-mode').classList.toggle('active', m === 'voxel');
  document.getElementById('palette-container').classList.toggle('hidden', m === 'map');
  document.getElementById('cooldown-container').classList.toggle('hidden', m === 'map');
  document.getElementById('canvas').classList.toggle('active', m === 'voxel');
  document.getElementById('map').style.pointerEvents = m === 'map' ? 'all' : 'none';
  if (highlight) highlight.visible = false;
  if (ghost)     ghost.visible     = false;
}

// ── Palette ────────────────────────────────────────────────────────────────
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
      if (ghost) ghost.material.color.set(c);
    });
    el.appendChild(s);
  });
}

// ── Cooldown UI ────────────────────────────────────────────────────────────
function updateCooldownUI() {
  const bar  = document.getElementById('cooldown-bar');
  const text = document.getElementById('cooldown-text');
  const tick = () => {
    const pct = Math.min((Date.now() - window._lastPlaceTime) / COOLDOWN_MS, 1);
    bar.style.width = (pct * 100) + '%';
    if (pct < 1) {
      text.textContent = `Next cube in ${((COOLDOWN_MS - (Date.now()-window._lastPlaceTime))/1000).toFixed(1)}s`;
      requestAnimationFrame(tick);
    } else {
      text.textContent = 'Ready to place!';
      if (hoveredTile && ghost) ghost.visible = true;
    }
  };
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  if (!camera) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (mapInstance) mapInstance.invalidateSize();
});

// ── Entry point (called from auth.js after login) ──────────────────────────
window.initWorld = function() {
  initMap();
  initThreeJS();
  loadCubes();
  updateCooldownUI();
};
