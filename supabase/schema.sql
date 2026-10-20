-- =====================================================================
-- Yamaha XSR 155 website — Supabase schema, RLS and anti-spam controls
-- Run ONCE in Supabase Dashboard → SQL Editor on a fresh project.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 0. Owners allow-list. Only users listed here are treated as the owner.
--    (Also turn OFF "Allow new users to sign up" in Auth settings.)
-- ---------------------------------------------------------------------
create table if not exists public.owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.owners enable row level security;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.owners where user_id = auth.uid());
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

drop policy if exists "owners read self" on public.owners;
create policy "owners read self" on public.owners
  for select to authenticated using (user_id = auth.uid());

revoke all on public.owners from anon, authenticated;
grant select on public.owners to authenticated;

-- ---------------------------------------------------------------------
-- 1. Tables
--    ip_hash   : salted SHA-256 of the requester IP, set by trigger, used
--                only for rate limiting. Never readable by the public.
--    hp        : honeypot column. Real visitors leave it empty; bots that
--                fill it fail the CHECK constraint.
--    client_token : one random UUID per form render; unique index makes
--                accidental double submits harmless.
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text check (name is null or char_length(name) <= 80),
  email        text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  category     text not null check (category in ('Design','Information','Features','User Experience','Other')),
  liked        text check (liked is null or char_length(liked) <= 3000),
  improve      text check (improve is null or char_length(improve) <= 3000),
  suggestions  text check (suggestions is null or char_length(suggestions) <= 3000),
  rating       smallint check (rating is null or rating between 1 and 5),
  status       text not null default 'new' check (status in ('new','reviewed','archived')),
  client_token uuid unique,
  ip_hash      text,
  hp           text check (hp is null or hp = ''),
  constraint feedback_has_content check (liked is not null or improve is not null or suggestions is not null)
);

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  rating       smallint not null check (rating between 1 and 5),
  title        text not null check (char_length(title) between 3 and 100),
  body         text not null check (char_length(body) between 10 and 2000),
  display_name text check (display_name is null or char_length(display_name) <= 60),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  moderated_at timestamptz,
  client_token uuid unique,
  ip_hash      text,
  hp           text check (hp is null or hp = '')
);
create index if not exists reviews_public_idx on public.reviews (created_at desc) where status = 'approved';

create table if not exists public.inquiries (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 80),
  email          text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  category       text not null check (category in ('General','Motorcycle information','Test ride','Reviews and feedback','Other')),
  message        text not null check (char_length(message) between 10 and 4000),
  consent        boolean not null check (consent = true),
  status         text not null default 'new' check (status in ('new','contacted','resolved','archived')),
  needs_response boolean not null default true,
  owner_notes    text check (owner_notes is null or char_length(owner_notes) <= 4000),
  client_token   uuid unique,
  ip_hash        text,
  hp             text check (hp is null or hp = '')
);

create table if not exists public.test_ride_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  full_name      text not null check (char_length(full_name) between 1 and 80),
  email          text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          text not null check (phone ~ '^[0-9+()\-\s]{7,20}$'),
  location       text not null check (char_length(location) between 2 and 120),
  preferred_date date not null,
  preferred_time text not null check (preferred_time in ('Morning (9–12)','Afternoon (12–4)','Evening (4–7)')),
  message        text check (message is null or char_length(message) <= 1000),
  consent        boolean not null check (consent = true),
  -- A request is NOT an appointment until the owner sets 'approved'.
  status         text not null default 'pending' check (status in ('pending','contacted','approved','completed','cancelled')),
  follow_up_at   date,
  follow_up_note text check (follow_up_note is null or char_length(follow_up_note) <= 2000),
  client_token   uuid unique,
  ip_hash        text,
  hp             text check (hp is null or hp = '')
);

