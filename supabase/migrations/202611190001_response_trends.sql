-- Aggregate in the database; never infer chart counts from the paginated inbox.
begin;
create function public.survey_response_trends(p_restaurant_id uuid default null,p_employee_id uuid default null,p_rating integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Monterrey')::date; result jsonb; admin boolean;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 admin:=public.is_portal_admin();
 if p_rating is not null and p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
 if p_restaurant_id is not null and not exists(select 1 from public.restaurants r where r.id=p_restaurant_id and (r.owner_id=auth.uid() or admin)) then raise exception 'restaurant_access_required' using errcode='42501'; end if;
 with calendar as (
 select today-29+n as day from generate_series(0,29) n
 ), counts as (
 select (s.submitted_at at time zone 'America/Monterrey')::date as day,count(*) as responses
 from public.survey_responses s join public.restaurants r on r.id=s.restaurant_id
 where (r.owner_id=auth.uid() or admin)
 and (p_restaurant_id is null or s.restaurant_id=p_restaurant_id)
 and (p_employee_id is null or s.employee_id=p_employee_id)
 and (p_rating is null or s.rating=p_rating)
 and s.submitted_at>=((today-29)::timestamp at time zone 'America/Monterrey')
 and s.submitted_at<=now()
 group by (s.submitted_at at time zone 'America/Monterrey')::date
 ), daily as (
 select c.day,coalesce(x.responses,0) as responses from calendar c left join counts x using(day)
 ), weekdays as (
 select n as weekday,coalesce((select sum(d.responses) from daily d where extract(isodow from d.day)=n),0) as responses from generate_series(1,7) n
 )
 select jsonb_build_object('timezone','America/Monterrey','from',today-29,'through',today,'total',(select sum(responses) from daily),
 'daily',(select jsonb_agg(jsonb_build_object('day',day,'responses',responses) order by day) from daily),
 'weekdays',(select jsonb_agg(jsonb_build_object('weekday',weekday,'responses',responses) order by weekday) from weekdays)) into result;
 return result;
end $$;
revoke all on function public.survey_response_trends(uuid,uuid,integer) from public;
grant execute on function public.survey_response_trends(uuid,uuid,integer) to authenticated;
commit;
