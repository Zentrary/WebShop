-- ZenMarket Admin Bootstrap (ตรงกับสคีมาจริงของโปรเจกต์ njjrgklfjwgmtcoefctc)
-- ให้เจ้าของร้านรันคำสั่งนี้ใน Supabase SQL Editor หลังสร้างผู้ใช้ใน Auth แล้ว
--
-- ใช้ได้กับผู้ใช้ที่มีอยู่แล้วใน auth.users (เช่น zenadmin)
-- ผลลัพธ์: ผู้ใช้คนนั้นจะมีสิทธิ์แอดมิน (is_admin() = true)

-- ขั้นตอนที่ 1: สร้างโปรไฟล์ + สิทธิ์แอดมิน (ใช้ email ของผู้ใช้ที่ต้องการ)
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

-- ขั้นตอนที่ 2: ตั้งค่าร้านค้าเริ่มต้น (ตาราง store_settings เป็น singleton แถวเดียว)
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

-- ขั้นตอนที่ 3: หมวดหมู่เริ่มต้น (ตาราง categories มีแค่ name)
insert into public.categories (name)
select v.name
from (values
  ('เครื่องสำอาง'),
  ('ดูแลผิวหน้า'),
  ('เพอร์นิเจอร์'),
  ('ของใช้ทั่วไป')
) as v(name)
where not exists (select 1 from public.categories c where c.name = v.name);

-- ตรวจสอบผลลัพธ์
select
  (select count(*) from public.store_admin) as admins,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.store_settings) as settings;
