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

function blogEsc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function blogParse(raw, slug) {
  const meta={title:slug.replace(/-/g," "),description:"",slug,published:true,updated:""};
  let body=raw;
  if(raw.startsWith("---\n")) { const end=raw.indexOf("\n---",4); if(end>=0) { for(const line of raw.slice(4,end).split("\n")) { const m=line.match(/^([a-zA-Z]+):\s*(.*)$/); if(m && m[1] in meta) { let v=m[2].trim(); try{v=JSON.parse(v)}catch{v=v.replace(/^['"]|['"]$/g,"")} meta[m[1]]=v; } } body=raw.slice(end+4).trim(); } }
  return {...meta,body};
}
function blogInline(s) {
  return s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" rel="noopener noreferrer">$1</a>');
}
function blogMarkdown(s) {
  const lines=blogEsc(s).replace(/\r/g,"").split("\n"), out=[]; let p=[], list="";
  const fp=()=>{if(p.length){out.push("<p>"+p.join(" ")+"</p>");p=[]}};
  const fl=()=>{if(list){out.push("</"+list+">");list=""}};
  for(const line of lines){const t=line.trim(); if(!t){fp();fl();continue;}
    const h=t.match(/^(#{1,3})\s+(.+)$/); if(h){fp();fl();const n=h[1].length;out.push("<h"+n+">"+blogInline(h[2])+"</h"+n+">");continue}
    const li=t.match(/^[-*]\s+(.+)$/)||t.match(/^\d+\.\s+(.+)$/);
    if(li){fp();const want=/^\d+\./.test(t)?"ol":"ul";if(list!==want){fl();list=want;out.push("<"+list+">")}out.push("<li>"+blogInline(li[1])+"</li>");continue}
    fl();p.push(blogInline(t));
  } fp();fl();return out.join("\n");
}
function blogHtml(title, content, description="Calcusite guides and resources") {
 return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+blogEsc(title)+' | Calcusite</title><meta name="description" content="'+blogEsc(description)+'"><meta name="robots" content="index,follow"><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fc;color:#14213d;font:16px/1.75 system-ui,sans-serif}header{background:white;border-bottom:1px solid #e0e8f7}.bar{max-width:900px;margin:auto;padding:16px 20px;display:flex;justify-content:space-between;gap:12px}.brand,a{color:#1d5de8}.brand{font-size:21px;font-weight:800;text-decoration:none}.wrap{max-width:820px;margin:32px auto;padding:0 18px}.intro,.article,.post{background:white;border:1px solid #e0e8f7;border-radius:18px;padding:clamp(22px,5vw,38px);margin-bottom:16px}.eyebrow,.date{color:#64708f;font-size:13px}h1{font-size:clamp(30px,5vw,44px);line-height:1.2;margin:8px 0 14px}h2{line-height:1.3;margin-top:28px}p,li{color:#34415d}.post{text-decoration:none;display:block}.post h2{margin:0 0 8px;color:#14213d}.post p{margin:0}.article ul,.article ol{padding-left:24px}footer{text-align:center;color:#64708f;padding:24px;font-size:13px}</style></head><body><header><div class="bar"><a class="brand" href="/">∑ Calcusite</a><a href="/">← Back to calculators</a></div></header><main class="wrap">'+content+'</main><footer>© 2026 Calcusite · Smart Calculations, Smarter Decisions</footer></body></html>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60"}});
}
async function serveBlog(request, env, url) {
 const path=decodeURIComponent(url.pathname); let files=[];
 try { const d=await github(request,env,"/repos/Avdhesh-khutar/calcusite/contents/content/blog?ref=main"); files=Array.isArray(d)?d.filter(x=>x.type==="file"&&x.name.endsWith(".md")):[]; }
 catch(e){if(e.status!==404)return blogHtml("Blog temporarily unavailable",'<section class="intro"><h1>Blog temporarily unavailable</h1><p>Please refresh in a moment.</p></section>');}
 if(path==="/blog"||path==="/blog/"){
   const posts=[];
   for(const f of files){try{const item=await github(request,env,"/repos/Avdhesh-khutar/calcusite/contents/"+f.path.split("/").map(encodeURIComponent).join("/")+"?ref=main");const dec=atob((item.content||"").replace(/\n/g,""));const raw=new TextDecoder().decode(Uint8Array.from(dec,c=>c.charCodeAt(0)));const p=blogParse(raw,f.name.replace(/\.md$/,""));if(p.published===false||p.published==="false")continue;posts.push({...p,slug:f.name.replace(/\.md$/,"")});}catch{}}
   posts.sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
   const uniquePosts=[]; const seenPosts=new Set(); for(const p of posts){const key=String(p.title||p.slug).trim().toLowerCase();if(seenPosts.has(key))continue;seenPosts.add(key);uniquePosts.push(p);}
   const list=uniquePosts.length?uniquePosts.map(p=>'<a class="post" href="/blog/'+encodeURIComponent(p.slug)+'"><div class="date">'+blogEsc(p.updated||"Calcusite guide")+'</div><h2>'+blogEsc(p.title)+'</h2><p>'+blogEsc(p.description||"Read this practical guide from Calcusite.")+'</p><p><strong>Read article →</strong></p></a>').join(""):'<section class="intro">No articles published yet. Please check back soon.</section>';
   return blogHtml("Blog & Guides",'<section class="intro"><div class="eyebrow">CALCUSITE RESOURCES</div><h1>Blog &amp; Guides</h1><p>Practical guides to loans, calculators, personal finance, and smarter everyday decisions.</p></section>'+list,"Practical calculator guides and financial explainers from Calcusite.");
 }
 const slug=path.slice("/blog/".length).replace(/\/$/,""); if(!validSlug(slug))return blogHtml("Article not found",'<section class="intro"><h1>Article not found</h1><a href="/blog">Browse all articles</a></section>');
 try{const item=await github(request,env,"/repos/Avdhesh-khutar/calcusite/contents/content/blog/"+encodeURIComponent(slug)+".md?ref=main");const dec=atob((item.content||"").replace(/\n/g,""));const raw=new TextDecoder().decode(Uint8Array.from(dec,c=>c.charCodeAt(0)));const p=blogParse(raw,slug);if(p.published===false||p.published==="false")return blogHtml("Article not found",'<section class="intro"><h1>Article not published</h1><a href="/blog">Browse articles</a></section>');const bodyLines=p.body.split("\n"); const firstHeading=bodyLines.findIndex(line=>line.trim()); if(firstHeading>=0){const firstBodyTitle=bodyLines[firstHeading].trim().replace(/^#{1,6}\s+/,"").trim();if(firstBodyTitle.toLowerCase()===String(p.title).trim().toLowerCase())bodyLines.splice(firstHeading,1);} return blogHtml(p.title,'<p class="date"><a href="/blog">Blog</a> / '+blogEsc(p.updated)+'</p><article class="article"><h1>'+blogEsc(p.title)+'</h1>'+(p.description?'<p><strong>'+blogEsc(p.description)+'</strong></p>':'')+blogMarkdown(bodyLines.join("\n"))+'<hr><p><a href="/blog">← Back to all articles</a></p></article>',p.description||p.title);}
 catch(e){return blogHtml("Article not found",'<section class="intro"><h1>Article not found</h1><p>This article may not have been published yet.</p><a href="/blog">Browse all articles</a></section>');}
}


function xmlEsc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
async function serveSitemap(request, env) {
  const origin = "https://calcusite.com";
  const urls = [{ loc: origin + "/", changefreq: "weekly", priority: "1.0" }, { loc: origin + "/blog", changefreq: "weekly", priority: "0.8" }];
  try {
    const files = await github(request, env, "/repos/Avdhesh-khutar/calcusite/contents/content/blog?ref=main");
    if (Array.isArray(files)) {
      for (const f of files.filter(x => x.type === "file" && x.name.endsWith(".md"))) {
        try {
          const item = await github(request, env, "/repos/Avdhesh-khutar/calcusite/contents/" + f.path.split("/").map(encodeURIComponent).join("/") + "?ref=main");
          const dec = atob((item.content || "").replace(/\\n/g, ""));
          const raw = new TextDecoder().decode(Uint8Array.from(dec, ch => ch.charCodeAt(0)));
          const p = blogParse(raw, f.name.replace(/\\.md$/, ""));
          if (p.published === false || p.published === "false") continue;
          const slug = String(p.slug || f.name.replace(/\\.md$/, ""));
          if (!validSlug(slug)) continue;
          urls.push({ loc: origin + "/blog/" + encodeURIComponent(slug), lastmod: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(p.updated)) ? p.updated : "", changefreq: "monthly", priority: "0.6" });
        } catch {}
      }
    }
  } catch {}
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + xmlEsc(u.loc) + '</loc>' + (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '') + '<changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>').join("") + '</urlset>';
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
function serveRobots() {
  return new Response("User-agent: *\\nAllow: /\\nDisallow: /admin/\\nDisallow: /api/\\nSitemap: https://calcusite.com/sitemap.xml\\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt") return serveRobots();\n    if (url.pathname === "/sitemap.xml") return serveSitemap(request, env);\n    if (url.pathname.startsWith("/api/admin/")) return adminApi(request, env, url);
    if (url.pathname === "/blog" || url.pathname === "/blog/" || url.pathname.startsWith("/blog/")) return serveBlog(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
