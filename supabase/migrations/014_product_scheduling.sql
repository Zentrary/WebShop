-- 014_product_scheduling.sql
-- ตั้งเวลาเปิดขายสินค้า (scheduled publishing) + ป้าย "เร็ว ๆ นี้"
--
-- * products.publish_at  = เวลาที่สินค้าจะขึ้นเว็บเอง (null = ขายทันที)
-- * products.show_soon  = ให้โชว์เป็น "เร็ว ๆ นี้" บนหน้า /shop ก่อนถึงเวลาหรือไม่
--
-- สิ่งที่ต้องบังคับที่ฐานข้อมูล ไม่ใช่แค่ซ่อนที่หน้าจอ:
--   1) policy อ่าน products: ลูกค้าเห็นเฉพาะสินค้าที่ active และถึงเวลาแล้ว
--   2) create_order_reserved_internal: ห้ามขายสินค้าที่ยังไม่ถึงเวลาเปิดขาย

alter table public.products
  add column if not exists publish_at timestamptz,
  add column if not exists show_soon boolean not null default true;

create index if not exists products_publish_at_idx on public.products (publish_at) where active;

drop policy if exists product_read on public.products;
create policy product_read on public.products
  for select
  to anon, authenticated
  using (
    (active and (publish_at is null or publish_at <= now()))
    or is_admin()
  );

-- ตัดตอนขาย: เติมเงื่อนไข publish_at ให้ฟังก์ชันเดิม โดยไม่ต้องพิมพ์ body ใหม่ทั้งก้อน
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_order_reserved_internal';

  if def is null or def like '%publish_at%' then
    return;
  end if;

  def := replace(
    def,
    'and active for update;',
    'and active and (publish_at is null or publish_at <= now()) for update;'
  );
  execute def;
end $$;
