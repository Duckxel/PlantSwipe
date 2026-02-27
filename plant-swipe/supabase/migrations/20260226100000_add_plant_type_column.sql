-- ============================================================================
-- Add plant_type column (single-select text) to plants table
-- ============================================================================
-- The old plant_type column was renamed to encyclopedia_category (text[]) by
-- earlier migrations. This re-adds plant_type as a dedicated single-value
-- column for the primary botanical type of the plant.
-- ============================================================================

do $add_plant_type$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plants'
      and column_name = 'plant_type'
  ) then
    alter table public.plants add column plant_type text;
    raise notice 'Added column: plant_type';
  end if;
end $add_plant_type$;
