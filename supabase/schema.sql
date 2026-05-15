create extension if not exists pgcrypto;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  title text not null,
  youtube_url text,
  arabic_text text,
  french_translation text,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

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
create index if not exists files_folder_id_idx on public.files(folder_id);
create index if not exists files_folder_sort_order_idx on public.files(folder_id, sort_order asc);
create index if not exists files_updated_at_idx on public.files(updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_files_updated_at on public.files;
create trigger set_files_updated_at
before update on public.files
for each row
execute function public.set_updated_at();

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

alter table public.folders enable row level security;
alter table public.files enable row level security;

drop policy if exists "Authenticated users can manage folders" on public.folders;
create policy "Authenticated users can manage folders"
on public.folders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage files" on public.files;
create policy "Authenticated users can manage files"
on public.files
for all
to authenticated
using (true)
with check (true);
