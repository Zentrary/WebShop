-- 007: ให้แอดมินอ่านตาราง login_attempts ได้ (เพื่อแสดงในหน้า Operations)
-- ตารางนี้ถูกจำกัดเขียนผ่าน RPC login_allow เท่านั้น

drop policy if exists login_attempts_owner_read on public.login_attempts;
create policy login_attempts_owner_read on public.login_attempts
  for select
  to authenticated
  using (public.is_admin());
