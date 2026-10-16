const API = "https://api.github.com";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function cookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}
function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
async function makeSession(secret) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return payload + "." + await sign(payload, secret);
}
async function validSession(request, secret) {
  if (!secret) return false;
  const token = cookie(request, "calcusite_admin");
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await sign(payload, secret) === signature)) return false;
  try { return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).exp > Date.now(); } catch { return false; }
}
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function validSlug(s) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80; }
async function github(request, env, path, options = {}) {
  if (!env.GITHUB_TOKEN) throw new Error("GitHub write token is not configured in Cloudflare Worker secrets.");
  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "User-Agent": "CalcusiteAdmin/1.0 (https://calcusite.com)",
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    const detail = typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : raw.trim().slice(0, 240);
    const err = new Error("GitHub API HTTP " + response.status + (detail ? ": " + detail : "."));
    err.status = response.status;
    throw err;
  }
  return body;
}
async function adminApi(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": url.origin, "Access-Control-Allow-Credentials": "true", "Vary": "Origin" } });
  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Admin login is not configured. Set ADMIN_PASSWORD and SESSION_SECRET in Cloudflare Worker secrets." }, 503);
    const body = await request.json().catch(() => ({}));
    if (typeof body.password !== "string" || body.password.length > 256 || body.password !== env.ADMIN_PASSWORD) return json({ error: "Password is incorrect." }, 401);
    const token = await makeSession(env.SESSION_SECRET);
    return json({ ok: true }, 200, { "Set-Cookie": "calcusite_admin=" + encodeURIComponent(token) + "; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800" });
  }
  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": "calcusite_admin=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  }
  if (!(await validSession(request, env.SESSION_SECRET))) return json({ error: "Please sign in again." }, 401);
  try {
    if (url.pathname === "/api/admin/me" && request.method === "GET") return json({ ok: true });
    if (url.pathname === "/api/admin/articles" && request.method === "GET") {
      let data = [];
      try { data = await github(request, env, "/repos/Avdhesh-khutar/calcusite/contents/content/blog?ref=main"); }
      catch (e) { if (e.status !== 404) throw e; }
      const files = Array.isArray(data) ? data.filter(x => x.type === "file" && x.name.endsWith(".md")) : [];
      return json({ articles: files.map(f => ({ name: f.name, slug: f.name.replace(/\.md$/, ""), path: f.path, url: f.html_url, sha: f.sha })) });
    }
    if (url.pathname === "/api/admin/article" && request.method === "GET") {
      const slug = url.searchParams.get("slug") || "";
      if (!validSlug(slug)) return json({ error: "Invalid article slug." }, 400);
      try {
        const file = await github(request, env, "/repos/Avdhesh-khutar/calcusite/contents/content/blog/" + slug + ".md?ref=main");
        const decoded = atob(file.content.replace(/\n/g, ""));
        const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
        return json({ slug, content: new TextDecoder().decode(bytes), sha: file.sha, url: file.html_url });
      } catch (e) { if (e.status === 404) return json({ error: "Article not found." }, 404); throw e; }
    }
    if (url.pathname === "/api/admin/article" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      const slug = slugify(body.slug || title);
      if (!title) return json({ error: "Please enter an article title." }, 400);
      if (!validSlug(slug)) return json({ error: "Please use a valid URL slug (letters, numbers and hyphens)." }, 400);
      if (content.length < 30) return json({ error: "Article content must be at least 30 characters." }, 400);
      if (content.length > 100000) return json({ error: "Article is too long (100,000 character limit)." }, 413);
      const path = "/repos/Avdhesh-khutar/calcusite/contents/content/blog/" + slug + ".md";
      let sha;
      try { const old = await github(request, env, path + "?ref=main"); sha = old.sha; }
      catch (e) { if (e.status !== 404) throw e; }
      if (body.mode === "create" && sha) return json({ error: "This slug already exists. Choose another slug or open the existing article." }, 409);
      if (body.mode === "update" && !sha) return json({ error: "This article no longer exists. Refresh the list and try again." }, 404);
      const frontmatter = [
        "---",
        "title: " + JSON.stringify(title),
        "description: " + JSON.stringify(String(body.description || "").trim().slice(0, 300)),
        "slug: " + JSON.stringify(slug),
        "published: " + (body.published === false ? "false" : "true"),
        "updated: " + new Date().toISOString().slice(0, 10),
        "---",
        "",
        content,
        ""
      ].join("\n");
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(frontmatter)));
      const result = await github(request, env, path, { method: "PUT", body: JSON.stringify({
        message: (sha ? "Update" : "Publish") + " blog article: " + title,
        content: encoded,
        branch: "main",
        ...(sha ? { sha } : {})
      }) });
      return json({ ok: true, slug, path: result.content.path, commit: result.commit.sha, url: result.content.html_url, updated: Boolean(sha) }, 200);
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: e.message || "Server error." }, e.status && e.status >= 400 && e.status < 600 ? e.status : 500);
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/")) return adminApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
