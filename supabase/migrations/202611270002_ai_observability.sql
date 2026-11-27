begin;
create table public.ai_operations(
 id uuid primary key,request_id uuid,restaurant_id uuid references public.restaurants(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null,environment text not null check(environment in ('development','preview','production','unknown')),
 model text not null,kind text not null default 'restaurant_report',status text not null default 'running' check(status in ('running','succeeded','failed','blocked','reused','abandoned')),
 stage text not null default 'received',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),finished_at timestamptz,
 duration_ms integer,provider_started boolean not null default false,input_tokens bigint,output_tokens bigint,cached_tokens bigint,reasoning_tokens bigint,estimated_usd numeric(16,8),
 provider_status integer,provider_request_id text,provider_response_id text,error_code text,message text,metadata jsonb not null default '{}'
);
create index ai_operations_date on public.ai_operations(created_at desc,id);
create index ai_operations_restaurant_date on public.ai_operations(restaurant_id,created_at desc);
create index ai_operations_request on public.ai_operations(request_id);
create table public.ai_operation_events(id bigint generated always as identity primary key,operation_id uuid not null references public.ai_operations(id) on delete cascade,created_at timestamptz not null default now(),stage text not null,severity text not null check(severity in ('info','warning','error')),code text,message text,metadata jsonb not null default '{}');
create index ai_operation_events_operation on public.ai_operation_events(operation_id,id);
create table public.ai_monitor_settings(id boolean primary key default true check(id),monthly_alert_usd numeric(12,2) check(monthly_alert_usd is null or monthly_alert_usd>0),updated_at timestamptz not null default now(),updated_by uuid references auth.users(id));
insert into public.ai_monitor_settings(id)values(true);
alter table public.ai_operations enable row level security;alter table public.ai_operation_events enable row level security;alter table public.ai_monitor_settings enable row level security;
revoke all on public.ai_operations,public.ai_operation_events,public.ai_monitor_settings from public,anon,authenticated;

create function public.log_ai_operation(p_id uuid,p_start jsonb default null,p_event jsonb default '{}',p_update jsonb default '{}')returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare original public.ai_operations;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 if p_id is null or octet_length(coalesce(p_event,'{}')::text)>16000 or octet_length(coalesce(p_update,'{}')::text)>16000 then raise exception 'invalid_event';end if;
 if p_start is not null then
 insert into public.ai_operations(id,request_id,restaurant_id,actor_id,environment,model,metadata)
 values(p_id,(p_start->>'request_id')::uuid,(p_start->>'restaurant_id')::uuid,auth.uid(),p_start->>'environment',left(p_start->>'model',100),coalesce(p_start->'metadata','{}'))on conflict(id)do nothing;
 end if;
 select * into original from public.ai_operations where id=p_id for update;
 if not found or original.actor_id is distinct from auth.uid() then raise exception 'operation_access_required' using errcode='42501';end if;
 update public.ai_operations set updated_at=clock_timestamp(),
 stage=coalesce(p_event->>'stage',stage),status=coalesce(p_update->>'status',status),
 finished_at=case when p_update->>'status' in ('succeeded','failed','blocked','reused','abandoned')then clock_timestamp()else finished_at end,
 duration_ms=coalesce((p_update->>'duration_ms')::integer,duration_ms),
 provider_started=provider_started or coalesce((p_update->>'provider_started')::boolean,false),
 input_tokens=coalesce((p_update->>'input_tokens')::bigint,input_tokens),output_tokens=coalesce((p_update->>'output_tokens')::bigint,output_tokens),
 cached_tokens=coalesce((p_update->>'cached_tokens')::bigint,cached_tokens),reasoning_tokens=coalesce((p_update->>'reasoning_tokens')::bigint,reasoning_tokens),estimated_usd=coalesce((p_update->>'estimated_usd')::numeric,estimated_usd),
 provider_status=coalesce((p_update->>'provider_status')::integer,provider_status),provider_request_id=coalesce(left(p_update->>'provider_request_id',150),provider_request_id),provider_response_id=coalesce(left(p_update->>'provider_response_id',150),provider_response_id),
 error_code=coalesce(left(p_update->>'error_code',100),error_code),message=coalesce(left(p_update->>'message',1000),message),metadata=metadata||coalesce(p_update->'metadata','{}')
 where id=p_id;
 insert into public.ai_operation_events(operation_id,stage,severity,code,message,metadata)values(p_id,left(coalesce(p_event->>'stage','unknown'),80),coalesce(p_event->>'severity','info'),left(p_event->>'code',100),left(p_event->>'message',1000),coalesce(p_event->'metadata','{}'));
 return true;
