# Calcusite

Calcusite is a responsive online calculator website built with HTML, CSS, JavaScript and Cloudflare Workers. It includes a collection of calculators and a GitHub-backed blog with a private Admin Panel.

## Project structure

- `src/index.js` — Cloudflare Worker routes, blog rendering, sitemap/robots, and Admin API
- `public/index.html` — homepage and calculator registry
- `public/style.css` — website styling
- `public/script.js` — calculator logic
- `public/admin/` — private blog Admin Panel
- `content/blog/` — blog articles stored as Markdown
- `tests/smoke.test.js` — automated regression and Admin API tests
- `wrangler.jsonc` — Cloudflare Worker and static assets configuration

## Requirements

- Node.js 22 or newer
- A Cloudflare account for deployment
- A GitHub token with permission to read and write repository contents for the blog Admin Panel

## Install and run locally

```bash
npm install
npm test
npm run dev
```

Open the local URL printed by Wrangler. The Admin Panel is available at `/admin/`.

## Deploy to Cloudflare

Authenticate Wrangler first, then deploy:

```bash
npx wrangler login
npm run deploy
```

The deployment must target the same Cloudflare account and Worker used by your public site. A successful GitHub Actions test does **not** automatically deploy the Worker.

## Configure Admin Panel secrets

Set these as **Worker secrets/environment variables in the Cloudflare dashboard** for the `calcusite` Worker. Never put real values in `public/admin/admin.js`, HTML, source control, or screenshots.

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Strong password used to sign in to `/admin/` |
| `SESSION_SECRET` | Long random secret used to sign session cookies; keep it private |
| `GITHUB_TOKEN` | GitHub token allowed to read and update repository contents for `Avdhesh-khutar/calcusite` |

Use a separate, long random value for `SESSION_SECRET`. Give the GitHub token only the minimum required repository access. If any secret has ever been exposed publicly, rotate it immediately.

After setting the secrets, redeploy the Worker if your deployment process requires it, then verify:

1. `/admin/` loads.
2. An incorrect password is rejected.
3. The correct password opens the Admin Panel.
4. The article list loads from GitHub.
5. Save a test article as a draft and confirm it does not appear on public `/blog` or in `/sitemap.xml`.
6. Publish the article and confirm its public page appears. Delete the test article from the repository after testing if it is no longer needed.

Do not test publishing against the live blog unless you are comfortable creating a real commit in the repository.

## Notes

- The Admin Panel writes Markdown articles directly to the repository's `main` branch.
- Drafts are stored with `published: false`; published articles are included in public blog routes and the sitemap.
- The Admin API uses signed, HttpOnly, Secure, SameSite=Strict session cookies.
- Automated Admin tests mock GitHub API responses. They validate code paths but do not prove that live Cloudflare secrets are configured or that the latest Worker has been deployed.
