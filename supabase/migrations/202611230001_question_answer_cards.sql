-- Group submitted answers by restaurant + stable question ID, across survey versions.
begin;
create function private.analytics_question_catalog(p_restaurant_id uuid,p_version_id uuid)
returns table(restaurant_id uuid,restaurant_name text,version_id uuid,version integer,published_at timestamptz,key text,label text,question_type text,presentation text,options jsonb,question_position integer)
language sql stable security definer set search_path='' as $$
 select r.id,r.name,v.id,v.version,v.published_at,f.key,f.label,f.kind,f.presentation,f.options,f.question_position
 from public.survey_versions v join public.restaurants r on r.id=v.restaurant_id
 cross join lateral (
 select 'rating'::text as key,'Calificación de estrellas'::text as label,'rating'::text as kind,'scale'::text as presentation,'["1","2","3","4","5"]'::jsonb as options,0 as question_position
 union all select 'guest_name','Nombre del comensal','text',null,'[]'::jsonb,1
 union all select 'guest_contact',case v.contact_settings->>'mode' when 'email' then 'Correo electrónico' when 'phone' then 'Teléfono' else 'Correo o teléfono' end,'text',null,'[]'::jsonb,2
 union all select 'q:'||(q.value->>'id'),q.value->>'prompt',q.value->>'type',
 coalesce(q.value->>'presentation',case when q.value->>'type'='single' and q.value->'options'='["1","2","3","4","5"]'::jsonb then 'scale' when q.value->>'type'='single' and q.value->'options' in ('["Sí","No"]'::jsonb,'["Si","No"]'::jsonb,'["Yes","No"]'::jsonb) then 'yes_no' else null end),
 coalesce(q.value->'options','[]'::jsonb),q.ordinality::integer+2
 from jsonb_array_elements(v.questions) with ordinality q(value,ordinality) where q.value->>'type'<>'rating'
 ) f where auth.uid() is not null and (r.owner_id=auth.uid() or public.is_portal_admin())
 and (p_restaurant_id is null or r.id=p_restaurant_id) and (p_version_id is null or v.id=p_version_id);
$$;
revoke all on function private.analytics_question_catalog(uuid,uuid) from public,anon,authenticated;

