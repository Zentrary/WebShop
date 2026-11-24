






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



