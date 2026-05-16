alter table public.files
add column if not exists published_at date;

create index if not exists files_folder_published_at_idx
on public.files(folder_id, published_at desc nulls last);

drop function if exists public.search_translation_files(text);

create or replace function public.search_translation_files(search_text text)
returns table (
  id uuid,
  folder_id uuid,
  folder_name text,
  title text,
  youtube_url text,
  published_at date,
  arabic_text text,
  french_translation text,
  sort_order integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language sql
stable
as $$
  select
    files.id,
    files.folder_id,
    folders.name as folder_name,
    files.title,
    files.youtube_url,
    files.published_at,
    files.arabic_text,
    files.french_translation,
    files.sort_order,
    files.created_at,
    files.updated_at
  from public.files
  join public.folders on folders.id = files.folder_id
  where
    nullif(trim(search_text), '') is not null
    and (
      files.title ilike '%' || search_text || '%'
      or coalesce(files.arabic_text, '') ilike '%' || search_text || '%'
      or coalesce(files.french_translation, '') ilike '%' || search_text || '%'
    )
  order by files.published_at desc nulls last, files.created_at desc;
$$;
