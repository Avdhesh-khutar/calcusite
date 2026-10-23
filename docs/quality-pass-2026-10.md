# Calcusite quality pass — 2026-10

## Scope

This change documents the current assistant behavior and practical release checks. It does not change the production Worker or deploy the site.

## Repository review

- Project: `Avdhesh-khutar/calcusite`
- Primary stack: HTML/CSS/JavaScript, Cloudflare Worker, Hono
- Existing quality suite: `tests/smoke.test.js`
- Existing calculator types include EMI, SIP, loan, BMI, age, GST, FD, RD, and percentage.
- The homepage assistant is deterministic and rule-based. It supports safe arithmetic plus limited EMI/loan, SIP, FD, GST, and BMI patterns. It is not a connected generative AI model.

## Changes in this branch

- Clarified assistant limitations and safety expectations in the README.
- Added explicit guidance to keep future LLM credentials server-side, use rate limits, disclose data sent, and preserve deterministic calculator fallback.
- Clarified that CI tests do not prove that the live Worker has been deployed.

## Verification status

- GitHub branch created successfully.
- README update committed to this branch.
- Automated test suite has **not** been run in a local Node.js environment in this session; do not interpret this documentation-only change as a passing test run.
- No Cloudflare deployment was triggered.
- No production secrets or API keys were accessed or changed.

## Recommended next checks

1. Run `npm ci` and `npm test` in CI or a Node.js 22 environment.
2. Preview the site on mobile and desktop; test calculator inputs, assistant prompts, history, and keyboard navigation.
3. Confirm the current Worker configuration and secrets in Cloudflare before deployment.
4. If adding an LLM, first choose a provider and privacy policy; keep all credentials in Worker secrets, add rate limiting and error handling, and make any external transmission clear to users.
