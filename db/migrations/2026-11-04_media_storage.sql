alter table media_assets
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists storage_bytes bigint,
  add column if not exists storage_mime_type text,
  add column if not exists storage_sha256 text,
  add column if not exists copy_status text default 'pending',
  add column if not exists copy_error text,
  add column if not exists copied_at timestamptz;

create index if not exists media_assets_copy_status_idx
  on media_assets(copy_status);
