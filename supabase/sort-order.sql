alter table public.folders
add column if not exists sort_order integer default 0 not null;

alter table public.files
add column if not exists sort_order integer default 0 not null;

with ordered_folders as (
  select id, row_number() over (order by created_at, id) - 1 as position
  from public.folders
)
update public.folders
set sort_order = ordered_folders.position
from ordered_folders
where folders.id = ordered_folders.id
and folders.sort_order = 0
and not exists (
  select 1
  from public.folders existing_folders
  where existing_folders.sort_order <> 0
);

with ordered_files as (
  select
    id,
    row_number() over (partition by folder_id order by created_at, id) - 1 as position
  from public.files
)
update public.files
set sort_order = ordered_files.position
from ordered_files
where files.id = ordered_files.id
and files.sort_order = 0
and not exists (
  select 1
  from public.files existing_files
  where existing_files.sort_order <> 0
);

create index if not exists folders_sort_order_idx on public.folders(sort_order asc);
create index if not exists files_folder_sort_order_idx on public.files(folder_id, sort_order asc);

drop function if exists public.search_translation_files(text);

create or replace function public.search_translation_files(search_text text)
returns table (
  id uuid,
  folder_id uuid,
  folder_name text,
  title text,
  youtube_url text,
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
  order by files.sort_order asc, files.updated_at desc;
$$;
