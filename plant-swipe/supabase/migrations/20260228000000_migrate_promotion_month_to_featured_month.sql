-- Migration: promotion_month → featured_month
-- The old promotion_month column (single text) has been replaced by
-- featured_month (text[]). This migration ensures any remaining data
-- in promotion_month is copied into featured_month, then drops the
-- obsolete column from both plants and plant_translations tables.

do $$
begin
  -- 1. Copy promotion_month data into featured_month on the plants table
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plants' and column_name = 'promotion_month'
  ) then
    -- Ensure featured_month column exists before copying
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'plants' and column_name = 'featured_month'
    ) then
      alter table public.plants add column featured_month text[] not null default '{}'::text[];
    end if;

    -- Copy data: wrap the single text value into an array if featured_month is empty
    update public.plants
    set featured_month = array[promotion_month]
    where promotion_month is not null
      and trim(promotion_month) <> ''
      and (featured_month is null or featured_month = '{}'::text[]);

    raise notice 'Migrated promotion_month data to featured_month for % plants',
      (select count(*) from public.plants
       where promotion_month is not null and trim(promotion_month) <> '');

    -- Drop any CHECK constraints on promotion_month before dropping the column
    declare
      r record;
    begin
      for r in (
        select c.conname
        from pg_constraint c
        join pg_attribute a on a.attnum = any(c.conkey) and a.attrelid = c.conrelid
        where c.conrelid = 'public.plants'::regclass
          and c.contype = 'c'
          and a.attname = 'promotion_month'
      ) loop
        execute 'alter table public.plants drop constraint ' || quote_ident(r.conname);
      end loop;
    end;

    -- Drop the obsolete column
    alter table public.plants drop column promotion_month;
    raise notice 'Dropped promotion_month column from plants table';
  else
    raise notice 'promotion_month column does not exist on plants table — nothing to migrate';
  end if;

  -- 2. Drop promotion_month from plant_translations if it still exists
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plant_translations' and column_name = 'promotion_month'
  ) then
    alter table public.plant_translations drop column promotion_month;
    raise notice 'Dropped promotion_month column from plant_translations table';
  else
    raise notice 'promotion_month column does not exist on plant_translations table — already clean';
  end if;
end $$;
