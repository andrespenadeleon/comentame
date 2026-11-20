-- Submitted responses only; no partial answer contents are collected.
begin;
create function public.question_responses(p_version_id uuid,p_field text,p_restaurant_id uuid default null,p_employee_id uuid default null,p_rating integer default null,p_from timestamptz default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; original public.survey_versions; label text;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select v.* into original from public.survey_versions v join public.restaurants r on r.id=v.restaurant_id where v.id=p_version_id
 and (p_restaurant_id is null or r.id=p_restaurant_id) and (r.owner_id=auth.uid() or public.is_portal_admin());
 if not found then raise exception 'survey_access_required' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 100000 or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'invalid_filters'; end if;
 if p_field='rating' then label:='Calificación de estrellas';
 elsif p_field='guest_name' then label:='Nombre del comensal';
 elsif p_field='guest_contact' then label:='Contacto';
 else select q->>'prompt' into label from jsonb_array_elements(original.questions) q where 'q:'||(q->>'id')=p_field and q->>'type'<>'rating'; end if;
 if label is null then raise exception 'invalid_question'; end if;
 with scoped as (
 select s.id,s.guest_name,s.employee_name,s.submitted_at,
 case p_field when 'rating' then to_jsonb(s.rating) when 'guest_name' then to_jsonb(s.guest_name) when 'guest_contact' then to_jsonb(s.guest_contact) else s.answers->substring(p_field from 3) end as answer
 from public.survey_responses s where s.survey_version_id=p_version_id and s.restaurant_id=original.restaurant_id
 and (p_employee_id is null or s.employee_id=p_employee_id) and (p_rating is null or s.rating=p_rating) and (p_from is null or s.submitted_at>=p_from)
 ), answered as materialized (
 select * from scoped where case jsonb_typeof(answer) when 'string' then nullif(trim(answer#>>'{}'),'') is not null when 'array' then jsonb_array_length(answer)>0 when 'number' then true when 'boolean' then true else false end
 ), page_rows as (select * from answered order by submitted_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('total',(select count(*) from answered),'page',p_page,'page_size',20,'label',label,
 'restaurant_name',(select r.name from public.restaurants r where r.id=original.restaurant_id),'version',original.version,
 'rows',coalesce((select jsonb_agg(to_jsonb(a) order by a.submitted_at desc,a.id) from page_rows a),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.question_responses(uuid,text,uuid,uuid,integer,timestamptz,integer) from public;
grant execute on function public.question_responses(uuid,text,uuid,uuid,integer,timestamptz,integer) to authenticated;
commit;
