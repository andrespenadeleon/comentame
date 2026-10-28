-- Apply after 202610260002_feedback.sql. No customer opinions are exposed by table grants.
begin;
alter table public.restaurants add column logo_path text;
alter table public.restaurants add column social_links jsonb not null default '{}'::jsonb;
alter table public.employees add column deleted_at timestamptz;

create function private.valid_social_links(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item record; domain_pattern text;
begin
 if jsonb_typeof(value) is distinct from 'object' then return false; end if;
 for item in select * from jsonb_each(value) loop
  domain_pattern := case item.key when 'instagram' then 'instagram\.com' when 'facebook' then '(facebook\.com|fb\.com|fb\.me)' when 'tiktok' then 'tiktok\.com' when 'youtube' then '(youtube\.com|youtu\.be)' else null end;
  if domain_pattern is null or jsonb_typeof(item.value) is distinct from 'string' or length(item.value #>> '{}')>2048
   or (item.value #>> '{}') !~ ('^https://([a-z0-9-]+\.)*'||domain_pattern||'([/?#][^[:space:]]*)?$') then return false; end if;
 end loop;
 return true;
end $$;
grant execute on function private.valid_social_links(jsonb) to authenticated;
alter table public.restaurants add constraint restaurant_social_links_valid check(private.valid_social_links(social_links));
alter table public.restaurants add constraint restaurant_logo_valid check(logo_path is null or (split_part(logo_path,'/',1)=id::text and logo_path ~ '^[a-f0-9-]+/[a-f0-9-]+\.(jpg|png|webp)$'));
grant update(logo_path,social_links) on public.restaurants to authenticated;

create function public.create_restaurant(p_name text,p_address text,p_phone text,p_google_maps_url text,p_social_links jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 result:=public.create_restaurant(p_name,p_address,p_phone,p_google_maps_url);
 update public.restaurants set social_links=coalesce(p_social_links,'{}'::jsonb) where id=result and owner_id=auth.uid();
 return result;
end $$;
revoke all on function public.create_restaurant(text,text,text,text,jsonb) from public,anon;
grant execute on function public.create_restaurant(text,text,text,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('restaurant-logos','restaurant-logos',true,2097152,array['image/jpeg','image/png','image/webp']);
create policy restaurant_logo_owner_read on storage.objects for select to authenticated using(bucket_id='restaurant-logos' and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1] and r.owner_id=(select auth.uid())));
create policy restaurant_logo_owner_insert on storage.objects for insert to authenticated with check(bucket_id='restaurant-logos' and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1] and r.owner_id=(select auth.uid())));
create policy restaurant_logo_owner_delete on storage.objects for delete to authenticated using(bucket_id='restaurant-logos' and exists(select 1 from public.restaurants r where r.id::text=(storage.foldername(storage.objects.name))[1] and r.owner_id=(select auth.uid())));

create table public.survey_versions (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 version integer not null check(version>0),
 title text not null check(length(trim(title)) between 1 and 150),
 questions jsonb not null check(private.valid_questions(questions)),
 published_at timestamptz not null default now(),
 unique(restaurant_id,version)
);
alter table public.restaurants add column active_survey_id uuid references public.survey_versions(id) on delete set null;
alter table public.restaurants add constraint restaurant_live_google_required check(active_survey_id is null or google_maps_url is not null);
alter table public.survey_versions enable row level security;
revoke all on public.survey_versions from public,anon,authenticated;
grant select on public.survey_versions to authenticated;
create policy survey_version_owner on public.survey_versions for select to authenticated using(exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));

