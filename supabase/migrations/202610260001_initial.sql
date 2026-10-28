-- Run once in the Supabase SQL editor. Transactional; no service key in the app.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 150),
  phone text not null check (phone ~ '^\+52[2-9][0-9]{9}$'),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);
create table private.restaurant_limits (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  max_restaurants integer not null default 1 check (max_restaurants between 1 and 1000)
);
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 150),
  address text not null check (length(trim(address)) between 1 and 500),
  phone text not null check (phone ~ '^\+52[2-9][0-9]{9}$'),
  created_at timestamptz not null default now()
);
create index restaurants_owner on public.restaurants(owner_id);
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  last_name text not null check (length(trim(last_name)) between 1 and 80),
  role text not null check (length(trim(role)) between 1 and 100),
  photo_path text,
  created_at timestamptz not null default now(),
  check (photo_path is null or (split_part(photo_path,'/',1)=restaurant_id::text and split_part(photo_path,'/',2)=id::text and photo_path ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.(jpg|png|webp)$'))
);
create index employees_restaurant on public.employees(restaurant_id);

create function private.valid_questions(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare q jsonb; opt jsonb;
begin
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) not between 1 and 20 then return false; end if;
  for q in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q->'prompt') is distinct from 'string' or length(trim(q->>'prompt')) not between 1 and 250
      or jsonb_typeof(q->'type') is distinct from 'string' or q->>'type' not in ('text','single','multiple')
      or jsonb_typeof(q->'required') is distinct from 'boolean' or jsonb_typeof(q->'options') is distinct from 'array'
      or jsonb_typeof(q->'id') is distinct from 'string' or (q->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
    if q->>'type'='text' and jsonb_array_length(q->'options') <> 0 then return false; end if;
    if q->>'type'<>'text' and jsonb_array_length(q->'options') not between 2 and 10 then return false; end if;
    for opt in select * from jsonb_array_elements(q->'options') loop
      if jsonb_typeof(opt)<>'string' or length(trim(opt #>> '{}')) not between 1 and 120 then return false; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(q->'options')) <> (select count(distinct trim(o #>> '{}')) from jsonb_array_elements(q->'options') o) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
create table public.survey_drafts (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 150),
  questions jsonb not null check (private.valid_questions(questions)),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.employees enable row level security;
alter table public.survey_drafts enable row level security;
alter table private.restaurant_limits enable row level security;
revoke all on public.profiles,public.restaurants,public.employees,public.survey_drafts from anon,authenticated;
grant select,insert on public.profiles to authenticated;
grant update(full_name,phone) on public.profiles to authenticated;
grant select on public.restaurants to authenticated;
grant update(name,address,phone) on public.restaurants to authenticated;
grant select,insert,delete on public.employees to authenticated;
grant update(first_name,last_name,role,photo_path) on public.employees to authenticated;
grant select,insert,delete on public.survey_drafts to authenticated;
grant update(title,questions,updated_at) on public.survey_drafts to authenticated;

-- Checks use an indexed owner relationship. Anonymous visitors get no private data.
create policy profile_read on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profile_insert on public.profiles for insert to authenticated with check (id=(select auth.uid()) and not onboarding_completed);
create policy profile_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy restaurant_read on public.restaurants for select to authenticated using (owner_id=(select auth.uid()));
create policy restaurant_update on public.restaurants for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy employee_owner on public.employees for all to authenticated
using (exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())))
with check (exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));
create policy survey_owner on public.survey_drafts for all to authenticated
using (exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())))
with check (exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));

-- SECURITY DEFINER functions use a fixed search_path, auth.uid(), and explicit grants.
create function public.create_restaurant(p_name text,p_address text,p_phone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); allowed integer; result uuid;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  -- Serializes creations for this owner, including parallel requests from multiple tabs.
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if not exists(select 1 from public.profiles where id=caller) then raise exception 'profile_required'; end if;
  select coalesce((select max_restaurants from private.restaurant_limits where owner_id=caller),1) into allowed;
  if (select count(*) from public.restaurants where owner_id=caller)>=allowed then raise exception 'restaurant_limit'; end if;
  insert into public.restaurants(owner_id,name,address,phone) values(caller,trim(p_name),trim(p_address),p_phone) returning id into result;
  return result;
end $$;
create function public.complete_onboarding() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.restaurants where owner_id=auth.uid()) then raise exception 'restaurant_required'; end if;
  update public.profiles set onboarding_completed=true where id=auth.uid();
  if not found then raise exception 'profile_required'; end if;
end $$;
revoke all on function public.create_restaurant(text,text,text),public.complete_onboarding() from public,anon;
grant execute on function public.create_restaurant(text,text,text),public.complete_onboarding() to authenticated;
-- The check constraint calls this function; only validation is exposed, no private rows.
grant usage on schema private to authenticated;
grant execute on function private.valid_questions(jsonb) to authenticated;
revoke all on private.restaurant_limits from public,anon,authenticated;

-- Private employee photos, limited to 2 MiB and supported raster types.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('employee-photos','employee-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy employee_photo_read on storage.objects for select to authenticated
using(bucket_id='employee-photos' and exists(select 1 from public.employees e join public.restaurants r on r.id=e.restaurant_id where e.photo_path=storage.objects.name and r.owner_id=(select auth.uid())));
create policy employee_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='employee-photos' and exists(select 1 from public.employees e join public.restaurants r on r.id=e.restaurant_id where e.restaurant_id::text=(storage.foldername(storage.objects.name))[1] and e.id::text=(storage.foldername(storage.objects.name))[2] and r.owner_id=(select auth.uid())));
create policy employee_photo_delete on storage.objects for delete to authenticated
using(bucket_id='employee-photos' and exists(select 1 from public.employees e join public.restaurants r on r.id=e.restaurant_id where e.restaurant_id::text=(storage.foldername(storage.objects.name))[1] and e.id::text=(storage.foldername(storage.objects.name))[2] and r.owner_id=(select auth.uid())));
commit;
