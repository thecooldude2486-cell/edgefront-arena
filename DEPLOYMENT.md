# Publish with GitHub Actions and GitHub Pages

GitHub Actions builds the game. GitHub Pages hosts the resulting website.
Bot matches run in each visitor's browser. Online matches also need the separate
Node room server described in `server/README.md`.
No Cloudflare account or Cloudflare secrets are needed.

## One-time setup

1. Open repository Settings → Pages:
   https://github.com/thecooldude2486-cell/edgefront-arena/settings/pages
2. Under Build and deployment, set Source to **GitHub Actions**.
3. Open Actions → **Deploy Game to GitHub Pages** → **Run workflow** on `main`.
4. Wait for both the build and deploy jobs to turn green. The deployment
   summary provides the live website link.

Expected website address after successful deployment:
https://thecooldude2486-cell.github.io/edgefront-arena/

GitHub Pages on a private repository requires an eligible paid GitHub plan.
If GitHub asks you to upgrade, you can keep the repository private and upgrade,
or choose to make the repository public. Making it public exposes its source
code, so do that only if you want to share it.

## Build details

- The workflow runs game and multiplayer tests before building.
- Build command: `npm run build:pages`
- Folder to publish: `dist-pages`
- Website entry file: `dist-pages/index.html`
- The workflow automatically publishes future pushes to `main`.
- Local preview: `npm run build:pages`, then `npm run preview:pages`.
  Open the displayed address with `/edgefront-arena/` at the end.

The regular `npm run dev` preview still works. The Pages entry reuses the
existing GameShell, styles, and game code. Only the website wrapper and build
configuration differ from the server preview.

## Online room server

The Pages workflow connects the published game to
`wss://edgefront-rooms.onrender.com`. The Render service runs the room server;
GitHub Pages serves the frontend. The checked-in workflow keeps this connection
on future deployments without requiring a repository variable.

To change servers, set repository variable `VITE_MULTIPLAYER_URL` in
**Settings → Secrets and variables → Actions → Variables** to the new public
`wss://` address and rerun the Pages workflow. That variable overrides the default.
On the room server, allow `https://thecooldude2486-cell.github.io` in
`ALLOWED_ORIGINS`. Validate the server with:

```bash
node server/check-hosted.mjs https://edgefront-rooms.onrender.com
```

For local frontend builds, set `VITE_MULTIPLAYER_URL` explicitly when using a
hosted room server. Localhost without an override still uses port 3008.
The free Render server can take about a minute to wake after inactivity;
the game retries the connection automatically.
