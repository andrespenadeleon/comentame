begin;
create function public.response_question_versions(p_response_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_response_ids is null or cardinality(p_response_ids)>20 then raise exception 'invalid_response_ids'; end if;
 select coalesce(jsonb_object_agg(v.id,jsonb_build_object('title',v.title,'version',v.version,'questions',v.questions)),'{}'::jsonb) into result
 from public.survey_versions v where exists(
 select 1 from public.survey_responses s join public.restaurants r on r.id=s.restaurant_id
 where s.survey_version_id=v.id and s.id=any(p_response_ids)
 and (r.owner_id=auth.uid() or public.is_portal_admin())
 );
 return result;
end $$;
revoke all on function public.response_question_versions(uuid[]) from public;
grant execute on function public.response_question_versions(uuid[]) to authenticated;
commit;
