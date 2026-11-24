-- ZenMarket Admin Bootstrap
-- สคริปต์ตั้งค่าบัญชีเจ้าของร้านคนเดียวอย่างปลอดภัยด้วยตนเอง
-- ให้เจ้าของร้านรันคำสั่งนี้ใน Supabase SQL Editor หลังจากสร้างโปรเจกต์แล้ว

-- ขั้นตอนที่ 1: สร้างผู้ใช้ใน Auth (ทำผ่าน Supabase Dashboard Authentication > Users)
-- หรือใช้คำสั่งด้านล่างผ่าน Supabase CLI:
--   supabase auth users create --email admin@zenmarket.store --password 'ChangeMe123!'

-- ขั้นตอนที่ 2: สร้างโปรไฟล์สำหรับเจ้าของร้าน
insert into public.profiles (id, user_name, full_name, role, email)
select id, 'admin', 'เจ้าของร้าน ZenMarket', 'owner', email
from auth.users
where email = 'admin@zenmarket.store'
on conflict (id) do nothing;

-- ขั้นตอนที่ 3: ตั้งค่าร้านค้าเริ่มต้น
insert into public.store_settings (
  store_name, store_logo, store_description,
  contact_email, contact_phone, contact_line,
  contact_facebook, contact_instagram, contact_tiktok,
  shipping_fee, free_shipping_threshold,
  enable_cod, enable_promptpay,
  terms_and_conditions, privacy_policy
) values (
  'ZenMarket',
  '/public/images/placeholder.svg',
  'ร้านค้าออนไลน์สำหรับเจ้าของคนเดียว ด้วยความตั้งใจและความใส่ใจ',
  'admin@zenmarket.store',
  '',
  '',
  '',
  '',
  '',
  50,
  500,
  true,
  true,
  'ข้อกำหนดและเงื่อนไขการใช้บริการ',
  'นโยบายความเป็นส่วนตัว'
) on conflict (id) do nothing;

-- ขั้นตอนที่ 4: สร้างหมวดหมู่เริ่มต้น
insert into public.categories (name, icon, description, sort_order) values
  ('อุปกรณ์อิเล็กทรอนิกส์', 'Package', 'สินค้าอิเล็กทรอนิกส์และ gadget ต่างๆ', 1),
  ('เสื้อผ้าและแฟชั่น', 'ShoppingBag', 'เสื้อผ้า เครื่องแต่งกาย และแฟชั่น', 2),
  ('ของใช้ในบ้าน', 'Home', 'ของใช้ในบ้านและครัวเรือน', 3),
  ('ผลิตภัณฑ์ความงาม', 'Star', 'สกินแคร์และผลิตภัณฑ์ความงาม', 4),
  ('หนังสือและสื่อการเรียน', 'Book', 'หนังสือและสื่อการเรียนการสอน', 5)
on conflict do nothing;