create function public.publish_survey(p_restaurant_id uuid,p_title text,p_questions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; next_version integer; result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 select * into r from public.restaurants where id=p_restaurant_id and owner_id=auth.uid() for update;
 if not found then raise exception 'restaurant_not_found'; end if;
 if r.google_maps_url is null then raise exception 'google_required'; end if;
 if length(trim(p_title)) not between 1 and 150 or not private.valid_questions(p_questions) or p_title is null or p_questions is null then raise exception 'invalid_survey'; end if;
 select coalesce(max(version),0)+1 into next_version from public.survey_versions where restaurant_id=r.id;
 insert into public.survey_versions(restaurant_id,version,title,questions) values(r.id,next_version,trim(p_title),p_questions) returning id into result;
 insert into public.survey_drafts(restaurant_id,title,questions,updated_at) values(r.id,trim(p_title),p_questions,now()) on conflict(restaurant_id) do update set title=excluded.title,questions=excluded.questions,updated_at=excluded.updated_at;
 update public.restaurants set active_survey_id=result where id=r.id;
 return jsonb_build_object('id',result,'version',next_version);
end $$;
revoke all on function public.publish_survey(uuid,text,jsonb) from public,anon;
grant execute on function public.publish_survey(uuid,text,jsonb) to authenticated;

create table public.survey_responses (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique,
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 employee_id uuid not null references public.employees(id),
 survey_version_id uuid not null references public.survey_versions(id),
 restaurant_name text not null,
 employee_name text not null,
 guest_name text not null check(length(trim(guest_name)) between 1 and 150),
 guest_contact text check(length(guest_contact)<=254),
 rating smallint not null check(rating between 1 and 5),
 answers jsonb not null check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=131072),
 submitted_at timestamptz not null default now()
);
create index response_restaurant_date on public.survey_responses(restaurant_id,submitted_at desc,id desc);
create index response_employee_date on public.survey_responses(employee_id,submitted_at desc);
create index response_version on public.survey_responses(survey_version_id);
alter table public.survey_responses enable row level security;
revoke all on public.survey_responses from public,anon,authenticated;
grant select on public.survey_responses to authenticated;
create policy response_owner_read on public.survey_responses for select to authenticated using(exists(select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));

