import supabase from '../lib/supabase.js';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/cubes?gx=&gz= (load chunk) or all cubes ──────────────────
  if (req.method === 'GET') {
    const { gx, gz, limit = 5000 } = req.query;

    let query = supabase
      .from('cubes')
      .select('gx, gz, height, color, username, placed_at')
      .order('placed_at', { ascending: true })
      .limit(Number(limit));

    if (gx !== undefined && gz !== undefined) {
      query = query.eq('gx', Number(gx)).eq('gz', Number(gz));
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── POST /api/cubes — place a cube ────────────────────────────────────
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.replace('Bearer ', '');

    // Verify user via Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { gx, gz, color } = req.body;

    // Validate inputs
    if (gx === undefined || gz === undefined || !color) {
      return res.status(400).json({ error: 'Missing gx, gz or color' });
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color format' });
    }

    // Call atomic DB function (handles cooldown + height check)
    const { data, error } = await supabase
      .rpc('place_cube', { p_gx: gx, p_gz: gz, p_color: color });

    if (error) {
      const msg = error.message;
      if (msg.includes('Cooldown'))    return res.status(429).json({ error: 'Cooldown active' });
      if (msg.includes('Max height'))  return res.status(400).json({ error: 'Max height reached' });
      return res.status(500).json({ error: msg });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