-- ---------------------------------------------------------------------
-- 2. Server-side sanitising + rate limiting (runs for every public insert)
-- ---------------------------------------------------------------------
create or replace function public.clean_text(t text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(coalesce(t, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), '');
$$;

create or replace function public.a_prepare_submission()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  hdrs   json;
  ip     text;
  salt   text := coalesce(current_setting('app.ip_salt', true), 'change-me');
  maxph  int;
  recent int;
begin
  -- The owner (authenticated allow-listed user) is not rate limited.
  if auth.uid() is not null and public.is_owner() then
    return new;
  end if;

  begin
    hdrs := current_setting('request.headers', true)::json;
  exception when others then
    hdrs := null;
  end;
  ip := coalesce(nullif(split_part(coalesce(hdrs->>'x-forwarded-for', ''), ',', 1), ''), hdrs->>'x-real-ip', 'unknown');
  new.ip_hash := encode(digest(ip || salt, 'sha256'), 'hex');

  maxph := case TG_TABLE_NAME
             when 'feedback' then 6
             when 'reviews' then 3
             when 'inquiries' then 5
             when 'test_ride_requests' then 4
             else 5 end;

  execute format(
    'select count(*) from public.%I where ip_hash = $1 and created_at > now() - interval ''1 hour''',
    TG_TABLE_NAME) into recent using new.ip_hash;

  if recent >= maxph then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.b_clean_feedback() returns trigger language plpgsql as $$
begin
  new.name := public.clean_text(new.name);
  new.email := lower(public.clean_text(new.email));
  new.liked := public.clean_text(new.liked);
  new.improve := public.clean_text(new.improve);
  new.suggestions := public.clean_text(new.suggestions);
  return new;
end $$;

create or replace function public.b_clean_review() returns trigger language plpgsql as $$
begin
  new.title := public.clean_text(new.title);
  new.body := public.clean_text(new.body);
  new.display_name := public.clean_text(new.display_name);
  return new;
end $$;

create or replace function public.b_clean_inquiry() returns trigger language plpgsql as $$
begin
  new.name := public.clean_text(new.name);
  new.email := lower(public.clean_text(new.email));
  new.message := public.clean_text(new.message);
  return new;
end $$;

create or replace function public.b_clean_test_ride() returns trigger language plpgsql as $$
begin
  new.full_name := public.clean_text(new.full_name);
  new.email := lower(public.clean_text(new.email));
  new.phone := public.clean_text(new.phone);
  new.location := public.clean_text(new.location);
  new.message := public.clean_text(new.message);
  if tg_op = 'INSERT' and (new.preferred_date < current_date or new.preferred_date > current_date + 180) then
    raise exception 'invalid_preferred_date' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Triggers fire alphabetically: a_ (rate limit) before b_ (clean).
drop trigger if exists a_prepare on public.feedback;
create trigger a_prepare before insert on public.feedback for each row execute function public.a_prepare_submission();
drop trigger if exists b_clean on public.feedback;
create trigger b_clean before insert on public.feedback for each row execute function public.b_clean_feedback();

drop trigger if exists a_prepare on public.reviews;
create trigger a_prepare before insert on public.reviews for each row execute function public.a_prepare_submission();
drop trigger if exists b_clean on public.reviews;
create trigger b_clean before insert on public.reviews for each row execute function public.b_clean_review();

drop trigger if exists a_prepare on public.inquiries;
create trigger a_prepare before insert on public.inquiries for each row execute function public.a_prepare_submission();
drop trigger if exists b_clean on public.inquiries;
create trigger b_clean before insert on public.inquiries for each row execute function public.b_clean_inquiry();

drop trigger if exists a_prepare on public.test_ride_requests;
create trigger a_prepare before insert on public.test_ride_requests for each row execute function public.a_prepare_submission();
drop trigger if exists b_clean on public.test_ride_requests;
create trigger b_clean before insert on public.test_ride_requests for each row execute function public.b_clean_test_ride();

-- ---------------------------------------------------------------------
-- 3. Row Level Security + column privileges
-- ---------------------------------------------------------------------
alter table public.feedback           enable row level security;
alter table public.reviews            enable row level security;
alter table public.inquiries          enable row level security;
alter table public.test_ride_requests enable row level security;

-- Start from nothing, then grant only what is needed.
revoke all on public.feedback, public.reviews, public.inquiries, public.test_ride_requests from anon, authenticated;

-- Public visitors: INSERT only, only the columns a form may set. They cannot
-- set status, ip_hash, moderated_at, notes, etc. They cannot read private tables.
grant insert (name, email, category, liked, improve, suggestions, rating, client_token, hp)
  on public.feedback to anon;
grant insert (rating, title, body, display_name, client_token, hp)
  on public.reviews to anon;
grant insert (name, email, category, message, consent, client_token, hp)
  on public.inquiries to anon;
grant insert (full_name, email, phone, location, preferred_date, preferred_time, message, consent, client_token, hp)
  on public.test_ride_requests to anon;

-- Public may read ONLY approved reviews, and only public columns.
grant select (id, created_at, rating, title, body, display_name) on public.reviews to anon;

-- Owner: full management (RLS below limits this to allow-listed users).
grant select, update, delete on public.feedback, public.reviews, public.inquiries, public.test_ride_requests to authenticated;

-- Policies -------------------------------------------------------------
drop policy if exists "public submit feedback" on public.feedback;
create policy "public submit feedback" on public.feedback
  for insert to anon with check (status = 'new');

drop policy if exists "public submit review" on public.reviews;
create policy "public submit review" on public.reviews
  for insert to anon with check (status = 'pending' and moderated_at is null);

drop policy if exists "public read approved reviews" on public.reviews;
create policy "public read approved reviews" on public.reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "public submit inquiry" on public.inquiries;
create policy "public submit inquiry" on public.inquiries
  for insert to anon with check (status = 'new' and needs_response = true);

drop policy if exists "public submit test ride" on public.test_ride_requests;
create policy "public submit test ride" on public.test_ride_requests
  for insert to anon with check (status = 'pending' and follow_up_at is null);

do $$
declare t text;
begin
  foreach t in array array['feedback','reviews','inquiries','test_ride_requests'] loop
    execute format('drop policy if exists "owner manage" on public.%I', t);
    execute format(
      'create policy "owner manage" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Public rating summary — computed from APPROVED reviews only.
-- ---------------------------------------------------------------------
create or replace function public.review_summary()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'total',   count(*),
    'average', coalesce(round(avg(rating)::numeric, 2), 0),
    'distribution', json_build_object(
      '1', count(*) filter (where rating = 1),
      '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3),
      '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5))
  )
  from public.reviews where status = 'approved';
$$;
revoke all on function public.review_summary() from public;
grant execute on function public.review_summary() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. After running this file
--    a) Set a private salt for IP hashing (do not commit it):
--         alter database postgres set app.ip_salt = 'PUT-A-LONG-RANDOM-STRING-HERE';
--    b) Auth → Providers → Email: DISABLE "Allow new users to sign up".
--    c) Auth → Users → "Add user" for yourself, then register as owner:
--         insert into public.owners (user_id) values ('<your-auth-user-uuid>');
-- ---------------------------------------------------------------------
