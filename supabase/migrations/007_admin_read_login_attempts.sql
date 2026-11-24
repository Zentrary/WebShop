


drop policy if exists login_attempts_owner_read on public.login_attempts;
create policy login_attempts_owner_read on public.login_attempts
  for select
  to authenticated
  using (public.is_admin());
