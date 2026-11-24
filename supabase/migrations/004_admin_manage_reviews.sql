






drop policy if exists "review_admin" on public.product_reviews;
create policy "review_admin"
  on public.product_reviews for all
  to authenticated
  using (is_admin())
  with check (is_admin());
