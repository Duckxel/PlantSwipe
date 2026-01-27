-- Migration: Add SEO metadata fields to blog_posts table
-- This adds seo_title, seo_description, and tags for enhanced discoverability

-- Add seo_title column for custom SEO titles
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'seo_title') then
    alter table public.blog_posts add column seo_title text;
    comment on column public.blog_posts.seo_title is 'AI-generated or custom SEO title for search engines and social sharing';
  end if;
end $$;

-- Add seo_description column for custom SEO descriptions
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'seo_description') then
    alter table public.blog_posts add column seo_description text;
    comment on column public.blog_posts.seo_description is 'AI-generated or custom SEO description for search engines and social sharing';
  end if;
end $$;

-- Add tags column (array of text) for categorization and discoverability
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'tags') then
    alter table public.blog_posts add column tags text[] default '{}';
    comment on column public.blog_posts.tags is 'AI-generated or custom tags for categorization (limited to 7 tags)';
  end if;
end $$;

-- Create index on tags for efficient filtering
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);
