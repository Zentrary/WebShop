-- 010 — ให้สิทธิ์ตาราง product_reviews ตรงกับ policy ที่มีอยู่
--
-- ปัญหา: ตารางนี้มี RLS policy ครบ (อ่านได้ทุกคน, เขียน/ลบเฉพาะ admin) แต่ไม่เคย
-- GRANT ให้ role anon/authenticated ทำให้ PostgREST ตอบ 42501 permission denied
-- หน้า admin/reviews.html และหน้ารายละเอียดสินค้าจึงเห็นรีวิวว่างเสมอ
-- (หน้าแรกยังเห็นได้เพราะอ่านผ่าน get_home_reviews() ที่เป็น security definer)

grant select on table public.product_reviews to anon, authenticated;
grant insert, update, delete on table public.product_reviews to authenticated;

comment on table public.product_reviews is 'รีวิวสินค้า — RLS คุมสิทธิ์: อ่านได้ทุกคน เขียน/ลบเฉพาะ admin';
