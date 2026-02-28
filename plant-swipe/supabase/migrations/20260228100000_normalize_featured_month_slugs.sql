-- Migration: normalize featured_month values to canonical month slugs
--
-- The create-plant form was saving numeric values (1-12) instead of slug
-- strings ("january"-"december") into the featured_month text[] column.
-- This migration converts any numeric or mixed entries to proper slugs.

do $$
declare
  r record;
  slugs text[];
  months_arr constant text[] := array[
    'january','february','march','april','may','june',
    'july','august','september','october','november','december'
  ];
  abbrevs constant text[] := array[
    'jan','feb','mar','apr','may','jun',
    'jul','aug','sep','oct','nov','dec'
  ];
  elem text;
  lower_elem text;
  num int;
  slug text;
begin
  for r in
    select id, featured_month
    from public.plants
    where featured_month is not null
      and featured_month <> '{}'::text[]
      and exists (
        select 1 from unnest(featured_month) as e
        where e not in (
          'january','february','march','april','may','june',
          'july','august','september','october','november','december'
        )
      )
  loop
    slugs := '{}'::text[];
    foreach elem in array r.featured_month loop
      slug := null;
      lower_elem := lower(trim(elem));

      -- already a valid slug
      if lower_elem = any(months_arr) then
        slug := lower_elem;
      -- numeric string → slug
      elsif elem ~ '^\d{1,2}$' then
        num := elem::int;
        if num between 1 and 12 then
          slug := months_arr[num];
        end if;
      -- 3-letter abbreviation → slug
      elsif lower_elem = any(abbrevs) then
        slug := months_arr[array_position(abbrevs, lower_elem)];
      end if;

      if slug is not null and not (slug = any(slugs)) then
        slugs := array_append(slugs, slug);
      end if;
    end loop;

    update public.plants set featured_month = slugs where id = r.id;
  end loop;
end $$;
