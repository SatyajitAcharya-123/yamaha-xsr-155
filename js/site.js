/* Yamaha XSR 155 — public site behaviour. No build step required. */
(() => {
  "use strict";
  const CFG = window.XSR_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  }

  /* ---------------------------------------------------------------
     Supabase (only if configured — otherwise forms report honestly)
  --------------------------------------------------------------- */
  const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  let sb = null;
  function client() {
    if (sb) return sb;
    if (!configured || !window.supabase) return null;
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    return sb;
  }

  /* ---------------------------------------------------------------
     Images: real photo if configured, otherwise a labelled pending frame
  --------------------------------------------------------------- */
  function imgData(key) {
    if (CFG.IMAGES && CFG.IMAGES[key]) return CFG.IMAGES[key];
    return { src: "", alt: "" };
  }
  function paintFrame(el, src, alt, slotLabel) {
    el.querySelectorAll("img").forEach((i) => i.remove());
    el.classList.remove("pending");
    if (slotLabel) el.dataset.slot = slotLabel;
    if (!src) {
      el.classList.add("pending");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", (alt || "Image") + " — photograph not yet added");
      return;
    }
    el.removeAttribute("role"); el.removeAttribute("aria-label");
    const img = h("img", { src, alt: alt || "", decoding: "async" });
    if (!el.closest(".hero")) img.loading = "lazy";
    img.addEventListener("error", () => { img.remove(); paintFrame(el, "", alt, slotLabel); });
    el.prepend(img);
  }
  $$("[data-img]").forEach((el) => {
    const d = imgData(el.dataset.img);
    paintFrame(el, d.src, d.alt);
  });

  /* ---------------------------------------------------------------
     Nav, menu, scroll effects
  --------------------------------------------------------------- */
  const nav = $("#nav"), burger = $("#burger"), menu = $("#menu");
  const onScroll = () => nav.classList.toggle("solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  function setMenu(open) {
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    $$("a", menu).forEach((a) => (a.tabIndex = open ? 0 : -1));
  }
  setMenu(false);
  burger.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); burger.focus(); } });

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".rv, .mask, .line").forEach((el) => io.observe(el));

  // Active nav link
  const links = $$('.nav ul a');
  const secIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { threshold: 0.4 });
  $$("main > section[id]").forEach((s) => secIO.observe(s));

  // Gentle parallax
  const par = $$("[data-parallax]");
  if (par.length && !reduced) {
    let ticking = false;
    const run = () => {
      par.forEach((el) => {
        const sec = el.parentElement.getBoundingClientRect();
        if (sec.bottom < 0 || sec.top > innerHeight) return;
        const speed = parseFloat(el.dataset.parallax) || 0.08;
        const lim = el.offsetHeight * 0.05;
        const y = Math.max(-lim, Math.min(lim, -sec.top * speed));
        el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      });
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* ---------------------------------------------------------------
     Specifications (single source of truth for tabs + full modal)
     "v" marks values that differ between sources and need verification.
  --------------------------------------------------------------- */
  const SPECS = [
    { id: "engine", title: "Engine", tag: "155 cc", big: [["155 cc", "Displacement"], ["18.4 PS", "@ 10,000 rpm"], ["14.2 Nm", "@ 7,500 rpm"]], rows: [
      ["Type", "Liquid-cooled, 4-stroke, SOHC, 4-valve"], ["Displacement", "155 cc"], ["Bore × stroke", "58.0 × 58.7 mm"],
      ["Compression ratio", "11.6 : 1"], ["Max power", "13.5 kW (18.4 PS) @ 10,000 rpm"], ["Max torque", "14.2 Nm @ 7,500 rpm"],
      ["Fuel system", "Fuel injection"], ["Valve actuation", "VVA (Variable Valve Actuation)"], ["Lubrication", "Wet sump"],
      ["Starter", "Electric"], ["Fuel compatibility", "E20 compatible"]] },
    { id: "transmission", title: "Transmission", tag: "6-speed", big: [["6", "Gears"]], rows: [
      ["Gearbox", "6-speed"], ["Clutch", "Wet, multiple disc"], ["Assist & slipper clutch", "Listed in press coverage", true], ["Final drive", "Chain", true]] },
    { id: "dimensions", title: "Dimensions", tag: "137 kg", big: [["137 kg", "Kerb weight"], ["810 mm", "Seat height"], ["1,325 mm", "Wheelbase"]], rows: [
      ["Overall length", "2,005 mm"], ["Overall width", "805 mm"], ["Overall height", "1,080 mm"], ["Wheelbase", "1,325 mm"],
      ["Seat height", "810 mm"], ["Min. ground clearance", "120 mm"], ["Kerb weight", "137 kg (with oil and full fuel tank)"]] },
    { id: "chassis", title: "Chassis", tag: "Deltabox", big: [["Deltabox", "Frame"]], rows: [
      ["Frame", "Deltabox"], ["Swingarm", "Aluminium", true], ["Wheels", "17-inch front and rear"]] },
    { id: "suspension", title: "Suspension", tag: "Link-type rear", big: [["Link", "Rear monocross"]], rows: [
      ["Front", "Upside-down fork, 37 mm inner tube", true], ["Rear", "Swingarm, link-type monocross"]] },
    { id: "brakes", title: "Brakes", tag: "Dual ABS", big: [["282 mm", "Front disc"], ["220 mm", "Rear disc"]], rows: [
      ["Front", "Disc, 282 mm"], ["Rear", "Disc, 220 mm"], ["ABS", "Dual channel"], ["Traction control", "Equipped"]] },
    { id: "tyres", title: "Tyres", tag: "Tubeless", big: [["17\"", "Wheels"]], rows: [
      ["Front", "100/80-17 M/C 52P, tubeless", true], ["Rear", "140/70R17 M/C 66H, tubeless", true]] },
    { id: "instruments", title: "Instruments", tag: "LCD", big: [["LCD", "Display"]], rows: [
      ["Display", "Round LCD cluster"], ["Speedometer / tachometer", "Digital"], ["Fuel gauge", "Digital"], ["Fuel consumption indicator", "Equipped"],
      ["Connectivity", "Y-Connect (smartphone Bluetooth)"], ["Headlight", "LED"], ["Brake / tail light", "LED"], ["Battery", "12 V, 4.0 Ah (10 HR)"]] },
    { id: "fuel", title: "Fuel", tag: "10 L", big: [["10 L", "Tank capacity"]], rows: [
      ["Tank capacity", "10 L"], ["Fuel", "Petrol, E20 compatible"]] }
  ];
  const VERIFY = h("span", { class: "verify", text: "verify" });
  const rowsDl = (rows) => h("dl", { class: "rows" }, rows.map(([k, v, vf]) =>
    h("div", {}, h("dt", { text: k }), h("dd", {}, v, vf ? VERIFY.cloneNode(true) : null))));

  const tabs = $("#spec-tabs"), panels = $("#spec-panels");
  SPECS.forEach((s, i) => {
    tabs.append(h("button", { class: "tab", role: "tab", id: "tab-" + s.id, "aria-controls": "pn-" + s.id, "aria-selected": String(i === 0), tabindex: i === 0 ? "0" : "-1", type: "button" }, s.title, h("small", { text: s.tag })));
    panels.append(h("div", { class: "panel", role: "tabpanel", id: "pn-" + s.id, "aria-labelledby": "tab-" + s.id, hidden: i !== 0 },
      h("div", { class: "big" }, s.big.map(([b, l]) => h("div", {}, h("b", { text: b }), h("span", { text: l })))), rowsDl(s.rows)));
  });
  function selectTab(btn) {
    $$(".tab", tabs).forEach((t) => { const on = t === btn; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; $("#" + t.getAttribute("aria-controls")).hidden = !on; });
    btn.focus();
  }
  tabs.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) selectTab(b); });
  tabs.addEventListener("keydown", (e) => {
    const all = $$(".tab", tabs), i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const k = e.key;
    if (["ArrowDown", "ArrowRight"].includes(k)) { e.preventDefault(); selectTab(all[(i + 1) % all.length]); }
    else if (["ArrowUp", "ArrowLeft"].includes(k)) { e.preventDefault(); selectTab(all[(i - 1 + all.length) % all.length]); }
    else if (k === "Home") { e.preventDefault(); selectTab(all[0]); }
    else if (k === "End") { e.preventDefault(); selectTab(all[all.length - 1]); }
  });

  const specAll = $("#spec-all");
  SPECS.forEach((s) => { specAll.append(h("h4", { text: s.title }), rowsDl(s.rows)); });
  specAll.append(h("p", { class: "note", text: "Source: Yamaha India specification sheet (India-market model), cross-checked with press coverage. “verify” = sources differ; confirm with an authorised dealer." }));

  /* ---------------------------------------------------------------
     Dialog helpers
  --------------------------------------------------------------- */
  function openDialog(d) { if (!d.open) { d.showModal(); document.body.style.overflow = "hidden"; } }
  function closeDialog(d) { if (d.open) d.close(); }
  $$("dialog").forEach((d) => {
    d.addEventListener("close", () => { if (!$$("dialog[open]").length) document.body.style.overflow = ""; });
    d.addEventListener("click", (e) => { if (e.target === d) closeDialog(d); });   // click on backdrop
    $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => closeDialog(d)));
  });
  $("#open-specs").addEventListener("click", () => openDialog($("#spec-modal")));

  /* ---------------------------------------------------------------
     Colour selector
  --------------------------------------------------------------- */
  const colours = CFG.COLOURS || [];
  const stage = $("#colour-stage"), swWrap = $("#swatches"), cLabel = $("#colour-label");
  let cIndex = 0;
  function showColour(i, instant) {
    const c = colours[i]; if (!c) return;
    const next = h("div", { class: "frame" + (instant ? "" : " out") });
    next.style.position = "absolute"; next.style.inset = "0";
    paintFrame(next, c.src, c.alt, c.label);
    const old = $$(".frame", stage);
    stage.append(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      next.classList.remove("out");
      old.forEach((o) => { o.classList.add("out"); setTimeout(() => o.remove(), 700); });
    }));
    cLabel.textContent = `${String(i + 1).padStart(2, "0")} / ${String(colours.length).padStart(2, "0")} — ${c.label}`;
    cIndex = i;
  }
  colours.forEach((c, i) => {
    const input = h("input", { type: "radio", name: "colour", value: c.id, id: "col-" + c.id, checked: i === 0 });
    const lab = h("label", { class: "swatch", for: "col-" + c.id }, input, h("i", { style: `background:${c.swatch}` }), h("span", { text: c.label }), h("em", { "aria-hidden": "true" }));
    input.addEventListener("change", () => showColour(i));
    swWrap.append(lab);
  });
  showColour(0, true);

  /* ---------------------------------------------------------------
     Gallery + lightbox
  --------------------------------------------------------------- */
  const gal = $("#gal"), items = (CFG.GALLERY || []).map((g) => ({ ...imgData(g.key), caption: g.caption }));
  items.forEach((it, i) => {
    const fr = h("div", { class: "frame" });
    paintFrame(fr, it.src, it.alt || it.caption, it.caption);
    const btn = h("button", { type: "button", "aria-label": `Open image ${i + 1} of ${items.length}: ${it.caption}` }, fr);
    btn.addEventListener("click", () => openLb(i));
    gal.append(h("figure", { class: "rv" }, btn, h("figcaption", {}, h("span", { text: it.caption }), h("span", { text: String(i + 1).padStart(2, "0") }))));
  });
  $$("figure.rv", gal).forEach((f) => io.observe(f));

  const lb = $("#lb"), lbStage = $("#lb-stage");
  let li = 0;
  function renderLb() {
    const it = items[li];
    lbStage.replaceChildren();
    const fr = h("div", { class: "frame" });
    paintFrame(fr, it.src, it.alt || it.caption, it.caption);
    lbStage.append(fr);
    $("#lb-count").textContent = `${String(li + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    $("#lb-cap").textContent = it.caption;
  }
  function openLb(i) { li = i; renderLb(); openDialog(lb); $("#lb-close").focus(); }
  const step = (d) => { li = (li + d + items.length) % items.length; renderLb(); };
  $("#lb-prev").addEventListener("click", () => step(-1));
  $("#lb-next").addEventListener("click", () => step(1));
  $("#lb-close").addEventListener("click", () => closeDialog(lb));
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1); });
  let tx = null;
  lbStage.addEventListener("touchstart", (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
  lbStage.addEventListener("touchend", (e) => {
    if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ---------------------------------------------------------------
     Email (mailto) — opens the visitor's email app; sends nothing itself
  --------------------------------------------------------------- */
  const owner = CFG.OWNER_EMAIL || "";
  const ownerSet = owner && !/REPLACE/i.test(owner);
  $$("[data-owner-email]").forEach((el) => (el.textContent = owner));
  const mailHref = () =>
    `mailto:${encodeURIComponent(owner).replace(/%40/g, "@")}?subject=${encodeURIComponent(CFG.MAILTO_SUBJECT || "Yamaha XSR 155 Website Inquiry")}&body=${encodeURIComponent(CFG.MAILTO_BODY || "")}`;
  function openMail(e) {
    const fb = $("#mail-fallback");
    if (!ownerSet) {
      e.preventDefault();
      fb.replaceChildren("The owner’s email address has not been configured yet. Please use the inquiry form instead.");
      location.hash = "#contact";
      return;
    }
    e.preventDefault();
    location.href = mailHref();
    fb.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }
  $("#mailto-btn").addEventListener("click", openMail);
  $("#footer-mail").addEventListener("click", openMail);
  $("#copy-mail").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (!ownerSet) { b.textContent = "Address not configured"; return; }
    try { await navigator.clipboard.writeText(owner); b.textContent = "Copied"; } catch { b.textContent = "Select the address and copy it manually"; }
    setTimeout(() => (b.textContent = "Copy address"), 2500);
  });

  // Social (only real URLs)
  const social = $("#social");
  Object.entries(CFG.SOCIAL || {}).forEach(([k, url]) => {
    if (/^https:\/\//.test(url || "")) social.append(h("li", {}, h("a", { href: url, rel: "noopener noreferrer", target: "_blank", text: k[0].toUpperCase() + k.slice(1) })));
  });
  if (!social.children.length) social.remove();

  /* ---------------------------------------------------------------
     Forms
  --------------------------------------------------------------- */
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const phoneRe = /^[0-9+()\-\s]{7,20}$/;

  // test-ride fields
  const loc = $("#tr-loc");
  loc.append(h("option", { value: "", text: "Select…" }));
  (CFG.TEST_RIDE_LOCATIONS || []).forEach((l) => loc.append(h("option", { text: l })));
  const dateEl = $("#tr-date"), today = new Date(), max = new Date(); max.setDate(max.getDate() + 180);
  dateEl.min = ymd(today); dateEl.max = ymd(max);

  const FORMS = {
    review: { table: "reviews", ok: "Thank you. Your review was saved and is awaiting moderation — it will appear once approved.",
      fields: ["rating", "title", "body", "display_name", "hp"],
      validate: (v) => { const e = {}; if (!(+v.rating >= 1 && +v.rating <= 5)) e.rating = "Choose a rating from 1 to 5.";
        if ((v.title || "").trim().length < 3) e.title = "Add a short title (3+ characters)."; if ((v.body || "").trim().length < 10) e.body = "Please write at least 10 characters."; return e; } },
    feedback: { table: "feedback", ok: "Thank you. Your feedback was saved.",
      fields: ["name", "email", "category", "liked", "improve", "suggestions", "rating", "hp"],
      validate: (v) => { const e = {}; if (!(v.liked || v.improve || v.suggestions || "").trim()) e.content = "Please complete at least one of the three questions.";
        if (v.email && !emailRe.test(v.email)) e.email = "That email address doesn’t look right."; return e; } },
    inquiry: { table: "inquiries", ok: "Thank you. Your inquiry was saved and the owner can now read it.",
      fields: ["name", "email", "category", "message", "consent", "hp"],
      validate: (v) => { const e = {}; if (!(v.name || "").trim()) e.name = "Please enter your name."; if (!emailRe.test(v.email || "")) e.email = "Enter a valid email address.";
        if ((v.message || "").trim().length < 10) e.message = "Please write at least 10 characters."; if (!v.consent) e.consent = "Consent is needed so we can reply."; return e; } },
    ride: { table: "test_ride_requests", ok: "Request received and saved. This is not a confirmed appointment — you will be contacted to arrange one.",
      fields: ["full_name", "email", "phone", "location", "preferred_date", "preferred_time", "message", "consent", "hp"],
      validate: (v) => { const e = {}; if (!(v.full_name || "").trim()) e.full_name = "Please enter your full name."; if (!emailRe.test(v.email || "")) e.email = "Enter a valid email address.";
        if (!phoneRe.test((v.phone || "").trim())) e.phone = "Enter a phone number (digits, spaces, + ( ) - only).";
        if (!v.location) e.location = "Choose a location."; if (!v.preferred_date) e.preferred_date = "Choose a date.";
        else if (v.preferred_date < ymd(today) || v.preferred_date > ymd(max)) e.preferred_date = "Choose a date within the next 6 months.";
        if (!v.consent) e.consent = "Consent is needed to arrange a test ride."; return e; } }
  };
  const OPTIONAL = new Set(["name", "email", "display_name", "liked", "improve", "suggestions", "message", "rating"]);

  function collect(form, kind) {
    const fd = new FormData(form), out = {};
    FORMS[kind].fields.forEach((f) => {
      let v = fd.get(f);
      if (f === "consent") { out[f] = form.elements.consent ? form.elements.consent.checked : false; return; }
      v = v == null ? "" : String(v).trim();
      if (f === "rating") out[f] = v ? Number(v) : null;
      else if (f === "hp") out[f] = v;
      else out[f] = v === "" && OPTIONAL.has(f) ? null : v;
    });
    return out;
  }
  function showStatus(form, type, text) {
    const s = $(".status", form);
    s.replaceChildren(text ? h("span", { class: "msg " + type, text }) : "");
  }
  function showErrors(form, errs) {
    $$("[data-err]", form).forEach((el) => (el.textContent = errs[el.dataset.err] || ""));
    $$("input, select, textarea", form).forEach((i) => i.removeAttribute("aria-invalid"));
    Object.keys(errs).forEach((k) => { const i = form.elements[k]; if (i && i.setAttribute) i.setAttribute("aria-invalid", "true"); });
    const first = Object.keys(errs)[0];
    if (first) { const el = form.elements[first] || $(`[data-err="${first}"]`, form); (el && el.focus ? el : $(`[data-err="${first}"]`, form)).scrollIntoView?.({ block: "center" }); el?.focus?.({ preventScroll: true }); }
  }
  function friendlyError(err) {
    const m = (err && (err.message || "")) + " " + (err && err.details || "");
    if (/rate_limit/i.test(m)) return "You’ve sent several submissions recently. Please wait a while and try again.";
    if (/invalid_preferred_date/i.test(m)) return "The preferred date isn’t valid. Please choose a date within the next 6 months.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Couldn’t reach the server. Check your connection and try again — nothing was saved.";
    if (/violates check constraint|invalid input/i.test(m)) return "Some details were rejected by the server. Please review the form and try again — nothing was saved.";
    return "Something went wrong, and nothing was saved. Please try again in a moment.";
  }

  $$("form[data-kind]").forEach((form) => {
    const kind = form.dataset.kind, cfg = FORMS[kind];
    let token = crypto.randomUUID ? crypto.randomUUID() : null;
    let busy = false;
    const btn = $('button[type="submit"]', form), label = $(".t", btn), idle = label.textContent;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;                                   // duplicate-submit guard
      const data = collect(form, kind);
      const errs = cfg.validate(data);
      showErrors(form, errs);
      if (Object.keys(errs).length) { showStatus(form, "bad", "Please fix the highlighted fields."); return; }

      const c = client();
      if (!c) {
        showStatus(form, "bad", configured
          ? "The backend library could not be loaded, so nothing was saved. Please try again later."
          : "This site isn’t connected to its database yet, so nothing was saved.");
        return;
      }
      busy = true; btn.disabled = true; btn.classList.add("loading"); label.textContent = "Sending…";
      showStatus(form, "info", "Saving…");
      try {
        const row = { ...data, client_token: token };
        const { error } = await c.from(cfg.table).insert(row);       // no .select(): public cannot read private rows
        if (error && error.code === "23505") {                       // same token already stored = earlier attempt succeeded
          showStatus(form, "ok", "We already have this submission — thank you.");
        } else if (error) {
          throw error;
        } else {
          showStatus(form, "ok", cfg.ok);
        }
        form.reset(); showErrors(form, {});
        token = crypto.randomUUID ? crypto.randomUUID() : null;
        if (kind === "review") setTimeout(() => closeDialog($("#review-modal")), 3200);
      } catch (err) {
        showStatus(form, "bad", friendlyError(err));
      } finally {
        busy = false; btn.disabled = false; btn.classList.remove("loading"); label.textContent = idle;
      }
    });
  });

  /* ---------------------------------------------------------------
     Reviews — averages and distribution come only from approved rows
  --------------------------------------------------------------- */
  const PAGE = 8;
  let shown = 0, total = 0;
  const score = $("#score"), rlist = $("#rlist"), more = $("#more-reviews");
  const stars = (n) => { const s = h("span", { class: "stars", role: "img", "aria-label": `${n} out of 5 stars` }); for (let i = 1; i <= 5; i++) { const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", i <= n ? "on" : ""); svg.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#star"); svg.append(u); s.append(svg); } return s; };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  function emptyState(msg) {
    return h("div", { class: "empty" }, h("h3", { text: "No reviews yet" }), h("p", { class: "muted", text: msg || "Be the first to share what it’s like to ride or own the XSR 155." }));
  }
  function renderSummary(s) {
    score.replaceChildren();
    total = s.total || 0;
    if (!total) { score.append(h("p", { class: "state", text: "No approved reviews yet." })); return; }
    const avg = Number(s.average);
    score.append(h("b", { text: avg.toFixed(1) }), stars(Math.round(avg)), h("p", { class: "mono", style: "margin-top:10px", text: `${total} approved review${total === 1 ? "" : "s"}` }));
    const dist = h("div", { class: "dist" });
    for (let n = 5; n >= 1; n--) {
      const c = (s.distribution && s.distribution[n]) || 0;
      const i = h("i"); i.style.transform = `scaleX(${total ? c / total : 0})`;
      dist.append(h("div", {}, h("span", { text: `${n}★` }), h("span", { class: "bar" }, i), h("span", { text: String(c) })));
    }
    score.append(dist);
  }
  function renderReviews(rows) {
    rows.forEach((r) => rlist.append(h("article", { class: "rcard" },
      h("div", { class: "who" }, stars(r.rating), h("br"), r.display_name || "Anonymous rider", h("br"), fmtDate(r.created_at)),
      h("div", {}, h("h4", { text: r.title }), h("p", { text: r.body })))));
  }
  async function loadReviews(first) {
    const c = client();
    if (!c) {
      score.replaceChildren(h("p", { class: "state", text: configured ? "Reviews are temporarily unavailable." : "Reviews will appear here once the site is connected to its database." }));
      rlist.replaceChildren(emptyState(configured ? "" : "Submitting is disabled until the site is connected."));
      return;
    }
    try {
      if (first) {
        const { data, error } = await c.rpc("review_summary");
        if (error) throw error;
        renderSummary(data);
        rlist.replaceChildren();
        shown = 0;
      }
      const { data: rows, error } = await c.from("reviews").select("id,created_at,rating,title,body,display_name")
        .order("created_at", { ascending: false }).range(shown, shown + PAGE - 1);
      if (error) throw error;
      renderReviews(rows); shown += rows.length;
      if (first && !rows.length) rlist.replaceChildren(emptyState());
      more.hidden = shown >= total;
    } catch (err) {
      score.replaceChildren(h("p", { class: "state", text: "Couldn’t load reviews right now." }));
      rlist.replaceChildren();
    }
  }
  more.addEventListener("click", () => loadReviews(false));
  $("#write-review").addEventListener("click", () => openDialog($("#review-modal")));
  loadReviews(true);
})();
