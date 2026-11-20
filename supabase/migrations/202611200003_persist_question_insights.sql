-- Persisted mock analyses. All reads/writes require portal-admin authorization.
begin;
create table public.portal_question_insights (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
 field_key text not null,
 period text not null check(period in ('7','30','90','all')),
 employee_id uuid,
 rating integer check(rating between 1 and 5),
 generated_by uuid references auth.users(id) on delete set null,
 generated_at timestamptz not null default now(),
 week_start date not null,
 window_from timestamptz,
 window_through timestamptz not null,
 previous_analysis_id uuid references public.portal_question_insights(id) on delete set null,
 source_count integer not null check(source_count>=0),
 new_count integer not null check(new_count>=0),
 output jsonb not null
);
create index question_insights_scope on public.portal_question_insights(restaurant_id,survey_version_id,field_key,period,generated_at desc);
create index question_insights_week on public.portal_question_insights(restaurant_id,week_start);
create table public.portal_question_insight_sources (
 analysis_id uuid not null references public.portal_question_insights(id) on delete cascade,
 response_id uuid not null references public.survey_responses(id) on delete cascade,
 primary key(analysis_id,response_id)
);
alter table public.portal_question_insights enable row level security;
alter table public.portal_question_insight_sources enable row level security;
revoke all on public.portal_question_insights,public.portal_question_insight_sources from public,anon,authenticated;

