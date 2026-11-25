-- 016_remove_scheduled_publishing.sql
-- ถอดระบบ "ตั้งเวลาเปิดขาย" (publish_at / show_soon) ออกทั้งหมด
-- เก็บไว้เฉพาะหมวด "สินค้าใหม่" (new_days / new_until) ที่ใช้งานจริง
--
-- ลำดับสำคัญ: ต้องแก้ trigger + policy + ฟังก์ชันสั่งซื้อ "ก่อน" ลบคอลัมน์
-- ไม่งั้นของที่ยังอ้าง publish_at จะพังตอนรัน

-- 1) new_until ไม่ต้องพึ่ง publish_at อีก (นับจากวันโพสต์เท่านั้น)
create or replace function public.products_set_new_until()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.new_until := coalesce(new.created_at, now()) + make_interval(days => coalesce(new.new_days, 7));
  return new;
end;
$$;

drop trigger if exists products_set_new_until on public.products;
create trigger products_set_new_until
  before insert or update of created_at, new_days
  on public.products
  for each row execute function public.products_set_new_until();

-- 2) คืน policy อ่านสินค้าเป็นแบบก่อนมีระบบตั้งเวลา
drop policy if exists product_read on public.products;
create policy product_read on public.products
  for select
  to anon, authenticated
  using (active or is_admin());

-- 3) คืนฟังก์ชันสั่งซื้อ (ไม่ต้องเช็กเวลาเปิดขายอีก)
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_order_reserved_internal';

  if def is null or def not like '%publish_at%' then
    return;
  end if;

  def := replace(
    def,
    'and active and (publish_at is null or publish_at <= now()) for update;',
    'and active for update;'
  );
  execute def;
end $$;

-- 4) ลบคอลัมน์และดัชนีของระบบเดิม (ตรวจแล้ว 0 แถวใช้งาน)
drop index if exists public.products_publish_at_idx;
alter table public.products drop column if exists show_soon;
alter table public.products drop column if exists publish_at;

-- 5) คำนวณหน้าต่าง "ใหม่" ใหม่ให้ทุกแถว
update public.products
   set new_until = coalesce(created_at, now()) + make_interval(days => new_days);
