# Calcusite quality pass — 2026-10

## Scope

This change documents current assistant behavior, adds focused regression tests, and records release checks. It does not change the production Worker or deploy the site.

## Repository review

- Project: `Avdhesh-khutar/calcusite`
- Primary stack: HTML/CSS/JavaScript, Cloudflare Worker, Hono
- Quality suite: `tests/smoke.test.js`
- Existing calculator types include EMI, SIP, loan, BMI, age, GST, FD, RD, and percentage.
- The homepage assistant is deterministic and rule-based. It supports safe arithmetic plus limited EMI/loan, SIP, FD, GST, and BMI patterns. It is not a connected generative AI model.

## Changes in this branch

- Clarified assistant limitations and safety expectations in the README.
- Added guidance to keep future LLM credentials server-side, use rate limits, disclose data sent, and preserve deterministic calculator fallback.
- Added two regression tests for percentage-answer formatting, unsupported prompts, and checks against common external-model endpoint / credential patterns in the browser source.
- Clarified that CI tests do not prove that the live Worker has been deployed.

## Verification status

- GitHub branch and pull request are available.
- GitHub Actions workflow `Calcusite checks` ran for commit `a4325e329db386b31d6be85d262d44341b399d16` and reported **success**. This includes the new regression tests.
- The workflow runs `npm test`; the passing CI result is the authoritative test evidence for that commit.
- The tests are source-level checks and do not prove every browser behavior or detect every possible secret format.
- No Cloudflare deployment was triggered.
- No production secrets or API keys were accessed or changed.

## Recommended next checks

1. Review the pull request and merge only when satisfied.
2. Preview the site on mobile and desktop; test calculator inputs, assistant prompts, history, and keyboard navigation.
3. Confirm Worker configuration and secrets in Cloudflare before deployment.
4. If adding an LLM, first choose a provider and privacy policy; keep credentials in Worker secrets, add rate limiting and error handling, and clearly disclose any external data transmission.
