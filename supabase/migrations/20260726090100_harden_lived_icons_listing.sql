-- Public object URLs do not require a broad storage.objects SELECT policy.
-- Removing it keeps generated badges reachable by their known URLs while
-- preventing clients from listing every object in the bucket.

drop policy if exists "lived-icons public read" on storage.objects;

do $$
begin
  if not exists (
    select 1
    from storage.buckets bucket
    where bucket.id = 'lived-icons'
      and bucket.public
  ) then
    raise exception 'lived-icons must remain a public URL bucket';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.cmd = 'SELECT'
      and policy.qual ilike '%lived-icons%'
  ) then
    raise exception 'lived-icons still has a listing policy';
  end if;
end
$$;
