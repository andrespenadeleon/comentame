-- Apply after portal dashboard migration. Counts clicks, never Google review publication.
begin;
create table public.survey_google_clicks (
 id uuid primary key,
 visit_id uuid not null references public.survey_visits(id) on delete cascade,
 clicked_at timestamptz not null default now()
);
create index survey_google_clicks_visit on public.survey_google_clicks(visit_id);
alter table public.survey_google_clicks enable row level security;
revoke all on public.survey_google_clicks from public,anon,authenticated;
grant select on public.survey_google_clicks to authenticated;
create policy google_clicks_owner on public.survey_google_clicks for select to authenticated using(exists(select 1 from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id where v.id=visit_id and r.owner_id=(select auth.uid())));

create function public.record_google_review_click(p_click_id uuid,p_visit_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_click_id is null or p_visit_id is null then return false; end if;
 insert into public.survey_google_clicks(id,visit_id)
 select p_click_id,v.id from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where v.id=p_visit_id and v.completed_at is not null and v.response_id is not null and nullif(trim(r.google_maps_url),'') is not null
 on conflict(id) do nothing;
 return found;
end $$;
revoke all on function public.record_google_review_click(uuid,uuid) from public;
grant execute on function public.record_google_review_click(uuid,uuid) to anon,authenticated;

create or replace function public.survey_engagement_metrics(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 with sessions as materialized (
 select v.* from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where r.owner_id=(select auth.uid()) and v.engagement_tracked
 and (p_restaurant_id is null or v.restaurant_id=p_restaurant_id) and (p_employee_id is null or v.employee_id=p_employee_id) and (p_from is null or v.visited_at>=p_from)
 ), employee_stats as (
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id)),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
 count(*) filter(where started_at is not null and completed_at is null) as unfinished,
 round(avg(active_ms)/1000.0,1) as average_seconds,
 round(avg(active_ms) filter(where completed_at is not null)/1000.0,1) as completed_seconds,
 round(avg(active_ms) filter(where completed_at is null)/1000.0,1) as incomplete_seconds
 from sessions group by employee_id
 ), field_stats as (
 select v.restaurant_id,r.name as restaurant_name,sv.id as version_id,sv.version,f.key,f.label,count(*) as visits,
 count(*) filter(where f.key=any(v.touched_fields)) as touched,
 count(*) filter(where f.key=any(v.answered_fields)) as answered
 from sessions v join public.survey_versions sv on sv.id=v.survey_version_id join public.restaurants r on r.id=v.restaurant_id
 cross join lateral (
 select 'rating'::text as key,'Calificación de estrellas'::text as label
 union all select 'guest_name','Nombre del comensal'
 union all select 'guest_contact','Contacto (opcional)'
 union all select 'q:'||(q->>'id'),q->>'prompt' from jsonb_array_elements(sv.questions) q where q->>'type'<>'rating'
 ) f group by v.restaurant_id,r.name,sv.id,sv.version,f.key,f.label
 )
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),
 'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employee_stats e),'[]'::jsonb),
 'fields',coalesce((select jsonb_agg(to_jsonb(f) order by f.answered desc,f.label,f.version_id) from field_stats f),'[]'::jsonb)) from sessions;
$$;

create or replace function public.portal_engagement_metrics(p_query text default '',p_restaurant_id uuid default null,p_status text default 'active') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; term text:=lower(trim(coalesce(p_query,'')));
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if length(term)>150 or p_status is null or p_status not in ('active','archived','all') then raise exception 'invalid_filters'; end if;
 with staff as materialized (
 select e.id from public.employees e join public.restaurants r on r.id=e.restaurant_id
 where (p_restaurant_id is null or e.restaurant_id=p_restaurant_id)
 and (p_status='all' or (p_status='active' and e.deleted_at is null) or (p_status='archived' and e.deleted_at is not null))
 and (term='' or position(term in lower(concat_ws(' ',e.first_name,e.last_name,e.role,r.name)))>0)
 ), sessions as materialized (
 select v.* from public.survey_visits v join staff e on e.id=v.employee_id where v.engagement_tracked
 ), employees as (
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id)),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
 count(*) filter(where started_at is not null and completed_at is null) as unfinished,round(avg(active_ms)/1000.0,1) as average_seconds
 from sessions group by employee_id
 )
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employees e),'[]'::jsonb)) into result from sessions;
 return result;
end $$;

create or replace function public.portal_survey_engagement(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 return (
 with sessions as materialized (
 select v.* from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where v.engagement_tracked
 and (p_restaurant_id is null or v.restaurant_id=p_restaurant_id) and (p_employee_id is null or v.employee_id=p_employee_id) and (p_from is null or v.visited_at>=p_from)
 ), employee_stats as (
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id)),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
 count(*) filter(where started_at is not null and completed_at is null) as unfinished,
 round(avg(active_ms)/1000.0,1) as average_seconds,
 round(avg(active_ms) filter(where completed_at is not null)/1000.0,1) as completed_seconds,
 round(avg(active_ms) filter(where completed_at is null)/1000.0,1) as incomplete_seconds
 from sessions group by employee_id
 ), field_stats as (
 select v.restaurant_id,r.name as restaurant_name,sv.id as version_id,sv.version,f.key,f.label,count(*) as visits,
 count(*) filter(where f.key=any(v.touched_fields)) as touched,
 count(*) filter(where f.key=any(v.answered_fields)) as answered
 from sessions v join public.survey_versions sv on sv.id=v.survey_version_id join public.restaurants r on r.id=v.restaurant_id
 cross join lateral (
 select 'rating'::text as key,'Calificación de estrellas'::text as label
 union all select 'guest_name','Nombre del comensal'
 union all select 'guest_contact','Contacto (opcional)'
 union all select 'q:'||(q->>'id'),q->>'prompt' from jsonb_array_elements(sv.questions) q where q->>'type'<>'rating'
 ) f group by v.restaurant_id,r.name,sv.id,sv.version,f.key,f.label
 )
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),
 'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employee_stats e),'[]'::jsonb),
 'fields',coalesce((select jsonb_agg(to_jsonb(f) order by f.answered desc,f.label,f.version_id) from field_stats f),'[]'::jsonb)) from sessions
 );
end $$;

commit;
