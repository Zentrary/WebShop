-- 005: ตารางรายการโปรด (favorites)
-- ผู้ใช้เก็บสินค้าที่ชอบไว้ ใช้ owner-scoped RLS เท่านั้น

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_product_key unique (user_id, product_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_product_id_idx on public.favorites(product_id);

alter table public.favorites enable row level security;

drop policy if exists favorites_owner_read on public.favorites;
create policy favorites_owner_read on public.favorites
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists favorites_owner_insert on public.favorites;
create policy favorites_owner_insert on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_owner_delete on public.favorites;
create policy favorites_owner_delete on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());
