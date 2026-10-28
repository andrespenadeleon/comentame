-- Apply after 202610260001_initial.sql. Preserves restaurants and existing questions.
begin;
alter table public.restaurants add column if not exists google_maps_url text;
alter table public.restaurants add constraint restaurant_google_maps_url check (
  google_maps_url is null or (length(google_maps_url)<=2048 and google_maps_url ~ '^https://(maps\.app\.goo\.gl/[^[:space:]]+|goo\.gl/maps/[^[:space:]]+|(www\.)?google\.com(\.mx)?/maps([/?][^[:space:]]*)?|maps\.google\.com(\.mx)?/[^[:space:]]*)$')
);
grant update(google_maps_url) on public.restaurants to authenticated;
create or replace function public.create_restaurant(p_name text,p_address text,p_phone text,p_google_maps_url text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); allowed integer; result uuid;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  -- Serializes creations for this owner, including parallel requests from multiple tabs.
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if not exists(select 1 from public.profiles where id=caller) then raise exception 'profile_required'; end if;
  select coalesce((select max_restaurants from private.restaurant_limits where owner_id=caller),1) into allowed;
  if (select count(*) from public.restaurants where owner_id=caller)>=allowed then raise exception 'restaurant_limit'; end if;
  insert into public.restaurants(owner_id,name,address,phone,google_maps_url) values(caller,trim(p_name),trim(p_address),p_phone,nullif(trim(p_google_maps_url),'')) returning id into result;
  return result;
end $$;

revoke all on function public.create_restaurant(text,text,text,text) from public,anon;
grant execute on function public.create_restaurant(text,text,text,text) to authenticated;
-- Compatibility for clients that still send only the original three fields.
create or replace function public.create_restaurant(p_name text,p_address text,p_phone text) returns uuid
language sql security definer set search_path = '' as $$
 select public.create_restaurant(p_name,p_address,p_phone,null::text);
$$;
create or replace function private.valid_questions(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare q jsonb; opt jsonb;
begin
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) not between 1 and 21 then return false; end if;
  if value->0->>'type' is distinct from 'rating' or value->0->>'required' is distinct from 'true'
    or value->0->>'id' is distinct from '00000000-0000-4000-8000-000000000005'
    or value->0->>'prompt' is distinct from '¿Cómo estuvo tu experiencia?'
    or (select count(*) from jsonb_array_elements(value) x where x->>'type'='rating') <> 1
    or (select count(distinct x->>'id') from jsonb_array_elements(value) x) <> jsonb_array_length(value) then return false; end if;
  for q in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q->'prompt') is distinct from 'string' or length(trim(q->>'prompt')) not between 1 and 250
      or jsonb_typeof(q->'type') is distinct from 'string' or q->>'type' not in ('rating','text','single','multiple')
      or jsonb_typeof(q->'required') is distinct from 'boolean' or jsonb_typeof(q->'options') is distinct from 'array'
      or jsonb_typeof(q->'id') is distinct from 'string' or (q->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
    if q->>'type' in ('text','rating') and jsonb_array_length(q->'options') <> 0 then return false; end if;
    if q->>'type' in ('single','multiple') and jsonb_array_length(q->'options') not between 2 and 10 then return false; end if;
    for opt in select * from jsonb_array_elements(q->'options') loop
      if jsonb_typeof(opt)<>'string' or length(trim(opt #>> '{}')) not between 1 and 120 then return false; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(q->'options')) <> (select count(distinct trim(o #>> '{}')) from jsonb_array_elements(q->'options') o) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

update public.survey_drafts set questions = jsonb_build_array(jsonb_build_object(
  'id','00000000-0000-4000-8000-000000000005','type','rating',
  'prompt','¿Cómo estuvo tu experiencia?','required',true,'options','[]'::jsonb
)) || questions, updated_at=now()
where questions->0->>'type' is distinct from 'rating';
commit;
