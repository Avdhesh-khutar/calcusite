const API = "https://api.github.com";
const SITE_ORIGIN = "https://calcusite.in";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function cookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  if (!item) return "";
  try { return decodeURIComponent(item.slice(name.length + 1)); }
  catch { return ""; }
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
async function githubPublic(path) {
  const response = await fetch(API + path, {
    headers: {
      "User-Agent": "CalcusitePublic/1.0",
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    const detail = typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : raw.trim().slice(0, 240);
    const err = new Error("GitHub public API HTTP " + response.status + (detail ? ": " + detail : "."));
    err.status = response.status;
    throw err;
  }
  return body;
}
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
      if (body.mode !== "create" && body.mode !== "update") return json({ error: "Invalid save mode. Refresh the editor and try again." }, 400);
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
      // Keep the public blog manifest in sync with every article save.
      // The public listing and sitemap both read this manifest.
      const manifestPath = "/repos/Avdhesh-khutar/calcusite/contents/content/blog/index.json";
      let manifestFile;
      let manifest = { articles: [] };
      try {
        manifestFile = await github(request, env, manifestPath + "?ref=main");
        const decodedManifest = atob(String(manifestFile.content || "").replace(/\\n/g, ""));
        const manifestBytes = Uint8Array.from(decodedManifest, c => c.charCodeAt(0));
        manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      if (!Array.isArray(manifest.articles)) manifest.articles = [];
      if (!manifest.articles.includes(slug)) {
        manifest.articles.push(slug);
        manifest.articles.sort();
        const manifestText = JSON.stringify(manifest, null, 2) + "\\n";
        const manifestBytes = new TextEncoder().encode(manifestText);
        let binary = "";
        for (const byte of manifestBytes) binary += String.fromCharCode(byte);
        const manifestEncoded = btoa(binary);
        await github(request, env, manifestPath, { method: "PUT", body: JSON.stringify({
          message: "Update blog article manifest: " + slug,
          content: manifestEncoded,
          branch: "main",
          ...(manifestFile ? { sha: manifestFile.sha } : {})
        }) });
      }
      return json({ ok: true, slug, path: result.content.path, commit: result.commit.sha, url: result.content.html_url, updated: Boolean(sha), published: body.published !== false }, 200);
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
function blogHtml(title, content, description="Calcusite guides and resources", canonicalUrl="") {
 const schema=canonicalUrl?(canonicalUrl.endsWith("/blog")?{"@context":"https://schema.org","@type":"CollectionPage","name":title,"description":description,"url":canonicalUrl,"isPartOf":{"@type":"WebSite","name":"Calcusite","url":new URL("/",canonicalUrl).href}}:{"@context":"https://schema.org","@type":"BlogPosting","headline":title,"description":description,"mainEntityOfPage":canonicalUrl,"url":canonicalUrl,"publisher":{"@type":"Organization","name":"Calcusite","url":new URL("/",canonicalUrl).href}}):null;
 const structuredData=schema?'<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,"\\u003c")+'</script>':"";
 return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+blogEsc(title)+' | Calcusite</title><meta name="description" content="'+blogEsc(description)+'"><meta name="robots" content="index,follow">'+(canonicalUrl?'<link rel="canonical" href="'+blogEsc(canonicalUrl)+'"><meta property="og:type" content="'+(canonicalUrl.endsWith("/blog")?"website":"article")+'"><meta property="og:site_name" content="Calcusite"><meta property="og:title" content="'+blogEsc(title)+'"><meta property="og:description" content="'+blogEsc(description)+'"><meta property="og:url" content="'+blogEsc(canonicalUrl)+'">' : '')+structuredData+'<style>*{box-sizing:border-box}body{margin:0;background:#f3f6fc;color:#14213d;font:16px/1.75 system-ui,sans-serif}header{background:white;border-bottom:1px solid #e0e8f7}.bar{max-width:900px;margin:auto;padding:16px 20px;display:flex;justify-content:space-between;gap:12px}.brand,a{color:#1d5de8}.brand{font-size:21px;font-weight:800;text-decoration:none}.wrap{max-width:820px;margin:32px auto;padding:0 18px}.intro,.article,.post{background:white;border:1px solid #e0e8f7;border-radius:18px;padding:clamp(22px,5vw,38px);margin-bottom:16px}.eyebrow,.date{color:#64708f;font-size:13px}h1{font-size:clamp(30px,5vw,44px);line-height:1.2;margin:8px 0 14px}h2{line-height:1.3;margin-top:28px}p,li{color:#34415d}.post{text-decoration:none;display:block}.post h2{margin:0 0 8px;color:#14213d}.post p{margin:0}.article ul,.article ol{padding-left:24px}.language-tools{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:#eaf1ff;border:1px solid #cfddfb;border-radius:14px;padding:12px 14px;margin:0 0 16px}.language-tools strong{font-size:14px}.language-tools button{border:0;border-radius:999px;padding:9px 13px;background:#1d5de8;color:white;font:inherit;font-weight:750;cursor:pointer}.language-tools button:last-of-type{background:white;color:#1d5de8;border:1px solid #b9ccfa}.language-tools #translate-status{font-size:12px;color:#52617d}html,body{margin-top:0!important;top:0!important}iframe.goog-te-banner-frame,.goog-te-banner-frame,.VIpgJd-ZVi9od-ORHb-OEVmcd-frame{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;pointer-events:none!important}body > .skiptranslate{display:none!important}.language-tools #google_translate_element{flex-basis:100%;font-size:12px}.language-tools #google_translate_element .goog-te-gadget{font-size:12px!important}.language-tools #google_translate_element select{max-width:100%;border:1px solid #cbd8ef;border-radius:8px;padding:5px;background:#fff;color:#14213d}.language-tools button:focus-visible{outline:3px solid #8bb4ff;outline-offset:2px}footer{text-align:center;color:#64708f;padding:24px;font-size:13px}.wrap{max-width:1120px;margin:28px auto;padding:0 18px}.intro{padding:clamp(24px,5vw,48px);overflow:hidden;background:linear-gradient(120deg,#e1f4ff 0%,#d7f7f0 46%,#e4e8ff 100%);position:relative;border:0}.intro:after{content:"📚";position:absolute;right:5%;bottom:0;font-size:clamp(72px,14vw,150px);opacity:.85;filter:drop-shadow(0 12px 14px #2c62bb25)}.eyebrow{font-weight:800;letter-spacing:.12em;color:#2459c7}.intro h1{font-size:clamp(36px,6vw,58px);font-weight:850;letter-spacing:-.04em}.intro h1 span{color:#1d5de8}.intro p{max-width:620px;font-size:clamp(17px,2.4vw,21px);line-height:1.65;margin-bottom:0}.blog-stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.blog-stat{background:#ffffffc9;border:1px solid #ffffff;border-radius:14px;padding:9px 13px;font-size:13px;font-weight:700}.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:28px 0 14px}.section-head h2{font-size:clamp(23px,3vw,30px);margin:0;letter-spacing:-.03em}.section-head a,.all-link{border:1px solid #b9ccfa;border-radius:999px;padding:7px 14px;font-weight:700;text-decoration:none;white-space:nowrap}.category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.category-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;text-decoration:none;color:#14213d;border-radius:19px;border:1px solid #e2e9f7;box-shadow:0 5px 15px #18386a0a;transition:transform .18s,box-shadow .18s;background:white}.category-card:hover{transform:translateY(-3px);box-shadow:0 12px 25px #18386a17}.category-art{height:112px;display:grid;place-items:center;font-size:54px;background:linear-gradient(135deg,var(--tint),#fff)}.category-copy{padding:14px 15px 16px;display:flex;flex-direction:column;flex:1}.category-copy h3{margin:0 0 5px;font-size:17px;line-height:1.3}.category-copy p{margin:0 0 12px;font-size:13px;line-height:1.5;flex:1}.category-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px}.count-pill{background:var(--tint);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:750}.arrow-pill{width:30px;height:30px;border-radius:50%;background:var(--tint);display:grid;place-items:center;font-size:18px;font-weight:800}.latest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.post{padding:0;overflow:hidden;margin:0;border-radius:18px;box-shadow:0 5px 16px #18386a0a;transition:transform .18s,box-shadow .18s}.post:hover{transform:translateY(-3px);box-shadow:0 12px 25px #18386a16}.post-art{height:150px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);overflow:hidden}.post-art img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}.post:hover .post-art img{transform:scale(1.04)}.post-copy{padding:17px 18px 19px}.post-copy .date{display:inline-block;background:#f1f5f9;border-radius:999px;padding:3px 9px;margin-bottom:9px}.post-copy h3{margin:0 0 8px;color:#14213d;font-size:19px;line-height:1.35}.post-copy p{font-size:14px;line-height:1.6;margin:0 0 12px}.post-copy strong{color:#1d5de8}.blog-search{display:flex;gap:8px;margin-top:22px;max-width:720px}.blog-search input{min-width:0;flex:1;border:1px solid #cbd8ef;border-radius:14px;background:#fff;padding:13px 15px;font:inherit;outline-color:#1d5de8}.blog-search button{border:0;border-radius:14px;padding:0 20px;background:#1d5de8;color:white;font:inherit;font-weight:800}.filter-note{color:#64708f;font-size:14px;margin:0 0 14px}.empty-state{padding:28px;background:white;border:1px dashed #cbd8ef;border-radius:18px}@media(max-width:850px){.category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.latest-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.post-art{height:135px}}@media(max-width:560px){.wrap{margin:20px auto;padding:0 12px}.intro{padding:25px 22px}.intro:after{right:3%;bottom:4px;font-size:74px;opacity:.4}.intro p{max-width:95%;font-size:16px}.blog-stats{gap:7px}.blog-stat{padding:7px 9px;font-size:11px}.section-head{margin:24px 0 12px;align-items:flex-start}.section-head h2{font-size:22px}.category-grid{gap:10px}.category-art{height:90px;font-size:43px}.category-copy{padding:12px 11px}.category-copy h3{font-size:15px}.category-copy p{font-size:12px}.count-pill{font-size:11px;padding:4px 8px}.latest-grid{grid-template-columns:1fr;gap:13px}.post-art{height:170px}.post-copy{padding:15px}.post-copy h3{font-size:18px}.blog-search{gap:6px}.blog-search button{padding:0 13px}}</style></head><body><header><div class="bar"><a class="brand" href="/">∑ Calcusite</a><a href="/">← Back to calculators</a></div></header><main class="wrap">'+content+'</main><footer>© 2026 Calcusite · Smart Calculations, Smarter Decisions</footer></body></html>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60"}});
}
let blogListingMemoryCache={expiresAt:0,posts:null};
let sitemapMemoryCache={expiresAt:0,xml:""};
async function serveBlog(request, env, url) {
 let path; try { path=decodeURIComponent(url.pathname); } catch { return blogHtml("Invalid URL", '<section class="intro"><h1>Invalid URL</h1><a href="/blog">Browse articles</a></section>'); }
 if(path==="/blog"||path==="/blog/"){
   let posts=[];
   if(blogListingMemoryCache.posts&&blogListingMemoryCache.expiresAt>Date.now()){posts=blogListingMemoryCache.posts;}
   else {
     let slugs=[];
     try { const response=await fetch("https://raw.githubusercontent.com/Avdhesh-khutar/calcusite/main/content/blog/index.json",{headers:{"User-Agent":"CalcusitePublic/1.0"}}); if(!response.ok)throw new Error("Blog index unavailable: "+response.status); const manifest=await response.json(); slugs=Array.isArray(manifest.articles)?manifest.articles.filter(validSlug):[]; }
     catch(e){return blogHtml("Blog temporarily unavailable",'<section class="intro"><h1>Blog temporarily unavailable</h1><p>We are recovering the article list. Please try again shortly.</p></section>');}
     const loaded=await Promise.all(slugs.map(async slug=>{try{const articleResponse=await fetch("https://raw.githubusercontent.com/Avdhesh-khutar/calcusite/main/content/blog/"+encodeURIComponent(slug)+".md",{headers:{"User-Agent":"CalcusitePublic/1.0"}});if(!articleResponse.ok)throw new Error("Blog article fetch failed: "+articleResponse.status);const raw=await articleResponse.text();const p=blogParse(raw,slug);if(p.published===false||p.published==="false")return null;return {...p,slug};}catch{return null;}}));
     posts=loaded.filter(Boolean).sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
     blogListingMemoryCache={expiresAt:Date.now()+5*60*1000,posts};
   }
   const uniquePosts=[]; const seenPosts=new Set(); for(const p of posts){const key=String(p.title||p.slug).trim().toLowerCase();if(seenPosts.has(key))continue;seenPosts.add(key);uniquePosts.push(p);}
   const categories=[
    {id:"loan-emi",name:"Loan & EMI",desc:"Home, personal and car loan guides",icon:"🏠",tint:"#cceeff",keywords:/loan|emi|mortgage|borrow|lending/},
    {id:"investment",name:"Investment",desc:"SIP, FD, RD, PPF and returns",icon:"🌱",tint:"#c9f7d5",keywords:/sip|investment|invest|fd calculator|fixed deposit|rd calculator|ppf|cagr|mutual fund/},
    {id:"tax-gst",name:"Tax & GST",desc:"GST, tax planning and percentages",icon:"🧮",tint:"#e4d5ff",keywords:/gst|tax|tds|vat|percentage|duty/},
    {id:"health",name:"Health & Fitness",desc:"BMI, calories and healthy habits",icon:"💗",tint:"#ffe0cc",keywords:/bmi|health|fitness|calorie|bmr|weight|water intake/},
    {id:"personal-finance",name:"Personal Finance",desc:"Budgeting, savings and money basics",icon:"🪙",tint:"#ffd6e5",keywords:/saving|budget|personal finance|inflation|net worth|money/},
    {id:"business",name:"Business",desc:"Profit, margin, break-even and ROI",icon:"💼",tint:"#c9fbf0",keywords:/business|profit|loss|margin|break-even|roi|salary/},
    {id:"education",name:"Education",desc:"Marks, grades and study calculators",icon:"🎓",tint:"#e8ddff",keywords:/marks|grade|cgpa|education|student|attendance/},
    {id:"travel",name:"Travel & Lifestyle",desc:"Currency, distance and everyday tools",icon:"🌍",tint:"#fff0bd",keywords:/currency|travel|distance|fuel|mileage|unit converter|speed/}
   ];
   const categoryFor=p=>{const text=(p.title+" "+p.description+" "+p.slug).toLowerCase();return (categories.find(c=>c.keywords.test(text))||categories[4]).id;};
   const catFilter=(url.searchParams.get("category")||"").toLowerCase();
   const query=(url.searchParams.get("q")||"").trim().toLowerCase();
   const visiblePosts=uniquePosts.filter(p=>(!catFilter||categoryFor(p)===catFilter)&&(!query||(p.title+" "+p.description+" "+p.slug).toLowerCase().includes(query)));
   const imageFor=p=>{const text=(p.title+" "+p.slug).toLowerCase();if(/bmi|health|fitness|calorie|water/.test(text))return "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80";if(/gst|tax|tds|percentage|discount/.test(text))return "https://images.unsplash.com/photo-1554224154-22dec7ec8818?auto=format&fit=crop&w=900&q=80";if(/sip|investment|fd calculator|fixed deposit|rd calculator|ppf|cagr/.test(text))return "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=900&q=80";if(/age|date|calendar/.test(text))return "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=900&q=80";if(/currency|travel|distance|fuel|mileage/.test(text))return "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80";if(/marks|grade|cgpa|education|student/.test(text))return "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80";if(/business|profit|salary|roi/.test(text))return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80";return "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80";};
   const categoryCards=categories.map(c=>{const count=uniquePosts.filter(p=>categoryFor(p)===c.id).length;return '<a class="category-card" href="/blog?category='+c.id+'" style="--tint:'+c.tint+'"><div class="category-art">'+c.icon+'</div><div class="category-copy"><h3>'+blogEsc(c.name)+'</h3><p>'+blogEsc(c.desc)+'</p><div class="category-bottom"><span class="count-pill">'+count+' '+(count===1?'article':'articles')+'</span><span class="arrow-pill">→</span></div></div></a>';}).join("");
   const list=visiblePosts.length?visiblePosts.map(p=>'<a class="post" href="/blog/'+encodeURIComponent(p.slug)+'"><div class="post-art"><img src="'+imageFor(p)+'" alt="" loading="lazy" decoding="async"></div><div class="post-copy"><div class="date">'+blogEsc(p.updated||"Calcusite guide")+'</div><h3>'+blogEsc(p.title)+'</h3><p>'+blogEsc(p.description||"Read this practical guide from Calcusite.")+'</p><strong>Read article →</strong></div></a>').join(""):'<div class="empty-state">No articles match this filter yet. Try another category or search term.</div>';
   const currentCat=categories.find(c=>c.id===catFilter);
   const heading=currentCat?currentCat.name+" Guides":query?"Search Results":"Latest Articles";
   const hero='<section class="intro"><div class="eyebrow">✦ CALCUSITE RESOURCES</div><h1>Blog <span>&amp; Guides</span></h1><p>Practical guides to loans, calculators, investing, taxes and smarter everyday decisions.</p><div class="blog-stats"><span class="blog-stat">📚 '+uniquePosts.length+' Published Guides</span><span class="blog-stat">🧭 8 Topic Categories</span><span class="blog-stat">✨ Free to Read</span></div><form class="blog-search" action="/blog" method="get"><input name="q" value="'+blogEsc(query)+'" placeholder="Search articles and guides..." aria-label="Search blog articles"><button type="submit">Search →</button></form></section>';
   const cats='<div class="section-head"><h2>🎨 Explore by Category</h2><a class="all-link" href="/blog">View all →</a></div><section class="category-grid">'+categoryCards+'</section>';
   const latest='<div class="section-head"><h2>📖 '+blogEsc(heading)+'</h2>'+(currentCat||query?'<a class="all-link" href="/blog">Clear filter ×</a>':'<a class="all-link" href="/blog">All articles →</a>')+'</div>'+(currentCat||query?'<p class="filter-note">Showing '+visiblePosts.length+' of '+uniquePosts.length+' guides.</p>':'')+'<section class="latest-grid">'+list+'</section>';
   return blogHtml("Blog & Guides",hero+cats+latest,"Explore colorful categories and practical calculator guides for loans, investing, taxes, health, education and everyday decisions.",SITE_ORIGIN + "/blog");
 }
 const slug=path.slice("/blog/".length).replace(/\/$/,""); if(!validSlug(slug))return blogHtml("Article not found",'<section class="intro"><h1>Article not found</h1><a href="/blog">Browse all articles</a></section>');
 try{const articleResponse=await fetch("https://raw.githubusercontent.com/Avdhesh-khutar/calcusite/main/content/blog/"+encodeURIComponent(slug)+".md",{headers:{"User-Agent":"CalcusitePublic/1.0"}});if(!articleResponse.ok){const e=new Error("Blog article fetch failed");e.status=articleResponse.status;throw e;}const raw=await articleResponse.text();const p=blogParse(raw,slug);if(p.published===false||p.published==="false")return blogHtml("Article not found",'<section class="intro"><h1>Article not published</h1><a href="/blog">Browse articles</a></section>');const bodyLines=p.body.split("\n"); const firstHeading=bodyLines.findIndex(line=>line.trim()); if(firstHeading>=0){const firstBodyTitle=bodyLines[firstHeading].trim().replace(/^#{1,6}\s+/,"").trim();if(firstBodyTitle.toLowerCase()===String(p.title).trim().toLowerCase())bodyLines.splice(firstHeading,1);} const languageTools='<div class="language-tools"><strong>इस लेख को इसमें पढ़ें:</strong><button type="button" id="read-hi">हिंदी में पढ़ें</button><button type="button" id="read-en">अंग्रेज़ी में पढ़ें</button><span id="translate-status" aria-live="polite"></span><div id="google_translate_element" hidden></div></div><script>(function(){var loaded=false,requestedLang="hi",tries=0,timer=null;var status=document.getElementById("translate-status");function setImportantIfChanged(el,prop,value){if(el.style.getPropertyValue(prop)!==value||el.style.getPropertyPriority(prop)!=="important")el.style.setProperty(prop,value,"important");}function hideTranslateBanner(){document.querySelectorAll("iframe.goog-te-banner-frame,.goog-te-banner-frame,.VIpgJd-ZVi9od-ORHb-OEVmcd-frame,body > .skiptranslate").forEach(function(el){setImportantIfChanged(el,"display","none");setImportantIfChanged(el,"visibility","hidden");setImportantIfChanged(el,"height","0");setImportantIfChanged(el,"max-height","0");});setImportantIfChanged(document.documentElement,"margin-top","0");setImportantIfChanged(document.body,"top","0");setImportantIfChanged(document.body,"margin-top","0");}var bannerObserver=new MutationObserver(hideTranslateBanner);bannerObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});hideTranslateBanner();function applyLanguage(){var sel=document.querySelector(".goog-te-combo");if(sel){sel.value=requestedLang;sel.dispatchEvent(new Event("change"));status.textContent=requestedLang==="hi"?"हिंदी अनुवाद चुना गया":"अंग्रेज़ी चुनी गई";return true;}if(tries++<30){timer=setTimeout(applyLanguage,250);return false;}status.textContent="भाषा विकल्प लोड नहीं हुए। दोबारा कोशिश करें।";return false;}function setLang(lang){requestedLang=lang;tries=0;var box=document.getElementById("google_translate_element");box.hidden=false;var sel=document.querySelector(".goog-te-combo");if(sel){sel.value=lang;sel.dispatchEvent(new Event("change"));status.textContent=lang==="hi"?"हिंदी अनुवाद चुना गया":"अंग्रेज़ी चुनी गई";return;}status.textContent="भाषा लोड हो रही है…";if(!loaded){loaded=true;window.googleTranslateElementInit=function(){new google.translate.TranslateElement({pageLanguage:"en",includedLanguages:"en,hi",autoDisplay:false}, "google_translate_element");applyLanguage();};var script=document.createElement("script");script.src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";script.async=true;script.onerror=function(){status.textContent="अनुवाद सेवा अभी उपलब्ध नहीं है। फिर कोशिश करें।";loaded=false;};document.head.appendChild(script);}else{if(timer)clearTimeout(timer);applyLanguage();}}document.getElementById("read-hi").addEventListener("click",function(){setLang("hi")});document.getElementById("read-en").addEventListener("click",function(){setLang("en")});})();</script>'; return blogHtml(p.title,'<p class="date"><a href="/blog">Blog</a> / '+blogEsc(p.updated)+'</p>'+languageTools+'<article class="article"><h1>'+blogEsc(p.title)+'</h1>'+(p.description?'<p><strong>'+blogEsc(p.description)+'</strong></p>':'')+blogMarkdown(bodyLines.join("\n"))+'<hr><p><a href="/blog">← Back to all articles</a></p></article>',p.description||p.title,SITE_ORIGIN + "/blog/" + encodeURIComponent(slug));}
 catch(e){return blogHtml("Article not found",'<section class="intro"><h1>Article not found</h1><p>This article may not have been published yet.</p><a href="/blog">Browse all articles</a></section>');}
}


function xmlEsc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
async function serveSitemap(request, env) {
  const origin = SITE_ORIGIN
  if (sitemapMemoryCache.xml && sitemapMemoryCache.expiresAt > Date.now()) {
    return new Response(sitemapMemoryCache.xml, {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
    });
  }
  const urls = [
    { loc: origin + "/", changefreq: "weekly", priority: "1.0" },
    { loc: origin + "/blog", changefreq: "weekly", priority: "0.8" }
  ];
  try {
    const indexResponse = await fetch("https://raw.githubusercontent.com/Avdhesh-khutar/calcusite/main/content/blog/index.json", { headers: { "User-Agent": "CalcusitePublic/1.0" } });
    if (!indexResponse.ok) throw new Error("Blog index unavailable: " + indexResponse.status);
    const manifest = await indexResponse.json();
    const slugs = Array.isArray(manifest.articles) ? manifest.articles.filter(validSlug) : [];
    const entries = await Promise.all(slugs.map(async slug => {
      try {
        const articleResponse = await fetch("https://raw.githubusercontent.com/Avdhesh-khutar/calcusite/main/content/blog/" + encodeURIComponent(slug) + ".md", { headers: { "User-Agent": "CalcusitePublic/1.0" } });
        if (!articleResponse.ok) throw new Error("Blog article fetch failed: " + articleResponse.status);
        const p = blogParse(await articleResponse.text(), slug);
        if (p.published === false || p.published === "false") return null;
        return { loc: origin + "/blog/" + encodeURIComponent(slug), lastmod: /^\d{4}-\d{2}-\d{2}$/.test(String(p.updated)) ? p.updated : "", changefreq: "monthly", priority: "0.6" };
      } catch { return null; }
    }));
    urls.push(...entries.filter(Boolean));
  } catch (error) {
    console.error("Could not load blog sitemap entries", error);
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(u => '<url><loc>' + xmlEsc(u.loc) + '</loc>' + (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '') +
      '<changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>').join("") +
    '</urlset>';
  sitemapMemoryCache = { expiresAt: Date.now() + 60 * 60 * 1000, xml };
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
  });
}
function serveRobots() {
  const origin = SITE_ORIGIN
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;
    if (url.pathname === "/robots.txt") {
      response = serveRobots();
    } else if (url.pathname === "/sitemap.xml") {
      response = await serveSitemap(request, env);
    } else if (url.pathname.startsWith("/api/admin/")) {
      response = await adminApi(request, env, url);
    } else if (url.pathname === "/blog" || url.pathname === "/blog/" || url.pathname.startsWith("/blog/")) {
      try {
        response = await serveBlog(request, env, url);
      } catch (error) {
        console.error("Calcusite blog route error", error && error.stack ? error.stack : error);
        response = new Response("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Blog temporarily unavailable</title><body style=\"font:16px system-ui;padding:24px;max-width:640px;margin:auto\"><h1>Blog temporarily unavailable</h1><p>We are recovering the blog service. Please try again shortly.</p><p><a href=\"/\">Return to Calcusite</a></p></body></html>", {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
        });
      }
    } else {
      response = await env.ASSETS.fetch(request);
    }
    return withSecurityHeaders(response);
  }
};
