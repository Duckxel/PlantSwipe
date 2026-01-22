-- Migration: Add SEO and discoverability fields to blog_posts
-- Adds meta_description, seo_title, and tags columns for better search engine optimization
-- Tags are limited to help AI generate focused, relevant tags

-- Add meta_description column for SEO meta tags
alter table public.blog_posts add column if not exists meta_description text;

-- Add seo_title column for optimized page titles
alter table public.blog_posts add column if not exists seo_title text;

-- Add tags array column for blog categorization (limited to 5 tags)
alter table public.blog_posts add column if not exists tags text[] default '{}';

-- Add constraint to limit number of tags to 5
alter table public.blog_posts drop constraint if exists blog_posts_tags_limit;
alter table public.blog_posts add constraint blog_posts_tags_limit 
  check (coalesce(array_length(tags, 1), 0) <= 5);

-- Add index on tags for faster searches
create index if not exists blog_posts_tags_idx on public.blog_posts using gin(tags);

-- Add comment for documentation
comment on column public.blog_posts.meta_description is 'SEO meta description for search engines (150-160 chars recommended)';
comment on column public.blog_posts.seo_title is 'Optimized SEO title (60 chars recommended)';
comment on column public.blog_posts.tags is 'Categorization tags for the blog post (limited to 5)';