create function public.portal_question_insight_state(p_restaurant_id uuid,p_version_id uuid,p_field text,p_period text default '30',p_employee_id uuid default null,p_rating integer default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare latest public.portal_question_insights; definition jsonb; used integer; current_count integer; fresh_count integer;
 as_of timestamptz:=clock_timestamp();
 week_date date:=date_trunc('week',as_of at time zone 'America/Monterrey')::date;
 since timestamptz;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if p_period is null or p_period not in ('7','30','90','all') or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'invalid_filters'; end if;
 select q into definition from public.survey_versions v cross join lateral jsonb_array_elements(v.questions) q
 where v.id=p_version_id and v.restaurant_id=p_restaurant_id and 'q:'||(q->>'id')=p_field and q->>'type'='text';
 if definition is null then raise exception 'invalid_text_question'; end if;
 if p_employee_id is not null and not exists(select 1 from public.employees e where e.id=p_employee_id and e.restaurant_id=p_restaurant_id) then raise exception 'invalid_employee'; end if;
 if p_period<>'all' then since:=as_of-make_interval(days=>p_period::integer); end if;
 select i.* into latest from public.portal_question_insights i where i.restaurant_id=p_restaurant_id and i.survey_version_id=p_version_id and i.field_key=p_field and i.period=p_period
 and i.employee_id is not distinct from p_employee_id and i.rating is not distinct from p_rating order by i.generated_at desc,i.id desc limit 1;
 select count(*) into used from public.portal_question_insights i where i.restaurant_id=p_restaurant_id and i.week_start=week_date;
 select count(*),count(*) filter(where not exists(select 1 from public.portal_question_insight_sources x where x.analysis_id=latest.id and x.response_id=s.id)) into current_count,fresh_count
 from public.survey_responses s where s.restaurant_id=p_restaurant_id and s.survey_version_id=p_version_id
 and (p_employee_id is null or s.employee_id=p_employee_id) and (p_rating is null or s.rating=p_rating)
 and (since is null or s.submitted_at>=since) and s.submitted_at<=as_of
 and jsonb_typeof(s.answers->substring(p_field from 3))='string' and nullif(trim(s.answers->>substring(p_field from 3)),'') is not null;
 return jsonb_build_object('analysis',case when latest.id is null then null else to_jsonb(latest)-'request_id'-'generated_by' end,
 'as_of',as_of,'week_start',week_date,'matching_count',current_count,'new_count',fresh_count,'used',used,'limit',2,'remaining',greatest(0,2-used),'resets_at',((week_date+7)::timestamp at time zone 'America/Monterrey'));
end $$;
revoke all on function public.portal_question_insight_state(uuid,uuid,text,text,uuid,integer) from public;
grant execute on function public.portal_question_insight_state(uuid,uuid,text,text,uuid,integer) to authenticated;

create function public.portal_generate_question_insight_mock(p_request_id uuid,p_restaurant_id uuid,p_version_id uuid,p_field text,p_period text default '30',p_employee_id uuid default null,p_rating integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare state jsonb; prior_id uuid; prior_summary text; prior_count integer:=0; new_inputs jsonb; generation_input jsonb; fresh_count integer; new_analysis_id uuid:=gen_random_uuid(); prior_request public.portal_question_insights;
 since timestamptz; run_at timestamptz; result jsonb;
 week_date date;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'invalid_request'; end if;
 -- One transaction per restaurant: different questions/admins share the same allowance.
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text,0));
 state:=public.portal_question_insight_state(p_restaurant_id,p_version_id,p_field,p_period,p_employee_id,p_rating);
 run_at:=(state->>'as_of')::timestamptz;
 week_date:=(state->>'week_start')::date;
 select * into prior_request from public.portal_question_insights i where i.request_id=p_request_id;
 if found then
 if prior_request.restaurant_id<>p_restaurant_id or prior_request.survey_version_id<>p_version_id or prior_request.field_key<>p_field or prior_request.period<>p_period
 or prior_request.employee_id is distinct from p_employee_id or prior_request.rating is distinct from p_rating or prior_request.generated_by is distinct from auth.uid()
 then raise exception 'request_scope_conflict'; end if;
 return state||jsonb_build_object('outcome','already_saved');
 end if;
 prior_id:=nullif(state->'analysis'->>'id','')::uuid;
 prior_summary:=state->'analysis'->'output'->>'summary';
 if p_period<>'all' then since:=run_at-make_interval(days=>p_period::integer); end if;
 select coalesce(jsonb_agg(jsonb_build_object('response_id',s.id,'text',s.answers->>substring(p_field from 3)) order by s.submitted_at,s.id),'[]'::jsonb) into new_inputs
 from public.survey_responses s where s.restaurant_id=p_restaurant_id and s.survey_version_id=p_version_id
 and (p_employee_id is null or s.employee_id=p_employee_id) and (p_rating is null or s.rating=p_rating)
 and (since is null or s.submitted_at>=since) and s.submitted_at<=run_at
 and jsonb_typeof(s.answers->substring(p_field from 3))='string' and nullif(trim(s.answers->>substring(p_field from 3)),'') is not null
 and not exists(select 1 from public.portal_question_insight_sources x where x.analysis_id=prior_id and x.response_id=s.id);
 fresh_count:=jsonb_array_length(new_inputs);
 if fresh_count=0 then return state||jsonb_build_object('outcome','no_new_responses'); end if;
 if (state->>'remaining')::integer<=0 then raise exception 'weekly_limit_reached'; end if;
 select count(*) into prior_count from public.portal_question_insight_sources x where x.analysis_id=prior_id;
 -- Real incremental inputs are prepared here; the generator is deliberately mocked.
 -- No raw response text is sent to a provider or copied into the persisted output.
 generation_input:=jsonb_build_object('previous_analysis',state->'analysis'->'output','new_responses',new_inputs);
 result:=jsonb_build_object('mode','mock','summary',case when prior_id is null then
 'Resumen ficticio: este ejemplo ilustra una experiencia generalmente positiva y oportunidades relacionadas con los tiempos de atención.' else
 'Actualización ficticia: este ejemplo conserva el análisis anterior como referencia e incorpora nuevas respuestas al contexto simulado.' end,
 'reference_summary',prior_summary,
 'insights',jsonb_build_array('Ejemplo de fortaleza: trato amable del equipo.','Ejemplo de oportunidad: esperas en horas concurridas.','Ejemplo de patrón para revisar: consistencia entre turnos.'),
 'actions',jsonb_build_array('Revisar la cobertura durante las horas de mayor demanda.','Definir un estándar de bienvenida y seguimiento a mesas.','Comparar comentarios después de aplicar ajustes.'),
 'input_new_count',jsonb_array_length(generation_input->'new_responses'),'input_has_previous',prior_id is not null);
 insert into public.portal_question_insights(id,request_id,restaurant_id,survey_version_id,field_key,period,employee_id,rating,generated_by,generated_at,week_start,window_from,window_through,previous_analysis_id,source_count,new_count,output)
 values(new_analysis_id,p_request_id,p_restaurant_id,p_version_id,p_field,p_period,p_employee_id,p_rating,auth.uid(),run_at,week_date,since,run_at,prior_id,prior_count+fresh_count,fresh_count,result);
 insert into public.portal_question_insight_sources(analysis_id,response_id)
 select new_analysis_id,x.response_id from public.portal_question_insight_sources x where x.analysis_id=prior_id
 union select new_analysis_id,(item->>'response_id')::uuid from jsonb_array_elements(new_inputs) item;
 return public.portal_question_insight_state(p_restaurant_id,p_version_id,p_field,p_period,p_employee_id,p_rating)||jsonb_build_object('outcome','saved');
end $$;
revoke all on function public.portal_generate_question_insight_mock(uuid,uuid,uuid,text,text,uuid,integer) from public;
grant execute on function public.portal_generate_question_insight_mock(uuid,uuid,uuid,text,text,uuid,integer) to authenticated;
commit;
