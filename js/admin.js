/* Owner dashboard. Every read/write goes through Supabase with the owner's
   signed-in session; Row Level Security (schema.sql) is what enforces access. */
(() => {
  "use strict";
  const CFG = window.XSR_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v; else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  }
  const fmt = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
  const fmtDay = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  const login = $("#login"), app = $("#app"), main = $("#main");
  let sb = null, user = null, view = "overview";

  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) {
    login.hidden = false;
    $("#login-form").replaceChildren(h("h1", { text: "Not connected" }), h("p", { text: "Add your Supabase URL and anon key to js/config.js, then reload." }));
    return;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  function toast(msg, bad) {
    const t = h("div", { class: "toast" + (bad ? " bad" : ""), role: "status", text: msg });
    document.body.append(t); setTimeout(() => t.remove(), 3200);
  }

  /* ---------------- auth ---------------- */
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (data.session) await enter(data.session.user); else { login.hidden = false; app.hidden = true; }
  }
  async function enter(u) {
    // Confirm owner allow-list membership (RLS lets users read only their own row).
    const { data, error } = await sb.from("owners").select("user_id").eq("user_id", u.id).maybeSingle();
    if (error || !data) {
      await sb.auth.signOut();
      login.hidden = false; app.hidden = true;
      $("#login-err").textContent = "This account is not authorised as an owner.";
      return;
    }
    user = u; login.hidden = true; app.hidden = false;
    $("#who").textContent = u.email;
    go("overview"); refreshPills();
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn"), err = $("#login-err"); err.textContent = ""; btn.disabled = true; btn.textContent = "Signing in…";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    btn.disabled = false; btn.textContent = "Sign in";
    if (error) { err.textContent = "Sign-in failed. Check your email and password."; return; }
    $("#pw").value = ""; await enter(data.user);
  });
  $("#logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  /* ---------------- section definitions ---------------- */
  const SECTIONS = {
    feedback: {
      title: "Feedback", table: "feedback", statuses: ["new", "reviewed", "archived"], defaultStatus: "new",
      categories: ["Design", "Information", "Features", "User Experience", "Other"], catField: "category",
      searchIn: ["name", "email", "liked", "improve", "suggestions"],
      rowTitle: (r) => `${r.category}${r.rating ? " · " + stars(r.rating) : ""}`,
      rowSub: (r) => [r.liked && "Liked: " + r.liked, r.improve && "Improve: " + r.improve, r.suggestions && "Add: " + r.suggestions].filter(Boolean).join("  ·  "),
      rowMeta: (r) => [r.name || "Anonymous"],
      pill: { status: "new" }
    },
    reviews: {
      title: "Reviews", table: "reviews", statuses: ["pending", "approved", "rejected"], defaultStatus: "pending",
      searchIn: ["title", "body", "display_name"],
      rowTitle: (r) => `${stars(r.rating)}  ${r.title}`, rowSub: (r) => r.body, rowMeta: (r) => [r.display_name || "Anonymous"],
      pill: { status: "pending" }, summary: true
    },
    inquiries: {
      title: "Inquiries", table: "inquiries", statuses: ["new", "contacted", "resolved", "archived"], defaultStatus: "new",
      categories: ["General", "Motorcycle information", "Test ride", "Reviews and feedback", "Other"], catField: "category",
      searchIn: ["name", "email", "message", "owner_notes"],
      rowTitle: (r) => `${r.name} — ${r.category}`, rowSub: (r) => r.message,
      rowMeta: (r) => [r.email, r.needs_response && r.status !== "resolved" && r.status !== "archived" ? "Response needed" : null],
      pill: { status: "new" }
    },
    rides: {
      title: "Test rides", table: "test_ride_requests", statuses: ["pending", "contacted", "approved", "completed", "cancelled"], defaultStatus: "pending",
      searchIn: ["full_name", "email", "phone", "location", "message", "follow_up_note"],
      rowTitle: (r) => `${r.full_name} — ${r.location}`,
      rowSub: (r) => `Requested ${fmtDay(r.preferred_date)}, ${r.preferred_time}`,
      rowMeta: (r) => [r.status === "approved" ? "Confirmed by you" : "Request only — not confirmed", r.follow_up_at ? "Follow up " + fmtDay(r.follow_up_at) : null],
      pill: { status: "pending" }, dateSort: true
    }
  };

  /* ---------------- navigation ---------------- */
  $("#side-nav").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) go(b.dataset.view); });
  function go(v) {
    view = v;
    $$("#side-nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
    if (v === "overview") renderOverview(); else renderList(v);
    main.focus({ preventScroll: true });
  }
  async function countOf(table, status) {
    const { count, error } = await sb.from(table).select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw error; return count || 0;
  }
  async function refreshPills() {
    try {
      for (const k of Object.keys(SECTIONS)) {
        const s = SECTIONS[k], n = await countOf(s.table, s.pill.status);
        const el = $(`[data-pill="${k}"]`); el.textContent = n || ""; el.dataset.n = n;
      }
    } catch { /* counts are cosmetic; list views show their own errors */ }
  }

  /* ---------------- overview ---------------- */
  async function renderOverview() {
    main.replaceChildren(h("div", { class: "top" }, h("h2", { text: "Overview" })), h("div", { class: "state", text: "Loading real totals…" }));
    try {
      const [fb, pr, ar, iq, tr] = await Promise.all([
        countOf("feedback", "new"), countOf("reviews", "pending"), countOf("reviews", "approved"),
        countOf("inquiries", "new"), countOf("test_ride_requests", "pending")]);
      const card = (n, label, v) => h("button", { class: "stat", onclick: () => go(v) }, h("b", { text: String(n) }), h("span", { text: label }));
      main.replaceChildren(
        h("div", { class: "top" }, h("h2", { text: "Overview" }), h("button", { class: "btn ghost sm", onclick: () => { renderOverview(); refreshPills(); } }, "Refresh")),
        h("div", { class: "stats" }, card(fb, "New feedback", "feedback"), card(pr, "Pending reviews", "reviews"), card(ar, "Approved reviews", "reviews"),
          card(iq, "New inquiries", "inquiries"), card(tr, "Pending test rides", "rides")),
        h("p", { class: "state", style: "text-align:left;padding:0", text: "Totals are read live from the database. Open a section to read full submissions." }));
    } catch (err) {
      main.replaceChildren(h("div", { class: "top" }, h("h2", { text: "Overview" })), h("div", { class: "state bad", text: "Couldn’t load totals: " + (err.message || "unknown error") }));
    }
  }

  /* ---------------- list views ---------------- */
  async function renderList(key) {
    const S = SECTIONS[key];
    const state = { rows: [], q: "", status: "", cat: "", sort: "desc" };
    const listBox = h("div", { class: "list" }, h("div", { class: "state", text: "Loading…" }));
    const summaryBox = h("div");
    const q = h("input", { class: "a-in grow", type: "search", placeholder: "Search…", "aria-label": "Search" });
    const st = h("select", { class: "a-in", "aria-label": "Filter by status" }, h("option", { value: "", text: "All statuses" }), S.statuses.map((s) => h("option", { value: s, text: s })));
    const ct = S.categories ? h("select", { class: "a-in", "aria-label": "Filter by category" }, h("option", { value: "", text: "All categories" }), S.categories.map((c) => h("option", { text: c }))) : null;
    const so = h("select", { class: "a-in", "aria-label": "Sort" }, h("option", { value: "desc", text: "Newest first" }), h("option", { value: "asc", text: "Oldest first" }), S.dateSort ? h("option", { value: "req", text: "Requested date (soonest)" }) : null);
    st.value = S.defaultStatus;  // opens on what needs attention
    state.status = st.value;

    main.replaceChildren(
      h("div", { class: "top" }, h("h2", { text: S.title }), h("button", { class: "btn ghost sm", onclick: load }, "Refresh")),
      summaryBox,
      h("div", { class: "tools" }, q, st, ct, so),
      listBox);

    function draw() {
      const term = state.q.toLowerCase();
      let rows = state.rows.filter((r) =>
        (!state.status || r.status === state.status) &&
        (!state.cat || r[S.catField] === state.cat) &&
        (!term || S.searchIn.some((f) => (r[f] || "").toString().toLowerCase().includes(term))));
      rows.sort((a, b) => state.sort === "req" ? a.preferred_date.localeCompare(b.preferred_date)
        : state.sort === "asc" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
      if (!rows.length) { listBox.replaceChildren(h("div", { class: "state", text: state.rows.length ? "Nothing matches these filters." : "No submissions yet." })); return; }
      listBox.replaceChildren(...rows.map((r) => h("button", { class: "row", onclick: () => openDetail(key, r, load) },
        h("div", {}, h("div", { class: "t", text: S.rowTitle(r) }), h("div", { class: "s", text: S.rowSub(r) || "" })),
        h("div", { class: "m" }, h("span", { class: "tag " + r.status, text: r.status }), ...S.rowMeta(r).filter(Boolean).map((x) => h("span", { text: x })), h("span", { text: fmt(r.created_at) })))));
    }
    q.addEventListener("input", () => { state.q = q.value; draw(); });
    st.addEventListener("change", () => { state.status = st.value; draw(); });
    if (ct) ct.addEventListener("change", () => { state.cat = ct.value; draw(); });
    so.addEventListener("change", () => { state.sort = so.value; draw(); });

    async function load() {
      listBox.replaceChildren(h("div", { class: "state", text: "Loading…" }));
      const { data, error } = await sb.from(S.table).select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) { listBox.replaceChildren(h("div", { class: "state bad", text: "Couldn’t load: " + error.message })); return; }
      state.rows = data || [];
      if (S.summary) renderSummary(summaryBox, state.rows);
      draw(); refreshPills();
    }
    load();
  }

  function renderSummary(box, rows) {
    const ap = rows.filter((r) => r.status === "approved"), n = ap.length;
    if (!n) { box.replaceChildren(h("p", { class: "notice", text: "No approved reviews yet — the public rating summary is empty." })); return; }
    const avg = ap.reduce((a, r) => a + r.rating, 0) / n;
    const dist = [5, 4, 3, 2, 1].map((s) => `${s}★ ${ap.filter((r) => r.rating === s).length}`).join("   ");
    box.replaceChildren(h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", { text: avg.toFixed(1) }), h("span", { text: `Average of ${n} approved` })),
      h("div", { class: "stat", style: "grid-column: span 2" }, h("b", { style: "font-size:1.5rem;letter-spacing:.04em", text: dist }), h("span", { text: "Distribution (approved only)" }))));
  }

  /* ---------------- detail panel ---------------- */
  const dlg = $("#detail"), dBody = $("#d-body"), dActs = $("#d-acts");
  $("#d-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  const kv = (pairs) => h("dl", { class: "kv" }, pairs.filter(([, v]) => v !== undefined).flatMap(([k, v]) => [h("dt", { text: k }), h("dd", {}, v == null || v === "" ? "—" : v)]));
  const full = (label, text) => text ? h("div", {}, h("span", { class: "flab", text: label }), h("p", { class: "full", text })) : null;

  async function update(table, id, patch, after) {
    const { error } = await sb.from(table).update(patch).eq("id", id);
    if (error) { toast("Update failed: " + error.message, true); return false; }
    toast("Saved"); dlg.close(); after && after(); refreshPills(); return true;
  }
  function askDelete(table, id, what, after) {
    const c = $("#confirm");
    $("#c-title").textContent = "Delete permanently?";
    $("#c-text").textContent = `This ${what} will be permanently removed and cannot be recovered.`;
    c.showModal();
    $("#c-no").onclick = () => c.close();
    $("#c-yes").onclick = async () => {
      $("#c-yes").disabled = true;
      const { error } = await sb.from(table).delete().eq("id", id);
      $("#c-yes").disabled = false; c.close();
      if (error) { toast("Delete failed: " + error.message, true); return; }
      toast("Deleted"); dlg.close(); after && after(); refreshPills();
    };
  }
  const btn = (text, cls, fn) => h("button", { class: "btn sm " + cls, onclick: fn }, text);

  function openDetail(key, r, after) {
    const S = SECTIONS[key];
    $("#d-title").textContent = S.title.replace(/s$/, "") + " detail";
    dActs.replaceChildren();
    let body;
    const T = S.table;

    if (key === "feedback") {
      body = [kv([["Status", h("span", { class: "tag " + r.status, text: r.status })], ["Category", r.category], ["Rating", r.rating ? stars(r.rating) : "Not given"], ["Name", r.name], ["Email", r.email ? h("a", { href: "mailto:" + r.email, text: r.email, style: "color:inherit" }) : null], ["Received", fmt(r.created_at)]]),
        full("What did they like?", r.liked), full("What could be improved?", r.improve), full("Suggestions", r.suggestions)];
      if (r.status !== "reviewed") dActs.append(btn("Mark reviewed", "", () => update(T, r.id, { status: "reviewed" }, after)));
      if (r.status !== "archived") dActs.append(btn("Archive", "ghost", () => update(T, r.id, { status: "archived" }, after)));
      if (r.status !== "new") dActs.append(btn("Mark as new", "ghost", () => update(T, r.id, { status: "new" }, after)));
      dActs.append(btn("Delete", "red", () => askDelete(T, r.id, "feedback", after)));
    }

    if (key === "reviews") {
      body = [kv([["Status", h("span", { class: "tag " + r.status, text: r.status })], ["Rating", h("span", { class: "stars", text: stars(r.rating) })], ["Display name", r.display_name], ["Submitted", fmt(r.created_at)], ["Moderated", fmt(r.moderated_at)]]),
        full("Title", r.title), full("Review", r.body),
        h("p", { class: "notice", text: r.status === "approved" ? "This review is public." : "This review is NOT public." })];
      const now = () => new Date().toISOString();
      if (r.status !== "approved") dActs.append(btn("Approve & publish", "", () => update(T, r.id, { status: "approved", moderated_at: now() }, after)));
      if (r.status !== "rejected") dActs.append(btn("Reject", "ghost", () => update(T, r.id, { status: "rejected", moderated_at: now() }, after)));
      if (r.status !== "pending") dActs.append(btn("Back to pending", "ghost", () => update(T, r.id, { status: "pending", moderated_at: null }, after)));
      dActs.append(btn("Delete", "red", () => askDelete(T, r.id, "review", after)));
    }

    if (key === "inquiries") {
      const sel = h("select", { class: "a-in", id: "f-status" }, S.statuses.map((s) => h("option", { value: s, text: s, selected: s === r.status })));
      const needs = h("input", { type: "checkbox", id: "f-needs", checked: !!r.needs_response });
      const notes = h("textarea", { class: "a-in", id: "f-notes", rows: "4", style: "padding:10px 14px", maxlength: "4000" }); notes.value = r.owner_notes || "";
      body = [kv([["Name", r.name], ["Email", h("a", { href: "mailto:" + r.email, text: r.email, style: "color:inherit" })], ["Category", r.category], ["Received", fmt(r.created_at)], ["Consent", r.consent ? "Given" : "Not given"]]),
        full("Message", r.message),
        h("div", { class: "a-fld" }, h("label", { for: "f-status", text: "Status" }), sel),
        h("label", { class: "a-fld", style: "flex-direction:row;align-items:center;gap:10px;text-transform:none;letter-spacing:0;font-size:.95rem;color:var(--ivory);font-family:var(--ff-body)" }, needs, "Response still needed"),
        h("div", { class: "a-fld" }, h("label", { for: "f-notes", text: "Private notes" }), notes)];
      dActs.append(btn("Save changes", "", () => update(T, r.id, { status: sel.value, needs_response: needs.checked, owner_notes: notes.value.trim() || null }, after)),
        btn("Reply by email", "ghost", () => { location.href = `mailto:${r.email}?subject=${encodeURIComponent("Re: " + r.category + " inquiry")}`; }),
        btn("Delete", "red", () => askDelete(T, r.id, "inquiry", after)));
    }

    if (key === "rides") {
      const sel = h("select", { class: "a-in", id: "f-status" }, S.statuses.map((s) => h("option", { value: s, text: s, selected: s === r.status })));
      const fu = h("input", { class: "a-in", type: "date", id: "f-fu", value: r.follow_up_at || "" });
      const note = h("textarea", { class: "a-in", id: "f-note", rows: "4", style: "padding:10px 14px", maxlength: "2000" }); note.value = r.follow_up_note || "";
      body = [h("p", { class: "notice", text: r.status === "approved" ? "You marked this approved — treat it as a confirmed appointment." : "This is only a request. It is not a confirmed appointment until you approve it." }),
        kv([["Name", r.full_name], ["Email", h("a", { href: "mailto:" + r.email, text: r.email, style: "color:inherit" })], ["Phone", h("a", { href: "tel:" + r.phone.replace(/[^0-9+]/g, ""), text: r.phone, style: "color:inherit" })], ["Location", r.location],
          ["Requested date", fmtDay(r.preferred_date)], ["Requested time", r.preferred_time], ["Received", fmt(r.created_at)], ["Consent", r.consent ? "Given" : "Not given"]]),
        full("Message", r.message),
        h("div", { class: "a-fld" }, h("label", { for: "f-status", text: "Status" }), sel),
        h("div", { class: "a-fld" }, h("label", { for: "f-fu", text: "Follow-up date" }), fu),
        h("div", { class: "a-fld" }, h("label", { for: "f-note", text: "Follow-up notes (private)" }), note)];
      dActs.append(btn("Save changes", "", () => update(T, r.id, { status: sel.value, follow_up_at: fu.value || null, follow_up_note: note.value.trim() || null }, after)),
        btn("Contact by email", "ghost", () => { location.href = `mailto:${r.email}?subject=${encodeURIComponent("Your XSR 155 test-ride request")}`; }),
        btn("Delete", "red", () => askDelete(T, r.id, "test-ride request", after)));
    }

    dBody.replaceChildren(...body.filter(Boolean));
    dlg.showModal();
  }

  boot();
})();
