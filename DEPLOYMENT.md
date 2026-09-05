# Publish Edgefront Arena

GitHub Actions builds this game and publishes it to Cloudflare Workers.
The generated server serves the game page and the files in `dist/client`.
This build does not produce a standalone game `index.html` for GitHub Pages.

## One-time setup

1. Sign in to https://dash.cloudflare.com/ or create an account.
2. Open Workers & Pages and complete any initial account setup. Set up a
   workers.dev subdomain if prompted. You do not need to buy a domain.
3. Copy your Cloudflare account ID.
4. Create a Cloudflare API token using the **Edit Cloudflare Workers** template.
   Scope it to the account where you want this game hosted.
5. Open this repository's Settings → Secrets and variables → Actions:
   https://github.com/thecooldude2486-cell/edgefront-arena/settings/secrets/actions
6. Click **New repository secret** and add each of these separately:
   - `CLOUDFLARE_ACCOUNT_ID`: your account ID.
   - `CLOUDFLARE_API_TOKEN`: the token you just created.
   Paste the token into GitHub's secret field, never into code or chat.
7. Open Actions → **Deploy Edgefront Arena** → **Run workflow**, choose `main`,
   and click the green **Run workflow** button.

Official token and account setup instructions:
https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

## Find your game

After a successful deployment, open the run summary for the game link.
It will normally look like `https://edgefront-arena.YOUR-SUBDOMAIN.workers.dev`.
Anyone with that link can open the deployed game; the GitHub repository can stay private.

Future pushes to `main` automatically rebuild and publish the game. Until both
secrets are added, the workflow only verifies the build and clearly reports that
the game has not been deployed. A green build alone does not mean the game is live.
