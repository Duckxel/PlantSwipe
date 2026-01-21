-- Migration: Create landing_faq_translations table
-- This table stores translations for FAQ items in different languages

-- Create the table
create table if not exists public.landing_faq_translations (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references public.landing_faq(id) on delete cascade,
  language text not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(faq_id, language)
);

-- Create indexes for performance
create index if not exists idx_landing_faq_translations_faq_id on public.landing_faq_translations(faq_id);
create index if not exists idx_landing_faq_translations_language on public.landing_faq_translations(language);

-- Enable Row Level Security
alter table public.landing_faq_translations enable row level security;

-- RLS Policy: Anyone can read translations
drop policy if exists "Landing FAQ translations are publicly readable" on public.landing_faq_translations;
create policy "Landing FAQ translations are publicly readable" on public.landing_faq_translations for select using (true);

-- RLS Policy: Only admins can manage translations
drop policy if exists "Admins can manage landing FAQ translations" on public.landing_faq_translations;
create policy "Admins can manage landing FAQ translations" on public.landing_faq_translations for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