end $$;
revoke all on function public.log_ai_operation(uuid,jsonb,jsonb,jsonb) from public;grant execute on function public.log_ai_operation(uuid,jsonb,jsonb,jsonb) to authenticated;

create function public.set_ai_monitor_alert(p_monthly_usd numeric)returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 if p_monthly_usd is not null and(p_monthly_usd<=0 or p_monthly_usd>1000000)then raise exception 'invalid_threshold';end if;
 update public.ai_monitor_settings set monthly_alert_usd=p_monthly_usd,updated_at=now(),updated_by=auth.uid()where id;
 return true;
end $$;
revoke all on function public.set_ai_monitor_alert(numeric) from public;grant execute on function public.set_ai_monitor_alert(numeric) to authenticated;

create function public.portal_ai_monitor(p_restaurant uuid default null,p_status text default 'all',p_environment text default 'all',p_from timestamptz default null,p_through timestamptz default null,p_page integer default 1,p_detail uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; week_date date:=date_trunc('week',now() at time zone 'America/Monterrey')::date;
begin
 if auth.uid() is null or not public.is_portal_admin()then raise exception 'portal_admin_required' using errcode='42501';end if;
 if p_status is null or p_status not in ('all','running','succeeded','failed','blocked','reused','abandoned')or p_environment is null or p_environment not in ('all','development','preview','production','unknown')or p_page is null or p_page not between 1 and 100000 or(p_from is not null and p_through is not null and p_through<=p_from)then raise exception 'invalid_filters';end if;
 with scoped as materialized(
 select o.*,r.name as restaurant_name,case when o.status='running'and o.updated_at<now()-interval '12 minutes'then 'abandoned'else o.status end as effective_status
 from public.ai_operations o left join public.restaurants r on r.id=o.restaurant_id
 where(p_restaurant is null or o.restaurant_id=p_restaurant)and(p_environment='all'or o.environment=p_environment)and(p_from is null or o.created_at>=p_from)and(p_through is null or o.created_at<p_through)
 ),filtered as materialized(select * from scoped where p_status='all'or effective_status=p_status),
 page_rows as(select * from filtered order by created_at desc,id limit 25 offset(p_page-1)*25),
 quotas as(
 select r.id,r.name,(select count(*)from public.restaurant_ai_reports a where a.restaurant_id=r.id and a.week_start=week_date and(a.status='completed'or(a.status='running'and a.created_at>=now()-interval '10 minutes')))+(select count(*)from public.portal_question_insights i where i.restaurant_id=r.id and i.week_start=week_date)as used
 from public.restaurants r where(p_restaurant is null or r.id=p_restaurant)
 )select jsonb_build_object(
 'summary',(select jsonb_build_object('attempts',count(*),'provider_calls',count(*)filter(where provider_started),'succeeded',count(*)filter(where effective_status='succeeded'),'failed',count(*)filter(where effective_status in ('failed','abandoned')),'blocked',count(*)filter(where effective_status='blocked'),'reused',count(*)filter(where effective_status='reused'),'running',count(*)filter(where effective_status='running'),'input_tokens',coalesce(sum(input_tokens),0),'output_tokens',coalesce(sum(output_tokens),0),'estimated_usd',coalesce(sum(estimated_usd),0),'unknown_usage',count(*)filter(where (provider_started and(input_tokens is null or output_tokens is null))or(metadata->>'billing_unknown')='true'),'logging_gaps',count(*)filter(where(metadata->>'audit_degraded')='true'),'average_ms',round(avg(duration_ms)filter(where duration_ms is not null)))from filtered),
 'total',(select count(*)from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)order by p.created_at desc,p.id)from page_rows p),'[]'),
 'detail',(select to_jsonb(s)from scoped s where s.id=p_detail),'events',coalesce((select jsonb_agg(to_jsonb(e)order by e.id)from public.ai_operation_events e join scoped s on s.id=e.operation_id where s.id=p_detail),'[]'),
 'models',coalesce((select jsonb_agg(to_jsonb(m))from(select model,count(*)as attempts,coalesce(sum(estimated_usd),0)as estimated_usd from filtered group by model)m),'[]'),
 'quotas',coalesce((select jsonb_agg(to_jsonb(q)order by q.used desc,q.name)from quotas q where q.used>0),'[]'),
 'resets_at',(week_date+7)::timestamp at time zone 'America/Monterrey',
 'monthly_alert_usd',(select monthly_alert_usd from public.ai_monitor_settings where id),
 'month_estimated_usd',(select coalesce(sum(o.estimated_usd),0)from public.ai_operations o where o.created_at>=(date_trunc('month',now()at time zone 'America/Monterrey')at time zone 'America/Monterrey')),
 'daily',coalesce((select jsonb_agg(to_jsonb(d)order by d.day)from(select(created_at at time zone 'America/Monterrey')::date as day,count(*)as attempts,coalesce(sum(estimated_usd),0)as estimated_usd from filtered group by 1)d),'[]')
 )into result;return result;
