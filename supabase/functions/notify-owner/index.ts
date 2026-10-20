// Supabase Edge Function: notify-owner
// Optional. Sends the owner an email when a new submission row is inserted.
// Wire it up with Database Webhooks (Database → Webhooks → INSERT on feedback,
// reviews, inquiries, test_ride_requests → Supabase Edge Function → notify-owner).
//
// Secrets (set with `supabase secrets set`, never in browser code):
//   RESEND_API_KEY   – API key from your email provider (Resend shown here)
//   NOTIFY_TO        – the owner's recipient address (configure later)
//   NOTIFY_FROM      – a verified sender, e.g. "XSR 155 Site <notify@your-domain>"
//   WEBHOOK_SECRET   – any long random string; also add it as the
//                      "x-webhook-secret" HTTP header in the webhook settings.
//
// This is entirely separate from the visitor-side mailto: button.

const labels: Record<string, string> = {
  feedback: "New feedback",
  reviews: "New review (pending moderation)",
  inquiries: "New inquiry",
  test_ride_requests: "New test-ride request (not a confirmed appointment)",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_TO");
  const from = Deno.env.get("NOTIFY_FROM");
  if (!key || !to || !from) {
    return new Response(JSON.stringify({ sent: false, reason: "Email provider not configured" }), { status: 200 });
  }

  const payload = await req.json();
  if (payload.type !== "INSERT") return new Response(JSON.stringify({ sent: false, reason: "ignored" }), { status: 200 });

  const table: string = payload.table;
  const record = payload.record ?? {};
  const hidden = new Set(["ip_hash", "client_token", "hp"]);
  const rows = Object.entries(record)
    .filter(([k, v]) => !hidden.has(k) && v !== null && v !== "")
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`)
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[XSR 155] ${labels[table] ?? table}`,
      html: `<h2>${esc(labels[table] ?? table)}</h2><table>${rows}</table><p>Open your private dashboard to respond.</p>`,
    }),
  });

  // Report only what the provider actually confirmed.
  const ok = res.ok;
  return new Response(JSON.stringify({ sent: ok, status: res.status }), { status: ok ? 200 : 502 });
});
