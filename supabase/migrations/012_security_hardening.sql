-- 012 — ล็อกสิทธิ์ระดับตาราง/ฟังก์ชันให้แคบที่สุด (defense in depth)
--
-- ด่านหลักคือ RLS ซึ่งตอนนี้ถูกต้องแล้ว (ลูกค้าเห็นเฉพาะแถวของตัวเอง, แอดมินเห็นทั้งหมด)
-- ไฟล์นี้ลด "พื้นผิว" ที่เหลือ:
--   1) เลิกใช้ฟังก์ชัน login_email(text) เวอร์ชันเก่าที่คืนอีเมลโดยไม่ตรวจรหัสผ่าน
--   2) ฟังก์ชันที่ใช้ภายในไม่ให้ client เรียกตรง
--   3) ถอนสิทธิ์ TRUNCATE / REFERENCES / TRIGGER / MAINTAIN ที่ไม่มีใครใช้
--   4) ตารางที่เขียนผ่าน RPC เท่านั้น → ไม่ให้ anon/authenticated เขียนตรง
--   5) ยัง SELECT ได้ตามที่ RLS อนุญาต (ไม่กระทบหน้าเว็บ)

-- 1) ปิดทางเก่า -------------------------------------------------------------
drop function if exists public.login_email(text);

-- 2) ฟังก์ชันภายใน -----------------------------------------------------------
revoke all on function public.create_order_reserved_internal(jsonb, jsonb, uuid, text)
  from anon, authenticated;
revoke all on function public.admin_delete_category(text) from anon;
revoke all on function public.admin_rename_category(text, text) from anon;

-- 3) สิทธิ์ที่ไม่มีใครใช้แล้ว --------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
begin
  execute 'revoke maintain on all tables in schema public from anon, authenticated';
exception
  when others then null; -- PostgreSQL < 17 ไม่มีสิทธิ์ MAINTAIN
end $$;

-- 4) anon ไม่ต้องเขียนอะไรในแคตตาล็อก/ข้อมูลส่วนตัว ---------------------------
revoke insert, update, delete on
  public.products,
  public.categories,
  public.coupons,
  public.site_pages,
  public.store_settings,
  public.product_reviews,
  public.favorites
from anon;

-- ตารางที่เขียนผ่าน security-definer RPC เท่านั้น
revoke insert, update, delete on
  public.orders,
  public.profiles,
  public.customer_addresses,
  public.order_shipping_updates,
  public.owner_notifications,
  public.login_attempts,
  public.client_errors,
  public.operation_status,
  public.store_admin
from anon, authenticated;

-- 5) ยืนยันสิทธิ์อ่านที่ต้องใช้ (RLS ยังกรองแถวให้เอง) -------------------------
grant select on
  public.profiles,
  public.orders,
  public.customer_addresses,
  public.order_shipping_updates,
  public.owner_notifications,
  public.login_attempts,
  public.client_errors,
  public.operation_status,
  public.store_admin
to authenticated;

-- แคตตาล็อก/หน้าร้าน: anon อ่านได้ (RLS จำกัดเฉพาะสินค้าที่ active)
grant select on public.products, public.categories, public.site_pages, public.product_reviews to anon, authenticated;

comment on function public.login_email(text, text) is
  'คืนอีเมลสำหรับเข้าสู่ระบบ เฉพาะเมื่อชื่อผู้ใช้และรหัสผ่านถูกต้อง (กันการไล่เก็บอีเมลลูกค้า)';
