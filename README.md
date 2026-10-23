# Calcusite

Calcusite is a responsive online calculator website built with HTML, CSS, JavaScript and Cloudflare Workers. It includes a collection of calculators and a GitHub-backed blog with a private Admin Panel.

## Project structure

- `src/index.js` — Cloudflare Worker routes, blog rendering, sitemap/robots, and Admin API
- `public/index.html` — homepage, calculator registry, and rule-based AI calculation assistant
- `public/style.css` — website styling
- `public/script.js` — calculator logic
- `public/admin/` — private blog Admin Panel
- `public/favicon.svg` and `public/manifest.webmanifest` — branded app icon and install metadata
- `content/blog/` — blog articles stored as Markdown
- `tests/smoke.test.js` — automated regression, security-header, metadata, and Admin API tests
- `wrangler.jsonc` — Cloudflare Worker and static assets configuration

## AI assistant scope

The current assistant is a **rule-based calculator helper**, not a connected generative AI/LLM. It safely evaluates supported arithmetic expressions and recognizes a limited set of EMI/loan, SIP, FD, GST, and BMI prompts. It does not send prompts to an external AI service, and it may not understand open-ended questions. Treat financial results as estimates, not financial advice. BMI is a screening measure, not a diagnosis.

A future LLM integration should be opt-in, document the provider and data sent, handle API keys only as server-side Worker secrets, enforce rate limits, and retain a reliable deterministic calculator fallback. Do not place API keys in browser JavaScript.

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

## Quality checks

- Run `npm test` before shipping changes. The Cloudflare deployment workflow runs the full regression suite before attempting deployment, so a failing test prevents a new deployment.
- A green test suite verifies the covered code paths; it does not replace checking the live website on real mobile devices or confirming that Cloudflare secrets are configured.
- Before a release, check the live homepage and representative calculator flows on mobile and desktop, verify keyboard access, and confirm the production Worker version.

## Notes

- The Admin Panel writes Markdown articles directly to the repository's `main` branch.
- Drafts are stored with `published: false`; published articles are included in public blog routes and the sitemap.
- The Admin API uses signed, HttpOnly, Secure, SameSite=Strict session cookies.
- Worker responses apply baseline browser security headers (content-type sniffing protection, referrer policy, frame protection, and restricted camera/microphone/location permissions).
- The web manifest provides basic install metadata; installability and appearance should still be checked on target mobile browsers.
- Automated Admin tests mock GitHub API responses. They validate code paths but do not prove that live Cloudflare secrets are configured or that the latest Worker has been deployed.
