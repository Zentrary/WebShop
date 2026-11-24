-- 009 — Category management for the shop owner.
--
-- The back office can now rename a category (products follow through the
-- existing ON UPDATE CASCADE on products_category_fk) and delete one without
-- leaving products pointing at a category that no longer exists.
-- Both functions are SECURITY DEFINER and refuse to run for anyone who is not
-- a store admin, matching the RLS rules on public.categories.

create or replace function public.admin_rename_category(p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old text := btrim(coalesce(p_old, ''));
  v_new text := btrim(coalesce(p_new, ''));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ต้องเป็นเจ้าของร้านเท่านั้น';
  end if;

  if v_old = '' or v_new = '' then
    raise exception 'กรุณากรอกชื่อหมวดหมู่';
  end if;
  if char_length(v_new) > 80 then
    raise exception 'ชื่อหมวดหมู่ยาวเกิน 80 ตัวอักษร';
  end if;
  if v_new = 'ทั้งหมด' then
    raise exception 'ชื่อหมวดหมู่นี้ถูกสงวนไว้';
  end if;
  if v_old = v_new then
    return;
  end if;
  if not exists (select 1 from public.categories where name = v_old) then
    raise exception 'ไม่พบหมวดหมู่นี้';
  end if;
  if exists (select 1 from public.categories where name = v_new) then
    raise exception 'มีหมวดหมู่นี้อยู่แล้ว';
  end if;

  update public.categories set name = v_new where name = v_old;
end;
$$;

revoke all on function public.admin_rename_category(text, text) from public;
grant execute on function public.admin_rename_category(text, text) to authenticated;

create or replace function public.admin_delete_category(p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ต้องเป็นเจ้าของร้านเท่านั้น';
  end if;

  if v_name = '' then
    raise exception 'ไม่พบหมวดหมู่นี้';
  end if;

  -- products.category is nullable and ON DELETE RESTRICT, so products are
  -- moved to "no category" before the row disappears.
  update public.products set category = null where category = v_name;
  delete from public.categories where name = v_name;
end;
$$;

revoke all on function public.admin_delete_category(text) from public;
grant execute on function public.admin_delete_category(text) to authenticated;
