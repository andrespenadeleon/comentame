begin;
create function public.participation_versions(p_restaurant_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; admin boolean;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 admin:=public.is_portal_admin();
 if p_restaurant_id is not null and not exists(select 1 from public.restaurants r where r.id=p_restaurant_id and (r.owner_id=auth.uid() or admin)) then raise exception 'restaurant_access_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'restaurant_id',r.id,'restaurant_name',r.name,'version',v.version,'title',v.title,'published_at',v.published_at) order by v.published_at desc,v.version desc,v.id desc),'[]'::jsonb) into result
 from public.survey_versions v join public.restaurants r on r.id=v.restaurant_id
 where (r.owner_id=auth.uid() or admin) and (p_restaurant_id is null or r.id=p_restaurant_id);
 return result;
end $$;
revoke all on function public.participation_versions(uuid) from public;
grant execute on function public.participation_versions(uuid) to authenticated;
commit;
