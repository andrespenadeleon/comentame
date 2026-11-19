-- Preload only the current 20-row page, behind the existing restaurant authorization.
begin;
create function public.restaurant_leads_page(p_restaurant_id uuid,p_page integer default 1,p_detail uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; prepared jsonb;
begin
 -- This call validates authentication, owner/admin access, page bounds and lead eligibility.
 result:=public.restaurant_leads(p_restaurant_id,p_page,p_detail);
 select coalesce(jsonb_agg(row_data || jsonb_build_object(
 'response',to_jsonb(s),
 'version',jsonb_build_object('title',v.title,'version',v.version,'questions',v.questions)
 ) order by position),'[]'::jsonb) into prepared
 from jsonb_array_elements(result->'rows') with ordinality as page_rows(row_data,position)
 join public.survey_responses s on s.id=(row_data->>'id')::uuid and s.restaurant_id=p_restaurant_id
 join public.survey_versions v on v.id=s.survey_version_id;
 return jsonb_set(result,'{rows}',prepared);
end $$;
revoke all on function public.restaurant_leads_page(uuid,integer,uuid) from public;
grant execute on function public.restaurant_leads_page(uuid,integer,uuid) to authenticated;
commit;
