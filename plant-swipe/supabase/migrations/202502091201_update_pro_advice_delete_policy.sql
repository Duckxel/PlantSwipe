-- Update the delete policy to allow Pro users to delete any pro advice (moderation)
-- This extends the previous policy that only allowed admin/editor to moderate

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_delete_moderate') then
    drop policy plant_pro_advices_delete_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_delete_moderate on public.plant_pro_advices for delete to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor','pro']), false)
    );
end $$;

-- Also update the update policy to allow Pro users to update any advice
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='plant_pro_advices' and policyname='plant_pro_advices_update_moderate') then
    drop policy plant_pro_advices_update_moderate on public.plant_pro_advices;
  end if;
  create policy plant_pro_advices_update_moderate on public.plant_pro_advices for update to authenticated
    using (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor','pro']), false)
    )
    with check (
      author_id = auth.uid()
      or coalesce(public.has_any_role(auth.uid(), array['admin','editor','pro']), false)
    );
end $$;
