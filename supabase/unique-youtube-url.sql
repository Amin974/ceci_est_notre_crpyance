-- Bloque les doublons d'URL YouTube tout en autorisant plusieurs fichiers sans URL.
-- Si ce script echoue, corrigez d'abord les doublons existants retournes par la requete ci-dessous.

select lower(btrim(youtube_url)) as youtube_url, count(*) as duplicate_count
from public.files
where youtube_url is not null
group by lower(btrim(youtube_url))
having count(*) > 1;

create unique index if not exists files_youtube_url_unique_idx
on public.files (lower(btrim(youtube_url)))
where youtube_url is not null;
