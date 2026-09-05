# Publish with GitHub Actions and GitHub Pages

GitHub Actions builds the game. GitHub Pages hosts the resulting website.
The game runs in each visitor's browser and does not need a running server.
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

- Build command: `npm run build:pages`
- Folder to publish: `dist-pages`
- Website entry file: `dist-pages/index.html`
- The workflow automatically publishes future pushes to `main`.
- Local preview: `npm run build:pages`, then `npm run preview:pages`.
  Open the displayed address with `/edgefront-arena/` at the end.

The regular `npm run dev` preview still works. The Pages entry reuses the
existing GameShell, styles, and game code. Only the website wrapper and build
configuration differ from the server preview.
