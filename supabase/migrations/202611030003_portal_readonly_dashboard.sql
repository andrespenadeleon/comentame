begin;
create function public.portal_restaurants() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'address',r.address,'phone',r.phone,'google_maps_url',r.google_maps_url,'logo_path',r.logo_path,'social_links',r.social_links,'active_survey_id',r.active_survey_id) order by r.name,r.id) from public.restaurants r),'[]'::jsonb);
end $$;
revoke all on function public.portal_restaurants() from public,anon;
grant execute on function public.portal_restaurants() to authenticated;

create function public.portal_opinions(p_restaurant_id uuid default null,p_period text default '30',p_rating integer default null,p_employee_id uuid default null,p_page integer default 1,p_detail uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; since timestamptz; detail_row public.survey_responses; original jsonb; staff jsonb; summary jsonb; rows jsonb; total bigint; chosen_employee uuid;
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if p_period is null or p_period not in ('7','30','90','all') or p_page is null or p_page not between 1 and 100000 or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'invalid_filters'; end if;
 if p_period<>'all' then since:=now()-make_interval(days=>p_period::integer); end if;
 chosen_employee:=p_employee_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'restaurant_id',e.restaurant_id,'first_name',e.first_name,'last_name',e.last_name,'deleted_at',e.deleted_at) order by e.first_name,e.id),'[]'::jsonb) into staff from public.employees e where p_restaurant_id is null or e.restaurant_id=p_restaurant_id;
 with filtered as materialized (
 select s.* from public.survey_responses s where (p_restaurant_id is null or s.restaurant_id=p_restaurant_id) and (chosen_employee is null or s.employee_id=chosen_employee) and (since is null or s.submitted_at>=since) and (p_rating is null or s.rating=p_rating)
 ), current_page as (select * from filtered order by submitted_at desc,id limit 20 offset ((p_page-1)::bigint*20))
 select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(s) order by s.submitted_at desc,s.id) from current_page s),'[]'::jsonb),
 (select jsonb_build_object('total',count(*),'average',round(avg(s.rating),2),'distribution',jsonb_build_object('1',count(*) filter(where rating=1),'2',count(*) filter(where rating=2),'3',count(*) filter(where rating=3),'4',count(*) filter(where rating=4),'5',count(*) filter(where rating=5))) from filtered s) into total,rows,summary;
 if p_detail is not null then
 select * into detail_row from public.survey_responses s where s.id=p_detail and (p_restaurant_id is null or s.restaurant_id=p_restaurant_id);
 if found then select jsonb_build_object('title',v.title,'version',v.version,'questions',v.questions) into original from public.survey_versions v where v.id=detail_row.survey_version_id; end if;
 end if;
 return jsonb_build_object('opinions',rows,'count',total,'summary',summary,'staff',staff,'restaurant',p_restaurant_id,'period',p_period,'rating',p_rating,'employee',chosen_employee,'page',p_page,'detail',case when detail_row.id is null then null else to_jsonb(detail_row) end,'version',original);
end $$;
revoke all on function public.portal_opinions(uuid,text,integer,uuid,integer,uuid) from public,anon;
grant execute on function public.portal_opinions(uuid,text,integer,uuid,integer,uuid) to authenticated;

create function public.portal_survey_catalog(p_restaurant_id uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_page'; end if;
 with versions as materialized (
 select v.*,r.name as restaurant_name,(r.active_survey_id=v.id) as active,r.logo_path,r.social_links,r.google_maps_url from public.survey_versions v join public.restaurants r on r.id=v.restaurant_id where p_restaurant_id is null or r.id=p_restaurant_id
 ), current_page as (select * from versions order by published_at desc,id limit 20 offset ((p_page-1)::bigint*20))
 select jsonb_build_object('published',coalesce((select jsonb_agg(to_jsonb(v) order by v.published_at desc,v.id) from current_page v),'[]'::jsonb),'total',(select count(*) from versions),
 'drafts',coalesce((select jsonb_agg(jsonb_build_object('restaurant_id',r.id,'restaurant_name',r.name,'title',coalesce(d.editor_state->>'title',d.title),'questions',coalesce(d.editor_state->'questions',d.questions),'theme',d.theme,'logo_path',r.logo_path,'social_links',r.social_links,'google_maps_url',r.google_maps_url,'updated_at',d.updated_at) order by d.updated_at desc) from public.survey_drafts d join public.restaurants r on r.id=d.restaurant_id where p_restaurant_id is null or r.id=p_restaurant_id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.portal_survey_catalog(uuid,integer) from public,anon;
grant execute on function public.portal_survey_catalog(uuid,integer) to authenticated;

create function public.portal_visit_metrics(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null,p_rating integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 return (
 with staff as materialized (
 select e.id,e.restaurant_id,e.first_name,e.last_name,e.deleted_at,r.name as restaurant_name
 from public.employees e join public.restaurants r on r.id=e.restaurant_id
 where (p_restaurant_id is null or r.id=p_restaurant_id) and (p_employee_id is null or e.id=p_employee_id)
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
 from staff e left join visits v on v.employee_id=e.id left join responses s on s.employee_id=e.id),'[]'::jsonb))
 );
end $$;
revoke all on function public.portal_visit_metrics(uuid,uuid,timestamptz,integer) from public,anon;
grant execute on function public.portal_visit_metrics(uuid,uuid,timestamptz,integer) to authenticated;

create function public.portal_survey_engagement(p_restaurant_id uuid default null,p_employee_id uuid default null,p_from timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 return (
 with sessions as materialized (
 select v.* from public.survey_visits v join public.restaurants r on r.id=v.restaurant_id
 where v.engagement_tracked
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
 'fields',coalesce((select jsonb_agg(to_jsonb(f) order by f.answered desc,f.label,f.version_id) from field_stats f),'[]'::jsonb)) from sessions
 );
end $$;
revoke all on function public.portal_survey_engagement(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.portal_survey_engagement(uuid,uuid,timestamptz) to authenticated;
commit;