end $$;
revoke all on function public.portal_ai_monitor(uuid,text,text,timestamptz,timestamptz,integer,uuid)from public;grant execute on function public.portal_ai_monitor(uuid,text,text,timestamptz,timestamptz,integer,uuid)to authenticated;

-- Preserve existing reports without fabricating diagnostics that were never captured.
insert into public.ai_operations(id,request_id,restaurant_id,actor_id,environment,model,status,stage,created_at,updated_at,finished_at,provider_started,input_tokens,output_tokens,estimated_usd,error_code,message,metadata)
select r.id,r.id,r.restaurant_id,r.generated_by,'unknown',r.model,case r.status when 'completed'then 'succeeded'when 'failed'then 'failed'else 'abandoned'end,'historical_import',r.created_at,coalesce(r.completed_at,r.created_at),r.completed_at,r.status='completed',
 (r.usage->>'input_tokens')::bigint,(r.usage->>'output_tokens')::bigint,(r.usage->>'estimated_usd')::numeric,
 case when r.status<>'completed'then 'historical_unknown'end,'Registro anterior al monitoreo: sin diagnóstico original ni ambiente confirmado.',jsonb_build_object('historical',true,'environment_unconfirmed',true,'billing_unknown',r.status<>'completed')
from public.restaurant_ai_reports r;

create function public.portal_ai_operation_detail(p_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid()is null or not public.is_portal_admin()then raise exception 'portal_admin_required'using errcode='42501';end if;
 select jsonb_build_object('detail',to_jsonb(o)||jsonb_build_object('restaurant_name',r.name,'effective_status',case when o.status='running'and o.updated_at<now()-interval '12 minutes'then 'abandoned'else o.status end),'events',coalesce((select jsonb_agg(to_jsonb(e)order by e.id)from public.ai_operation_events e where e.operation_id=o.id),'[]'))into result from public.ai_operations o left join public.restaurants r on r.id=o.restaurant_id where o.id=p_id;
 return result;
end $$;
revoke all on function public.portal_ai_operation_detail(uuid)from public;grant execute on function public.portal_ai_operation_detail(uuid)to authenticated;

commit;
