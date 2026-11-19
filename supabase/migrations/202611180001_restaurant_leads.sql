-- Leads remain restaurant-scoped. Legacy Google events are never treated as verified clicks.
begin;
alter table public.survey_google_clicks add column event_kind text not null default 'legacy' check(event_kind in ('legacy','voluntary'));
create index survey_visits_response_lookup on public.survey_visits(response_id) where response_id is not null;

create function public.record_google_review_manual_click(p_click_id uuid,p_visit_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_click_id is null or p_visit_id is null then return false; end if;
 insert into public.survey_google_clicks(id,visit_id,event_kind)
 select p_click_id,v.id,'voluntary' from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where v.id=p_visit_id and v.completed_at is not null and v.response_id is not null and nullif(trim(r.google_maps_url),'') is not null
 on conflict(id) do nothing;
 return found;
end $$;
revoke all on function public.record_google_review_manual_click(uuid,uuid) from public;
grant execute on function public.record_google_review_manual_click(uuid,uuid) to anon,authenticated;

-- Mexico is the existing supported phone format. Unknown formats do not acquire a guessed identity.
create function public.lead_contact_key(p_contact text) returns text
language sql immutable set search_path='' as $$
 select case
 when trim(p_contact) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then 'email:'||lower(trim(p_contact))
 when trim(p_contact) ~ '^[+0-9()[:space:].-]+$' and regexp_replace(p_contact,'[^0-9]','','g') ~ '^(52)?[2-9][0-9]{9}$'
 then 'phone:+52'||right(regexp_replace(p_contact,'[^0-9]','','g'),10)
 else null end;
$$;
revoke all on function public.lead_contact_key(text) from public;

create function public.restaurant_leads(p_restaurant_id uuid,p_page integer default 1,p_detail uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_restaurant_id is null or not exists(
 select 1 from public.restaurants r where r.id=p_restaurant_id and (r.owner_id=auth.uid() or public.is_portal_admin())
 ) then raise exception 'restaurant_access_required' using errcode='42501'; end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'invalid_page'; end if;
 with eligible as materialized (
 select s.id,s.guest_name,s.guest_contact,s.submitted_at,s.employee_name,s.survey_version_id from public.survey_responses s where s.restaurant_id=p_restaurant_id
 and nullif(trim(s.guest_name),'') is not null and nullif(trim(s.guest_contact),'') is not null
 ), rows as (
 select e.id,e.guest_name,e.guest_contact,e.submitted_at,e.employee_name,
 public.lead_contact_key(e.guest_contact) as contact_key,
 exists(select 1 from public.survey_google_clicks c join public.survey_visits v on v.id=c.visit_id where v.response_id=e.id and c.event_kind='voluntary') as google_clicked,
 exists(select 1 from public.survey_google_clicks c join public.survey_visits v on v.id=c.visit_id where v.response_id=e.id and c.event_kind='legacy') as google_legacy
 from eligible e order by e.submitted_at desc,e.id limit 20 offset (p_page-1)*20
 )
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.submitted_at desc,x.id) from rows x),'[]'::jsonb),
 'detail',(select to_jsonb(s) from public.survey_responses s join eligible e on e.id=s.id where e.id=p_detail),
 'version',(select jsonb_build_object('title',v.title,'version',v.version,'questions',v.questions) from public.survey_versions v join eligible e on e.survey_version_id=v.id where e.id=p_detail)) into result;
 return result;
end $$;
revoke all on function public.restaurant_leads(uuid,integer,uuid) from public;
grant execute on function public.restaurant_leads(uuid,integer,uuid) to authenticated;

-- All Google aggregates now count only explicitly voluntary events.
create or replace function public.survey_engagement_metrics(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 with sessions as materialized (
 select v.* from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where r.owner_id=(select auth.uid()) and v.engagement_tracked
 and (p_restaurant_id is null or v.restaurant_id=p_restaurant_id) and (p_employee_id is null or v.employee_id=p_employee_id) and (p_from is null or v.visited_at>=p_from)
 ), employee_stats as (
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id and c.event_kind='voluntary')),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
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
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id where c.event_kind='voluntary'),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
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
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id and c.event_kind='voluntary')),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
 count(*) filter(where started_at is not null and completed_at is null) as unfinished,round(avg(active_ms)/1000.0,1) as average_seconds
 from sessions group by employee_id
 )
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id where c.event_kind='voluntary'),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
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
 select employee_id,coalesce(sum((select count(*) from public.survey_google_clicks c where c.visit_id=sessions.id and c.event_kind='voluntary')),0) as google_clicks,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
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
 select jsonb_build_object('google_clicks',(select count(*) from public.survey_google_clicks c join sessions v on v.id=c.visit_id where c.event_kind='voluntary'),'visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),
 'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employee_stats e),'[]'::jsonb),
 'fields',coalesce((select jsonb_agg(to_jsonb(f) order by f.answered desc,f.label,f.version_id) from field_stats f),'[]'::jsonb)) from sessions
 );
end $$;


commit;
