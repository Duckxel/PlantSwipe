-- Migration: Add landing_page_settings table for global landing page configuration
-- This table stores global settings like CTA buttons, social links, section visibility, etc.

-- Create the landing_page_settings table
create table if not exists public.landing_page_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Hero Section Settings
  hero_badge_text text default 'Your Personal Plant Care Expert',
  hero_title text default 'Grow Your',
  hero_title_highlight text default 'Green Paradise',
  hero_title_end text default 'with Confidence',
  hero_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips – all in one beautiful app.',
  hero_cta_primary_text text default 'Download App',
  hero_cta_primary_link text default '/download',
  hero_cta_secondary_text text default 'Try in Browser',
  hero_cta_secondary_link text default '/discovery',
  hero_social_proof_text text default '10,000+ plant lovers',
  
  -- Section Visibility
  show_hero_section boolean default true,
  show_stats_section boolean default true,
  show_beginner_section boolean default true,
  show_features_section boolean default true,
  show_demo_section boolean default true,
  show_how_it_works_section boolean default true,
  show_showcase_section boolean default true,
  show_testimonials_section boolean default true,
  show_faq_section boolean default true,
  show_final_cta_section boolean default true,
  
  -- Social Links
  instagram_url text default 'https://instagram.com/aphylia.app',
  twitter_url text default 'https://twitter.com/aphylia_app',
  support_email text default 'hello@aphylia.app',
  
  -- Final CTA Section
  final_cta_badge text default 'No experience needed',
  final_cta_title text default 'Ready to Start Your Plant Journey?',
  final_cta_subtitle text default 'Whether it''s your first succulent or you''re building a jungle, Aphylia grows with you.',
  final_cta_button_text text default 'Start Growing',
  final_cta_secondary_text text default 'Explore Plants',
  
  -- Beginner Section
  beginner_badge text default 'Perfect for Beginners',
  beginner_title text default 'Know Nothing About Gardening?',
  beginner_title_highlight text default 'That''s Exactly Why We Built This',
  beginner_subtitle text default 'Everyone starts somewhere. Aphylia turns complete beginners into confident plant parents with gentle guidance.',
  
  -- Meta/SEO
  meta_title text default 'Aphylia – Your Personal Plant Care Expert',
  meta_description text default 'Discover, track, and nurture your plants with personalized care reminders, smart identification, and expert tips.'
);

-- Create index
create index if not exists idx_landing_page_settings_id on public.landing_page_settings(id);

-- Ensure only one row exists
create or replace function public.ensure_single_landing_page_settings()
returns trigger as $$
begin
  if (select count(*) from public.landing_page_settings) > 0 and TG_OP = 'INSERT' then
    raise exception 'Only one landing_page_settings row allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ensure_single_landing_page_settings_trigger on public.landing_page_settings;
create trigger ensure_single_landing_page_settings_trigger
  before insert on public.landing_page_settings
  for each row execute function public.ensure_single_landing_page_settings();

-- RLS Policies
alter table public.landing_page_settings enable row level security;

drop policy if exists "Landing page settings are publicly readable" on public.landing_page_settings;
create policy "Landing page settings are publicly readable" on public.landing_page_settings 
  for select using (true);

drop policy if exists "Admins can manage landing page settings" on public.landing_page_settings;
create policy "Admins can manage landing page settings" on public.landing_page_settings 
  for all using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin')
    )
  );

-- Insert default settings row
insert into public.landing_page_settings (id) 
values (gen_random_uuid())
on conflict do nothing;
