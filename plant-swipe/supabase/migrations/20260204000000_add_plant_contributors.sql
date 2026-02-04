-- Add contributors list to plants meta (defensive DO block avoids 1600 columns parser issue)
do $add_contributors$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'plants'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'plants'
        and column_name = 'contributors'
    ) then
      execute 'alter table public.plants add column contributors text[] not null default ''{}''::text[]';
    end if;
  end if;
end $add_contributors$;

comment on column public.plants.contributors is 'Names of users who requested or edited this plant';
