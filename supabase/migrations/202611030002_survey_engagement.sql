-- Apply after 202611030001. Existing visits are excluded from the new funnel.
begin;
alter table public.survey_visits
 add column engagement_tracked boolean not null default false,
 add column started_at timestamptz,
 add column completed_at timestamptz,
 add column response_id uuid unique references public.survey_responses(id),
 add column active_ms integer not null default 0 check(active_ms between 0 and 86400000),
 add column event_sequence integer not null default 0,
 add column touched_fields text[] not null default '{}',
 add column answered_fields text[] not null default '{}',
 add column last_seen_at timestamptz;

create function public.update_survey_engagement(p_visit_id uuid,p_restaurant_id uuid,p_employee_id uuid,p_version_id uuid,p_active_ms integer,p_sequence integer,p_touched text[],p_answered text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare visit public.survey_visits; allowed text[]; merged text[];
begin
 if p_active_ms is null or p_active_ms not between 0 and 86400000 or p_sequence is null or p_sequence<0 or p_touched is null or p_answered is null or cardinality(p_touched)>24 or cardinality(p_answered)>24 then raise exception 'invalid_engagement'; end if;
 perform public.record_survey_visit(p_visit_id,p_restaurant_id,p_employee_id,p_version_id);
 select * into visit from public.survey_visits where id=p_visit_id and restaurant_id=p_restaurant_id and employee_id=p_employee_id and survey_version_id=p_version_id for update;
 if not found then return false; end if;
 if visit.completed_at is not null then return true; end if;
 select array['rating','guest_name','guest_contact']||coalesce(array_agg('q:'||(q->>'id')) filter(where q->>'type'<>'rating'),'{}'::text[]) into allowed
 from public.survey_versions s cross join lateral jsonb_array_elements(s.questions) q where s.id=visit.survey_version_id;
 if not (p_touched<@allowed) or not (p_answered<@p_touched) or array_position(p_touched,null) is not null or array_position(p_answered,null) is not null then raise exception 'invalid_fields'; end if;
 select coalesce(array_agg(distinct field),'{}'::text[]) into merged from unnest(visit.touched_fields||p_touched) field;
 update public.survey_visits set engagement_tracked=true,
 started_at=case when cardinality(merged)>0 then coalesce(started_at,now()) else started_at end,
 active_ms=greatest(active_ms,least(p_active_ms,least(86400000,greatest(0,floor(extract(epoch from (now()-visited_at))*1000)+15000))::integer)),
 event_sequence=greatest(event_sequence,p_sequence),touched_fields=merged,
 answered_fields=case when p_sequence>=event_sequence then p_answered else answered_fields end,last_seen_at=now()
 where id=visit.id;
 return true;
end $$;
revoke all on function public.update_survey_engagement(uuid,uuid,uuid,uuid,integer,integer,text[],text[]) from public;
grant execute on function public.update_survey_engagement(uuid,uuid,uuid,uuid,integer,integer,text[],text[]) to anon,authenticated;

-- Submit and mark completion in the same transaction; only a saved response can complete a visit.
create function public.submit_survey_tracked(p_submission_id uuid,p_restaurant_id uuid,p_employee_id uuid,p_version_id uuid,p_name text,p_contact text,p_rating integer,p_answers jsonb,p_tracking jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; visit_id uuid; fields text[];
begin
 result:=public.submit_survey(p_submission_id,p_restaurant_id,p_employee_id,p_version_id,p_name,p_contact,p_rating,p_answers);
 visit_id:=(p_tracking->>'visit_id')::uuid;
 fields:=array['rating','guest_name'];
 if nullif(trim(p_contact),'') is not null then fields:=fields||array['guest_contact']; end if;
 select fields||coalesce(array_agg('q:'||a.key),'{}'::text[]) into fields from jsonb_each(p_answers) a
 where (jsonb_typeof(a.value)='string' and length(trim(a.value#>>'{}'))>0) or (jsonb_typeof(a.value)='array' and a.value<>'[]'::jsonb);
 perform public.update_survey_engagement(visit_id,p_restaurant_id,p_employee_id,p_version_id,(p_tracking->>'active_ms')::integer,(p_tracking->>'sequence')::integer,
 array(select distinct unnest(array(select jsonb_array_elements_text(p_tracking->'touched'))||fields)),fields);
 update public.survey_visits set started_at=coalesce(started_at,now()),completed_at=now(),response_id=result,engagement_tracked=true,answered_fields=fields,last_seen_at=now()
 where id=visit_id and restaurant_id=p_restaurant_id and employee_id=p_employee_id and survey_version_id=p_version_id and completed_at is null;
 return result;
end $$;
revoke all on function public.submit_survey_tracked(uuid,uuid,uuid,uuid,text,text,integer,jsonb,jsonb) from public;
grant execute on function public.submit_survey_tracked(uuid,uuid,uuid,uuid,text,text,integer,jsonb,jsonb) to anon,authenticated;

create function public.survey_engagement_metrics(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 with sessions as materialized (
 select v.* from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where r.owner_id=(select auth.uid()) and v.engagement_tracked
 and (p_restaurant_id is null or v.restaurant_id=p_restaurant_id) and (p_employee_id is null or v.employee_id=p_employee_id) and (p_from is null or v.visited_at>=p_from)
 ), employee_stats as (
 select employee_id,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
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
 select jsonb_build_object('visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),
 'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employee_stats e),'[]'::jsonb),
 'fields',coalesce((select jsonb_agg(to_jsonb(f) order by f.answered desc,f.label,f.version_id) from field_stats f),'[]'::jsonb)) from sessions;
$$;
revoke all on function public.survey_engagement_metrics(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.survey_engagement_metrics(uuid,uuid,timestamptz) to authenticated;

-- Explicit portal authorization; restaurant owners cannot use the cross-account endpoint.
create function public.portal_engagement_metrics(p_query text default '',p_restaurant_id uuid default null,p_status text default 'active') returns jsonb
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
 select employee_id,count(*) as visits,count(started_at) as starts,count(completed_at) as completions,
 count(*) filter(where started_at is not null and completed_at is null) as unfinished,round(avg(active_ms)/1000.0,1) as average_seconds
 from sessions group by employee_id
 )
 select jsonb_build_object('visits',count(*),'starts',count(started_at),'completions',count(completed_at),
 'unfinished',count(*) filter(where started_at is not null and completed_at is null),'average_seconds',round(avg(active_ms)/1000.0,1),
 'completed_seconds',round(avg(active_ms) filter(where completed_at is not null)/1000.0,1),
 'incomplete_seconds',round(avg(active_ms) filter(where completed_at is null)/1000.0,1),
 'employees',coalesce((select jsonb_agg(to_jsonb(e)) from employees e),'[]'::jsonb)) into result from sessions;
 return result;
end $$;
revoke all on function public.portal_engagement_metrics(text,uuid,text) from public,anon;
grant execute on function public.portal_engagement_metrics(text,uuid,text) to authenticated;
commit;
