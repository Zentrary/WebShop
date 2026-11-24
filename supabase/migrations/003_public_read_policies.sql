-- ZenMarket migration 003 — แก้ RLS ให้ผู้เยี่ยมชม (ยังไม่ล็อกอิน) อ่านสินค้าและรีวิวได้
--
-- ปัญหาเดิม: policy "product_read" / "review_read" ผูกกับ role `authenticated` เท่านั้น
-- ทำให้ผู้เยี่ยมชมหน้าร้าน (anon) ไม่เห็นสินค้าเลย และรีวิวบนหน้าแรกไม่แสดง
--
-- ใช้กับโปรเจกต์: njjrgklfjwgmtcoefctc (MarketWeb)

drop policy if exists "product_read" on public.products;
create policy "product_read"
  on public.products for select
  to anon, authenticated
  using (active or is_admin());

drop policy if exists "review_read" on public.product_reviews;
create policy "review_read"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "product_admin" on public.products;
create policy "product_admin"
  on public.products for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- หมายเหตุ: การเขียน/ลบสินค้า หมวดหมู่ รีวิว และการแก้ไข store_settings
-- ทำได้เฉพาะผู้ที่มีอยู่ในตาราง store_admin เท่านั้น (ฟังก์ชัน is_admin())
