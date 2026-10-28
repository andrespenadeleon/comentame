-- Apply after 202610270001_surveys.sql. Existing surveys retain a default theme.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('survey-backgrounds','survey-backgrounds',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy survey_background_owner_insert on storage.objects for insert to authenticated with check(bucket_id='survey-backgrounds' and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1] and r.owner_id=(select auth.uid())));
create policy survey_background_owner_read on storage.objects for select to authenticated using(bucket_id='survey-backgrounds' and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1] and r.owner_id=(select auth.uid())));
-- No client deletion: a previous published version may still reference the asset.
create function private.valid_survey_theme(value jsonb,p_restaurant_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare path text;
begin
 if jsonb_typeof(value) is distinct from 'object' or (select count(*) from jsonb_object_keys(value))<>3
 or jsonb_typeof(value->'backgroundColor') is distinct from 'string' or (value->>'backgroundColor')!~'^#[0-9a-fA-F]{6}$'
 or jsonb_typeof(value->'accentColor') is distinct from 'string' or (value->>'accentColor')!~'^#[0-9a-fA-F]{6}$'
 or not(value ? 'backgroundImagePath') then return false; end if;
 if value->'backgroundImagePath'='null'::jsonb then return true; end if;
 if jsonb_typeof(value->'backgroundImagePath') is distinct from 'string' then return false; end if;
 path:=value->>'backgroundImagePath';
 return split_part(path,'/',1)=p_restaurant_id::text and path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
 and exists(select 1 from storage.objects o where o.bucket_id='survey-backgrounds' and o.name=path
 and (o.metadata->>'size')::bigint between 1 and 5242880 and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'));
exception when others then return false;
end $$;
revoke all on function private.valid_survey_theme(jsonb,uuid) from public,anon;
grant execute on function private.valid_survey_theme(jsonb,uuid) to authenticated;
alter table public.survey_drafts add column theme jsonb not null default '{"backgroundColor":"#FFFFFF","backgroundImagePath":null,"accentColor":"#2563EB"}'::jsonb;
alter table public.survey_drafts add column editor_state jsonb;
alter table public.survey_drafts add column builder_step smallint not null default 1 check(builder_step between 1 and 3);
alter table public.survey_drafts add constraint survey_draft_theme_valid check(private.valid_survey_theme(theme,restaurant_id));
alter table public.survey_drafts add constraint survey_draft_editor_size check(editor_state is null or (jsonb_typeof(editor_state)='object' and octet_length(editor_state::text)<=131072));
alter table public.survey_versions add column theme jsonb not null default '{"backgroundColor":"#FFFFFF","backgroundImagePath":null,"accentColor":"#2563EB"}'::jsonb;
alter table public.survey_versions add constraint survey_version_theme_valid check(private.valid_survey_theme(theme,restaurant_id));

-- Add presentation hints while preserving the existing response types and answer format.
create or replace function private.valid_questions(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare q jsonb; opt jsonb; presentation text;
begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value) not between 1 and 21 then return false; end if;
 if value->0->>'type' is distinct from 'rating' or value->0->>'required' is distinct from 'true'
 or value->0->>'id' is distinct from '00000000-0000-4000-8000-000000000005'
 or value->0->>'prompt' is distinct from '¿Cómo estuvo tu experiencia?'
 or (select count(*) from jsonb_array_elements(value) x where x->>'type'='rating')<>1
 or (select count(distinct x->>'id') from jsonb_array_elements(value) x)<>jsonb_array_length(value) then return false; end if;
 for q in select * from jsonb_array_elements(value) loop
  if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(q->'prompt') is distinct from 'string' or length(trim(q->>'prompt')) not between 1 and 250
  or q->>'type' not in ('rating','text','single','multiple') or jsonb_typeof(q->'type') is distinct from 'string'
  or jsonb_typeof(q->'required') is distinct from 'boolean' or jsonb_typeof(q->'options') is distinct from 'array'
  or jsonb_typeof(q->'id') is distinct from 'string' or (q->>'id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  if q->>'type' in ('text','rating') and jsonb_array_length(q->'options')<>0 then return false; end if;
  if q->>'type' in ('single','multiple') and jsonb_array_length(q->'options') not between 2 and 10 then return false; end if;
  for opt in select * from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(opt)<>'string' or length(trim(opt #>> '{}')) not between 1 and 120 then return false; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(q->'options'))<>(select count(distinct trim(o #>> '{}')) from jsonb_array_elements(q->'options') o) then return false; end if;
  if q ? 'presentation' then
   presentation:=q->>'presentation';
   if jsonb_typeof(q->'presentation') is distinct from 'string' or presentation not in ('short','long','scale','yes_no') then return false; end if;
   if presentation in ('short','long') and q->>'type'<>'text' then return false; end if;
   if presentation in ('scale','yes_no') and q->>'type'<>'single' then return false; end if;
   if presentation='scale' and q->'options'<>'["1","2","3","4","5"]'::jsonb then return false; end if;
   if presentation='yes_no' and q->'options'<>'["Sí","No"]'::jsonb then return false; end if;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function public.save_survey_draft(p_restaurant_id uuid,p_title text,p_questions jsonb,p_theme jsonb,p_step integer) returns void
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; q jsonb; opt jsonb; canonical boolean;
begin
 select * into r from public.restaurants where id=p_restaurant_id and owner_id=auth.uid() for update;
 if not found then raise exception 'restaurant_not_found'; end if;
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
end $$;
revoke all on function public.save_survey_draft(uuid,text,jsonb,jsonb,integer) from public,anon;
grant execute on function public.save_survey_draft(uuid,text,jsonb,jsonb,integer) to authenticated;

create function public.publish_survey(p_restaurant_id uuid,p_title text,p_questions jsonb,p_theme jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; next_version integer; result uuid;
begin
 select * into r from public.restaurants where id=p_restaurant_id and owner_id=auth.uid() for update;
 if not found then raise exception 'restaurant_not_found'; end if;
 if r.google_maps_url is null then raise exception 'google_required'; end if;
 if p_title is null or p_questions is null or length(trim(p_title)) not between 1 and 150 or not private.valid_questions(p_questions)
 or p_theme is null or not private.valid_survey_theme(p_theme,r.id) then raise exception 'invalid_survey'; end if;
 select coalesce(max(version),0)+1 into next_version from public.survey_versions where restaurant_id=r.id;
 insert into public.survey_versions(restaurant_id,version,title,questions,theme) values(r.id,next_version,trim(p_title),p_questions,p_theme) returning id into result;
 insert into public.survey_drafts(restaurant_id,title,questions,theme,editor_state,builder_step,updated_at)
 values(r.id,trim(p_title),p_questions,p_theme,jsonb_build_object('title',trim(p_title),'questions',p_questions),3,now())
 on conflict(restaurant_id) do update set title=excluded.title,questions=excluded.questions,theme=excluded.theme,editor_state=excluded.editor_state,builder_step=3,updated_at=now();
 update public.restaurants set active_survey_id=result where id=r.id;
 return jsonb_build_object('id',result,'version',next_version);
end $$;
revoke all on function public.publish_survey(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.publish_survey(uuid,text,jsonb,jsonb) to authenticated;
-- Keep the previous function signature, preserving the latest draft theme for older clients.
create or replace function public.publish_survey(p_restaurant_id uuid,p_title text,p_questions jsonb) returns jsonb
language sql security definer set search_path='' as $$
 select public.publish_survey(p_restaurant_id,p_title,p_questions,coalesce((select theme from public.survey_drafts where restaurant_id=p_restaurant_id),'{"backgroundColor":"#FFFFFF","backgroundImagePath":null,"accentColor":"#2563EB"}'::jsonb));
$$;
create or replace function public.get_public_survey(p_restaurant_id uuid,p_employee_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('restaurant_id',r.id,'restaurant_name',r.name,'logo_path',r.logo_path,'social_links',r.social_links,'google_maps_url',r.google_maps_url,'employee_id',e.id,'survey_version_id',v.id,'title',v.title,'questions',v.questions,'theme',v.theme)
 from public.restaurants r join public.employees e on e.restaurant_id=r.id and e.id=p_employee_id and e.deleted_at is null
 join public.survey_versions v on v.id=r.active_survey_id and v.restaurant_id=r.id where r.id=p_restaurant_id;
$$;
commit;
