# 🌍 VoxelWorld

> Collaborative 3D voxel world overlaid on a real map. Place colored cubes anywhere on Earth, one every 30 seconds.

## ✨ Features
- 🛰 Satellite + Relief + Street map layers (100% free, no API key)
- 🧊 3D voxel grid — stack up to 16 cubes per tile
- 🔐 Login with Google or Discord
- ⚡ Real-time multiplayer via Supabase Realtime
- ⏱ 30-second cooldown enforced server-side
- 🌐 Deployed on Vercel (frontend + API)

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| 3D Rendering | Three.js |
| Map | Leaflet.js + ESRI Satellite + OpenTopoMap |
| Auth | Supabase Auth (Google + Discord OAuth) |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| API | Vercel Serverless Functions |
| Deploy | Vercel + GitHub |

## 🚀 Setup

### 1. Supabase
- Create project at supabase.com
- Run migration: `supabase/migrations/20260625000001_initial_schema.sql`
- Enable Google + Discord OAuth in Authentication → Providers
- Add your Vercel URL to redirect URLs

### 2. Environment Variables (Vercel)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Deploy
```bash
# Connect repo to Vercel
vercel --prod
```

### 4. Inject env into frontend
In `public/index.html`, the `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__`
placeholders are replaced at build time by Vercel using a build script,
or you can set them directly for local testing.

## 📁 Structure

```
voxelworld/
├── api/
│   ├── cubes.js        # GET/POST cubes
│   └── profile.js      # GET user profile
├── public/
│   ├── index.html
│   ├── style.css
│   ├── auth.js         # Supabase Auth
│   ├── world.js        # Three.js + Leaflet
│   └── realtime.js     # Supabase Realtime
├── lib/
│   └── supabase.js     # Supabase admin client
├── supabase/
│   └── migrations/
│       └── 20260625000001_initial_schema.sql
├── vercel.json
└── package.json
```
