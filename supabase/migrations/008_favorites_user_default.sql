




alter table public.favorites alter column user_id set default auth.uid();


drop policy if exists favorites_owner_update on public.favorites;
