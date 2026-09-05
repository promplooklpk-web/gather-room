# MTL Click — Voice Rooms

Discord-style voice rooms with microphone and full-screen share. No accounts required.

**Live:** https://promplooklpk-web.github.io/gather-room/

## Features

- Five isolated voice rooms (Meeting 1–5)
- Always-on voice chat (mute / deafen) with high-fidelity speech processing
- Active speaking indicator (glowing green ring around avatars when talking)
- In-room text chat (Discord-style text channel with unread notification badge)
- Web Audio sound effects (Discord-like join, leave, mute, and message notification chimes)
- Settings modal (mic input selector, live mic test meter, display name & avatar color customization)
- Per-user volume slider for remote participants
- Responsive design with collapsible mobile navigation drawer
- Profile persistence in `localStorage`
- Screen sharing fills the main view, like Discord
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
2. Copy the room link (gear icon in the user panel) and open it in a second tab.
3. Allow microphone permission when prompted in both tabs.
4. Speak in one tab; the other tab should hear you.
5. Click **แชร์หน้าจอ / Share screen** in one tab; the other tab shows the shared screen full size in the main view.

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
app/                 # Next.js pages (/, /room)
components/discord/  # Discord-style shell, stage, and user panel
hooks/               # usePeerRoom — PeerJS mesh networking
lib/                 # rooms, types, audio, i18n
public/              # Static assets + .nojekyll
```

## License

MIT
