import supabase from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url, provider, cubes_placed, last_place_at, created_at')
      .eq('id', user.id)
      .single();

    if (profileError) return res.status(500).json({ error: profileError.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
