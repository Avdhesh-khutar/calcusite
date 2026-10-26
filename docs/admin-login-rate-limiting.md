# Admin login rate limiting

Calcusite's Worker validates the admin password at `POST /api/admin/login`. The Worker does not currently have a durable, shared counter for failed logins. Do not rely on a process-local counter: Cloudflare Workers can run across multiple isolates, so such a counter is not a dependable security boundary.

## Configure a Cloudflare edge rule

Configure a rate-limiting rule for the production hostname `calcusite.in` before treating the admin login as protected against repeated password guesses.

1. Open the Cloudflare dashboard and select the zone for `calcusite.in`.
2. Open **Security → WAF → Rate limiting rules** (dashboard wording can vary).
3. Create a rule matching all of these:
   - Hostname is `calcusite.in`
   - URI path equals `/api/admin/login`
   - HTTP request method equals `POST`
4. Where the account's plan and rule UI support it, start with a threshold of **5 requests per IP per 1 minute** and an action of **Block** for **10 minutes**.
5. Save the rule and verify it is enabled. Check the rule's event/log view after a controlled test.

Use the dashboard's available options if threshold, mitigation duration, or matching fields differ by plan. Do not block all of `/api/admin/*`: legitimate authenticated article operations use those paths too. Avoid exposing credentials or testing repeated guesses against production.

## Verification checklist

- A normal login with the correct password still works.
- A wrong password returns the existing generic `401` response.
- Repeated POST requests from one test IP are mitigated at the Cloudflare edge after the configured threshold.
- Requests to unrelated public pages and blog URLs continue to work.
- Review Cloudflare security events to confirm the rule, rather than assuming that a saved rule is active.

## Important limitations

- This dashboard rule is not created by the repository or by deploying the Worker. A zone administrator must configure and verify it in Cloudflare.
- Rule availability and options depend on the Cloudflare plan and dashboard configuration.
- Rate limiting by IP can affect users behind shared networks and can be bypassed by distributed sources; it is one layer of defense, not a complete authentication strategy.
- Keep `ADMIN_PASSWORD` and `SESSION_SECRET` in Worker secrets. Never commit either value to this repository.
