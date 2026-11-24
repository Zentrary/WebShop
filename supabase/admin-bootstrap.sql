






insert into public.profiles (id, username, first_name, last_name, phone)
select id,
       coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
       u.raw_user_meta_data->>'first_name',
       u.raw_user_meta_data->>'last_name',
       u.raw_user_meta_data->>'phone'
from auth.users u
where u.email = 'admin@zenmarket.store'
on conflict (id) do nothing;

insert into public.store_admin (singleton, user_id)
select true, u.id
from auth.users u
where u.email = 'admin@zenmarket.store'
on conflict (singleton) do update set user_id = excluded.user_id;


insert into public.store_settings (
  singleton, shop_name, tagline, logo_url,
  contact_email, contact_phone, contact_address,
  shipping_fee, free_shipping_threshold,
  promptpay_id, recipient_name
) values (
  true, 'ZenMarket', 'ร้านค้าออนไลน์สำหรับเจ้าของคนเดียว ด้วยความตั้งใจและความใส่ใจ',
  '/images/placeholder.svg',
  '', '', '',
  50, 300,
  '', ''
)
on conflict (singleton) do nothing;


insert into public.categories (name)
select v.name
from (values
  ('เครื่องสำอาง'),
  ('ดูแลผิวหน้า'),
  ('เพอร์นิเจอร์'),
  ('ของใช้ทั่วไป')
) as v(name)
where not exists (select 1 from public.categories c where c.name = v.name);


select
  (select count(*) from public.store_admin) as admins,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.store_settings) as settings;
