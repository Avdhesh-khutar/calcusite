const $ = (s) => document.querySelector(s);
const state = { articles: [], slug: "", loading: false };
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ").");
  return data;
}
function showMessage(target, text, type) {
  const el = $(target); el.textContent = text; el.className = "message " + type;
}
function hideMessage(target) { $(target).className = "message hidden"; }
function setSignedIn(on) {
  $("#loginView").classList.toggle("hidden", on);
  $("#workspace").classList.toggle("hidden", !on);
  $("#logoutBtn").classList.toggle("hidden", !on);
}
function safeText(s) { return String(s || ""); }
function renderArticles() {
  const query = $("#articleSearch").value.trim().toLowerCase();
  const articles = state.articles.filter(a => a.name.toLowerCase().includes(query));
  $("#articleCount").textContent = String(state.articles.length);
  $("#statArticles").textContent = String(state.articles.length);
  if (!articles.length) {
    $("#articleList").innerHTML = '<div class="empty-state"><span>▤</span><p>' + (query ? "No articles match your search." : "No Markdown articles found yet. Create your first article.") + '</p></div>';
    return;
  }
  $("#articleList").innerHTML = articles.map(a => '<button class="article-item ' + (state.slug === a.slug ? "selected" : "") + '" data-slug="' + encodeURIComponent(a.slug) + '" type="button"><span class="file-icon">▤</span><span class="article-info"><strong>' + safeText(a.name.replace(/\.md$/, "").replace(/-/g, " ")) + '</strong><small>content/blog/' + safeText(a.name) + '</small></span><span class="article-arrow">›</span></button>').join("");
  document.querySelectorAll(".article-item").forEach(btn => btn.addEventListener("click", () => openArticle(decodeURIComponent(btn.dataset.slug))));
}
async function loadArticles() {
  $("#articleList").innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Loading articles…</p></div>';
  try { const data = await api("/api/admin/articles"); state.articles = data.articles || []; renderArticles(); }
  catch (e) {
    $("#articleList").innerHTML = '<div class="empty-state"><span>⚠️</span><p>' + safeText(e.message) + '</p><button class="btn btn-quiet" id="retryList">Try again</button></div>';
    $("#retryList")?.addEventListener("click", loadArticles);
  }
}
function resetEditor() {
  state.slug = "";
  $("#articleForm").reset();
  $("#mode").value = "create";
  $("#slug").readOnly = false;
  delete $("#slug").dataset.touched;
  $("#published").checked = true;
  $("#editorTitle").textContent = "Create an article";
  $("#publishBtn").innerHTML = 'Publish to GitHub <span>↗</span>';
  $("#saveHint").textContent = "Changes are saved when you publish.";
  $("#wordCount").textContent = "0 words";
  hideMessage("#editorMessage"); renderArticles();
}
async function openArticle(slug) {
  hideMessage("#editorMessage");
  $("#editorTitle").textContent = "Loading article…";
  $("#editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const data = await api("/api/admin/article?slug=" + encodeURIComponent(slug));
    state.slug = data.slug; $("#mode").value = "update";
    const parsed = parseMarkdown(data.content);
    $("#title").value = parsed.title || slug.replace(/-/g, " ");
    $("#slug").value = slug; $("#description").value = parsed.description || "";
    $("#content").value = parsed.body || data.content;
    $("#published").checked = parsed.published !== "false";
    $("#editorTitle").textContent = "Edit article";
    $("#publishBtn").innerHTML = 'Save & publish <span>↗</span>';
    $("#saveHint").textContent = "Editing " + slug + ". Changes publish as a GitHub commit.";
    updateWordCount(); renderArticles();
  } catch (e) { showMessage("#editorMessage", e.message, "error"); $("#editorTitle").textContent = "Create an article"; }
}
function parseMarkdown(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    try { if (v.startsWith('"')) v = JSON.parse(v); } catch {}
    meta[m[1]] = v;
  }
  return { ...meta, body: raw.slice(match[0].length) };
}
function makeSlug(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function updateWordCount() {
  const text = $("#content").value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  $("#wordCount").textContent = count + (count === 1 ? " word" : " words");
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); hideMessage("#loginMessage");
  const button = e.submitter; button.disabled = true; button.textContent = "Signing in…";
  try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#password").value }) }); $("#password").value = ""; setSignedIn(true); await loadArticles(); }
  catch (err) { showMessage("#loginMessage", err.message, "error"); }
  finally { button.disabled = false; button.innerHTML = "Sign in <span>→</span>"; }
});
$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); } catch {}
  state.articles = []; resetEditor(); setSignedIn(false);
});
$("#newBtn").addEventListener("click", () => { resetEditor(); $("#title").focus(); $("#editorPanel").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("#navArticles").addEventListener("click", () => $("#articlePanel")?.scrollIntoView({ behavior: "smooth" }));
$("#refreshBtn").addEventListener("click", loadArticles);
$("#articleSearch").addEventListener("input", renderArticles);
$("#title").addEventListener("input", () => { if ($("#mode").value === "create" || !$("#slug").dataset.touched) $("#slug").value = makeSlug($("#title").value); });
$("#slug").addEventListener("input", () => { $("#slug").dataset.touched = "true"; $("#slug").value = makeSlug($("#slug").value); });
$("#content").addEventListener("input", updateWordCount);
$("#clearBtn").addEventListener("click", () => {
  if ($("#mode").value === "update") { if (confirm("Clear the editor and start a new article? The existing GitHub article will not be deleted.")) resetEditor(); }
  else if ($("#title").value || $("#content").value) { if (confirm("Clear all fields?")) resetEditor(); }
});
document.querySelectorAll("[data-insert]").forEach(btn => btn.addEventListener("click", () => {
  const area = $("#content"), start = area.selectionStart, end = area.selectionEnd, text = btn.dataset.insert;
  area.setRangeText(text, start, end, "end"); area.focus(); updateWordCount();
}));
$("#articleForm").addEventListener("submit", async e => {
  e.preventDefault(); hideMessage("#editorMessage");
  const mode = $("#mode").value, title = $("#title").value.trim(), slug = makeSlug($("#slug").value);
  const content = $("#content").value.trim();
  if (!title || !slug || content.length < 30) { showMessage("#editorMessage", "Please provide a title, valid slug and at least 30 characters of article content.", "error"); return; }
  const button = $("#publishBtn"); button.disabled = true; button.textContent = mode === "update" ? "Saving…" : "Publishing…";
  try {
    const result = await api("/api/admin/article", { method: "POST", body: JSON.stringify({ mode, title, slug, description: $("#description").value.trim(), content, published: $("#published").checked }) });
    state.slug = result.slug;
    showMessage("#editorMessage", (result.updated ? "Article updated" : "Article published") + " successfully. Commit: " + result.commit.slice(0, 7) + ". Cloudflare deployment should start from your GitHub commit workflow.", "success");
    $("#mode").value = "update"; $("#editorTitle").textContent = "Edit article";
    $("#publishBtn").innerHTML = 'Save & publish <span>↗</span>';
    $("#saveHint").textContent = "Last committed to content/blog/" + result.slug + ".md";
    await loadArticles();
  } catch (err) { showMessage("#editorMessage", err.message, "error"); }
  finally { button.disabled = false; if ($("#mode").value === "update") button.innerHTML = 'Save & publish <span>↗</span>'; else button.innerHTML = 'Publish to GitHub <span>↗</span>'; }
});
async function boot() {
  try { await api("/api/admin/me"); setSignedIn(true); await loadArticles(); }
  catch { setSignedIn(false); }
}
boot();