create function private.analytics_question_answers(p_restaurant_id uuid,p_version_id uuid,p_field text,p_employee_id uuid,p_rating integer,p_from timestamptz)
returns table(id uuid,restaurant_id uuid,version_id uuid,version integer,key text,guest_name text,employee_name text,submitted_at timestamptz,answer jsonb)
language sql stable security definer set search_path='' as $$
 with extracted as (
 select s.id,s.restaurant_id,s.survey_version_id,c.version,c.key,s.guest_name,s.employee_name,s.submitted_at,
 case c.key when 'rating' then to_jsonb(s.rating) when 'guest_name' then to_jsonb(s.guest_name) when 'guest_contact' then to_jsonb(s.guest_contact) else s.answers->substring(c.key from 3) end as answer
 from private.analytics_question_catalog(p_restaurant_id,p_version_id) c join public.survey_responses s on s.survey_version_id=c.version_id and s.restaurant_id=c.restaurant_id
 where (p_field is null or c.key=p_field) and (p_employee_id is null or s.employee_id=p_employee_id) and (p_rating is null or s.rating=p_rating) and (p_from is null or s.submitted_at>=p_from) and s.submitted_at<=now()
 ) select * from extracted where case jsonb_typeof(answer) when 'string' then nullif(trim(answer#>>'{}'),'') is not null when 'array' then jsonb_array_length(answer)>0 when 'number' then true when 'boolean' then true else false end;
$$;
revoke all on function private.analytics_question_answers(uuid,uuid,text,uuid,integer,timestamptz) from public,anon,authenticated;

create function public.question_answer_analytics(p_restaurant_id uuid default null,p_version_id uuid default null,p_employee_id uuid default null,p_rating integer default null,p_from timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if p_rating is not null and p_rating not between 1 and 5 then raise exception 'invalid_rating';end if;
 if p_restaurant_id is not null and not public.can_edit_survey(p_restaurant_id) then raise exception 'restaurant_access_required' using errcode='42501';end if;
 if p_version_id is not null and not exists(select 1 from private.analytics_question_catalog(p_restaurant_id,p_version_id)) then raise exception 'survey_access_required' using errcode='42501';end if;
 with catalog as materialized(select * from private.analytics_question_catalog(p_restaurant_id,p_version_id)),
 latest as (select distinct on(restaurant_id,key) * from catalog order by restaurant_id,key,published_at desc,version desc,question_position),
 answers as materialized(select * from private.analytics_question_answers(p_restaurant_id,p_version_id,null,p_employee_id,p_rating,p_from)),
 selections as materialized(
 select a.restaurant_id,a.key,a.id,p.label from answers a join latest l on l.restaurant_id=a.restaurant_id and l.key=a.key and l.question_type in ('rating','single','multiple') cross join lateral (
 select distinct value as label from jsonb_array_elements_text(case when jsonb_typeof(a.answer)='array' then a.answer else jsonb_build_array(a.answer#>>'{}') end)
 ) p
 ), question_groups as (
 select l.*,p_version_id as scope_version_id,
 (select count(*) from answers a where a.restaurant_id=l.restaurant_id and a.key=l.key) as answered,
 (select count(distinct c.version_id) from catalog c where c.restaurant_id=l.restaurant_id and c.key=l.key) as version_count,
 case when l.question_type in ('rating','single','multiple') then coalesce((
 select jsonb_agg(jsonb_build_object('label',opts.label,'total',(select count(*) from selections x where x.restaurant_id=l.restaurant_id and x.key=l.key and x.label=opts.label)) order by opts.first_position,opts.label)
 from (select label,min(first_position) as first_position from (
 select o.value as label,c.question_position*100+o.ordinality as first_position from catalog c cross join lateral jsonb_array_elements_text(c.options) with ordinality o(value,ordinality) where c.restaurant_id=l.restaurant_id and c.key=l.key
 union all select x.label,1000000::bigint from selections x where x.restaurant_id=l.restaurant_id and x.key=l.key
 ) choices group by label) opts
 ),'[]'::jsonb) else '[]'::jsonb end as distribution,
 coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at desc,p.id) from (select a.id,a.guest_name,a.employee_name,a.submitted_at,a.answer,a.version from answers a where a.restaurant_id=l.restaurant_id and a.key=l.key order by a.submitted_at desc,a.id limit 4) p),'[]'::jsonb) as preview
 from latest l
 ) select jsonb_build_object('groups',coalesce(jsonb_agg(to_jsonb(g) order by g.published_at desc,g.restaurant_name,g.question_position,g.key),'[]'::jsonb)) into result from question_groups g;
 return result;
end $$;
revoke all on function public.question_answer_analytics(uuid,uuid,uuid,integer,timestamptz) from public;
grant execute on function public.question_answer_analytics(uuid,uuid,uuid,integer,timestamptz) to authenticated;

-- Preserve the detail RPC signature; a null version now means all authorized versions.
create or replace function public.question_responses(p_version_id uuid,p_field text,p_restaurant_id uuid default null,p_employee_id uuid default null,p_rating integer default null,p_from timestamptz default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare definition record; result jsonb;
begin
 if auth.uid() is null or p_restaurant_id is null or not public.can_edit_survey(p_restaurant_id) then raise exception 'survey_access_required' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'invalid_filters';end if;
 select * into definition from private.analytics_question_catalog(p_restaurant_id,p_version_id) c where c.key=p_field order by c.published_at desc,c.version desc limit 1;
 if not found then raise exception 'invalid_question';end if;
 with answered as materialized(select * from private.analytics_question_answers(p_restaurant_id,p_version_id,p_field,p_employee_id,p_rating,p_from)),
 selected as (select id,guest_name,employee_name,submitted_at,answer,version,version_id from answered order by submitted_at desc,id limit 20 offset (p_page-1)*20),
 selections as (select a.id,x.label from answered a cross join lateral(select distinct value as label from jsonb_array_elements_text(case when jsonb_typeof(a.answer)='array' then a.answer else jsonb_build_array(a.answer#>>'{}') end)) x),
 choices as (select distinct o.value as label from private.analytics_question_catalog(p_restaurant_id,p_version_id) c cross join lateral jsonb_array_elements_text(c.options) o(value) where c.key=p_field union select label from selections)
 select jsonb_build_object('total',(select count(*) from answered),'page',p_page,'page_size',20,'label',definition.label,'restaurant_name',definition.restaurant_name,'version',definition.version,'all_versions',p_version_id is null,
 'question',jsonb_build_object('type',definition.question_type,'presentation',definition.presentation,'options',definition.options),
 'distribution',case when definition.question_type in ('rating','single','multiple') then coalesce((select jsonb_agg(jsonb_build_object('label',c.label,'total',(select count(*) from selections x where x.label=c.label)) order by c.label) from choices c),'[]'::jsonb) else '[]'::jsonb end,
 'rows',coalesce((select jsonb_agg(to_jsonb(s) order by s.submitted_at desc,s.id) from selected s),'[]'::jsonb)) into result;
 return result;
end $$;
commit;
