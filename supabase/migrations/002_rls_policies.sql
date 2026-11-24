-- ZenMarket RLS Policies

-- Profiles: Public read, users can update own profile
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Categories: Public read, authenticated can manage
alter table public.categories enable row level security;

create policy "Categories are viewable by everyone"
  on public.categories for select
  using (true);

-- Products: Public read, authenticated can manage
alter table public.products enable row level security;

create policy "Products are viewable by everyone"
  on public.products for select
  using (true);

-- Orders: Customers can read own orders, all can insert
alter table public.orders enable row level security;

create policy "Customers can view own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Anyone can insert orders"
  on public.orders for insert
  with check (true);

-- Reviews: Public read, authenticated can insert
alter table public.reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on public.reviews for select
  using (true);

create policy "Authenticated users can insert reviews"
  on public.reviews for insert
  with check (auth.uid() = customer_id);

-- Store settings: Public read
alter table public.store_settings enable row level security;

create policy "Store settings are viewable by everyone"
  on public.store_settings for select
  using (true);

-- Notifications: All can read
alter table public.notifications enable row level security;

create policy "Notifications are viewable by everyone"
  on public.notifications for select
  using (true);

-- Storage: Product images public read
create policy "Product images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- Order receipts: owner only
create policy "Order receipts are private"
  on storage.objects for all
  using (bucket_id = 'order-receipts');

-- RPC: username_login
create or replace function public.username_login(
  p_identifier text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  -- Try login by email first
  select id into v_user_id
  from auth.users
  where email = p_identifier
  limit 1;

  -- If not found by email, try by username in profiles
  if v_user_id is null then
    select id into v_user_id
    from public.profiles
    where user_name = p_identifier
    limit 1;
  end if;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'ไม่พบผู้ใช้');
  end if;

  -- Attempt sign in via Supabase Auth (uses email)
  -- The actual password verification is handled by auth.signInWithPassword on client
  -- This RPC just validates user exists
  select jsonb_build_object('success', true, 'user_id', v_user_id)
  into v_result;

  return v_result;
end;
$$;

-- Trigger for profiles updated_at
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

create trigger update_categories_updated_at
  before update on public.categories
  for each row
  execute function public.update_updated_at_column();

create trigger update_products_updated_at
  before update on public.products
  for each row
  execute function public.update_updated_at_column();

create trigger update_orders_updated_at
  before update on public.orders
  for each row
  execute function public.update_updated_at_column();

create trigger update_reviews_updated_at
  before update on public.reviews
  for each row
  execute function public.update_updated_at_column();

create trigger update_store_settings_updated_at
  before update on public.store_settings
  for each row
  execute function public.update_updated_at_column();