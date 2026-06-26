# 🌍 VoxelWorld

> Collaborative 3D voxel world overlaid on a real map. Place colored cubes anywhere on Earth, one every 30 seconds.

## ✨ Features (Prototype)
- 3D voxel grid representing the world map
- 32-color palette
- Stack cubes up to 16 high
- 30-second cooldown between placements
- Ghost cube preview before placing
- Hover to see lat/lng coordinates
- Orbit camera (drag + scroll)

## 🚀 Run locally

Just open `index.html` in your browser — no build step needed for the prototype.

```bash
# Or serve with any static server:
npx serve .
```

## 🗺 Roadmap

- [ ] **Phase 1** — Visual prototype (current)
- [ ] **Phase 2** — Backend (Node.js + Express + PostgreSQL)
- [ ] **Phase 3** — Real-time multiplayer (Socket.io)
- [ ] **Phase 4** — Auth + cooldown enforcement server-side
- [ ] **Phase 5** — Real Mapbox integration + geographic coordinates
- [ ] **Phase 6** — Chunk system for scale

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| 3D Rendering | Three.js |
| Map (planned) | Mapbox GL JS |
| Backend (planned) | Node.js + Express |
| Real-time (planned) | Socket.io |
| Database (planned) | PostgreSQL + Redis |

## 📁 Structure

```
voxelworld/
├── index.html   # Entry point
├── style.css    # UI styles
├── world.js     # Three.js scene + game logic
└── README.md
```
