# ห้องรวมพล (Gather Room)

A tiny Gather.town-style web room — walk around a fixed 2D office, talk with voice, and share your screen. No accounts required.

**Live:** https://promplooklpk-web.github.io/gather-room/

## Features

- Fixed 2D office room with WASD / arrow key movement
- Real-time position sync between participants (2–6 people)
- Always-on voice chat in the room (mute/unmute)
- Screen sharing displayed on a wall in the room and in a side panel
- Thai-first UI with English hints
- Static export — deploys to GitHub Pages, no custom backend

## Tech Stack

- Next.js (App Router, TypeScript, `output: 'export'`)
- PeerJS (public broker) for WebRTC mesh networking
- Tailwind CSS
- GitHub Actions → GitHub Pages

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/gather-room/ (basePath is `/gather-room`).

## Test with Two Tabs

1. Open the app in one browser tab and enter a display name.
2. Click **คัดลอกลิงก์ / Copy link** and open that URL in a second tab (or another browser).
3. Allow microphone permission when prompted in both tabs.
4. Walk around with WASD — you should see both avatars move.
5. Speak in one tab; the other tab should hear you.
6. Click **แชร์หน้าจอ / Share screen** in one tab; the other tab shows the shared screen on the wall and in the panel.

> **Note:** `getUserMedia` and `getDisplayMedia` require HTTPS. On localhost, modern browsers allow these APIs. For full testing, use the live GitHub Pages URL after deploy.

## Build

```bash
npm run build
```

Static files are output to `out/`.

## Deploy

Pushes to `main` trigger the GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds and deploys `out/` to GitHub Pages via `actions/deploy-pages`.

## Project Structure

```
app/           # Next.js pages (/, /room)
components/    # UI components (canvas, controls, join screen)
hooks/         # usePeerRoom — PeerJS mesh networking
lib/           # Room map, types, i18n strings
public/        # Static assets + .nojekyll
```

## License

MIT
