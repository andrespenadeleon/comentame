begin;
create function private.valid_contact_settings(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='object' and jsonb_typeof(value->'required')='boolean' and value->>'mode' in ('either','email','phone') and (select count(*) from jsonb_object_keys(value))=2,false);
$$;
alter table public.survey_drafts add column contact_settings jsonb not null default '{"required":false,"mode":"either"}'::jsonb check(private.valid_contact_settings(contact_settings));
alter table public.survey_versions add column contact_settings jsonb not null default '{"required":false,"mode":"either"}'::jsonb check(private.valid_contact_settings(contact_settings));
create function public.can_edit_survey(p_restaurant_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.restaurants r where r.id=p_restaurant_id and (r.owner_id=auth.uid() or public.is_portal_admin()));
$$;
revoke all on function public.can_edit_survey(uuid) from public;
grant execute on function public.can_edit_survey(uuid) to authenticated;
create function public.save_survey_draft(p_restaurant_id uuid,p_title text,p_questions jsonb,p_theme jsonb,p_step integer,p_contact jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; q jsonb; opt jsonb; canonical boolean;
begin
 select * into r from public.restaurants where id=p_restaurant_id and auth.uid() is not null and (owner_id=auth.uid() or public.is_portal_admin()) for update;
 if not found then raise exception 'restaurant_not_found'; end if;
 if not private.valid_contact_settings(p_contact) then raise exception 'invalid_contact_settings'; end if;
 if p_title is null or length(p_title)>150 or p_questions is null or p_step is null or p_step not between 1 and 3
 or not private.valid_survey_theme(p_theme,r.id) or p_theme is null then raise exception 'invalid_draft'; end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 1 and 21 or octet_length(p_questions::text)>131072 then raise exception 'invalid_draft'; end if;
 if p_questions->0 <> '{"id":"00000000-0000-4000-8000-000000000005","prompt":"¿Cómo estuvo tu experiencia?","type":"rating","required":true,"options":[]}'::jsonb
 or (select count(distinct x->>'id') from jsonb_array_elements(p_questions) x)<>jsonb_array_length(p_questions) then raise exception 'invalid_draft'; end if;
 for q in select * from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(q->'prompt') is distinct from 'string' or length(q->>'prompt')>250
  or jsonb_typeof(q->'id') is distinct from 'string' or (q->>'id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  or jsonb_typeof(q->'required') is distinct from 'boolean' or q->>'type' not in ('rating','text','single','multiple') or jsonb_typeof(q->'type') is distinct from 'string'
  or jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options')>10 then raise exception 'invalid_draft'; end if;
  if q->>'type'='rating' and q->>'id'<>'00000000-0000-4000-8000-000000000005' then raise exception 'invalid_draft'; end if;
  for opt in select * from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(opt) is distinct from 'string' or length(opt #>> '{}')>120 then raise exception 'invalid_draft'; end if;
  end loop;
  if q ? 'presentation' and (jsonb_typeof(q->'presentation') is distinct from 'string' or q->>'presentation' not in ('short','long','scale','yes_no')) then raise exception 'invalid_draft'; end if;
 end loop;
 canonical:=length(trim(p_title)) between 1 and 150 and private.valid_questions(p_questions);
 insert into public.survey_drafts(restaurant_id,title,questions,theme,editor_state,builder_step,updated_at)
 values(r.id,case when canonical then trim(p_title) else 'Tu opinión nos ayuda a mejorar' end,
 case when canonical then p_questions else jsonb_build_array(p_questions->0) end,p_theme,jsonb_build_object('title',p_title,'questions',p_questions),p_step,now())
 on conflict(restaurant_id) do update set title=case when canonical then trim(p_title) else survey_drafts.title end,
 questions=case when canonical then p_questions else survey_drafts.questions end,theme=p_theme,editor_state=excluded.editor_state,builder_step=p_step,updated_at=now();
 update public.survey_drafts set contact_settings=p_contact where restaurant_id=r.id;
end $$;
revoke all on function public.save_survey_draft(uuid,text,jsonb,jsonb,integer,jsonb) from public,anon;
grant execute on function public.save_survey_draft(uuid,text,jsonb,jsonb,integer,jsonb) to authenticated;

create function public.publish_survey(p_restaurant_id uuid,p_title text,p_questions jsonb,p_theme jsonb,p_contact jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; next_version integer; result uuid;
begin
 select * into r from public.restaurants where id=p_restaurant_id and auth.uid() is not null and (owner_id=auth.uid() or public.is_portal_admin()) for update;
 if not found then raise exception 'restaurant_not_found'; end if;
 if not private.valid_contact_settings(p_contact) then raise exception 'invalid_contact_settings'; end if;
 if r.google_maps_url is null then raise exception 'google_required'; end if;
 if p_title is null or p_questions is null or length(trim(p_title)) not between 1 and 150 or not private.valid_questions(p_questions)
 or p_theme is null or not private.valid_survey_theme(p_theme,r.id) then raise exception 'invalid_survey'; end if;
 select coalesce(max(version),0)+1 into next_version from public.survey_versions where restaurant_id=r.id;
 insert into public.survey_versions(restaurant_id,version,title,questions,theme,contact_settings) values(r.id,next_version,trim(p_title),p_questions,p_theme,p_contact) returning id into result;
 insert into public.survey_drafts(restaurant_id,title,questions,theme,editor_state,builder_step,updated_at)
 values(r.id,trim(p_title),p_questions,p_theme,jsonb_build_object('title',trim(p_title),'questions',p_questions),3,now())
 on conflict(restaurant_id) do update set title=excluded.title,questions=excluded.questions,theme=excluded.theme,editor_state=excluded.editor_state,builder_step=3,updated_at=now();
 update public.survey_drafts set contact_settings=p_contact where restaurant_id=r.id;
 update public.restaurants set active_survey_id=result where id=r.id;
 return jsonb_build_object('id',result,'version',next_version);
end $$;
revoke all on function public.publish_survey(uuid,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.publish_survey(uuid,text,jsonb,jsonb,jsonb) to authenticated;
create or replace function public.get_public_survey(p_restaurant_id uuid,p_employee_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'restaurant_id',r.id,'restaurant_name',r.name,'logo_path',r.logo_path,
  'social_links',r.social_links,'google_maps_url',r.google_maps_url,
  'employee_id',e.id,'employee_name',concat_ws(' ',nullif(trim(e.first_name),''),nullif(trim(e.last_name),'')),
  'survey_version_id',v.id,'title',v.title,'questions',v.questions,'theme',v.theme,'contact_settings',v.contact_settings
 )
 from public.restaurants r
 join public.employees e on e.restaurant_id=r.id and e.id=p_employee_id and e.deleted_at is null
 join public.survey_versions v on v.id=r.active_survey_id and v.restaurant_id=r.id
 where r.id=p_restaurant_id;
$$;
revoke all on function public.get_public_survey(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_public_survey(uuid,uuid) to anon,authenticated;

-- Enforce rules against the actual submitted version, including non-browser clients.
create function private.validate_response_contact() returns trigger language plpgsql security definer set search_path='' as $$
declare settings jsonb; contact text:=nullif(trim(new.guest_contact),''); is_email boolean; is_phone boolean;
begin
 select v.contact_settings into settings from public.survey_versions v where v.id=new.survey_version_id and v.restaurant_id=new.restaurant_id;
 if settings is null then raise exception 'survey_unavailable'; end if;
 if contact is null then if (settings->>'required')::boolean then raise exception 'contact_required'; end if;return new;end if;
 is_email:=contact ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
 is_phone:=contact ~ '^[+0-9() .-]+$' and length(regexp_replace(contact,'[^0-9]','','g')) between 10 and 15;
 if (settings->>'mode'='email' and not is_email) or (settings->>'mode'='phone' and not is_phone) or (settings->>'mode'='either' and not(is_email or is_phone)) then raise exception 'invalid_contact';end if;
 return new;
end $$;
create trigger survey_response_contact_rules before insert on public.survey_responses for each row execute function private.validate_response_contact();

create function public.portal_survey_editor(p_restaurant_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501';end if;
 if not exists(select 1 from public.restaurants where id=p_restaurant_id) then raise exception 'restaurant_not_found';end if;
 return jsonb_build_object('draft',(select to_jsonb(d) from public.survey_drafts d where d.restaurant_id=p_restaurant_id),
 'published',(select to_jsonb(v) from public.restaurants r join public.survey_versions v on v.id=r.active_survey_id and v.restaurant_id=r.id where r.id=p_restaurant_id));
end $$;
revoke all on function public.portal_survey_editor(uuid) from public;
grant execute on function public.portal_survey_editor(uuid) to authenticated;
create policy survey_background_portal_insert on storage.objects for insert to authenticated with check(bucket_id='survey-backgrounds' and public.is_portal_admin() and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1]));
create policy survey_background_portal_read on storage.objects for select to authenticated using(bucket_id='survey-backgrounds' and public.is_portal_admin());
create or replace function public.portal_survey_catalog(p_restaurant_id uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_portal_admin() then raise exception 'portal_admin_required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_page'; end if;
 with versions as materialized (
 select v.*,r.name as restaurant_name,(r.active_survey_id=v.id) as active,r.logo_path,r.social_links,r.google_maps_url from public.survey_versions v join public.restaurants r on r.id=v.restaurant_id where p_restaurant_id is null or r.id=p_restaurant_id
 ), current_page as (select * from versions order by published_at desc,id limit 20 offset ((p_page-1)::bigint*20))
 select jsonb_build_object('published',coalesce((select jsonb_agg(to_jsonb(v) order by v.published_at desc,v.id) from current_page v),'[]'::jsonb),'total',(select count(*) from versions),
 'drafts',coalesce((select jsonb_agg(jsonb_build_object('restaurant_id',r.id,'restaurant_name',r.name,'title',coalesce(d.editor_state->>'title',d.title),'questions',coalesce(d.editor_state->'questions',d.questions),'theme',d.theme,'contact_settings',d.contact_settings,'logo_path',r.logo_path,'social_links',r.social_links,'google_maps_url',r.google_maps_url,'updated_at',d.updated_at) order by d.updated_at desc) from public.survey_drafts d join public.restaurants r on r.id=d.restaurant_id where p_restaurant_id is null or r.id=p_restaurant_id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.portal_survey_catalog(uuid,integer) from public,anon;
grant execute on function public.portal_survey_catalog(uuid,integer) to authenticated;


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
 union all select 'guest_contact',(case sv.contact_settings->>'mode' when 'email' then 'Correo electrónico' when 'phone' then 'Teléfono' else 'Correo o teléfono' end)||(case when (sv.contact_settings->>'required')::boolean then ' (obligatorio)' else ' (opcional)' end)
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
 union all select 'guest_contact',(case sv.contact_settings->>'mode' when 'email' then 'Correo electrónico' when 'phone' then 'Teléfono' else 'Correo o teléfono' end)||(case when (sv.contact_settings->>'required')::boolean then ' (obligatorio)' else ' (opcional)' end)
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
