# MTL Click — Voice Rooms

Discord-style voice rooms with microphone and full-screen share. No accounts required.

**Live:** `https://gather-room.<your-workers-subdomain>.workers.dev/` once GitHub Actions secrets are set and deploy succeeds (see Deploy below).

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
- Static export — deploys to Cloudflare Workers Static Assets, no custom backend

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

Open http://localhost:3000/

## Test with Two Tabs

1. Open the app in one browser tab and enter a display name.
2. Copy the room link (gear icon in the user panel) and open it in a second tab.
3. Allow microphone permission when prompted in both tabs.
4. Speak in one tab; the other tab should hear you.
5. Click **แชร์หน้าจอ / Share screen** in one tab; the other tab shows the shared screen full size in the main view.

> **Note:** `getUserMedia` and `getDisplayMedia` require HTTPS. On localhost, modern browsers allow these APIs. For full testing, use the live Cloudflare URL after deploy.

## Build

```bash
npm run build
```

Static files are output to `out/`.

## Deploy

Pushes to `main` run `.github/workflows/deploy.yml`: `npm run build` (static export to `out/`) then `wrangler deploy` via [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

### GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts** edit permission for this account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (Dashboard → Workers & Pages → Overview, right sidebar) |

Build-time env (already set in the workflow): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Optional WebRTC TURN (for strict VPN / symmetric NAT when the built-in PeerJS TURN fallback is not enough):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TURN_URLS` | Comma-separated `turn:` / `turns:` URLs |
| `NEXT_PUBLIC_TURN_USERNAME` | TURN username (if required) |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | TURN password (if required) |

Screen share uses the same ICE servers as voice. If UDP is blocked (common on VPN), the app probes STUN, may recreate the Peer with TURN (`iceTransportPolicy: relay`), and reuses the **audio** PeerConnection for screen video when possible so a working voice path carries the share. After a TURN fallback, you must tap **Share screen** again — browsers only allow `getDisplayMedia` from a fresh user gesture.

### Meet / Gather.town–class reliability (roadmap)

This app uses a **PeerJS mesh** (one WebRTC connection per pair). Google Meet and Gather.town use an **SFU** (or MCU): one upstream per client, TURN always on, and screen video does not depend on a second P2P leg. For production-grade VPN + screen share:

| Approach | Notes |
|----------|--------|
| **Dedicated TURN** | Set `NEXT_PUBLIC_TURN_URLS` (+ username/credential) in CI — e.g. [Metered](https://www.metered.ca/tools/openrelay/), Cloudflare Calls TURN, or your own `coturn`. |
| **SFU** | [LiveKit](https://livekit.io/), [Cloudflare Calls](https://developers.cloudflare.com/calls/), or Daily — replace mesh `peer.call` with one `RTCPeerConnection` to the SFU and `replaceTrack` for screen. |
| **This repo** | Mesh + optional TURN is fine for small rooms; document limits in support copy when video never arrives after relay. |

Copy `.env.example` into `.env.local` for local TURN testing.

### QA: screen share behind restrictive network

1. Two browsers in the same room (mic working in both).
2. Tab A: start screen share; Tab B should see the stage within a few seconds.
3. Tab A on a VPN that blocks UDP: expect the orange **แชร์** badge and Thai “กำลังเชื่อมต่อวิดีโอ…” banner on Tab B; after relay fallback, video should appear if TURN can connect.
4. If video never arrives after ~18s, Tab B shows a VPN/WebRTC hint; try **เชื่อมต่อใหม่** or disable VPN on the sharer.

Local deploy after `npm run build`:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
npm run deploy
```

### GitHub Pages

Hosting was moved off GitHub Pages. In the repo: **Settings → Pages → Build and deployment → Source: None** (or unpublish) so the old `github.io/gather-room` URL is not advertised.

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
