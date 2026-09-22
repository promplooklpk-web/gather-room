# MTL Click — Voice Rooms

Discord-style voice rooms with microphone and full-screen share. No accounts required.

**Live:** `https://gather-room.<your-workers-subdomain>.workers.dev/` after CI deploy (see Deploy below)

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
