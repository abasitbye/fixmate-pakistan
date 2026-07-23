-- Citywide launch coverage gives applicants a truthful initial selection without inventing neighborhoods.
insert into public.service_zones (city_id, name)
select id, name || ' - Citywide'
from public.cities
where name in ('Islamabad', 'Rawalpindi')
on conflict (city_id, name) do nothing;

comment on table public.service_zones is 'Operator-managed coverage units. Phase 1 seeds only explicit citywide launch coverage; no neighborhoods are fabricated.';
