-- 015_new_arrivals_window.sql
-- "สินค้าใหม่" = หมวดชั่วคราวที่ระบบสร้างให้เอง
--
-- * products.new_days  = สินค้าชิ้นนี้อยู่ในหมวด "ใหม่" กี่วันหลังโพสต์ (0 = ไม่ต้องขึ้นหมวดใหม่)
-- * products.new_until = เวลาหมดอายุ คำนวณให้อัตโนมัติ (generated column)
--                        เริ่มนับจาก publish_at ถ้าตั้งเวลาไว้ ไม่งั้นนับจาก created_at
--
-- ครบกำหนดแล้วสินค้าจะหลุดจากหมวด "ใหม่" เองโดยไม่ต้องมีใครกดอะไร
-- และยังอยู่ในหมวดจริงของมัน (products.category) ตามปกติ — ไม่มีการย้ายข้อมูล

alter table public.products
  add column if not exists new_days integer not null default 7;

alter table public.products
  drop constraint if exists products_new_days_check;
alter table public.products
  add constraint products_new_days_check check (new_days between 0 and 365);

-- timestamptz + interval ไม่ immutable (ขึ้นกับ timezone/DST) จึงใช้ generated column ไม่ได้
-- ใช้คอลัมน์ธรรมดา + trigger คำนวณให้ทุกครั้งที่โพสต์/แก้เวลา
alter table public.products
  add column if not exists new_until timestamptz;

create or replace function public.products_set_new_until()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.new_until := coalesce(new.publish_at, new.created_at, now())
                 + make_interval(days => coalesce(new.new_days, 7));
  return new;
end;
$$;

drop trigger if exists products_set_new_until on public.products;
create trigger products_set_new_until
  before insert or update of publish_at, created_at, new_days
  on public.products
  for each row execute function public.products_set_new_until();

-- เติมค่าให้สินค้าที่มีอยู่แล้ว
update public.products
   set new_until = coalesce(publish_at, created_at) + make_interval(days => new_days)
 where new_until is null;

create index if not exists products_new_until_idx on public.products (new_until) where active;
