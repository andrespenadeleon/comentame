-- Display the first name of the employee identified by the public survey link.
-- Apply after the previous migrations. No employee contact details are exposed.
begin;
create or replace function public.get_public_survey(p_restaurant_id uuid,p_employee_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'restaurant_id',r.id,'restaurant_name',r.name,'logo_path',r.logo_path,
  'social_links',r.social_links,'google_maps_url',r.google_maps_url,
  'employee_id',e.id,'employee_name',trim(e.first_name),
  'survey_version_id',v.id,'title',v.title,'questions',v.questions,'theme',v.theme
 )
 from public.restaurants r
 join public.employees e on e.restaurant_id=r.id and e.id=p_employee_id and e.deleted_at is null
 join public.survey_versions v on v.id=r.active_survey_id and v.restaurant_id=r.id
 where r.id=p_restaurant_id;
$$;
revoke all on function public.get_public_survey(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_public_survey(uuid,uuid) to anon,authenticated;
commit;
