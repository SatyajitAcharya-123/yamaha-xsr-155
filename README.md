# Yamaha XSR 155 — website + owner dashboard

Static front end (no build step) + Supabase backend.

```
index.html              public site
admin/index.html        private owner dashboard (separate login)
css/                    tokens.css (design system) · site.css · admin.css
js/config.js            ← the only file you edit to go live
js/site.js              public behaviour
js/admin.js             dashboard behaviour
supabase/schema.sql     tables, Row Level Security, rate limiting, rating summary
supabase/functions/notify-owner/index.ts   optional email notifications
```

Run locally: `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`
(dashboard: `/admin/`). Deploy to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

## What works right now, without any setup

Everything visual and interactive: navigation, motion, specifications explorer and modal,
colour selector, gallery + lightbox (arrows, keyboard, swipe), FAQ, privacy, responsive layouts.

Until Supabase is connected the forms **refuse to pretend**: they validate, then say nothing was
saved. Reviews show "will appear once connected". There are no fake reviews, counts or ratings anywhere.

## Go-live checklist

1. **Supabase project** → create at supabase.com.
2. **SQL Editor** → run `supabase/schema.sql`, then the three statements at its bottom
   (IP-hash salt, disable public sign-ups, add yourself to `owners`).
3. **Auth → Users → Add user** with your email + a strong password. Copy the user's UUID into
   `insert into public.owners (user_id) values ('…');`. Disable "Allow new users to sign up".
4. **js/config.js** → paste Project URL and the **anon** key. (Never the service_role key.)
5. **js/config.js** → set `OWNER_EMAIL` to your real address (powers the "EMAIL US" button).
   While it contains `REPLACE`, the button explains it isn't configured instead of mailing a fake address.
6. **js/config.js** → set `TEST_RIDE_LOCATIONS`, and add social URLs only if you have real ones.
7. **Photography** → see below.
8. Optional notifications → see below.

## Photography (needs your input)

The brief asks for real, high-quality imagery. I can't download or licence photos from here, and
Yamaha's official photos are copyrighted, so `js/config.js` has an `IMAGES` / `COLOURS` / `GALLERY` map.
Put licensed photos in an `img/` folder (your own shots, or images your dealer/Yamaha permits you to
use) and set each `src`, e.g. `src: "img/hero.webp"`. Until a slot has a `src`, it renders a clearly
labelled "photograph pending" frame — never a broken image.

No 3D motorcycle model was supplied, so the hero is image-led with parallax depth (no fake 3D).

## Security model

- Public visitors can **insert** only (column-restricted) and **read only approved reviews'** public columns.
- Feedback, inquiries and test-ride requests are unreadable by the public. Status, notes and moderation fields cannot be set by visitors.
- Owner access = signed in **and** listed in `public.owners` (enforced in Postgres, not in the page).
- Server-side: constraints, text sanitising triggers, honeypot, per-IP-hash hourly rate limits, unique
  `client_token` against double submits.
- Hosting the dashboard on a public URL is fine; hiding it is not relied upon.
- Consider adding CAPTCHA (Cloudflare Turnstile) later if spam grows.

## Notifications (optional)

Deploy `supabase/functions/notify-owner`, set secrets `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM`,
`WEBHOOK_SECRET`, and add Database Webhooks (INSERT) on the four tables pointing at it, with header
`x-webhook-secret`. The function reports delivery only from the provider's real response. Independent
of the visitor-side `mailto:` button.

## Content verification

Specs follow Yamaha India's published sheet for the India-market model, cross-checked with press.
Items marked **verify** disagree between sources (front fork described as both telescopic and USD, tyre
sizes differ by market, final drive, swingarm material). Colour list (Metallic Blue, Vivid Red, Metallic
Grey, Greyish Green Metallic, Metallic Black) reflects Yamaha India's March 2026 announcement;
availability/pricing are deliberately not shown. Re-check before launch.

## Brief gaps

Your brief text ended mid-sentence at section 22 ("…Nav"). I followed everything up to there and
applied the stated intent (shared typography, colour, spacing, navigation across all screens).
