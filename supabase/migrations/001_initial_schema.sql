



create extension if not exists pgcrypto;


create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  user_name text unique,
  full_name text,
  phone text,
  email text,
  address text,
  subdistrict text,
  district text,
  province text,
  postal_code text,
  avatar_url text,
  role text default 'customer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default 'Package',
  description text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  images text[] default '{}',
  is_active boolean default true,
  is_featured boolean default false,
  sku text,
  weight_gram integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id),
  customer_name text not null,
  customer_phone text,
  customer_email text,
  shipping_address text,
  postal_code text,
  payment_method text not null default 'promptpay',
  payment_status text not null default 'pending',
  order_status text not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  tracking_number text,
  items jsonb default '[]',
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  customer_id uuid references public.profiles(id),
  customer_name text,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_text text,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.store_settings (
  id uuid default gen_random_uuid() primary key,
  store_name text default 'ZenMarket',
  store_logo text,
  store_description text,
  contact_email text,
  contact_phone text,
  contact_line text,
  contact_facebook text,
  contact_instagram text,
  contact_tiktok text,
  shipping_fee integer default 50,
  free_shipping_threshold integer default 500,
  enable_cod boolean default true,
  enable_promptpay boolean default true,
  promptpay_id text,
  promptpay_name text,
  store_address text,
  store_tax_id text,
  terms_and_conditions text,
  privacy_policy text,
  maintenance_mode boolean default false,
  maintenance_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text,
  type text default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);


insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', false)
on conflict (id) do nothing;