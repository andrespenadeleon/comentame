-- Saved real reports. Two reservations per restaurant/week, including legacy analyses.
begin;
create table public.restaurant_ai_reports (
 id uuid primary key,restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 generated_by uuid not null references auth.users(id),range_start date not null,range_end date not null,
 version_id uuid,employee_id uuid,rating integer,status text not null check(status in ('running','completed','failed')),
 created_at timestamptz not null default now(),completed_at timestamptz,week_start date not null,
 snapshot jsonb,source_ids uuid[] not null default '{}',output jsonb,usage jsonb,model text not null default 'gpt-6-luna',
 check(range_end>=range_start)
);
create index restaurant_ai_reports_scope on public.restaurant_ai_reports(restaurant_id,range_start,range_end,created_at desc);
create index restaurant_ai_reports_quota on public.restaurant_ai_reports(restaurant_id,week_start,status);
alter table public.restaurant_ai_reports enable row level security;
revoke all on public.restaurant_ai_reports from public,anon,authenticated;

create function private.restaurant_report_snapshot(p_restaurant uuid,p_start date,p_end date,p_version uuid,p_employee uuid,p_rating integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz:=p_start::timestamp at time zone 'America/Monterrey';through timestamptz:=least((p_end+1)::timestamp at time zone 'America/Monterrey',now()); result jsonb;
begin
 with current_rows as materialized(
 select s.* from public.survey_responses s where s.restaurant_id=p_restaurant and s.submitted_at>=since and s.submitted_at<through
 and (p_version is null or s.survey_version_id=p_version) and (p_employee is null or s.employee_id=p_employee) and (p_rating is null or s.rating=p_rating)
 ),previous_rows as materialized(
 select s.* from public.survey_responses s where s.restaurant_id=p_restaurant and s.submitted_at>=since-(through-since) and s.submitted_at<since
 and (p_version is null or s.survey_version_id=p_version) and (p_employee is null or s.employee_id=p_employee) and (p_rating is null or s.rating=p_rating)
 ),visits as materialized(
 select v.* from public.survey_visits v where v.restaurant_id=p_restaurant and v.engagement_tracked and v.visited_at>=since and v.visited_at<through
 and (p_version is null or v.survey_version_id=p_version) and (p_employee is null or v.employee_id=p_employee)
 ),answers as materialized(
 select a.* from private.analytics_question_answers(p_restaurant,p_version,null,p_employee,p_rating,since) a join current_rows s on s.id=a.id where a.key not in ('guest_name','guest_contact')
 ),catalog as (
 select distinct on(c.key) c.* from private.analytics_question_catalog(p_restaurant,p_version) c where c.key not in ('guest_name','guest_contact') order by c.key,c.published_at desc,c.version desc
 ),selections as materialized(
 select a.key,a.id,x.value as label from answers a join catalog c on c.key=a.key and c.question_type in ('rating','single','multiple') cross join lateral (
 select distinct value from jsonb_array_elements_text(case when jsonb_typeof(a.answer)='array' then a.answer else jsonb_build_array(a.answer#>>'{}') end)
 ) x
 ),question_groups as(
 select c.key,c.label,c.question_type,c.presentation,c.question_position,
 (select count(*) from answers a where a.key=c.key) as answered,
 case when c.question_type in ('rating','single','multiple') then coalesce((select jsonb_agg(to_jsonb(d) order by d.total desc,d.label) from(select x.label,count(*) as total from selections x where x.key=c.key group by x.label)d),'[]'::jsonb) else '[]'::jsonb end as distribution,
 case when c.question_type='text' then coalesce((select jsonb_agg(jsonb_build_object('response_id',a.id,'text',a.answer#>>'{}') order by a.submitted_at desc,a.id) from answers a where a.key=c.key),'[]'::jsonb) else '[]'::jsonb end as comments
 from catalog c
 )select jsonb_build_object(
 'restaurant_name',(select r.name from public.restaurants r where r.id=p_restaurant),'from',since,'through',through,'previous_from',since-(through-since),'previous_through',since,
 'responses',(select count(*) from current_rows),'average',(select round(avg(s.rating),2) from current_rows s),
 'previous',jsonb_build_object('responses',(select count(*) from previous_rows),'average',(select round(avg(s.rating),2) from previous_rows s)),
 'leads',(select count(*) from current_rows s where nullif(trim(s.guest_contact),'') is not null),
 'visits',(select count(*) from visits),'starts',(select count(*) from visits v where v.started_at is not null),'completions',(select count(*) from visits v where v.completed_at is not null),
 'average_seconds',(select round(avg(v.active_ms)/1000.0,1) from visits v),
 'google_clicks',(select count(*) from public.survey_google_clicks g join public.survey_visits v on v.id=g.visit_id where v.restaurant_id=p_restaurant and g.event_kind='voluntary' and g.clicked_at>=since and g.clicked_at<through and (p_version is null or v.survey_version_id=p_version) and (p_employee is null or v.employee_id=p_employee)),
 'ratings',coalesce((select jsonb_agg(to_jsonb(d) order by d.rating) from(select s.rating,count(*) as total from current_rows s group by s.rating)d),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from(select day::date as day,(select count(*) from current_rows s where (s.submitted_at at time zone 'America/Monterrey')::date=day::date) as total from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')day)d),'[]'::jsonb),
 'employees',coalesce((select jsonb_agg(to_jsonb(d) order by d.total desc,d.name) from(select s.employee_id as id,max(s.employee_name) as name,count(*) as total,round(avg(s.rating),2) as average from current_rows s group by s.employee_id)d),'[]'::jsonb),
 'questions',coalesce((select jsonb_agg(to_jsonb(q) order by q.question_position) from question_groups q),'[]'::jsonb),
 'source_ids',coalesce((select jsonb_agg(s.id order by s.id) from current_rows s),'[]'::jsonb)
 )into result;return result;
end $$;
revoke all on function private.restaurant_report_snapshot(uuid,date,date,uuid,uuid,integer) from public,anon,authenticated;

create function public.restaurant_ai_report_state(p_restaurant uuid,p_start date,p_end date,p_version uuid default null,p_employee uuid default null,p_rating integer default null)returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare latest public.restaurant_ai_reports; used_count integer; total_count integer;fresh_count integer;week_date date:=date_trunc('week',now() at time zone 'America/Monterrey')::date;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 if not exists(select 1 from public.restaurants r where r.id=p_restaurant) then raise exception 'invalid_restaurant';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 or p_end>(now() at time zone 'America/Monterrey')::date or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'invalid_range';end if;
 if p_version is not null and not exists(select 1 from public.survey_versions v where v.id=p_version and v.restaurant_id=p_restaurant) then raise exception 'invalid_version';end if;
 if p_employee is not null and not exists(select 1 from public.employees e where e.id=p_employee and e.restaurant_id=p_restaurant) then raise exception 'invalid_employee';end if;
 update public.restaurant_ai_reports set status='failed' where restaurant_id=p_restaurant and status='running' and created_at<now()-interval '10 minutes';
 select * into latest from public.restaurant_ai_reports r where r.restaurant_id=p_restaurant and r.range_start=p_start and r.range_end=p_end and r.version_id is not distinct from p_version and r.employee_id is not distinct from p_employee and r.rating is not distinct from p_rating and r.status='completed' order by r.created_at desc limit 1;
 select count(*),count(*) filter(where not(s.id=any(coalesce(latest.source_ids,'{}'::uuid[])))) into total_count,fresh_count from public.survey_responses s where s.restaurant_id=p_restaurant and s.submitted_at>=(p_start::timestamp at time zone 'America/Monterrey') and s.submitted_at<least(((p_end+1)::timestamp at time zone 'America/Monterrey'),now()) and (p_version is null or s.survey_version_id=p_version) and(p_employee is null or s.employee_id=p_employee)and(p_rating is null or s.rating=p_rating);
 select (select count(*) from public.restaurant_ai_reports r where r.restaurant_id=p_restaurant and r.week_start=week_date and r.status in ('running','completed'))+(select count(*) from public.portal_question_insights i where i.restaurant_id=p_restaurant and i.week_start=week_date) into used_count;
 return jsonb_build_object('report',case when latest.id is null then null else to_jsonb(latest)-'generated_by'-'source_ids' end,'matching_count',total_count,'new_count',fresh_count,'used',used_count,'limit',2,'remaining',greatest(0,2-used_count),'resets_at',(week_date+7)::timestamp at time zone 'America/Monterrey','running',exists(select 1 from public.restaurant_ai_reports r where r.restaurant_id=p_restaurant and r.status='running'));
end $$;
revoke all on function public.restaurant_ai_report_state(uuid,date,date,uuid,uuid,integer) from public;
grant execute on function public.restaurant_ai_report_state(uuid,date,date,uuid,uuid,integer) to authenticated;

create function public.reserve_restaurant_ai_report(p_request uuid,p_restaurant uuid,p_start date,p_end date,p_version uuid default null,p_employee uuid default null,p_rating integer default null)returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare state jsonb; prior public.restaurant_ai_reports; snapshot jsonb;ids uuid[];
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
 state:=public.restaurant_ai_report_state(p_restaurant,p_start,p_end,p_version,p_employee,p_rating);
 select * into prior from public.restaurant_ai_reports where id=p_request;
 if found then
 if prior.restaurant_id is distinct from p_restaurant or prior.generated_by is distinct from auth.uid() or prior.range_start is distinct from p_start or prior.range_end is distinct from p_end or prior.version_id is distinct from p_version or prior.employee_id is distinct from p_employee or prior.rating is distinct from p_rating then raise exception 'request_scope_conflict';end if;
 if prior.status='completed' then return state||jsonb_build_object('outcome','already_saved');end if;
 if prior.status='running' then raise exception 'report_in_progress';end if;
 end if;
 if (state->>'new_count')::integer=0 then return state||jsonb_build_object('outcome','no_new_responses');end if;
 if (state->>'running')::boolean then raise exception 'report_in_progress';end if;
 if (state->>'remaining')::integer=0 then raise exception 'weekly_limit_reached';end if;
 if (state->>'matching_count')::integer>5000 then raise exception 'report_too_large';end if;
 snapshot:=private.restaurant_report_snapshot(p_restaurant,p_start,p_end,p_version,p_employee,p_rating);
 if octet_length(snapshot::text)>1200000 then raise exception 'report_too_large';end if;
 select coalesce(array_agg(value::uuid),'{}'::uuid[])into ids from jsonb_array_elements_text(snapshot->'source_ids');
 snapshot:=snapshot-'source_ids';
 insert into public.restaurant_ai_reports(id,restaurant_id,generated_by,range_start,range_end,version_id,employee_id,rating,status,week_start,snapshot,source_ids)
 values(p_request,p_restaurant,auth.uid(),p_start,p_end,p_version,p_employee,p_rating,'running',date_trunc('week',now() at time zone 'America/Monterrey')::date,snapshot,ids)
 on conflict(id)do update set status='running',created_at=now(),week_start=excluded.week_start,snapshot=excluded.snapshot,source_ids=excluded.source_ids;
 return jsonb_build_object('outcome','reserved','snapshot',snapshot,'previous_output',state->'report'->'output','request_id',p_request);
end $$;
revoke all on function public.reserve_restaurant_ai_report(uuid,uuid,date,date,uuid,uuid,integer) from public;
grant execute on function public.reserve_restaurant_ai_report(uuid,uuid,date,date,uuid,uuid,integer) to authenticated;

create function public.finish_restaurant_ai_report(p_request uuid,p_output jsonb default null,p_usage jsonb default null,p_failed boolean default false) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare report public.restaurant_ai_reports;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 select * into report from public.restaurant_ai_reports where id=p_request for update;
 if not found or report.generated_by<>auth.uid() then raise exception 'report_access_required' using errcode='42501';end if;
 if report.status='completed' then return true;end if;
 if report.status<>'running' then raise exception 'report_expired';end if;
 if not p_failed and (p_output is null or jsonb_typeof(p_output)<>'object' or octet_length(p_output::text)>150000) then raise exception 'invalid_output';end if;
 update public.restaurant_ai_reports set status=case when p_failed then 'failed' else 'completed' end,completed_at=now(),output=case when p_failed then null else p_output end,usage=p_usage where id=p_request;
 return true;
end $$;
revoke all on function public.finish_restaurant_ai_report(uuid,jsonb,jsonb,boolean) from public;
grant execute on function public.finish_restaurant_ai_report(uuid,jsonb,jsonb,boolean) to authenticated;
-- The old mock endpoint must not create new analyses outside the shared real-report allowance.
revoke execute on function public.portal_generate_question_insight_mock(uuid,uuid,uuid,text,text,uuid,integer) from authenticated;
commit;
