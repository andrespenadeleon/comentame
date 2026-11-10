-- Read-only aggregate for the restaurant overview. Existing review/visit calculations are unchanged.
begin;
create function public.restaurant_employee_performance(p_restaurant_id uuid,p_from timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(performance) order by performance.name,performance.id),'[]'::jsonb)
 from (
  select e.id,concat_ws(' ',e.first_name,e.last_name) as name,e.role,count(s.id) as reviews,
   coalesce(sum(s.rating),0) as rating_sum,round(avg(s.rating),2) as average,count(s.id) filter(where s.rating=5) as five_stars
  from public.employees e join public.restaurants r on r.id=e.restaurant_id
  left join public.survey_responses s on s.employee_id=e.id and s.restaurant_id=r.id and (p_from is null or s.submitted_at>=p_from)
  where r.id=p_restaurant_id and r.owner_id=(select auth.uid()) and e.deleted_at is null
  group by e.id,e.first_name,e.last_name,e.role
 ) performance;
$$;
revoke all on function public.restaurant_employee_performance(uuid,timestamptz) from public,anon;
grant execute on function public.restaurant_employee_performance(uuid,timestamptz) to authenticated;
commit;
