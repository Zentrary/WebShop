-- 008: แก้บั๊ก favorites.user_id ไม่มี default
-- ตาราง favorites สร้างด้วย user_id uuid not null (ไม่มี default)
-- → เมื่อ client insert แค่ { product_id } จะได้ not-null violation
-- แก้โดยให้ default เป็น auth.uid() (RLS ยังคุมได้ด้วย with check user_id = auth.uid())

alter table public.favorites alter column user_id set default auth.uid();

-- กันไว้ให้ชัดเจนว่าตารางนี้เป็น owner-scoped เท่านั้น
drop policy if exists favorites_owner_update on public.favorites;
