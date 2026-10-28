-- Apply after the four previous migrations. Grant membership manually via SQL Editor.
begin;
create table private.portal_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table private.portal_admins enable row level security;
revoke all on private.portal_admins from public,anon,authenticated;

-- No caller-supplied user ID and no editable user_metadata claims.
create function public.is_portal_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.portal_admins a where a.user_id=auth.uid());
$$;
revoke all on function public.is_portal_admin() from public,anon;
grant execute on function public.is_portal_admin() to authenticated;

-- Minimal read-only directory. All cross-restaurant reads stay behind this check.
create function public.portal_employee_directory(p_query text default '',p_restaurant_id uuid default null,p_status text default 'active',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; term text:=lower(trim(coalesce(p_query,''))); page_number integer:=coalesce(p_page,1);
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if length(term)>150 or p_status is null or p_status not in ('active','archived','all') or page_number not between 1 and 100000 then raise exception 'invalid_directory_filters'; end if;
 with filtered as materialized (
  select e.id,e.restaurant_id,e.first_name,e.last_name,e.role,e.deleted_at,r.name as restaurant_name,(r.active_survey_id is not null) as survey_published
  from public.employees e join public.restaurants r on r.id=e.restaurant_id
  where (p_restaurant_id is null or r.id=p_restaurant_id)
  and (p_status='all' or (p_status='active' and e.deleted_at is null) or (p_status='archived' and e.deleted_at is not null))
  and (term='' or position(term in lower(concat_ws(' ',e.first_name,e.last_name,e.role,r.name)))>0)
 ), current_page as (
  select * from filtered order by restaurant_name,first_name,last_name,id limit 50 offset ((page_number-1)::bigint*50)
 )
 select jsonb_build_object(
  'employees',coalesce((select jsonb_agg(to_jsonb(p) order by p.restaurant_name,p.first_name,p.last_name,p.id) from current_page p),'[]'::jsonb),
  'total',(select count(*) from filtered),
  'restaurants',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name,r.id) from public.restaurants r),'[]'::jsonb),
  'page',page_number,'page_size',50
 ) into result;
 return result;
end $$;
revoke all on function public.portal_employee_directory(text,uuid,text,integer) from public,anon;
grant execute on function public.portal_employee_directory(text,uuid,text,integer) to authenticated;
commit;