-- Archiving preserves history and disables the NFC link. Owners cannot hard-delete employees.
revoke delete on public.employees from authenticated;
create function public.archive_employee(p_employee_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 update public.employees e set deleted_at=coalesce(e.deleted_at,now()),photo_path=null where e.id=p_employee_id and exists(select 1 from public.restaurants r where r.id=e.restaurant_id and r.owner_id=auth.uid());
 if not found then raise exception 'employee_not_found'; end if;
end $$;
revoke all on function public.archive_employee(uuid) from public,anon;
grant execute on function public.archive_employee(uuid) to authenticated;

-- Only public branding and the current published survey are returned. Never guest/admin data.
create function public.get_public_survey(p_restaurant_id uuid,p_employee_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('restaurant_id',r.id,'restaurant_name',r.name,'logo_path',r.logo_path,'social_links',r.social_links,'google_maps_url',r.google_maps_url,'employee_id',e.id,'survey_version_id',v.id,'title',v.title,'questions',v.questions)
 from public.restaurants r join public.employees e on e.restaurant_id=r.id and e.id=p_employee_id and e.deleted_at is null
 join public.survey_versions v on v.id=r.active_survey_id and v.restaurant_id=r.id where r.id=p_restaurant_id;
$$;
revoke all on function public.get_public_survey(uuid,uuid) from public;
grant execute on function public.get_public_survey(uuid,uuid) to anon,authenticated;

create function public.submit_survey(p_submission_id uuid,p_restaurant_id uuid,p_employee_id uuid,p_version_id uuid,p_name text,p_contact text,p_rating integer,p_answers jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.restaurants; e public.employees; v public.survey_versions; prior public.survey_responses; q jsonb; answer jsonb; entry record; result uuid; contact text:=nullif(trim(p_contact),'');
begin
 if p_submission_id is null or p_rating is null or p_rating not between 1 and 5 or p_name is null or length(trim(p_name)) not between 1 and 150
  or p_answers is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>131072 then raise exception 'invalid_response'; end if;
 if contact is not null and (length(contact)>254 or not (contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or (contact ~ '^[+0-9() .-]+$' and length(regexp_replace(contact,'[^0-9]','','g')) between 10 and 15))) then raise exception 'invalid_contact'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,1));
 select * into prior from public.survey_responses where submission_id=p_submission_id;
 if found then
  if prior.restaurant_id=p_restaurant_id and prior.employee_id=p_employee_id and prior.survey_version_id=p_version_id and prior.guest_name=trim(p_name) and prior.guest_contact is not distinct from contact and prior.rating=p_rating and prior.answers=p_answers then return prior.id; end if;
  raise exception 'submission_conflict';
 end if;
 select * into e from public.employees where id=p_employee_id and restaurant_id=p_restaurant_id and deleted_at is null for share;
 if not found then raise exception 'survey_unavailable'; end if;
 select * into r from public.restaurants where id=p_restaurant_id and active_survey_id is not null;
 if not found then raise exception 'survey_unavailable'; end if;
 -- A visitor who opened the previous published version can finish it after a new publication.
 select * into v from public.survey_versions where id=p_version_id and restaurant_id=r.id;
 if not found then raise exception 'survey_unavailable'; end if;
 for entry in select * from jsonb_each(p_answers) loop
  if not exists(select 1 from jsonb_array_elements(v.questions) x where x->>'id'=entry.key and x->>'type'<>'rating') then raise exception 'invalid_answer'; end if;
 end loop;
 for q in select * from jsonb_array_elements(v.questions) loop
  if q->>'type'='rating' then continue; end if;
  answer:=p_answers->(q->>'id');
  if answer is null or answer='null'::jsonb or answer='""'::jsonb or answer='[]'::jsonb or (jsonb_typeof(answer)='string' and length(trim(answer #>> '{}'))=0) then
   if (q->>'required')::boolean then raise exception 'answer_required'; end if;
   continue;
  end if;
  if q->>'type'='text' then
   if jsonb_typeof(answer)<>'string' or length(answer #>> '{}')>2000 then raise exception 'invalid_answer'; end if;
  elsif q->>'type'='single' then
   if jsonb_typeof(answer)<>'string' or not ((q->'options') @> jsonb_build_array(answer)) then raise exception 'invalid_answer'; end if;
  elsif q->>'type'='multiple' then
   if jsonb_typeof(answer)<>'array' then raise exception 'invalid_answer'; end if;
   if jsonb_array_length(answer)>10 or (select count(distinct x) from jsonb_array_elements(answer) x)<>jsonb_array_length(answer) then raise exception 'invalid_answer'; end if;
   for entry in select value from jsonb_array_elements(answer) loop
    if jsonb_typeof(entry.value)<>'string' or not ((q->'options') @> jsonb_build_array(entry.value)) then raise exception 'invalid_answer'; end if;
   end loop;
  else raise exception 'invalid_answer'; end if;
 end loop;
 insert into public.survey_responses(submission_id,restaurant_id,employee_id,survey_version_id,restaurant_name,employee_name,guest_name,guest_contact,rating,answers)
 values(p_submission_id,r.id,e.id,v.id,r.name,concat_ws(' ',e.first_name,e.last_name),trim(p_name),contact,p_rating,p_answers) returning id into result;
 return result;
end $$;
revoke all on function public.submit_survey(uuid,uuid,uuid,uuid,text,text,integer,jsonb) from public;
grant execute on function public.submit_survey(uuid,uuid,uuid,uuid,text,text,integer,jsonb) to anon,authenticated;

create function public.opinions_summary(p_restaurant_id uuid default null,p_employee_id uuid default null,p_rating integer default null,p_from timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'average',round(avg(s.rating),2),
 'distribution',jsonb_build_object('1',count(*) filter(where s.rating=1),'2',count(*) filter(where s.rating=2),'3',count(*) filter(where s.rating=3),'4',count(*) filter(where s.rating=4),'5',count(*) filter(where s.rating=5)))
 from public.survey_responses s where exists(select 1 from public.restaurants r where r.id=s.restaurant_id and r.owner_id=(select auth.uid()))
 and (p_restaurant_id is null or s.restaurant_id=p_restaurant_id) and (p_employee_id is null or s.employee_id=p_employee_id) and (p_rating is null or s.rating=p_rating) and (p_from is null or s.submitted_at>=p_from);
$$;
revoke all on function public.opinions_summary(uuid,uuid,integer,timestamptz) from public,anon;
grant execute on function public.opinions_summary(uuid,uuid,integer,timestamptz) to authenticated;
commit;
