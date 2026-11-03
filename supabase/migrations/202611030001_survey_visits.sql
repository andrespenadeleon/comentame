-- Survey openings: no visitor identity, no public table writes or analytics reads.
begin;
create table public.survey_visits (
 id uuid primary key,
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 employee_id uuid not null references public.employees(id),
 survey_version_id uuid not null references public.survey_versions(id),
 visited_at timestamptz not null default now()
);
create index survey_visits_restaurant_date on public.survey_visits(restaurant_id,visited_at);
create index survey_visits_employee_date on public.survey_visits(employee_id,visited_at);
alter table public.survey_visits enable row level security;
revoke all on public.survey_visits from public,anon,authenticated;
grant select on public.survey_visits to authenticated;
create policy survey_visits_owner on public.survey_visits for select to authenticated using(exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));

create function public.record_survey_visit(p_visit_id uuid,p_restaurant_id uuid,p_employee_id uuid,p_version_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_visit_id is null then return false; end if;
 insert into public.survey_visits(id,restaurant_id,employee_id,survey_version_id)
 select p_visit_id,r.id,e.id,v.id from public.restaurants r
 join public.employees e on e.restaurant_id=r.id and e.id=p_employee_id and e.deleted_at is null
 join public.survey_versions v on v.restaurant_id=r.id and v.id=r.active_survey_id and v.id=p_version_id
 where r.id=p_restaurant_id on conflict(id) do nothing;
 return found;
end $$;
revoke all on function public.record_survey_visit(uuid,uuid,uuid,uuid) from public;
grant execute on function public.record_survey_visit(uuid,uuid,uuid,uuid) to anon,authenticated;

create function public.survey_visit_metrics(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null,p_rating integer default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 with staff as materialized (
 select e.id,e.restaurant_id,e.first_name,e.last_name,e.deleted_at,r.name as restaurant_name
 from public.employees e join public.restaurants r on r.id=e.restaurant_id
 where r.owner_id=(select auth.uid()) and (p_restaurant_id is null or r.id=p_restaurant_id) and (p_employee_id is null or e.id=p_employee_id)
 ), visits as (
 select v.employee_id,count(*) as total from public.survey_visits v join staff e on e.id=v.employee_id
 where p_from is null or v.visited_at>=p_from group by v.employee_id
 ), responses as (
 select s.employee_id,count(*) as total,round(avg(s.rating),2) as average
 from public.survey_responses s join staff e on e.id=s.employee_id
 where (p_from is null or s.submitted_at>=p_from) and (p_rating is null or s.rating=p_rating) group by s.employee_id
 )
 select jsonb_build_object('visits',coalesce((select sum(total) from visits),0),
 'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'restaurant_id',e.restaurant_id,'name',concat_ws(' ',e.first_name,e.last_name),'restaurant_name',e.restaurant_name,'archived',e.deleted_at is not null,'visits',coalesce(v.total,0),'responses',coalesce(s.total,0),'average',s.average) order by coalesce(v.total,0) desc,e.first_name,e.last_name,e.id)
 from staff e left join visits v on v.employee_id=e.id left join responses s on s.employee_id=e.id),'[]'::jsonb));
$$;
revoke all on function public.survey_visit_metrics(uuid,uuid,timestamptz,integer) from public,anon;
grant execute on function public.survey_visit_metrics(uuid,uuid,timestamptz,integer) to authenticated;

create or replace function public.portal_employee_directory(p_query text default '',p_restaurant_id uuid default null,p_status text default 'active',p_page integer default 1) returns jsonb
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
  'visits',(select count(*) from public.survey_visits v join filtered f on f.id=v.employee_id),
  'employees',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('visits',(select count(*) from public.survey_visits v where v.employee_id=p.id)) order by p.restaurant_name,p.first_name,p.last_name,p.id) from current_page p),'[]'::jsonb),
  'total',(select count(*) from filtered),
  'restaurants',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name,r.id) from public.restaurants r),'[]'::jsonb),
  'page',page_number,'page_size',50
 ) into result;
 return result;
end $$;
commit;
