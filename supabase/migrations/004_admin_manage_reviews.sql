-- ZenMarket migration 004 — ให้แอดมินจัดการรีวิวได้ (ลบ/แก้ไข)
--
-- ปัญหาเดิม: ตาราง product_reviews มีแต่ policy "review_read" (SELECT) เท่านั้น
-- ปุ่ม "ลบรีวิว" ในหลังบ้านจึงถูก RLS ปฏิเสธเงียบ ๆ
--
-- ใช้กับโปรเจกต์: njjrgklfjwgmtcoefctc (MarketWeb)

drop policy if exists "review_admin" on public.product_reviews;
create policy "review_admin"
  on public.product_reviews for all
  to authenticated
  using (is_admin())
  with check (is_admin());
