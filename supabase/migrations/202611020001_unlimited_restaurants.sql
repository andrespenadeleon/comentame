-- Temporarily remove the per-account restaurant quota.
-- Existing three- and five-argument wrappers delegate to this function.
-- Keep private.restaurant_limits intact so a future quota policy can be restored.
begin;
create or replace function public.create_restaurant(p_name text,p_address text,p_phone text,p_google_maps_url text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); result uuid;
begin
  if caller is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  if not exists(select 1 from public.profiles where id=caller) then raise exception 'profile_required'; end if;
  insert into public.restaurants(owner_id,name,address,phone,google_maps_url)
  values(caller,trim(p_name),trim(p_address),p_phone,nullif(trim(p_google_maps_url),''))
  returning id into result;
  return result;
end $$;
revoke all on function public.create_restaurant(text,text,text,text) from public,anon;
grant execute on function public.create_restaurant(text,text,text,text) to authenticated;
commit;
