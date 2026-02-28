-- Migration: normalize featured_month values to canonical month slugs
--
-- The create-plant form was saving numeric values (1-12) instead of slug
-- strings ("january"-"december") into the featured_month text[] column.
-- This migration converts any numeric or mixed entries to proper slugs.

update public.plants
set featured_month = (
  select coalesce(array_agg(normalised.slug order by normalised.ord), '{}'::text[])
  from (
    select t.ord, case
      when elem in ('january','february','march','april','may','june',
                    'july','august','september','october','november','december')
        then elem
      -- numeric string → slug  ("1" → "january", "12" → "december")
      when elem ~ '^\d{1,2}$' and cast(elem as int) between 1 and 12
        then (array['january','february','march','april','may','june',
                     'july','august','september','october','november','december'])[cast(elem as int)]
      -- 3-letter abbreviation → slug  ("jan" → "january")
      when lower(elem) in ('jan','feb','mar','apr','may','jun',
                           'jul','aug','sep','oct','nov','dec')
        then (array['january','february','march','april','may','june',
                     'july','august','september','october','november','december'])[
               array_position(
                 array['jan','feb','mar','apr','may','jun',
                       'jul','aug','sep','oct','nov','dec'],
                 lower(elem)
               )
             ]
      -- full month name (mixed case) → slug  ("March" → "march")
      when lower(elem) in ('january','february','march','april','may','june',
                           'july','august','september','october','november','december')
        then lower(elem)
      else null  -- discard unrecognisable values
    end as slug,
    t.ord
    from unnest(featured_month) with ordinality as t(elem, ord)
  ) normalised
  where slug is not null
)
where featured_month is not null
  and featured_month <> '{}'::text[]
  -- only touch rows that have at least one non-slug entry
  and exists (
    select 1 from unnest(featured_month) as e
    where e not in ('january','february','march','april','may','june',
                    'july','august','september','october','november','december')
  );
