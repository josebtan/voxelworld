// ── auth.js ────────────────────────────────────────────────────────────────

const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON
);

window._supabase = supabase;
window._user     = null;
window._token    = null;

// ── Login buttons ──────────────────────────────────────────────────────────
document.getElementById('btn-google').addEventListener('click', () => {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin }
  });
});

document.getElementById('btn-discord').addEventListener('click', () => {
  supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: location.origin }
  });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

// ── Session management ─────────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await onLogin(session);
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await onLogin(session);
    } else if (event === 'SIGNED_OUT') {
      location.reload();
    }
  });
}

async function onLogin(session) {
  window._user  = session.user;
  window._token = session.access_token;

  // Hide auth, show app
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Load profile
  const { data: profile } = await window._supabase
    .from('profiles')
    .select('username, avatar_url, cubes_placed, last_place_at')
    .eq('id', session.user.id)
    .single();

  if (profile) {
    document.getElementById('user-name').textContent   = profile.username;
    document.getElementById('user-cubes').textContent  = `${profile.cubes_placed} cubes`;
    document.getElementById('user-avatar').src         = profile.avatar_url || '';
    window._profile = profile;

    // Set cooldown from server
    if (profile.last_place_at) {
      const elapsed = Date.now() - new Date(profile.last_place_at).getTime();
      window._lastPlaceTime = Date.now() - elapsed;
    }
  }

  // Init world after auth
  if (typeof initWorld === 'function') initWorld();
}

initAuth();
