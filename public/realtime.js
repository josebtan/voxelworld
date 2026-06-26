// ── realtime.js ────────────────────────────────────────────────────────────
// Subscribes to new cubes via Supabase Realtime so all users see
// each other's placements instantly.

function initRealtime() {
  if (!window._supabase) return;

  window._supabase
    .channel('cubes-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cubes' },
      payload => {
        const { gx, gz, height, color, username } = payload.new;

        // Skip if it's our own cube (already added optimistically)
        if (window._profile && username === window._profile.username) return;

        // Add the cube to the 3D scene
        if (typeof addCube === 'function') {
          const mesh = addCube(gx, gz, height, color, username);
          if (mesh && typeof animatePop === 'function') animatePop(mesh);
        }

        // Optional: toast notification
        showToast(`${username} placed a cube!`);
      }
    )
    .subscribe();

  console.log('Realtime subscribed ✅');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:     'fixed',
    bottom:       '120px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   'rgba(0,136,255,0.85)',
    color:        '#fff',
    padding:      '8px 18px',
    borderRadius: '30px',
    fontSize:     '0.8rem',
    zIndex:       '999',
    pointerEvents:'none',
    transition:   'opacity 0.4s',
    whiteSpace:   'nowrap',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 2200);
  setTimeout(() => t.remove(), 2700);
}

// Init realtime after world is ready
const _origInitWorld = window.initWorld;
window.initWorld = function() {
  _origInitWorld();
  initRealtime();
};
