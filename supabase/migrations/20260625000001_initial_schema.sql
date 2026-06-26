-- ── VoxelWorld Schema ─────────────────────────────────────────────────────

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  avatar_url    TEXT,
  provider      TEXT,                        -- 'google' | 'discord'
  cubes_placed  INTEGER DEFAULT 0,
  last_place_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Cubes
CREATE TABLE IF NOT EXISTS public.cubes (
  id         BIGSERIAL PRIMARY KEY,
  gx         SMALLINT NOT NULL,              -- grid X (0 to GRID_SIZE-1)
  gz         SMALLINT NOT NULL,              -- grid Z (0 to GRID_SIZE-1)
  height     SMALLINT NOT NULL DEFAULT 0,   -- stack level (0 = ground)
  color      CHAR(7)  NOT NULL,             -- hex color e.g. #FF5733
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username   TEXT,                           -- denormalized for speed
  placed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gx, gz, height)
);

-- Indexes for fast tile lookups
CREATE INDEX IF NOT EXISTS idx_cubes_tile ON public.cubes(gx, gz);
CREATE INDEX IF NOT EXISTS idx_cubes_placed_at ON public.cubes(placed_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cubes    ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Cubes: anyone can read, authenticated users can insert
CREATE POLICY "cubes_select" ON public.cubes FOR SELECT USING (true);
CREATE POLICY "cubes_insert" ON public.cubes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── Realtime ───────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.cubes;

-- ── Auto-create profile on signup ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, provider)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_username',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_app_meta_data->>'provider'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Cooldown enforcement ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_place_cube(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_time TIMESTAMPTZ;
BEGIN
  SELECT last_place_at INTO last_time
  FROM public.profiles WHERE id = p_user_id;
  RETURN (last_time IS NULL OR NOW() - last_time >= INTERVAL '30 seconds');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Place cube (atomic) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_cube(
  p_gx     SMALLINT,
  p_gz     SMALLINT,
  p_color  CHAR(7)
)
RETURNS public.cubes AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_username TEXT;
  v_height   SMALLINT;
  v_cube     public.cubes;
BEGIN
  -- Auth check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cooldown check
  IF NOT public.can_place_cube(v_user_id) THEN
    RAISE EXCEPTION 'Cooldown active';
  END IF;

  -- Get username
  SELECT username INTO v_username FROM public.profiles WHERE id = v_user_id;

  -- Next height on this tile
  SELECT COALESCE(MAX(height) + 1, 0) INTO v_height
  FROM public.cubes WHERE gx = p_gx AND gz = p_gz;

  -- Max height check (16 levels)
  IF v_height >= 16 THEN
    RAISE EXCEPTION 'Max height reached';
  END IF;

  -- Insert cube
  INSERT INTO public.cubes (gx, gz, height, color, user_id, username)
  VALUES (p_gx, p_gz, v_height, p_color, v_user_id, v_username)
  RETURNING * INTO v_cube;

  -- Update profile stats
  UPDATE public.profiles
  SET cubes_placed  = cubes_placed + 1,
      last_place_at = NOW()
  WHERE id = v_user_id;

  RETURN v_cube;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
